// Tests for the read side (core/read.js) and the token savings it exists to deliver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getBoard, getTask, getConfig, listArchive, getStats, summarizeChanges, dueStatus } from '../core/read.js';
import { applyOp } from '../core/ops.js';
import { parseBoard } from '../core/board.js';
import { migrateBoardText, migrateArchiveText } from '../core/migrate.js';
import { BoardError } from '../core/text.js';
import { measure, tokens } from './tools/measure.mjs';

const raw = (n) => readFileSync(new URL(`./fixtures/${n}.md`, import.meta.url), 'utf8');
const board = migrateBoardText(raw('demo.kanban')).text;
const ws = { board, archive: migrateArchiveText(raw('demo.archive'), parseBoard(board).config.columns).text };
const TODAY = '2026-10-25';
const q = (args) => getBoard(ws, args, { today: TODAY });
const ids = (r) => r.tasks.map((t) => t.id);
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof BoardError); return e.code; } return null; };

// ---- get_board -----------------------------------------------------------------------------------

test('get_board returns summaries in display order with column counts and a rev', () => {
  const r = q({});
  assert.equal(r.total, 15);
  assert.deepEqual(r.columns.map((c) => [c.id, c.count]), [['backlog', 5], ['in-progress', 3], ['review', 3], ['done', 4]]);
  assert.match(r.rev, /^[0-9a-z]+$/);
  const t = r.tasks[0];
  assert.deepEqual(Object.keys(t), ['id', 'title', 'status', 'priority', 'assignees', 'tags', 'etag']);
  assert.ok(!('description' in t) && !('subtasks' in t) && !('notes' in t), 'no heavy fields in a summary');
});

test('empty fields are omitted from rows', () => {
  const bare = applyOp(ws, { type: 'createTask', task: { title: 'Bare' } }).board;
  const row = getBoard({ board: bare, archive: null }, { text: 'Bare' }).tasks[0];
  assert.deepEqual(Object.keys(row), ['id', 'title', 'status', 'etag']);
});

test('filters: status, assignee (with or without @ and display name), tag, priority, category', () => {
  assert.ok(q({ status: 'review' }).tasks.every((t) => t.status === 'review'));
  assert.equal(q({ status: 'review,done' }).total, 7);
  const alice = q({ assignee: '@alice' }).tasks, alice2 = q({ assignee: 'alice' }).tasks;
  assert.ok(alice.length > 0);
  assert.deepEqual(ids({ tasks: alice }), ids({ tasks: alice2 }));
  assert.ok(q({ tag: '#security' }).tasks.every((t) => t.tags.includes('#security')));
  assert.equal(q({ tag: 'bug,ui' }).tasks.every((t) => t.tags.includes('#bug') && t.tags.includes('#ui')), true);
  assert.ok(q({ priority: 'critical' }).tasks.every((t) => t.priority === 'Critical'));
  assert.ok(q({ category: 'design' }).total > 0);
});

test('filters combine with AND, and text needs every word', () => {
  const both = q({ status: 'in-progress', assignee: 'alice' });
  assert.ok(both.tasks.every((t) => t.status === 'in-progress' && t.assignees.includes('@alice')));
  assert.equal(q({ text: 'zzz-nothing' }).total, 0);
  const one = q({ text: 'rate limiting' });
  assert.deepEqual(ids(one), ['TASK-002']);
  assert.equal(q({ text: 'rate banana' }).total, 0);
});

test('dueBefore and overdue follow the page rule (a finished task is never overdue)', () => {
  const od = q({ overdue: true });
  assert.ok(od.total > 0 && od.tasks.every((t) => t.due < TODAY));
  assert.equal(q({ dueBefore: '2026-10-16' }).tasks.every((t) => t.due < '2026-10-16'), true);
  assert.equal(dueStatus({ due: '2026-10-20', completed: '2026-10-21' }, TODAY), null);
  assert.equal(dueStatus({ due: '2026-10-25', completed: '' }, TODAY), 'soon');
  assert.equal(dueStatus({ due: '2026-10-28', completed: '' }, TODAY), null);
  assert.equal(dueStatus({ due: '2026-02-31', completed: '' }, TODAY), null); // impossible date
});

