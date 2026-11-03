// Tests for task links (**Blocked by**, core/links.js): the field itself, how ops edit it, and what the
// derived reads say. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard, generateBoard, parseTaskIds } from '../core/board.js';
import { applyOp } from '../core/ops.js';
import { getTask, getBoard } from '../core/read.js';
import { indexTasks, blockersOf, blockedByThis, hasCycle } from '../core/links.js';
import { diffStats, BoardError } from '../core/text.js';

const HEAD = `# Board

<!-- Config: Last Task ID: 4 -->
<!-- Format: v3 -->

## ⚙️ Configuration

**Columns**: 💤 Backlog (backlog) | 📝 To Do (todo) | ✅ Done (done)

**Backlog file**: backlog.md (backlog)

---

## Tasks

`;
const block = (n, title, status, extra = '') => `### TASK-00${n} | ${title}\n**Status**: ${status}  \n${extra}\n`;
const board = HEAD
  + block(1, 'Ship', 'todo', '**Priority**: High  \n**Blocked by**: TASK-002, TASK-003, TASK-009  \n**Tags**: #x  \n\nDesc.\n')
  + block(2, 'Build', 'todo')
  + block(4, 'Docs', 'done', '**Blocked by**: TASK-003  \n');
const backlog = `# Backlog\n\n<!-- Format: v3 -->\n\n## 📥 Backlog\n\n${block(3, 'Parked', 'backlog')}`;
const archive = `# Task Archive\n\n<!-- Format: v3 -->\n\n## ✅ Archives\n\n${block(5, 'Old', 'done')}`;
const ws = { board, backlog, archive };
const apply = (w, op) => applyOp(w, op, { today: () => '2026-01-01' });
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof BoardError); return e.code; } return null; };

test('Blocked by parses to ids, and survives generating the board again', () => {
  const p = parseBoard(board);
  assert.deepEqual(p.tasks[0].blockedBy, ['TASK-002', 'TASK-003', 'TASK-009']);
  assert.deepEqual(p.tasks[1].blockedBy, []);
  assert.equal(p.tasks[0].description, 'Desc.');
  const again = parseBoard(generateBoard(p));
  assert.deepEqual(again.tasks.map((t) => t.blockedBy), p.tasks.map((t) => t.blockedBy));
});

test('parseTaskIds is forgiving about the way ids are written, and drops anything else', () => {
  assert.deepEqual(parseTaskIds('task-7, TASK-007 ,TASK-12 nope TASK-x'), ['TASK-007', 'TASK-012']);
});

