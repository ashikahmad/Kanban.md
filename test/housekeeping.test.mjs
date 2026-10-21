// Housekeeping: the policy line, the suggestions, bulk archive, and the CLI command.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseHousekeepingSpec, formatHousekeepingSpec, resolveHousekeeping, normalizeHousekeeping } from '../core/housekeeping-spec.js';
import { getHousekeeping, archiveCandidates } from '../core/housekeeping.js';
import { parseBoard, parseArchive, generateBoard, createDefaultBoardContent } from '../core/board.js';
import { applyOp } from '../core/ops.js';
import { getStats, getConfig } from '../core/read.js';
import { BoardError, diffStats } from '../core/text.js';

const TODAY = '2026-10-25';
const CLI = new URL('../cli/kanbanmd.js', import.meta.url).pathname;
const task = (id, o = {}) => ({ id, title: `Task ${id}`, status: 'todo', order: null, priority: '', category: '', assignees: [], tags: [], created: '2026-10-01', started: '', due: '', completed: '', description: '', subtasks: [], notes: '', extra: '', ...o });
function board(tasks, housekeeping = null, columns) {
  const base = parseBoard(createDefaultBoardContent()).config;
  const config = { ...base, columns: columns || [{ name: '📥 Backlog', id: 'backlog' }, { name: 'To Do', id: 'todo' }, { name: '✅ Done', id: 'done' }], housekeeping, lastTaskId: 99 };
  return generateBoard({ config, tasks });
}
const ws = (tasks, hk, cols) => ({ board: board(tasks, hk, cols), archive: null });
const kinds = (r) => r.suggestions.map((s) => s.kind);
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof BoardError); return e.code; } return null; };

// ---- the policy line ------------------------------------------------------------------------------

test('the policy line parses, formats and round-trips', () => {
  for (const s of ['done=done after=30d | backlog=backlog after=90d | max=200', 'off', 'max=150', 'done=shipped after=14d', 'backlog=ideas']) {
    assert.equal(formatHousekeepingSpec(parseHousekeepingSpec(s)), s);
  }
  assert.deepEqual(parseHousekeepingSpec('done=done after=30'), { enabled: true, done: { column: 'done', afterDays: 30 } }, 'after= without the d');
  assert.deepEqual(parseHousekeepingSpec('garbage here'), { enabled: true }, 'nothing recognised: just the defaults');
  assert.deepEqual(parseHousekeepingSpec(formatHousekeepingSpec({ enabled: true, done: { afterDays: 3 } })), { enabled: true, done: { afterDays: 3 } }, 'a day count without a column');
  assert.deepEqual(parseHousekeepingSpec('nonsense | max=5'), { enabled: true, max: 5 }, 'unknown segments are ignored');
  assert.equal(parseHousekeepingSpec(undefined), null);
  assert.deepEqual(normalizeHousekeeping({ enabled: true, max: 7 }), { enabled: true, max: 7 });
});

test('with no line the defaults apply and the done / backlog columns are guessed from their names', () => {
  const p = resolveHousekeeping({ columns: [{ id: 'backlog', name: '📥 Backlog' }, { id: 'todo', name: 'To Do' }, { id: 'done', name: '✅ Done' }], housekeeping: null });
  assert.deepEqual([p.enabled, p.done, p.backlog, p.max], [true, { column: 'done', afterDays: 30 }, { column: 'backlog', afterDays: 90 }, 200]);
  const named = resolveHousekeeping({ columns: [{ id: 'col2', name: '🚀 Shipped' }, { id: 'col3', name: 'Ideas backlog' }], housekeeping: null });
  assert.equal(named.done.column, 'col2');
  assert.equal(named.backlog.column, 'col3');
  const none = resolveHousekeeping({ columns: [{ id: 'a', name: 'Alpha' }], housekeeping: null });
  assert.deepEqual([none.done.column, none.backlog.column], [null, null]);
  assert.equal(resolveHousekeeping({ columns: [{ id: 'a', name: 'Alpha' }], housekeeping: { enabled: true, done: { column: 'ghost' } } }).done.column, null, 'a configured column that does not exist is skipped');
  assert.equal(resolveHousekeeping({ columns: [], housekeeping: { enabled: false } }).enabled, false);
});

