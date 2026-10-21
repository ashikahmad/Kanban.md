// Read-side queries over a board: compact, filterable, paginated. Pure: take the two file texts,
// return plain JSON-able objects. The CLI and the MCP server are thin wrappers around these.
//
// Compactness is the point (an agent pays for every byte it reads):
//   - a board listing returns summaries, never descriptions, subtasks or notes
//   - empty fields are omitted (an absent key means "empty")
//   - filtering and paging happen here, not in the agent's context
//   - the archive is only read when asked for
import { parseBoard, parseArchive, orderedTasks } from './board.js';
import { BoardError, etagOf } from './text.js';
import { Doc, blocksOf } from './patch.js';
import { localToday, dayNumber } from './dates.js';
import { getHousekeeping } from './housekeeping.js';
import { resolveHousekeeping } from './housekeeping-spec.js';

export { localToday };

export const TASK_VIEW_FIELDS = ['id', 'title', 'status', 'order', 'priority', 'category', 'assignees', 'tags', 'created', 'started', 'due',
    'completed', 'description', 'subtasks', 'notes', 'extra', 'progress', 'etag'];
const SUMMARY_FIELDS = ['id', 'title', 'status', 'priority', 'assignees', 'due', 'tags'];
const MAX_LIMIT = 500, DEFAULT_LIMIT = 50, STATS_LIST_CAP = 20;

