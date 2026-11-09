// A fenced code block in a task description is text: lines in it that look like fields or sections are not,
// and its blank lines and indentation survive parsing, patching and generating.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard, generateBoard } from '../core/board.js';
import { applyOp } from '../core/ops.js';

const task = (desc) => `### TASK-001 | Code\n**Status**: todo  \n**Priority**: High  \n**Created**: 2026-11-01  \n\n${desc}\n\n**Notes**:\nA note.\n`;
const board = (desc) => `# Kanban Board\n\n<!-- Config: Last Task ID: 1 -->\n<!-- Format: v3 -->\n\n## ⚙️ Configuration\n\n**Columns**: To Do (todo) | Done (done)\n\n**Categories**: A\n\n**Users**: @u (U)\n\n**Priorities**: High | Low\n\n**Tags**: #x\n\n---\n\n## Tasks\n\n${task(desc)}`;
const CODE = 'Use:\n```js\nfunction f() {\n\n    return 1;\n}\n**Blocked by**: TASK-007\n**Status**: done\n**Notes**:\n```\nafter';

test('field and section lines inside a code block stay in the description', () => {
    const t = parseBoard(board(CODE)).tasks[0];
    assert.equal(t.status, 'todo');
    assert.deepEqual(t.blockedBy, []);
    assert.equal(t.notes.trim(), 'A note.');
    assert.equal(t.description, CODE); // blank line and indentation kept
});

test('parse then generate keeps the code block as written', () => {
    const parsed = parseBoard(board(CODE));
    const again = parseBoard(generateBoard(parsed)).tasks[0];
    assert.equal(again.description, CODE);
    assert.equal(again.status, 'todo');
});

test('patching other fields leaves the code block alone', () => {
    const text = board(CODE);
    const out = applyOp({ board: text, archive: '' }, { type: 'updateTask', id: 'TASK-001', set: { priority: 'Low' } }, { today: () => '2026-11-09' }).board;
    assert.ok(out.includes('**Priority**: Low'));
    assert.ok(out.includes('**Blocked by**: TASK-007\n**Status**: done\n**Notes**:\n```'));
    assert.equal(parseBoard(out).tasks[0].description, CODE);
});

test('an unclosed fence is not a code block', () => {
    const t = parseBoard(board('Text\n```\n**Blocked by**: TASK-007')).tasks[0];
    assert.deepEqual(t.blockedBy, ['TASK-007']);
});