test('the line lives in the config section and survives parse -> generate', () => {
  const md = board([task('TASK-001')], { enabled: true, done: { column: 'done', afterDays: 14 }, max: 50 });
  assert.match(md, /\*\*Tags\*\*:[^\n]*\n\n\*\*Housekeeping\*\*: done=done after=14d \| max=50\n\n---/);
  assert.deepEqual(parseBoard(md).config.housekeeping, { enabled: true, done: { column: 'done', afterDays: 14 }, max: 50 });
  assert.equal(parseBoard(board([task('TASK-001')])).config.housekeeping, null);
  assert.ok(!board([task('TASK-001')]).includes('Housekeeping'), 'absent stays absent');
});

// ---- suggestions ----------------------------------------------------------------------------------

test('archive_done: finished long enough ago, oldest first; undated done tasks are counted, not aged', () => {
  const r = getHousekeeping(ws([
    task('TASK-001', { status: 'done', completed: '2026-09-01' }),
    task('TASK-002', { status: 'done', completed: '2026-08-01' }),
    task('TASK-003', { status: 'done', completed: '2026-10-20' }), // recent
    task('TASK-004', { status: 'done' }),                           // no date
    task('TASK-005', { status: 'todo', completed: '2026-01-01' }),  // not in the done column
  ]), { today: TODAY });
  const s = r.suggestions.find((x) => x.kind === 'archive_done');
  assert.deepEqual([s.count, s.ids, s.undated, s.afterDays], [2, ['TASK-002', 'TASK-001'], 1, 30]);
  assert.match(s.message, /2 task\(s\) in "done" were finished 30\+ days ago/);
});

test('the boundary is inclusive: exactly N days old is due, N-1 is not', () => {
  const r = getHousekeeping(ws([task('TASK-001', { status: 'done', completed: '2026-09-25' }), task('TASK-002', { status: 'done', completed: '2026-09-26' })]), { today: TODAY });
  assert.deepEqual(r.suggestions[0].ids, ['TASK-001']);
});

test('stale_backlog: old by created date, or long past due', () => {
  const r = getHousekeeping(ws([
    task('TASK-001', { status: 'backlog', created: '2026-06-01' }),
    task('TASK-002', { status: 'backlog', created: '2026-10-20', due: '2026-06-01' }),
    task('TASK-003', { status: 'backlog', created: '2026-10-20' }),
    task('TASK-004', { status: 'todo', created: '2025-01-01' }),
  ]), { today: TODAY });
  const s = r.suggestions.find((x) => x.kind === 'stale_backlog');
  assert.deepEqual(s.ids, ['TASK-001', 'TASK-002'].sort((a, b) => (a === 'TASK-001' ? '2026-06-01' : '2026-10-20').localeCompare(b === 'TASK-001' ? '2026-06-01' : '2026-10-20')));
  assert.equal(s.count, 2);
});

test('board_large: more tasks than max', () => {
  const tasks = Array.from({ length: 6 }, (_, i) => task(`TASK-00${i + 1}`));
  assert.deepEqual(kinds(getHousekeeping(ws(tasks, { enabled: true, max: 5 }), { today: TODAY })), ['board_large']);
  assert.deepEqual(kinds(getHousekeeping(ws(tasks, { enabled: true, max: 6 }), { today: TODAY })), []);
});

test('nothing over a threshold means no suggestions at all', () => {
  assert.deepEqual(getHousekeeping(ws([task('TASK-001'), task('TASK-002', { status: 'done', completed: '2026-10-24' })]), { today: TODAY }).suggestions, []);
});

