// Tool definitions for the Kanban.md MCP server: reads and writes. Kept apart from the transport so tests and the
// token measurement can import them. Schemas are deliberately terse: every tool schema is paid for
// in context on every session, so descriptions say only what the name and the types do not.
import { resolve } from 'node:path';
import { BoardError } from '../core/text.js';
import { getBoard, getTask, getConfig, listArchive, getStats, summarizeChanges } from '../core/read.js';
import { readWorkspace, readActivity, mutate } from '../io/node-fs.js';
import { etagOf } from '../core/text.js';

const filterProps = {
    status: { type: ['string', 'array'], items: { type: 'string' }, description: 'column id(s)' },
    assignee: { type: ['string', 'array'], items: { type: 'string' }, description: '@name' },
    tag: { type: ['string', 'array'], items: { type: 'string' }, description: 'all of these' },
    priority: { type: ['string', 'array'], items: { type: 'string' } },
    category: { type: ['string', 'array'], items: { type: 'string' } },
    text: { type: 'string', description: 'words that must all appear in id/title/description/notes/tags' },
    dueBefore: { type: 'string', description: 'YYYY-MM-DD' },
    overdue: { type: 'boolean' },
    limit: { type: 'integer', description: 'default 50, max 500' },
    offset: { type: 'integer' },
    fields: { type: 'array', items: { type: 'string' }, description: 'columns per row instead of the default (id always kept), e.g. title,status,progress' },
};

export const TOOLS = [
    {
        name: 'get_board',
        description: 'Compact task list in display order (summaries only), plus per-column counts and rev. Filter here instead of reading files. archived: true lists the archive instead (reverse: newest first).',
        inputSchema: { type: 'object', properties: { ...filterProps, archived: { type: 'boolean' }, reverse: { type: 'boolean' } } },
        run: (ws, a) => (a.archived ? listArchive(ws, a) : getBoard(ws, a)),
    },
    {
        name: 'get_task',
        description: 'One task in full (board or archive), with its etag for later edits. `fields` limits the result.',
        inputSchema: { type: 'object', properties: { id: { type: 'string' }, fields: filterProps.fields }, required: ['id'] },
        run: (ws, a) => getTask(ws, a.id, a),
    },
    {
        name: 'get_config',
        description: 'Valid column ids, priorities, categories, users, tags, and format info.',
        inputSchema: { type: 'object', properties: {} },
        run: (ws) => getConfig(ws),
    },
    {
        name: 'get_board_stats',
        description: 'Counts by status, assignee and priority, plus overdue and due-soon tasks.',
        inputSchema: { type: 'object', properties: {} },
        run: (ws) => getStats(ws),
    },
    {
        name: 'get_changes_since',
        description: 'Edits made through these tools after an ISO timestamp, plus current rev. Page edits are not logged: if rev differs from the one you hold, re-read.',
        inputSchema: { type: 'object', properties: { since: { type: 'string', description: 'ISO timestamp' } } },
        run: async (ws, a, dir) => summarizeChanges(await readActivity(dir), { since: a.since, rev: etagOf(ws.board) }),
    },
];

// ---- writes -----------------------------------------------------------------------------------
// Every write is one or more ops applied as a single verified, locked, atomic edit (io/node-fs.js).
// Arguments are flat (no nested "set" object) and one field definition serves create and update.
const date = { type: 'string', description: 'YYYY-MM-DD' };
const fieldProps = {
    title: { type: 'string' },
    status: { type: 'string', description: 'column id' },
    priority: { type: 'string' },
    category: { type: 'string' },
    assignees: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    created: date, started: date, due: date, completed: date,
    description: { type: 'string' },
    subtasks: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, completed: { type: 'boolean' } }, required: ['text'] } },
    notes: { type: 'string' },
    order: { type: 'integer' },
};
const dryRun = { type: 'boolean', description: 'preview the diff, write nothing' };
const ifMatch = { type: 'string', description: 'etag from a read; fails if the task changed since' };
const FIELD_KEYS = Object.keys(fieldProps);
const pick = (args, keys) => Object.fromEntries(keys.filter((k) => args[k] !== undefined).map((k) => [k, args[k]]));
const id = { type: 'string' };

