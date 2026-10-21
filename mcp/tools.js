// Tool definitions for the Kanban.md MCP server. Kept apart from the transport so tests and the
// token measurement can import them. Schemas are deliberately terse: every tool schema is paid for
// in context on every session, so descriptions say only what the name and the types do not.
import { resolve } from 'node:path';
import { BoardError } from '../core/text.js';
import { getBoard, getTask, getConfig, listArchive, getStats, summarizeChanges } from '../core/read.js';
import { readWorkspace, readActivity } from '../io/node-fs.js';
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
        description: 'Compact task list in display order (summaries only), plus per-column counts and rev. Filter here instead of reading files.',
        inputSchema: { type: 'object', properties: filterProps },
        run: (ws, a) => getBoard(ws, a),
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
        name: 'list_archive',
        description: 'Archived tasks (summaries). Same filters as get_board; `reverse` lists newest first.',
        inputSchema: { type: 'object', properties: { ...filterProps, reverse: { type: 'boolean' } } },
        run: (ws, a) => listArchive(ws, a),
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

export const SERVER_INSTRUCTIONS = 'Kanban board in markdown files. Read with get_board (filtered, summaries) and fetch detail with get_task; do not read kanban.md directly. Ids look like TASK-014; statuses are column ids from get_config. Empty fields are omitted.';

export const publicTools = () => TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

// Run a tool against the project folder; always returns an MCP tool result.
export async function callTool(dir, name, args = {}) {
    const tool = TOOLS.find((t) => t.name === name);
    try {
        if (!tool) throw new BoardError('unknown_tool', `Unknown tool "${name}"`, { valid: TOOLS.map((t) => t.name) });
        const root = resolve(dir);
        const ws = await readWorkspace(root);
        const result = await tool.run(ws, args || {}, root);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e) {
        const err = e instanceof BoardError ? e.toJSON() : { code: 'internal', message: e.message };
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: err }) }] };
    }
}
