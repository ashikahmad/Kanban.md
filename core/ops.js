// Board operations: validate, apply as minimal text patches, verify.
//
//   applyOp({ board, archive }, op) -> { board, archive, files, changed, result }
//
// Each op does two independent things: it updates an in-memory copy of the parsed state (the
// "expected" result, per the format's own rules) and it patches the raw text surgically. Before
// anything is returned the patched text is re-parsed and must equal the expected state exactly;
// otherwise nothing is written and a verify_failed error is raised. The text and the state are
// computed separately on purpose: that is what makes the verify step meaningful.
import { parseBoard, parseArchive, generateArchive, generateTaskBlock, normalizeConfig, orderedTasks } from './board.js';
import { BoardError, firstDifference, etagOf, stripEol, toEol } from './text.js';
import * as P from './patch.js';

export const DEFAULT_ARCHIVE_STRINGS = { title: '# Task Archive', desc: '> Archived tasks', section: '## ✅ Archives' };
export const TASK_FIELDS = ['title', 'status', 'order', 'priority', 'category', 'assignees', 'tags', 'created', 'started', 'due', 'completed', 'description', 'subtasks', 'notes'];
export const OP_TYPES = ['createTask', 'updateTask', 'moveTask', 'sortTasks', 'toggleSubtask', 'addSubtask', 'appendNote', 'archiveTask', 'restoreTask', 'deleteTask', 'setConfigList', 'setColumns'];
const CONFIG_LISTS = ['categories', 'users', 'priorities', 'tags'];

const clone = (v) => JSON.parse(JSON.stringify(v));
const todayISO = () => new Date().toISOString().slice(0, 10);
// Same cleaning the page applies to priority entries ("🔴 Critical" -> "Critical").
export const cleanPriority = (p) => p.replace(/[^\w\s]+/, '').trim();

// ---- validation / normalization of field values -----------------------------------------------

function fail(code, message, extra) { throw new BoardError(code, message, extra); }
const isStr = (v) => typeof v === 'string';
const oneLine = (v, what) => {
    if (!isStr(v)) fail('invalid_field', `${what} must be a string`);
    const s = v.trim();
    if (/[\r\n]/.test(s)) fail('invalid_field', `${what} must be a single line`);
    return s;
};
const list = (v, what) => {
    const arr = Array.isArray(v) ? v : isStr(v) ? v.split(',') : fail('invalid_field', `${what} must be an array or a comma separated string`);
    return arr.map((x) => oneLine(x, what)).filter(Boolean);
};