TOOLS.push(
    {
        name: 'save_task',
        description: 'Create a task (no id: appended last, id assigned) or change one (id: only the fields you pass; subtasks and notes replace, so prefer subtask and add_note). Returns id and the new etag.',
        inputSchema: { type: 'object', properties: { id, ...fieldProps, ifMatch, dryRun } },
        write: (a) => {
            if (a.id) return [{ type: 'updateTask', id: a.id, set: pick(a, FIELD_KEYS), ifMatch: a.ifMatch }];
            if (!a.title) throw new BoardError('missing_field', 'A new task needs a title (or pass id to change one)');
            return [{ type: 'createTask', task: pick(a, FIELD_KEYS) }];
        },
    },
    {
        name: 'move_task',
        description: 'Change column in place (a one-line edit). before (a task id) or atEnd also sets the position.',
        inputSchema: { type: 'object', properties: { id, status: fieldProps.status, before: id, atEnd: { type: 'boolean' }, ifMatch, dryRun }, required: ['id', 'status'] },
        write: (a) => [{ type: 'moveTask', id: a.id, status: a.status, before: a.before, atEnd: a.atEnd, ifMatch: a.ifMatch }],
    },
    {
        name: 'subtask',
        description: 'Add a subtask (add) or flip one (toggle: its index or exact text; done sets the state).',
        inputSchema: { type: 'object', properties: { id, add: { type: 'string' }, toggle: { type: ['integer', 'string'] }, done: { type: 'boolean' }, dryRun }, required: ['id'] },
        write: (a) => {
            if (a.toggle !== undefined) return [{ type: 'toggleSubtask', id: a.id, ...(Number.isInteger(a.toggle) ? { index: a.toggle } : { text: String(a.toggle) }), ...(a.done !== undefined && { completed: a.done }) }];
            if (a.add) return [{ type: 'addSubtask', id: a.id, text: a.add, ...(a.done !== undefined && { completed: a.done }) }];
            throw new BoardError('missing_field', 'Pass add or toggle');
        },
    },
    {
        name: 'add_note',
        description: 'Append text to a task\'s notes without rewriting them.',
        inputSchema: { type: 'object', properties: { id, text: { type: 'string' }, dryRun }, required: ['id', 'text'] },
        write: (a) => [{ type: 'appendNote', id: a.id, text: a.text }],
    },
    {
        name: 'archive_tasks',
        description: 'Move tasks to the archive, all or nothing, as one edit.',
        inputSchema: { type: 'object', properties: { ids: { type: 'array', items: id }, dryRun }, required: ['ids'] },
        write: (a) => [{ type: 'archiveTasks', ids: a.ids }],
    },
    {
        name: 'restore_task',
        description: 'Bring an archived task back to the board (its column, or the first one if that is gone).',
        inputSchema: { type: 'object', properties: { id, dryRun }, required: ['id'] },
        write: (a) => [{ type: 'restoreTask', id: a.id }],
    },
    {
        name: 'delete_task',
        description: 'Delete a task for good (board or archive). Prefer archive_tasks.',
        inputSchema: { type: 'object', properties: { id, ifMatch, dryRun }, required: ['id'] },
        write: (a) => [{ type: 'deleteTask', id: a.id, ifMatch: a.ifMatch }],
    },
    {
        name: 'sort_tasks',
        description: 'File-wide reorder, never implicit. mode: ids and positions write Order keys (by id / by current order), clear removes them, blocks reorders the file by id.',
        inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['ids', 'positions', 'clear', 'blocks'] }, order: { type: 'string', enum: ['asc', 'desc'] }, scope: { type: 'string', enum: ['board', 'archive', 'both'] }, dryRun }, required: ['mode'] },
        write: (a) => [{ type: 'sortTasks', mode: a.mode, order: a.order, scope: a.scope }],
    },
    {
        name: 'update_config',
        description: 'Replace config lists, the column list (reassign maps removed column ids to new ones), or the housekeeping policy ({off}, {reset}, or done/backlog {column, afterDays} and max).',
        inputSchema: {
            type: 'object',
            properties: {
                categories: { type: 'array', items: { type: 'string' } }, users: { type: 'array', items: { type: 'string' } },
                priorities: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } },
                columns: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, id: { type: 'string' } }, required: ['name', 'id'] } },
                reassign: { type: 'object', additionalProperties: { type: 'string' } },
                housekeeping: { type: 'object' }, dryRun,
            },
        },
        write: (a) => {
            const ops = [];
            if (a.columns) ops.push({ type: 'setColumns', columns: a.columns, reassign: a.reassign });
            for (const name of ['categories', 'users', 'priorities', 'tags']) if (a[name]) ops.push({ type: 'setConfigList', name, values: a[name] });
            if (a.housekeeping) ops.push({ type: 'setHousekeeping', ...a.housekeeping });
            if (!ops.length) throw new BoardError('missing_field', 'Pass at least one of columns, categories, users, priorities, tags, housekeeping');
            return ops;
        },
    },
);

export const SERVER_INSTRUCTIONS = 'Kanban board in markdown files. Read with get_board (filtered summaries) and get_task; change it only through the write tools, never by editing the files. Ids look like TASK-014; statuses are column ids (get_config). Empty fields are omitted. Pass a task\'s etag as ifMatch to avoid overwriting someone else\'s edit; dryRun previews. If get_board_stats lists housekeeping suggestions, tell the user; do not archive without asking.';

export const publicTools = ({ readOnly = false } = {}) => TOOLS.filter((t) => !(readOnly && t.write)).map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

// What a write returns: just enough to continue (ids, the new etag), never the task back.
function ack(out, dry) {
    const rs = out.results || [out.result];
    const ids = rs.flatMap((r) => (r.ids ? r.ids : r.id ? [r.id] : []));
    return {
        ok: true,
        ...(ids.length === 1 ? { id: ids[0] } : ids.length > 1 ? { ids } : {}),
        ...(rs.length === 1 && rs[0].etag ? { etag: rs[0].etag } : {}),
        ...(out.files.length ? { files: out.files } : { changed: false }),
        ...(dry ? { dryRun: true, diff: out.diff } : {}),
    };
}

// Run a tool against the project folder; always returns an MCP tool result. `actor` names the caller
// in the activity log.
export async function callTool(dir, name, args = {}, { actor = 'mcp', readOnly = false } = {}) {
    const tool = TOOLS.find((t) => t.name === name && !(readOnly && t.write));
    try {
        if (!tool) throw new BoardError('unknown_tool', `Unknown tool "${name}"`, { valid: publicTools({ readOnly }).map((t) => t.name) });
        const root = resolve(dir);
        args = args || {};
        let result;
        if (tool.write) {
            const ops = tool.write(args);
            const out = await mutate(root, ops.length === 1 ? ops[0] : ops, { dryRun: !!args.dryRun, actor });
            result = ack(out, !!args.dryRun);
        } else {
            result = await tool.run(await readWorkspace(root), args, root);
        }
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e) {
        const err = e instanceof BoardError ? e.toJSON() : { code: 'internal', message: e.message };
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: err }) }] };
    }
}