test('off silences everything, and a custom policy is honoured', () => {
  const old = [task('TASK-001', { status: 'done', completed: '2026-01-01' })];
  assert.deepEqual(getHousekeeping(ws(old, { enabled: false }), { today: TODAY }).suggestions, []);
  assert.deepEqual(archiveCandidates(ws(old, { enabled: false }), { today: TODAY }), []);
  assert.equal(getHousekeeping(ws([task('TASK-001', { status: 'done', completed: '2026-10-20' })], { enabled: true, done: { afterDays: 3 } }), { today: TODAY }).suggestions.length, 1);
});

test('a board with no done or backlog column gets only the size nudge', () => {
  const cols = [{ name: 'Alpha', id: 'alpha' }, { name: 'Beta', id: 'beta' }];
  const tasks = Array.from({ length: 4 }, (_, i) => task(`TASK-00${i + 1}`, { status: 'alpha', created: '2020-01-01' }));
  assert.deepEqual(kinds(getHousekeeping(ws(tasks, { enabled: true, max: 3 }, cols), { today: TODAY })), ['board_large']);
});

test('the listed ids are capped but the count and archiveCandidates are complete', () => {
  const tasks = Array.from({ length: 30 }, (_, i) => task(`TASK-${String(i + 1).padStart(3, '0')}`, { status: 'done', completed: '2026-01-01' }));
  const w = ws(tasks);
  const s = getHousekeeping(w, { today: TODAY }).suggestions.find((x) => x.kind === 'archive_done');
  assert.equal(s.count, 30);
  assert.equal(s.ids.length, 20);
  assert.equal(archiveCandidates(w, { today: TODAY }).length, 30);
});

// ---- bulk archive ---------------------------------------------------------------------------------

test('archiveTasks: many tasks, one edit, archive written first, blocks moved verbatim', () => {
  const tasks = [task('TASK-001', { status: 'done', completed: '2026-01-01', notes: 'keep me' }), task('TASK-002'), task('TASK-003', { status: 'done', completed: '2026-01-02' })];
  const w = ws(tasks);
  const out = applyOp(w, { type: 'archiveTasks', ids: ['TASK-001', 'TASK-003'] });
  assert.deepEqual(out.files.map((f) => f.name), ['archive.md', 'kanban.md']);
  assert.deepEqual(parseBoard(out.board).tasks.map((t) => t.id), ['TASK-002']);
  const cols = parseBoard(out.board).config.columns;
  assert.deepEqual(parseArchive(out.archive, cols).tasks.map((t) => t.id), ['TASK-001', 'TASK-003']);
  assert.equal(parseArchive(out.archive, cols).tasks[0].notes, 'keep me');
  assert.equal(out.result.count, 2);
  assert.equal(diffStats(w.board, out.board).added, 0, 'the board only loses lines');
});

test('archiveTasks is all or nothing, and rejects empty or duplicate-safe input', () => {
  const w = ws([task('TASK-001'), task('TASK-002')]);
  assert.equal(code(() => applyOp(w, { type: 'archiveTasks', ids: ['TASK-001', 'TASK-404'] })), 'unknown_task');
  assert.equal(code(() => applyOp(w, { type: 'archiveTasks', ids: [] })), 'missing_field');
  assert.equal(applyOp(w, { type: 'archiveTasks', ids: ['TASK-001', 'TASK-001'] }).result.count, 1, 'duplicates collapse');
});

// ---- setHousekeeping ------------------------------------------------------------------------------

