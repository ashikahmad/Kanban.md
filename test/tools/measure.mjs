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

export function measure() {
    const rules = size(read('AI_WORKFLOW.md')) + size(read('.claude/skills/markdown-task-manager/SKILL.md'));
    const toolSchemas = size(publicTools()) + size(SERVER_INSTRUCTIONS);
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
    return { rules, toolSchemas, scenarios };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const m = measure();
    if (process.argv.includes('--json')) { console.log(JSON.stringify(m, null, 2)); process.exit(0); }
    console.log(`Per-session fixed cost\n  format rules an agent loads today (AI_WORKFLOW.md + skill): ~${tokens(m.rules)} tokens\n  tool schemas + server instructions:                         ~${tokens(m.toolSchemas)} tokens\n`);
    let last = '';
    for (const s of m.scenarios) {
        if (s.board !== last) { console.log(`\n${s.board}   raw kanban.md = ~${tokens(s.raw)} tokens`); last = s.board; }
        const pct = Math.round((1 - s.tool / s.raw) * 100);
        console.log(`  ${s.question.padEnd(42)} tool ~${String(tokens(s.tool)).padStart(5)} tokens   (${pct}% less than reading the file)`);
    }
}