test('paging: limit, offset, nextOffset', () => {
  const a = q({ limit: 4 });
  assert.equal(a.returned, 4);
  assert.equal(a.nextOffset, 4);
  const b = q({ limit: 4, offset: 4 });
  assert.deepEqual(ids(b).filter((i) => ids(a).includes(i)), []);
  const last = q({ limit: 4, offset: 12 });
  assert.equal(last.returned, 3);
  assert.ok(!('nextOffset' in last));
  assert.equal(code(() => q({ limit: 0 })), 'invalid_field');
  assert.equal(code(() => q({ limit: 501 })), 'invalid_field');
});

test('fields replace the default columns, id is always kept', () => {
  const r = q({ fields: 'title,progress', limit: 2 });
  assert.deepEqual(Object.keys(r.tasks[0]), ['id', 'title', 'progress']);
  assert.match(r.tasks[0].progress, /^\d+\/\d+$/);
  assert.equal(code(() => q({ fields: 'bogus' })), 'invalid_field');
});

test('errors list the valid choices', () => {
  let e;
  try { q({ status: 'nope' }); } catch (x) { e = x; }
  assert.equal(e.code, 'unknown_status');
  assert.deepEqual(e.valid, ['backlog', 'in-progress', 'review', 'done']);
  assert.equal(code(() => q({ dueBefore: 'tomorrow' })), 'invalid_date');
});

test('manual order: rows come back in key order and show their key', () => {
  let w = ws;
  w = { ...w, board: applyOp(w, { type: 'sortTasks', mode: 'positions' }).board };
  w = { ...w, board: applyOp(w, { type: 'moveTask', id: 'TASK-001', status: 'backlog', atEnd: true }).board };
  const r = getBoard(w, { status: 'backlog' }, { today: TODAY });
  assert.equal(r.tasks.at(-1).id, 'TASK-001');
  assert.ok(r.tasks.every((t) => typeof t.order === 'number'));
});

test('rev changes with any edit; the etag in a row works as ifMatch, and goes stale after an edit', () => {
  const before = q({ status: 'backlog' });
  const row = before.tasks[0];
  const edited = applyOp(ws, { type: 'updateTask', id: row.id, set: { title: 'Changed' }, ifMatch: row.etag });
  const w2 = { board: edited.board, archive: ws.archive };
  assert.notEqual(getBoard(w2, {}, { today: TODAY }).rev, before.rev);
  assert.equal(code(() => applyOp(w2, { type: 'updateTask', id: row.id, set: { title: 'Again' }, ifMatch: row.etag })), 'conflict');
  const fresh = getTask(w2, row.id).etag;
  assert.equal(fresh, edited.result.etag);
});

// ---- get_task / config / archive / stats --------------------------------------------------------

test('get_task accepts TASK-004, task-4 and 4; returns everything non-empty plus the etag', () => {
  for (const id of ['TASK-004', 'task-4', '4']) assert.equal(getTask(ws, id).id, 'TASK-004');
  const t = getTask(ws, 'TASK-001');
  assert.ok(t.description && t.subtasks.length === 3 && t.etag);
  assert.ok(!('notes' in t), 'empty notes omitted');
  assert.deepEqual(Object.keys(getTask(ws, 'TASK-001', { fields: 'status,progress' })), ['id', 'status', 'progress']);
  assert.equal(code(() => getTask(ws, 'TASK-999')), 'unknown_task');
});

test('get_task finds archived tasks and says so', () => {
  const a = listArchive(ws).tasks[0];
  const t = getTask(ws, a.id);
  assert.equal(t.archived, true);
  assert.equal(t.etag, a.etag);
});

test('get_config gives what an agent needs to write valid values', () => {
  const c = getConfig(ws);
  assert.deepEqual(c.columns.map((x) => x.id), ['backlog', 'in-progress', 'review', 'done']);
  assert.deepEqual(c.priorities, ['Critical', 'High', 'Medium', 'Low']);
  assert.equal(c.formatVersion, 3);
  assert.ok(!('migrationNeeded' in c));
  assert.equal(c.manualOrder, false);
  assert.equal(c.tasks, 15);
  assert.equal(c.archived, 4);
});