const fail = (code, message, extra) => { throw new BoardError(code, message, extra); };
const clean = (p) => p.replace(/[^\w\s]+/, '').trim();
const empty = (v) => v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0);
const list = (v) => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : String(v).split(','));
const norm = (s) => String(s).trim().toLowerCase();
// "@bob (Bob Ito)" -> "bob"
const userKey = (u) => norm(u).replace(/^@/, '').replace(/[\s(].*$/, '');

// Same rule as the page's deadline badge: 'overdue' (due before today), 'soon' (within 2 days,
// today included), or null. A task with a Finished date is never flagged.
export function dueStatus(task, today) {
    if (!task.due || task.completed) return null;
    const due = dayNumber(task.due.trim()), now = dayNumber(today);
    if (due === null || now === null) return null;
    const days = due - now;
    return days < 0 ? 'overdue' : days <= 2 ? 'soon' : null;
}

// ---- loading ----------------------------------------------------------------------------------

function load(ws) {
    const bp = parseBoard(ws.board);
    const ap = typeof ws.archive === 'string' ? parseArchive(ws.archive, bp.config.columns) : { tasks: [], formatVersion: null };
    return { bp, ap, ws };
}

function etags(text, kind) {
    if (typeof text !== 'string') return new Map();
    const doc = new Doc(text);
    return new Map(blocksOf(doc, kind).map((b) => [b.id, etagOf(doc.lines.slice(b.start, b.end).join(''))]));
}

// ---- field selection --------------------------------------------------------------------------

// `fields` replaces the default set; id is always kept (and first).
function fieldList(fields, fallback) {
    const given = !(fields === undefined || fields === null || fields === '');
    const want = given ? list(fields).map((f) => String(f).trim()).filter(Boolean) : fallback;
    for (const f of want) if (!TASK_VIEW_FIELDS.includes(f)) fail('invalid_field', `Unknown field "${f}"`, { valid: TASK_VIEW_FIELDS });
    return { fields: ['id', ...want.filter((f) => f !== 'id')], given };
}

function view(task, fields, etag, extra = {}) {
    const out = {};
    for (const f of fields) {
        let v;
        if (f === 'progress') v = task.subtasks.length ? `${task.subtasks.filter((s) => s.completed).length}/${task.subtasks.length}` : '';
        else if (f === 'etag') v = etag;
        else v = task[f];
        if (f === 'id' || !empty(v)) out[f] = v;
    }
    return { ...out, ...extra };
}

// ---- filtering --------------------------------------------------------------------------------

function makeFilter(q, config, today) {
    const statuses = list(q.status).map((s) => String(s).trim()).filter(Boolean);
    const ids = config.columns.map((c) => c.id);
    for (const s of statuses) if (!ids.includes(s)) fail('unknown_status', `Unknown status "${s}"`, { valid: ids });
    const assignees = list(q.assignee).map(userKey).filter(Boolean);
    const tags = list(q.tag).map((t) => norm(t).replace(/^#/, '')).filter(Boolean);
    const priorities = list(q.priority).map((p) => norm(clean(String(p)))).filter(Boolean);
    const categories = list(q.category).map(norm).filter(Boolean);
    const terms = norm(q.text || '').split(/\s+/).filter(Boolean);
    let dueBefore = null;
    if (q.dueBefore !== undefined && q.dueBefore !== null && q.dueBefore !== '') {
        if (dayNumber(String(q.dueBefore)) === null) fail('invalid_date', 'dueBefore must be YYYY-MM-DD', { hint: `Got "${q.dueBefore}".` });
        dueBefore = String(q.dueBefore);
    }
    return (t) => {
        if (statuses.length && !statuses.includes(t.status)) return false;
        if (assignees.length && !assignees.some((a) => t.assignees.some((u) => userKey(u) === a))) return false;
        if (tags.length && !tags.every((g) => t.tags.some((x) => norm(x).replace(/^#/, '') === g))) return false;
        if (priorities.length && !priorities.includes(norm(clean(t.priority)))) return false;
        if (categories.length && !categories.includes(norm(t.category))) return false;
        if (dueBefore && !(t.due && t.due < dueBefore)) return false;
        if (q.overdue && dueStatus(t, today) !== 'overdue') return false;
        if (terms.length) {
            const hay = norm([t.id, t.title, t.description, t.notes, t.category, t.tags.join(' ')].join(' \n '));
            if (!terms.every((w) => hay.includes(w))) return false;
        }
        return true;
    };
}

function page(rows, q) {
    const limit = q.limit === undefined || q.limit === null ? DEFAULT_LIMIT : Number(q.limit);
    const offset = q.offset === undefined || q.offset === null ? 0 : Number(q.offset);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) fail('invalid_field', `limit must be 1 to ${MAX_LIMIT}`);
    if (!Number.isInteger(offset) || offset < 0) fail('invalid_field', 'offset must be 0 or more');
    const slice = rows.slice(offset, offset + limit);
    return { slice, meta: { total: rows.length, returned: slice.length, offset, ...(offset + limit < rows.length && { nextOffset: offset + limit }) } };
}

// ---- queries ----------------------------------------------------------------------------------

// Board listing: summaries in display order, filtered and paged.
export function getBoard(ws, q = {}, { today = localToday() } = {}) {
    const { bp } = load(ws);
    const { fields, given } = fieldList(q.fields, SUMMARY_FIELDS.concat('etag'));
    const match = makeFilter(q, bp.config, today);
    const tags = etags(ws.board, 'board');
    const all = orderedTasks(bp.tasks);
    const { slice, meta } = page(all.filter(match), q);
    const counts = Object.fromEntries(bp.config.columns.map((c) => [c.id, 0]));
    for (const t of bp.tasks) counts[t.status] = (counts[t.status] || 0) + 1;
    return {
        rev: etagOf(ws.board),
        ...meta,
        columns: bp.config.columns.map((c) => ({ id: c.id, name: c.name, count: counts[c.id] })),
        tasks: slice.map((t) => view(t, fields, tags.get(t.id), !given && t.order !== null ? { order: t.order } : {})),
    };
}

const normId = (id) => {
    const m = /^(?:task-)?(\d+)$/i.exec(String(id).trim());
    return m ? 'TASK-' + m[1].padStart(3, '0') : String(id).trim();
};

// One task in full (or just `fields`), from the board or the archive.
export function getTask(ws, id, q = {}) {
    const { bp, ap } = load(ws);
    const want = normId(id);
    let task = bp.tasks.find((t) => t.id === want), archived = false;
    if (!task) { task = ap.tasks.find((t) => t.id === want); archived = !!task; }
    if (!task) fail('unknown_task', `No task ${id}`, { hint: 'Ids look like TASK-014. Use get_board with filters to find one.' });
    const { fields } = fieldList(q.fields, TASK_VIEW_FIELDS.filter((f) => f !== 'progress'));
    const tag = etags(archived ? ws.archive : ws.board, archived ? 'archive' : 'board').get(task.id);
    return view(task, fields, tag, archived ? { archived: true } : {});
}

export function getConfig(ws) {
    const { bp, ap } = load(ws);
    const c = bp.config;
    return {
        title: c.boardTitle,
        rev: etagOf(ws.board),
        formatVersion: bp.formatVersion,
        ...(bp.formatVersion < 3 && { migrationNeeded: true, hint: 'Edits need format v3: run `kanbanmd migrate`.' }),
        lastTaskId: c.lastTaskId,
        columns: c.columns.map((x) => ({ id: x.id, name: x.name })),
        categories: c.categories,
        users: c.users,
        priorities: c.priorities.map(clean),
        tags: c.tags,
        housekeeping: resolveHousekeeping(bp.config),
        manualOrder: bp.tasks.some((t) => t.order !== null),
        tasks: bp.tasks.length,
        archived: ap.tasks.length,
    };
}

export function listArchive(ws, q = {}, { today = localToday() } = {}) {
    const { bp, ap } = load(ws);
    const { fields } = fieldList(q.fields, SUMMARY_FIELDS.concat('etag'));
    const match = makeFilter(q, bp.config, today);
    const tags = etags(ws.archive, 'archive');
    let rows = ap.tasks.filter(match);
    if (q.reverse) rows = [...rows].reverse();
    const { slice, meta } = page(rows, q);
    return { ...meta, tasks: slice.map((t) => view(t, fields, tags.get(t.id))) };
}

export function getStats(ws, { today = localToday() } = {}) {
    const { bp, ap } = load(ws);
    const tally = (keyOf) => {
        const out = {};
        for (const t of bp.tasks) for (const k of [].concat(keyOf(t))) if (k) out[k] = (out[k] || 0) + 1;
        return out;
    };
    const byStatus = Object.fromEntries(bp.config.columns.map((c) => [c.id, 0]));
    for (const t of bp.tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    // The lists are capped so the call stays small on a big board; the count says how many exist.
    const flagged = (kind) => orderedTasks(bp.tasks).filter((t) => dueStatus(t, today) === kind)
        .sort((a, b) => a.due.localeCompare(b.due));
    const row = (t) => ({ id: t.id, title: t.title, due: t.due, status: t.status });
    const overdue = flagged('overdue'), soon = flagged('soon');
    const hk = getHousekeeping(ws, { today });
    return {
        rev: etagOf(ws.board),
        today,
        total: bp.tasks.length,
        archived: ap.tasks.length,
        byStatus,
        byAssignee: tally((t) => t.assignees.map((a) => '@' + userKey(a))),
        unassigned: bp.tasks.filter((t) => !t.assignees.length).length,
        byPriority: tally((t) => clean(t.priority)),
        overdue: overdue.slice(0, STATS_LIST_CAP).map(row),
        ...(overdue.length > STATS_LIST_CAP && { overdueTotal: overdue.length }),
        dueSoon: soon.slice(0, STATS_LIST_CAP).map(row),
        ...(soon.length > STATS_LIST_CAP && { dueSoonTotal: soon.length }),
        ...(hk.suggestions.length && { housekeeping: hk.suggestions }),
    };
}

// Entries of the activity log (see io/node-fs.js) after `since`, compacted. Edits made through the
// page are not logged, so `rev` (changes with any edit) is the authoritative "did it change?".
export function summarizeChanges(entries, { since, rev, limit = 200 } = {}) {
    const rows = entries.filter((e) => !since || e.ts > since);
    const cut = rows.slice(-limit);
    return {
        rev,
        ...(rows.length > cut.length && { truncated: rows.length - cut.length }),
        changes: cut.map((e) => ({ ts: e.ts, actor: e.actor, op: e.op, ...(e.id && { id: e.id }) })),
        note: 'Page edits are not logged; compare rev to detect any change.',
    };
}