test('the field sits after Tags, and is not description text', () => {
  const out = apply({ board: HEAD + block(1, 'A', 'todo', '**Tags**: #x  \n') + block(2, 'B', 'todo') }, { type: 'updateTask', id: 'TASK-001', set: { blockedBy: ['TASK-002'] } }).board;
  assert.match(out, /\*\*Tags\*\*: #x {2}\n\*\*Blocked by\*\*: TASK-002 {2}\n/);
  assert.equal(parseBoard(out).tasks[0].description, '');
});

test('updateTask on blockedBy touches only that line, and clearing removes it', () => {
  const one = apply(ws, { type: 'updateTask', id: 'TASK-001', set: { blockedBy: ['TASK-002'] } });
  const s = diffStats(ws.board, one.board);
  assert.deepEqual([s.removed, s.added], [1, 1]);
  const none = apply(ws, { type: 'updateTask', id: 'TASK-001', set: { blockedBy: [] } });
  assert.ok(!/TASK-001 \| Ship[\s\S]*?\*\*Blocked by\*\*[\s\S]*?### TASK-002/.test(none.board));
  assert.ok(none.board.includes('**Blocked by**: TASK-003'), 'other tasks keep their own');
});

test('moves, archives and other edits leave Blocked by alone', () => {
  for (const op of [{ type: 'moveTask', id: 'TASK-001', status: 'done' }, { type: 'updateTask', id: 'TASK-001', set: { priority: 'Low', description: 'New.' } }]) {
    const out = apply(ws, op);
    assert.deepEqual(parseBoard(out.board).tasks[0].blockedBy, ['TASK-002', 'TASK-003', 'TASK-009']);
  }
});

test('blockedBy is validated: real tasks only, not itself; any file counts; cycles are allowed', () => {
  assert.equal(code(() => apply(ws, { type: 'updateTask', id: 'TASK-001', set: { blockedBy: ['TASK-777'] } })), 'unknown_task');
  assert.equal(code(() => apply(ws, { type: 'updateTask', id: 'TASK-001', set: { blockedBy: ['TASK-001'] } })), 'invalid_field');
  assert.equal(code(() => apply(ws, { type: 'updateTask', id: 'TASK-001', set: { blockedBy: ['nonsense'] } })), 'invalid_field');
  const ok = apply(ws, { type: 'updateTask', id: 'TASK-001', set: { blockedBy: '3, 5' } }); // backlog and archive both exist
  assert.deepEqual(parseBoard(ok.board).tasks[0].blockedBy, ['TASK-003', 'TASK-005']);
  const cyc = apply(ws, { type: 'updateTask', id: 'TASK-002', set: { blockedBy: ['TASK-001'] } });
  assert.deepEqual(parseBoard(cyc.board).tasks[1].blockedBy, ['TASK-001']);
});

test('createTask accepts blockedBy', () => {
  const out = apply(ws, { type: 'createTask', task: { title: 'New', status: 'todo', blockedBy: ['TASK-002'] } });
  assert.deepEqual(parseBoard(out.board).tasks.at(-1).blockedBy, ['TASK-002']);
  assert.equal(code(() => apply(ws, { type: 'createTask', task: { title: 'New', blockedBy: ['TASK-777'] } })), 'unknown_task');
});

test('open blockers: backlog counts as open, the last column and the archive as done, a missing id as unknown', () => {
  const p = parseBoard(board);
  const byId = indexTasks({ board: p.tasks, backlog: [{ id: 'TASK-003', status: 'backlog', blockedBy: [] }], archive: [{ id: 'TASK-005', status: 'done', blockedBy: [] }] });
  const r = blockersOf(p.tasks[0], byId, p.config.columns);
  assert.deepEqual(r.open.map((e) => [e.task.id, e.where]), [['TASK-002', 'board'], ['TASK-003', 'backlog']]);
  assert.deepEqual(r.unknown, ['TASK-009']);
  assert.deepEqual(blockersOf({ blockedBy: ['TASK-005'] }, byId, p.config.columns).done.map((e) => e.task.id), ['TASK-005']);
  assert.deepEqual(blockedByThis('TASK-003', byId).map((e) => e.task.id), ['TASK-001', 'TASK-004']);
});

test('hasCycle follows the links', () => {
  const byId = indexTasks({ board: [{ id: 'A', blockedBy: ['B'] }, { id: 'B', blockedBy: ['C'] }, { id: 'C', blockedBy: ['A'] }, { id: 'D', blockedBy: ['A'] }] });
  assert.equal(hasCycle('A', byId), true);
  assert.equal(hasCycle('D', byId), false);
});

test('reads derive openBlockers and blocks across board, backlog and archive', () => {
  const t1 = getTask(ws, 'TASK-001');
  assert.deepEqual(t1.blockedBy, ['TASK-002', 'TASK-003', 'TASK-009']);
  assert.deepEqual(t1.openBlockers, ['TASK-002', 'TASK-003']); // 009 is unknown, so it is not counted
  assert.deepEqual(getTask(ws, 'TASK-003').blocks, ['TASK-001', 'TASK-004']);
  assert.deepEqual(getTask(ws, 'TASK-004').openBlockers, ['TASK-003']); // a task in the last column still names its blocker
  const row = getBoard(ws, { fields: ['title', 'openBlockers'] }).tasks.find((t) => t.id === 'TASK-001');
  assert.deepEqual(row, { id: 'TASK-001', title: 'Ship', openBlockers: ['TASK-002', 'TASK-003'] });
});