test('reads work on older formats too, and say a migration is needed', () => {
  for (const name of ['demo', 'examples-v1']) {
    const old = { board: raw(`${name}.kanban`), archive: null };
    const c = getConfig(old);
    assert.equal(c.migrationNeeded, true, name);
    assert.ok(getBoard(old, {}).total > 0);
  }
});

test('list_archive filters, pages and reverses', () => {
  const all = listArchive(ws);
  assert.equal(all.total, 4);
  assert.deepEqual(ids(listArchive(ws, { reverse: true })), ids(all).reverse());
  assert.equal(listArchive(ws, { limit: 1 }).nextOffset, 1);
  assert.equal(listArchive(ws, { text: 'zzz' }).total, 0);
});

test('get_board_stats counts everything and flags overdue and due soon', () => {
  const s = getStats(ws, { today: TODAY });
  assert.equal(s.total, 15);
  assert.equal(Object.values(s.byStatus).reduce((a, b) => a + b, 0), 15);
  assert.equal(s.unassigned + Object.values(s.byAssignee).reduce((a, b) => a + b, 0) >= 15, true);
  assert.deepEqual(s.overdue.map((t) => t.id).sort(), getBoard(ws, { overdue: true }, { today: TODAY }).tasks.map((t) => t.id).sort());
  assert.deepEqual(s.overdue.map((t) => t.due), [...s.overdue.map((t) => t.due)].sort(), 'oldest first');
  const soon = getStats(ws, { today: '2026-10-21' });
  assert.ok(soon.dueSoon.length > 0);
});

test('stats lists are capped, with the real total alongside', () => {
  const tasks = Array.from({ length: 30 }, (_, i) => `### TASK-${String(i + 1).padStart(3, '0')} | t${i}\n**Status**: todo\n**Due**: 2020-01-${String((i % 28) + 1).padStart(2, '0')}\n`).join('\n');
  const big = `# B\n\n<!-- Format: v3 -->\n\n## Tasks\n\n${tasks}`;
  const s = getStats({ board: big, archive: null }, { today: TODAY });
  assert.equal(s.overdue.length, 20);
  assert.equal(s.overdueTotal, 30);
});

test('changes since: filters by time, compacts, and points at rev', () => {
  const entries = [
    { ts: '2026-10-25T10:00:00Z', actor: 'a', op: 'moveTask', id: 'TASK-001', files: ['kanban.md'] },
    { ts: '2026-10-25T11:00:00Z', actor: 'b', op: 'archiveTask', id: 'TASK-002', files: ['archive.md', 'kanban.md'] },
    { ts: '2026-10-25T12:00:00Z', actor: 'a', op: 'migrate', id: null, files: [] },
  ];
  const r = summarizeChanges(entries, { since: '2026-10-25T10:30:00Z', rev: 'r1' });
  assert.deepEqual(r.changes, [{ ts: '2026-10-25T11:00:00Z', actor: 'b', op: 'archiveTask', id: 'TASK-002' }, { ts: '2026-10-25T12:00:00Z', actor: 'a', op: 'migrate' }]);
  assert.equal(r.rev, 'r1');
  assert.equal(summarizeChanges(entries, { limit: 1 }).truncated, 2);
});

// ---- the point of all this -----------------------------------------------------------------------

test('token savings hold: targeted reads cost a small fraction of reading the file', () => {
  const m = measure();
  const big = m.scenarios.filter((s) => s.board.startsWith('synthetic'));
  const ratio = (label) => { const s = big.find((x) => x.question.includes(label)); return s.tool / s.raw; };
  assert.ok(ratio('in "') < 0.10, 'a column listing should be under 10% of the file');
  assert.ok(ratio('overdue') < 0.10);
  assert.ok(ratio('security') < 0.05);
  assert.ok(ratio('in full') < 0.05);
  assert.ok(ratio('counts') < 0.10);
  assert.ok(ratio('every task') < 0.25, 'even a full first page stays well under the raw file');
  assert.ok(tokens(m.toolSchemas) < 1200, 'the tool schemas must stay small: they are paid every session');
  assert.ok(m.toolSchemas < m.rules / 3, 'and far smaller than the format rules they replace');
});
