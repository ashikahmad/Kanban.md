// Token measurement: what an agent pays to answer common questions by reading the raw markdown vs
// through the read tools.   usage: node test/tools/measure.mjs [--json]
//
// "Tokens" here are bytes / 4, the usual rough rule for English text. Claude's real tokenizer
// differs (emoji, accents and non-English text cost more per byte), so read the numbers as
// relative sizes, not exact counts. The ratios are what matters and they are stable.
import { readFileSync } from 'node:fs';
import { parseBoard, generateBoard } from '../../core/board.js';
import { migrateBoardText } from '../../core/migrate.js';
import { getBoard, getTask, getStats } from '../../core/read.js';
import { applyOp } from '../../core/ops.js';
import { generateTaskBlock } from '../../core/board.js';
import { etagOf } from '../../core/text.js';
import { publicTools, SERVER_INSTRUCTIONS } from '../../mcp/tools.js';

const TODAY = '2026-10-25';
const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
export const tokens = (bytes) => Math.ceil(bytes / 4);
const size = (v) => Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v));

// A realistic large board: the example board's tasks (long descriptions, notes) cloned to 100.
function synthetic(n) {
    const base = parseBoard(migrateBoardText(read('test/fixtures/examples-v2.kanban.md')).text);
    const cols = base.config.columns.map((c) => c.id);
    const users = base.config.users.map((u) => u.split(/[\s(]/)[0]);
    const tasks = Array.from({ length: n }, (_, i) => {
        const t = JSON.parse(JSON.stringify(base.tasks[i % base.tasks.length]));
        t.id = 'TASK-' + String(i + 1).padStart(3, '0');
        t.title = `${t.title} (${i + 1})`;
        t.status = cols[i % cols.length];
        t.assignees = [users[i % users.length]];
        if (i % 9 === 0) { t.due = '2026-10-20'; t.completed = ''; }
        return t;
    });
    return generateBoard({ config: { ...base.config, lastTaskId: n }, tasks });
}

const boards = () => [
    ['demo (15 tasks)', migrateBoardText(read('test/fixtures/demo.kanban.md')).text],
    ['examples (18 tasks)', migrateBoardText(read('test/fixtures/examples-v2.kanban.md')).text],
    ['synthetic (100 tasks)', synthetic(100)],
];

// What a write costs: the tool call plus its acknowledgement, against an agent that edits the file
// itself (it must read the file, then make an edit call quoting the old and new text; ~40 tokens of
// fixed overhead per edit call for the path and wrapper).
const EDIT_OVERHEAD = 160; // bytes
const editCall = (oldText, newText) => EDIT_OVERHEAD + size(oldText) + size(newText);
const ackOf = (out) => JSON.stringify({ ok: true, ...(out.result.id ? { id: out.result.id } : {}), ...(out.result.etag ? { etag: out.result.etag } : {}), files: out.files.map((f) => f.name) });

function writeScenarios(name, board) {
    const bp = parseBoard(board);
    const ws = { board, archive: null };
    const t = bp.tasks.find((x) => x.subtasks.length) || bp.tasks[Math.floor(bp.tasks.length / 2)];
    const cols = bp.config.columns.map((c) => c.id);
    const other = cols.find((c) => c !== t.status);
    const rows = [];
    const add = (question, rawCost, args, out) => rows.push({ board: name, question, raw: size(board) + rawCost, tool: size(args) + size(ackOf(out)) });
    // move: the agent quotes the header and Status lines (to be unique) before and after
    const head = `### ${t.id} | ${t.title}\n**Status**: ${t.status}\n`;
    add(`move ${t.id} to "${other}"`, editCall(head, head.replace(t.status, other)), { id: t.id, status: other }, applyOp(ws, { type: 'moveTask', id: t.id, status: other }));
    // create: append a block and bump Last Task ID (two edits)
    const draft = { title: 'Investigate the slow dashboard', status: cols[0], priority: bp.config.priorities[1].replace(/[^\w\s]+/, '').trim(), category: bp.config.categories[0], tags: ['perf'], description: 'Profile the query and report.' };
    const created = applyOp(ws, { type: 'createTask', task: draft });
    const block = generateTaskBlock({ ...bp.tasks[0], ...draft, id: created.result.id, assignees: [], subtasks: [], notes: '', extra: '', order: null, due: '', started: '', completed: '' });
    add('create a task', editCall('(end of file context)', block) + editCall('Last Task ID: 000', 'Last Task ID: 001'), draft, created);
    // subtask toggle and note
    const sub = t.subtasks[0] || { text: 'step', completed: false };
    const line = `- [${sub.completed ? 'x' : ' '}] ${sub.text}`;
    add('tick a subtask', editCall(line, line.replace(/\[.\]/, sub.completed ? '[ ]' : '[x]')), { id: t.id, toggle: 0 }, applyOp(ws, { type: 'toggleSubtask', id: t.id, index: 0 }));
    const note = 'Waiting on the infra team for the metrics export.';
    add('append a note', editCall('(last lines of the task block)', `(same lines)\n\n**Notes**:\n${note}`), { id: t.id, text: note }, applyOp(ws, { type: 'appendNote', id: t.id, text: note }));
    // bulk archive of 10 tasks: the agent cuts each block from the board and pastes it into archive.md
    const ten = bp.tasks.slice(0, 10);
    const blocks = ten.map((x) => size(generateTaskBlock(x)));
    const raw = blocks.reduce((a, b) => a + 2 * b, 0) + 20 * EDIT_OVERHEAD + 400; // old block out, new block in; archive read ~400 bytes
    const bulk = applyOp(ws, { type: 'archiveTasks', ids: ten.map((x) => x.id) });
    rows.push({ board: name, question: 'archive 10 tasks', raw: size(board) + raw, tool: size({ ids: ten.map((x) => x.id) }) + size(ackOf({ result: { id: '', etag: '' }, files: bulk.files })) });
    return rows;
}

export function measure() {
    const rules = size(read('AI_WORKFLOW.md')) + size(read('.claude/skills/markdown-task-manager/SKILL.md'));
    const toolSchemas = size(publicTools()) + size(SERVER_INSTRUCTIONS);
    const toolSchemasReadOnly = size(publicTools({ readOnly: true })) + size(SERVER_INSTRUCTIONS);
    const scenarios = [];
    for (const [name, board] of boards()) {
        const ws = { board, archive: null };
        const cols = parseBoard(board).config.columns.map((c) => c.id);
        const some = parseBoard(board).tasks[Math.floor(parseBoard(board).tasks.length / 2)].id;
        const ask = (label, args, result) => scenarios.push({ board: name, question: label, raw: size(board), tool: size(args) + size(result) });
        ask(`what is in "${cols[1]}"?`, { status: cols[1] }, getBoard(ws, { status: cols[1] }, { today: TODAY }));
        ask('what is overdue for the first user?', { assignee: '@alice', overdue: true }, getBoard(ws, { assignee: '@alice', overdue: true }, { today: TODAY }));
        ask('find tasks mentioning "security"', { text: 'security' }, getBoard(ws, { text: 'security' }, { today: TODAY }));
        ask(`read ${some} in full`, { id: some }, getTask(ws, some));
        ask('how are we doing? (counts)', {}, getStats(ws, { today: TODAY }));
        ask('list every task (first page of 50)', {}, getBoard(ws, {}, { today: TODAY }));
    }
    const writes = boards().flatMap(([name, board]) => writeScenarios(name, board));
    return { rules, toolSchemas, toolSchemasReadOnly, scenarios, writes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const m = measure();
    if (process.argv.includes('--json')) { console.log(JSON.stringify(m, null, 2)); process.exit(0); }
    console.log(`Per-session fixed cost\n  format rules an agent loads today (AI_WORKFLOW.md + skill): ~${tokens(m.rules)} tokens\n  tool schemas + server instructions (all tools):             ~${tokens(m.toolSchemas)} tokens\n  same, --read-only (5 tools):                                ~${tokens(m.toolSchemasReadOnly)} tokens\n`);
    let last = '';
    for (const s of m.scenarios) {
        if (s.board !== last) { console.log(`\n${s.board}   raw kanban.md = ~${tokens(s.raw)} tokens`); last = s.board; }
        const pct = Math.round((1 - s.tool / s.raw) * 100);
        console.log(`  ${s.question.padEnd(42)} tool ~${String(tokens(s.tool)).padStart(5)} tokens   (${pct}% less than reading the file)`);
    }
    console.log('\nWrites: tool call + ack vs read the file and edit it (estimate)');
    last = '';
    for (const s of m.writes) {
        if (s.board !== last) { console.log(`\n${s.board}`); last = s.board; }
        console.log(`  ${s.question.padEnd(42)} tool ~${String(tokens(s.tool)).padStart(5)} tokens   vs ~${String(tokens(s.raw)).padStart(6)}   (${Math.round((1 - s.tool / s.raw) * 100)}% less)`);
    }
}