export function normalizeFields(input, config, { partial }) {
    const out = {};
    for (const key of Object.keys(input)) {
        if (!TASK_FIELDS.includes(key)) fail('unknown_field', `Unknown task field "${key}"`, { valid: TASK_FIELDS });
    }
    const has = (k) => input[k] !== undefined;
    if (has('title')) {
        out.title = oneLine(input.title, 'title');
        if (!out.title) fail('invalid_field', 'title must not be empty');
    } else if (!partial) fail('missing_field', 'title is required');

    if (has('status')) {
        out.status = oneLine(input.status, 'status');
        const ids = config.columns.map((c) => c.id);
        if (!ids.includes(out.status)) fail('unknown_status', `Unknown status "${out.status}"`, { valid: ids, hint: 'Use a column id from the board configuration.' });
    }
    if (has('order')) {
        const v = input.order;
        if (v === '' || v === null) out.order = null;
        else {
            const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? parseInt(v, 10) : v;
            if (!Number.isInteger(n) || n < 0) fail('invalid_field', 'order must be a non-negative integer, or empty to clear it');
            out.order = n;
        }
    }
    if (has('priority')) {
        out.priority = oneLine(input.priority, 'priority');
        if (out.priority) {
            const valid = (config.priorities || []).map(cleanPriority);
            if (!/^\w+$/.test(out.priority) || (valid.length && !valid.includes(out.priority))) {
                fail('unknown_priority', `Unknown priority "${out.priority}"`, { valid });
            }
        }
    }
    if (has('category')) {
        out.category = oneLine(input.category, 'category');
        if (out.category.includes('|')) fail('invalid_field', 'category must not contain "|"');
    }
    if (has('assignees')) {
        out.assignees = list(input.assignees, 'assignees');
        if (out.assignees.some((a) => a.includes(','))) fail('invalid_field', 'assignee names must not contain ","');
    }
    if (has('tags')) {
        const tags = list(Array.isArray(input.tags) ? input.tags : isStr(input.tags) ? input.tags.split(/[\s,]+/) : input.tags, 'tags').map((t) => (t.startsWith('#') ? t : '#' + t));
        for (const t of tags) if (!/^#[\w-]+$/.test(t)) fail('invalid_tag', `Invalid tag "${t}"`, { hint: 'Tags are letters, digits, "_" and "-".' });
        out.tags = [...new Set(tags)];
    }
    for (const key of ['created', 'started', 'due', 'completed']) {
        if (!has(key)) continue;
        const v = oneLine(input[key], key);
        if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)))) fail('invalid_date', `${key} must be YYYY-MM-DD`, { hint: `Got "${v}".` });
        out[key] = v;
    }
    if (has('description')) {
        if (!isStr(input.description)) fail('invalid_field', 'description must be a string');
        const lines = input.description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        for (const l of lines) {
            if (/^#{1,6}\s/.test(l)) fail('invalid_description', 'description must not contain markdown headings', { hint: `Offending line: "${l}"` });
            if (/^\*\*(Status|Priority|Category|Assigned|Created|Started|Due|Finished|Tags|Subtasks|Notes|Links|Review|Dependencies)\*\*/.test(l) || /\*\*Notes\*\*:\s*$/.test(l)) {
                fail('invalid_description', 'description must not start a line with a field or section label', { hint: `Offending line: "${l}"` });
            }
        }
        out.description = lines.join('\n');
    }
    if (has('subtasks')) {
        if (!Array.isArray(input.subtasks)) fail('invalid_field', 'subtasks must be an array of { text, completed }');
        out.subtasks = input.subtasks.map((s) => ({ completed: !!s.completed, text: oneLine(isStr(s) ? s : s.text, 'subtask text') }));
        if (out.subtasks.some((s) => !s.text)) fail('invalid_field', 'subtask text must not be empty');
    }
    if (has('notes')) {
        if (!isStr(input.notes)) fail('invalid_field', 'notes must be a string');
        out.notes = noteText(input.notes);
    }
    return out;
}