test('setHousekeeping inserts, replaces, turns off and resets the line, one line each time', () => {
  let w = ws([task('TASK-001')]);
  const step = (op) => { const out = applyOp(w, op); const d = diffStats(w.board, out.board); w = { board: out.board, archive: null }; return d; };
  assert.deepEqual([step({ type: 'setHousekeeping', done: { column: 'done', afterDays: 14 }, max: 80 }).added], [2]); // line + blank
  assert.deepEqual(parseBoard(w.board).config.housekeeping, { enabled: true, done: { column: 'done', afterDays: 14 }, max: 80 });
  const rep = step({ type: 'setHousekeeping', max: 90 });
  assert.deepEqual([rep.removed, rep.added], [1, 1]);
  step({ type: 'setHousekeeping', off: true });
  assert.match(w.board, /\*\*Housekeeping\*\*: off/);
  step({ type: 'setHousekeeping', reset: true });
  assert.ok(!w.board.includes('Housekeeping'));
  assert.equal(parseBoard(w.board).config.housekeeping, null);
});

test('setHousekeeping validates', () => {
  const w = ws([task('TASK-001')]);
  assert.equal(code(() => applyOp(w, { type: 'setHousekeeping', done: { column: 'nope' } })), 'unknown_status');
  assert.equal(code(() => applyOp(w, { type: 'setHousekeeping', done: { afterDays: 0 } })), 'invalid_field');
  assert.equal(code(() => applyOp(w, { type: 'setHousekeeping', max: 1.5 })), 'invalid_field');
  assert.equal(code(() => applyOp(w, { type: 'setHousekeeping', backlog: 'x' })), 'invalid_field');
});

// ---- reads and CLI --------------------------------------------------------------------------------

test('stats carry the suggestions only when there are some; config carries the policy', () => {
  const quiet = getStats(ws([task('TASK-001')]), { today: TODAY });
  assert.ok(!('housekeeping' in quiet));
  const loud = getStats(ws([task('TASK-001', { status: 'done', completed: '2026-01-01' })]), { today: TODAY });
  assert.equal(loud.housekeeping[0].kind, 'archive_done');
  const c = getConfig(ws([task('TASK-001')]));
  assert.deepEqual(c.housekeeping.done, { column: 'done', afterDays: 30 });
});

function project(tasks, hk) {
  const dir = mkdtempSync(join(tmpdir(), 'kanbanmd-hk-'));
  writeFileSync(join(dir, 'kanban.md'), board(tasks, hk));
  return dir;
}
const cli = (dir, ...a) => JSON.parse(spawnSync(process.execPath, [CLI, '--dir', dir, ...a], { encoding: 'utf8' }).stdout);

test('cli housekeeping: shows suggestions, --apply archives the finished ones in one edit, --set edits the policy', () => {
  const dir = project([task('TASK-001', { status: 'done', completed: '2020-01-01' }), task('TASK-002', { status: 'done', completed: '2020-02-01' }), task('TASK-003')]);
  const shown = cli(dir, 'housekeeping');
  assert.equal(shown.suggestions[0].kind, 'archive_done');
  assert.equal(shown.suggestions[0].count, 2);
  const dry = cli(dir, '--dry-run', 'housekeeping', '--apply');
  assert.equal(dry.dryRun, true);
  assert.ok(!existsSync(join(dir, 'archive.md')));
  const done = cli(dir, 'housekeeping', '--apply');
  assert.equal(done.archived, 2);
  assert.deepEqual(parseBoard(readFileSync(join(dir, 'kanban.md'), 'utf8')).tasks.map((t) => t.id), ['TASK-003']);
  assert.match(readFileSync(join(dir, 'archive.md'), 'utf8'), /TASK-001[\s\S]*TASK-002/);
  assert.equal(cli(dir, 'housekeeping', '--apply').archived, 0, 'nothing left to archive');
  assert.equal(cli(dir, 'housekeeping', '--set', 'done=done after=7d | max=40').ok, true);
  assert.deepEqual(parseBoard(readFileSync(join(dir, 'kanban.md'), 'utf8')).config.housekeeping, { enabled: true, done: { column: 'done', afterDays: 7 }, max: 40 });
  cli(dir, 'housekeeping', '--set', 'off');
  assert.equal(cli(dir, 'housekeeping').suggestions.length, 0);
  assert.equal(cli(dir, 'housekeeping', '--set', 'reset').ok, true);
});