function noteText(v) {
    const s = v.replace(/\s+$/, '').replace(/^(\s*\r?\n)+/, '');
    if (s.split(/\r?\n/).some((l) => /^###\s+TASK-\d+\s*\|/.test(l))) fail('invalid_notes', 'notes must not contain a task header line');
    return s.replace(/\r\n/g, '\n');
}

// The file format stores priority, category and assignees on ONE line and the parser only reads
// them together, so a priority without a category (or the reverse) would be lost on save.
function checkMeta(t) {
    if (!!t.priority !== !!t.category || (t.assignees.length && !t.category)) {
        fail('meta_incomplete', 'priority and category must be set together (assignees need both)', {
            hint: 'The file format keeps them on one line and reads them only as a group. Set both, or clear all three.',
        });
    }
}

// ---- context ----------------------------------------------------------------------------------

function open(ws) {
    const bp = parseBoard(ws.board);
    if (!bp.formatV2) {
        fail('needs_migration', 'kanban.md uses the legacy (V1) format', { hint: 'Open the board once in the app (it migrates to V2 with a backup), or run `kanbanmd migrate`.' });
    }
    const hasArchive = typeof ws.archive === 'string';
    const ap = hasArchive ? parseArchive(ws.archive, bp.config.columns) : { tasks: [], formatV2: true };
    return {
        board: new P.Doc(ws.board),
        archive: hasArchive ? new P.Doc(ws.archive) : null,
        archiveV2: ap.formatV2,
        state: { config: clone(bp.config), tasks: clone(bp.tasks), archive: clone(ap.tasks) },
        origin: ws,
    };
}

function archiveDoc(ctx) {
    if (!ctx.archive) {
        ctx.archive = new P.Doc(toEol(generateArchive([], DEFAULT_ARCHIVE_STRINGS), ctx.board.eol)); // same line endings as the board
        ctx.archiveV2 = true;
        return ctx.archive;
    }
    const hasTasks = P.findBlocks(ctx.archive.lines).length > 0;
    if (!ctx.archiveV2) {
        if (hasTasks) fail('needs_migration', 'archive.md uses the legacy format', { hint: 'Open the board once in the app (it migrates with a backup), or run `kanbanmd migrate`.' });
        P.insertMarker(ctx.archive);
        ctx.archiveV2 = true;
    }
    return ctx.archive;
}

function findTask(ctx, id) {
    const norm = /^TASK-\d+$/i.test(id || '') ? 'TASK-' + id.slice(5).padStart(3, '0') : id;
    const inBoard = ctx.state.tasks.find((t) => t.id === norm);
    if (inBoard) return { task: inBoard, kind: 'board', doc: ctx.board };
    const inArchive = ctx.state.archive.find((t) => t.id === norm);
    if (inArchive) return { task: inArchive, kind: 'archive', doc: ctx.archive };
    fail('unknown_task', `No task ${id}`, { hint: 'Ids look like TASK-014.' });
}

function locate(ctx, found) {
    const loc = P.locateTask(found.doc, found.kind, found.task.id);
    if (!loc) fail('ambiguous_id', `${found.task.id} appears more than once in ${found.kind === 'board' ? 'kanban.md' : 'archive.md'}`, { hint: 'Fix the duplicate id by hand first.' });
    return loc;
}

function checkEtag(ctx, found, op) {
    if (!op.ifMatch) return;
    const current = etagOf(P.blockText(found.doc, locate(ctx, found)));
    if (current !== op.ifMatch) fail('conflict', `${found.task.id} changed since you read it`, { details: { current, task: found.task } });
}

// ---- patching a task from a before/after pair -------------------------------------------------

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function patchFields(ctx, found, before, after) {
    const doc = found.doc, kind = found.kind, id = before.id;
    const loc = () => locate(ctx, found);
    try {
        if (before.title !== after.title) P.setTitle(doc, loc(), after.title);
        if (before.status !== after.status) P.setStatus(doc, loc(), after.status);
        if (before.order !== after.order) P.setOrder(doc, loc(), after.order);
        if (before.priority !== after.priority || before.category !== after.category || !same(before.assignees, after.assignees)) P.setMeta(doc, loc(), after);
        if (['created', 'started', 'due', 'completed'].some((k) => before[k] !== after[k])) P.setDates(doc, loc(), after);
        if (!same(before.tags, after.tags)) P.setTags(doc, loc(), after.tags);
        if (before.description !== after.description) P.setDescription(doc, loc(), after.description);
        if (!same(before.subtasks, after.subtasks)) P.setSubtasks(doc, loc(), after.subtasks);
        if (before.notes !== after.notes) P.setNotes(doc, loc(), after.notes);
    } catch (e) {
        if (!(e instanceof P.Fallback)) throw e;
        P.replaceBlock(doc, loc(), after); // this one block only, canonical layout
    }
}

// ---- manual ordering --------------------------------------------------------------------------
// Optional **Order** keys decide the display order within a column (see orderedTasks in board.js).
// Ordering is "on" as soon as any board task carries a key. While it is on, positional moves write a
// key instead of relocating a block, so a reorder is a one- or two-line diff.
const STEP = 1000;
const orderActive = (tasks) => tasks.some((t) => t.order != null);

function setKey(ctx, task, key) {
    const loc = P.locateTask(ctx.board, 'board', task.id);
    if (!loc) fail('ambiguous_id', `${task.id} appears more than once in kanban.md`, { hint: 'Fix the duplicate id by hand first.' });
    task.order = key;
    P.setOrder(ctx.board, loc, key);
}

// Give every key-less task a key after the existing ones (in file order), so a new or hand-added
// task cannot sort ahead of a position that is about to be set.
function ensureKeys(ctx) {
    const tasks = ctx.state.tasks;
    if (!orderActive(tasks)) return;
    let max = Math.max(...tasks.filter((t) => t.order != null).map((t) => t.order));
    for (const t of tasks) if (t.order == null) setKey(ctx, t, (max += STEP));
}

// ---- the ops ----------------------------------------------------------------------------------

function maxId(ctx) {
    return [...ctx.state.tasks, ...ctx.state.archive].reduce((m, t) => Math.max(m, parseInt((t.id.match(/(\d+)$/) || [])[1], 10) || 0), 0);
}

const OPS = {
    createTask(ctx, op, env) {
        const f = normalizeFields(op.task || fail('missing_field', 'createTask needs a "task" object'), ctx.state.config, { partial: false });
        const task = {
            id: '', title: f.title, status: f.status || ctx.state.config.columns[0].id,
            priority: f.priority || '', category: f.category || '', assignees: f.assignees || [], tags: f.tags || [],
            created: f.created || env.today(), started: f.started || '', due: f.due || '', completed: f.completed || '',
            description: f.description || '', subtasks: f.subtasks || [], notes: f.notes || '', extra: '',
            order: f.order === undefined ? null : f.order,
        };
        task.notes = task.notes.replace(/\n/g, ctx.board.eol); // the parser keeps the file's EOL inside notes
        checkMeta(task);
        const n = Math.max(ctx.state.config.lastTaskId, maxId(ctx)) + 1;
        task.id = 'TASK-' + String(n).padStart(3, '0');
        if (f.order === undefined && orderActive(ctx.state.tasks)) { // keep "new tasks go last" under manual ordering
            ensureKeys(ctx);
            task.order = Math.max(...ctx.state.tasks.map((t) => t.order)) + STEP;
        }
        ctx.state.config.lastTaskId = n;
        ctx.state.tasks.push(task);
        P.appendBlockText(ctx.board, generateTaskBlock(task));
        P.setLastTaskId(ctx.board, n);
        return { id: task.id, kind: 'board' };
    },

    updateTask(ctx, op) {
        const found = findTask(ctx, op.id);
        checkEtag(ctx, found, op);
        const patch = normalizeFields(op.set || fail('missing_field', 'updateTask needs a "set" object'), ctx.state.config, { partial: true });
        const before = clone(found.task);
        if (patch.notes !== undefined) patch.notes = patch.notes.replace(/\n/g, found.doc.eol);
        const after = Object.assign(found.task, patch);
        checkMeta(after);
        patchFields(ctx, found, before, after);
        return { id: after.id, kind: found.kind };
    },

    moveTask(ctx, op) {
        const found = findTask(ctx, op.id);
        if (found.kind !== 'board') fail('task_archived', `${found.task.id} is archived`, { hint: 'Restore it first.' });
        checkEtag(ctx, found, op);
        const { tasks, config } = ctx.state;
        const t = found.task;
        const status = op.status === undefined ? t.status : normalizeFields({ status: op.status }, config, { partial: true }).status;
        if (op.before) {
            const b = tasks.find((x) => x.id === op.before);
            if (!b || b.id === t.id) fail('unknown_task', `No task ${op.before} to place it before`);
            if (b.status !== status) fail('before_not_in_column', `${b.id} is not in column "${status}"`);
        }
        if (op.before && op.atEnd) fail('invalid_field', 'give either before or atEnd, not both');
        const statusChanged = t.status !== status;
        const positional = !!(op.before || op.atEnd);
        if (positional && orderActive(tasks)) {
            // Manual ordering is on: write a key, never relocate the block.
            ensureKeys(ctx);
            if (statusChanged) { P.setStatus(ctx.board, locate(ctx, found), status); t.status = status; }
            const col = orderedTasks(tasks).filter((x) => x.status === status);
            const ti = col.indexOf(t);
            const others = col.filter((x) => x !== t);
            if (op.before ? col[ti + 1] && col[ti + 1].id === op.before : col[col.length - 1] === t) return { id: t.id, kind: 'board' }; // already there
            if (op.before) {
                const j = others.findIndex((x) => x.id === op.before);
                const next = others[j].order, prev = j > 0 ? others[j - 1].order : null;
                const key = prev === null ? Math.floor(next / 2) : Math.floor((prev + next) / 2);
                if (key < next && (prev === null || key > prev)) setKey(ctx, t, key);
                else { // no room between the neighbours: renumber evenly, with t placed before the anchor
                    const list = orderedTasks(tasks).filter((x) => x !== t);
                    list.splice(list.findIndex((x) => x.id === op.before), 0, t);
                    list.forEach((x, i) => { if (x.order !== (i + 1) * STEP) setKey(ctx, x, (i + 1) * STEP); });
                }
            } else {
                const pool = others.length ? others : tasks.filter((x) => x !== t);
                setKey(ctx, t, Math.max(0, ...pool.map((x) => x.order)) + STEP);
            }
            return { id: t.id, kind: 'board' };
        }
        // By default a move edits the **Status** line in place and the block stays where it is in the
        // file (so the diff is one line). The block is relocated only when a position is asked for:
        // `before` (ahead of that task) or `atEnd` (after the last task of the column, as a drag to
        // the bottom of a column does in the page).
        const rest = tasks.filter((x) => x !== t);
        let idx = -1;
        if (op.before) idx = rest.findIndex((x) => x.id === op.before);
        else if (op.atEnd) {
            idx = rest.length;
            for (let i = rest.length - 1; i >= 0; i--) if (rest[i].status === status) { idx = i + 1; break; }
        }
        const reordered = idx < 0 ? tasks : [...rest.slice(0, idx), t, ...rest.slice(idx)];
        const orderChanged = reordered.some((x, i) => x !== tasks[i]);

        if (statusChanged) P.setStatus(ctx.board, locate(ctx, found), status);
        if (orderChanged) {
            const lines = P.cutBlock(ctx.board, locate(ctx, found));
            const anchor = idx < rest.length ? P.locateTask(ctx.board, 'board', rest[idx].id) : null;
            P.pasteBlock(ctx.board, anchor ? anchor.start : ctx.board.lines.length, lines);
        }
        t.status = status;
        ctx.state.tasks = reordered;
        return { id: t.id, kind: 'board' };
    },

    // Explicit sort. Modes:
    //   blocks    reorder the task blocks in the file by numeric id
    //   ids       assign keys that reflect id order
    //   positions assign keys that reflect the current order (keys, then file position); also how
    //             manual ordering is switched on
    //   clear     remove every key (order falls back to file position)
    sortTasks(ctx, op) {
        // Sorting rewrites the file wholesale, so the mode is never guessed.
        const mode = op.mode;
        const MODES = ['blocks', 'ids', 'positions', 'clear'];
        if (!mode) fail('missing_field', 'sortTasks needs a mode', { valid: MODES, hint: 'blocks: reorder file blocks by id. ids / positions: write Order keys from id order / current order. clear: remove all Order keys.' });
        if (!MODES.includes(mode)) fail('invalid_field', `Unknown sort mode "${mode}"`, { valid: MODES });
        if (op.by && op.by !== 'id') fail('invalid_field', `Cannot sort by "${op.by}"`, { valid: ['id'] });
        const dir = op.order === 'desc' ? -1 : 1;
        const num = (t) => parseInt((t.id.match(/(\d+)$/) || [])[1], 10) || 0;
        const tasks = ctx.state.tasks;

        if (mode === 'clear') {
            for (const t of tasks) if (t.order != null) setKey(ctx, t, null);
            return { mode };
        }
        if (mode === 'ids' || mode === 'positions') {
            const list = mode === 'positions' ? orderedTasks(tasks) : [...tasks].sort((a, b) => dir * (num(a) - num(b)) || tasks.indexOf(a) - tasks.indexOf(b));
            list.forEach((t, i) => { if (t.order !== (i + 1) * STEP) setKey(ctx, t, (i + 1) * STEP); });
            return { mode };
        }
        const scope = op.scope || 'board';
        if (!['board', 'archive', 'both'].includes(scope)) fail('invalid_field', `Unknown scope "${scope}"`, { valid: ['board', 'archive', 'both'] });
        for (const kind of ['board', 'archive']) {
            if (scope !== 'both' && scope !== kind) continue;
            const doc = kind === 'board' ? ctx.board : ctx.archive;
            const list = kind === 'board' ? ctx.state.tasks : ctx.state.archive;
            if (!doc || list.length < 2) continue;
            const order = list.map((_, i) => i).sort((a, b) => dir * (num(list[a]) - num(list[b])) || a - b);
            if (order.every((v, i) => v === i)) continue;
            if (P.blocksOf(doc, kind).length !== list.length) fail('ambiguous_id', 'Could not match every task block in the file', { hint: 'Fix duplicate or malformed task headers first.' });
            P.reorderBlocks(doc, kind, order);
            const sorted = order.map((i) => list[i]);
            if (kind === 'board') ctx.state.tasks = sorted; else ctx.state.archive = sorted;
        }
        return { mode, scope };
    },

    toggleSubtask(ctx, op) {
        const found = findTask(ctx, op.id);
        checkEtag(ctx, found, op);
        const t = found.task;
        let i = Number.isInteger(op.index) ? op.index : t.subtasks.findIndex((s) => s.text === (op.text || '').trim());
        if (!t.subtasks[i]) fail('unknown_subtask', `${t.id} has no such subtask`, { details: { count: t.subtasks.length } });
        const done = op.completed === undefined ? !t.subtasks[i].completed : !!op.completed;
        if (t.subtasks[i].completed !== done) {
            const before = clone(t);
            t.subtasks[i].completed = done;
            patchFields(ctx, found, before, t);
        }
        return { id: t.id, kind: found.kind };
    },

    addSubtask(ctx, op) {
        const found = findTask(ctx, op.id);
        checkEtag(ctx, found, op);
        const [s] = normalizeFields({ subtasks: [{ text: op.text, completed: op.completed }] }, ctx.state.config, { partial: true }).subtasks;
        found.task.subtasks.push(s);
        try { P.addSubtask(found.doc, locate(ctx, found), s); }
        catch (e) { if (!(e instanceof P.Fallback)) throw e; P.replaceBlock(found.doc, locate(ctx, found), found.task); }
        return { id: found.task.id, kind: found.kind };
    },

    appendNote(ctx, op) {
        const found = findTask(ctx, op.id);
        checkEtag(ctx, found, op);
        const text = normalizeFields({ notes: op.text }, ctx.state.config, { partial: true }).notes;
        if (!text) fail('invalid_field', 'note text must not be empty');
        const t = found.task;
        const expected = text.replace(/\n/g, found.doc.eol);
        t.notes = t.notes ? `${t.notes}${found.doc.eol}${expected}` : expected;
        try { P.appendNote(found.doc, locate(ctx, found), text); }
        catch (e) { if (!(e instanceof P.Fallback)) throw e; P.replaceBlock(found.doc, locate(ctx, found), t); }
        return { id: t.id, kind: found.kind };
    },

    archiveTask(ctx, op) {
        const found = findTask(ctx, op.id);
        if (found.kind !== 'board') fail('already_archived', `${found.task.id} is already archived`);
        checkEtag(ctx, found, op);
        const t = found.task;
        const dest = archiveDoc(ctx);
        syncStatusLine(ctx, found, t.status); // the archive reads **Status** to remember the column
        const lines = carry(P.cutBlock(ctx.board, locate(ctx, found)), t, ctx.board, dest);
        P.pasteBlock(dest, dest.lines.length, lines);
        ctx.state.tasks = ctx.state.tasks.filter((x) => x !== t);
        ctx.state.archive.push(t);
        return { id: t.id, kind: 'archive', order: ['archive', 'board'] };
    },

    restoreTask(ctx, op) {
        const found = findTask(ctx, op.id);
        if (found.kind !== 'archive') fail('not_archived', `${found.task.id} is not archived`);
        const t = found.task;
        // Same rule as the page: a column that no longer exists falls back to the first column.
        const status = ctx.state.config.columns.some((c) => c.id === t.status) ? t.status : ctx.state.config.columns[0].id;
        syncStatusLine(ctx, found, status);
        const lines = carry(P.cutBlock(ctx.archive, locate(ctx, found)), t, ctx.archive, ctx.board);
        P.pasteBlock(ctx.board, ctx.board.lines.length, lines);
        t.status = status;
        ctx.state.archive = ctx.state.archive.filter((x) => x !== t);
        ctx.state.tasks.push(t);
        return { id: t.id, kind: 'board', order: ['board', 'archive'] };
    },

    deleteTask(ctx, op) {
        const found = findTask(ctx, op.id);
        checkEtag(ctx, found, op);
        P.cutBlock(found.doc, locate(ctx, found));
        if (found.kind === 'board') ctx.state.tasks = ctx.state.tasks.filter((x) => x !== found.task);
        else ctx.state.archive = ctx.state.archive.filter((x) => x !== found.task);
        return { id: found.task.id, kind: found.kind };
    },

    setConfigList(ctx, op) {
        if (!CONFIG_LISTS.includes(op.name)) fail('unknown_config', `Unknown config list "${op.name}"`, { valid: CONFIG_LISTS });
        if (!Array.isArray(op.values)) fail('invalid_field', 'values must be an array');
        let values = op.values.map((v) => oneLine(v, op.name)).filter(Boolean);
        if (op.name === 'tags') {
            values = values.map((v) => v.replace(/^#/, ''));
            for (const v of values) if (!/^[\w-]+$/.test(v)) fail('invalid_tag', `Invalid tag "${v}"`);
        }
        if (['categories', 'users'].includes(op.name) && values.some((v) => v.includes(','))) fail('invalid_field', `${op.name} must not contain ","`);
        if (op.name === 'priorities' && values.some((v) => v.includes('|'))) fail('invalid_field', 'priorities must not contain "|"');
        if (op.name !== 'priorities') values = [...new Set(values)];
        if (!values.length) fail('invalid_field', `${op.name} must not be empty`, { hint: 'An empty list falls back to defaults, so it would not stay empty.' });
        ctx.state.config[op.name] = values;
        P.setConfigLine(ctx.board, op.name, P.configValueText[op.name](values), normalizeConfig(ctx.state.config));
        return { name: op.name };
    },

    setColumns(ctx, op) {
        if (!Array.isArray(op.columns) || !op.columns.length) fail('invalid_field', 'columns must be a non-empty array of { name, id }');
        const current = new Map(ctx.state.config.columns.map((c) => [c.id, c]));
        const cols = op.columns.map((c) => ({ name: oneLine(c.name, 'column name'), id: oneLine(c.id, 'column id') }));
        const ids = new Set();
        for (const c of cols) {
            const old = current.get(c.id);
            if (!old || old.name !== c.name) {
                if (!c.name || /[|]/.test(c.name) || /\)\s*$/.test(c.name)) fail('invalid_column', `Invalid column name "${c.name}"`, { hint: 'Names must not contain "|" or end with ")".' });
            }
            if (!old && !/^[\w-]+$/.test(c.id)) fail('invalid_column', `Invalid column id "${c.id}"`, { hint: 'Ids are letters, digits, "_" and "-".' });
            if (ids.has(c.id)) fail('invalid_column', `Duplicate column id "${c.id}"`);
            ids.add(c.id);
        }
        const reassign = op.reassign || {};
        const orphans = [];
        for (const t of [...ctx.state.tasks, ...ctx.state.archive]) {
            if (current.has(t.status) && !ids.has(t.status)) {
                const to = reassign[t.status];
                if (!to) orphans.push({ id: t.id, status: t.status });
                else if (!ids.has(to)) fail('invalid_column', `reassign target "${to}" is not a column`);
            }
        }
        if (orphans.length) fail('orphaned_tasks', `${orphans.length} task(s) are in columns being removed`, { details: { orphans }, hint: 'Pass reassign: { oldColumnId: newColumnId }.' });
        for (const t of ctx.state.tasks) if (reassign[t.status] && !ids.has(t.status)) { statusEdit(ctx, 'board', t, reassign[t.status]); }
        for (const t of ctx.state.archive) if (reassign[t.status] && !ids.has(t.status)) { statusEdit(ctx, 'archive', t, reassign[t.status]); }
        ctx.state.config.columns = cols;
        P.setConfigLine(ctx.board, 'columns', P.configValueText.columns(cols), normalizeConfig(ctx.state.config));
        return { name: 'columns' };
    },
};

// Blocks move between files verbatim. Only when the two files use different line endings is the
// block re-terminated, and then the expected task is updated the same way: the parser keeps the
// file's line endings inside notes and preserved sections.
function carry(lines, task, from, to) {
    const foreign = lines.some((l) => { const e = (/\r?\n$/.exec(l) || [''])[0]; return e && e !== to.eol; });
    if (!foreign || (from.eol === to.eol && !P.hasUniformEol(to))) return lines;
    const conv = (v) => v.replace(/\r?\n/g, to.eol);
    task.notes = conv(task.notes);
    task.extra = conv(task.extra);
    return P.convertBlockEol(lines, to.eol);
}

function statusEdit(ctx, kind, task, status) {
    const doc = kind === 'board' ? ctx.board : ctx.archive;
    P.setStatus(doc, P.locateTask(doc, kind, task.id), status);
    task.status = status;
}

// Make the block's **Status** line say `status` (the line may be missing or name a removed column).
function syncStatusLine(ctx, found, status) {
    const loc = locate(ctx, found);
    const f = P.fieldsOf(found.doc, loc);
    const text = f.status >= 0 ? stripEol(found.doc.lines[f.status]).replace(/^\s*\*\*Status\*\*:\s*/, '').trim() : null;
    if (text !== status) P.setStatus(found.doc, loc, status);
}

// ---- entry point ------------------------------------------------------------------------------

export function applyOp(ws, op, options = {}) {
    if (!op || !OPS[op.type]) fail('unknown_op', `Unknown operation "${op && op.type}"`, { valid: OP_TYPES });
    const env = { today: options.today || todayISO };
    const ctx = open(ws);
    const result = OPS[op.type](ctx, op, env);

    const board = ctx.board.toString();
    const archive = ctx.archive ? ctx.archive.toString() : null;
    verify(ctx, board, archive);

    const changed = { board: board !== ws.board, archive: archive !== (ws.archive ?? null) };
    const order = result.order || ['board', 'archive'];
    const files = order.filter((k) => changed[k]).map((k) => ({ name: k === 'board' ? 'kanban.md' : 'archive.md', text: k === 'board' ? board : archive }));

    // Fresh etag of the affected block, so a caller can chain edits with ifMatch.
    let etag;
    if (result.id) {
        const doc = result.kind === 'archive' ? ctx.archive : ctx.board;
        const loc = doc && P.locateTask(doc, result.kind, result.id);
        if (loc) etag = etagOf(P.blockText(doc, loc));
    }
    return { board, archive, files, changed, result: { op: op.type, ...result, order: undefined, etag } };
}

function verify(ctx, board, archive) {
    const bp = parseBoard(board);
    const diff = firstDifference({ config: ctx.state.config, tasks: ctx.state.tasks }, { config: bp.config, tasks: bp.tasks });
    if (!bp.formatV2 || diff) {
        fail('verify_failed', 'The change could not be written so that it reads back identically; nothing was written.', { details: diff || { path: 'formatV2' } });
    }
    if (archive !== null) {
        const ap = parseArchive(archive, bp.config.columns);
        const adiff = firstDifference(ctx.state.archive, ap.tasks);
        if (adiff) fail('verify_failed', 'The archive change could not be written so that it reads back identically; nothing was written.', { details: { file: 'archive.md', ...adiff } });
    }
}
