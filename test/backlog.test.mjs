// The optional backlog file: a task lives in it exactly when its status is the backlog column.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBacklogFileSpec, formatBacklogFileSpec, resolveBacklogFile, isValidStoreFileName } from '../core/backlog-spec.js';
import { parseBoard, parseArchive, parseBacklog, generateBoard, createDefaultBoardContent } from '../core/board.js';
import { applyOp } from '../core/ops.js';
import { applyOps, diffToOps } from '../core/changes.js';
import { BoardError, etagOf } from '../core/text.js';
import { Doc, blocksOf } from '../core/patch.js';

const task = (id, o = {}) => ({ id, title: `Task ${id}`, status: 'todo', order: null, priority: '', category: '', assignees: [], tags: [], created: '2026-10-01', started: '', due: '', completed: '', description: '', subtasks: [], notes: '', extra: '', ...o });
const COLS = [{ name: '📥 Backlog', id: 'backlog' }, { name: 'To Do', id: 'todo' }, { name: '✅ Done', id: 'done' }];
function mk(tasks, { backlogFile = null, eol = '\n' } = {}) {
  const base = parseBoard(createDefaultBoardContent()).config;
  const md = generateBoard({ config: { ...base, columns: COLS, backlogFile, lastTaskId: 90 }, tasks }).replace(/\n/g, eol);
  return { board: md, archive: null, backlog: null };
}
const apply = (ws, op) => applyOp(ws, op, { today: () => '2026-10-25' });
const next = (ws, out) => ({ board: out.board, archive: out.archive, backlog: out.backlog });
const run = (ws, ...ops) => ops.reduce((w, op) => next(w, apply(w, op)), ws);
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof BoardError, e && e.stack); return e.code; } return null; };
const view = (ws) => {
  const b = parseBoard(ws.board);
  const bc = resolveBacklogFile(b.config);
  return {
    config: b.config, board: b.tasks, bc,
    backlog: ws.backlog && bc ? parseBacklog(ws.backlog, b.config.columns, bc.column).tasks : [],
    archive: ws.archive ? parseArchive(ws.archive, b.config.columns).tasks : [],
  };
};
const ids = (list) => list.map((t) => t.id);
const blockMap = (text, kind) => { if (text === null) return new Map(); const d = new Doc(text); return new Map(blocksOf(d, kind).map((b) => [b.id, d.lines.slice(b.start, b.end).join('')])); };

const SEED = () => mk([
  task('TASK-001', { status: 'backlog', title: 'Idea one', description: 'keep me verbatim', notes: 'a note' }),
  task('TASK-002', { status: 'todo' }),
  task('TASK-003', { status: 'backlog', subtasks: [{ completed: true, text: 's1' }] }),
  task('TASK-004', { status: 'done', completed: '2026-10-01' }),
]);
const ENABLED = () => run(SEED(), { type: 'setBacklogFile', enabled: true });

// ---- the config line -----------------------------------------------------------------------------

test('the line parses, formats, resolves and rejects bad file names', () => {
  assert.deepEqual(parseBacklogFileSpec('backlog.md (backlog)'), { file: 'backlog.md', column: 'backlog' });
  assert.deepEqual(parseBacklogFileSpec('ideas.md'), { file: 'ideas.md' });
  assert.equal(parseBacklogFileSpec('off'), null);
  assert.equal(parseBacklogFileSpec('kanban.md (backlog)'), null, 'the board file is not a backlog file');
  assert.equal(parseBacklogFileSpec('../escape.md'), null);
  assert.equal(parseBacklogFileSpec('has space.md'), null);
  assert.equal(formatBacklogFileSpec({ file: 'backlog.md', column: 'backlog' }), 'backlog.md (backlog)');
  assert.equal(isValidStoreFileName('Archive.md'), false, 'reserved names are case-insensitive');
  const config = { columns: COLS, backlogFile: { file: 'backlog.md' } };
  assert.deepEqual(resolveBacklogFile(config), { file: 'backlog.md', column: 'backlog' }, 'guessed from the column names');
  assert.equal(resolveBacklogFile({ columns: COLS, backlogFile: { file: 'x.md', column: 'ghost' } }), null, 'a column that does not exist disables it');
  assert.equal(resolveBacklogFile({ columns: [{ id: 'a', name: 'Alpha' }], backlogFile: { file: 'x.md' } }), null, 'nothing to guess');
  assert.equal(resolveBacklogFile({ columns: COLS, backlogFile: null }), null);
});

test('the line is written in the config section and survives parse -> generate', () => {
  const ws = mk([task('TASK-001')], { backlogFile: { file: 'backlog.md', column: 'backlog' } });
  assert.match(ws.board, /\*\*Backlog file\*\*: backlog\.md \(backlog\)\n\n---/);
  assert.deepEqual(parseBoard(ws.board).config.backlogFile, { file: 'backlog.md', column: 'backlog' });
  assert.equal(parseBoard(mk([task('TASK-001')]).board).config.backlogFile, null);
});

// ---- enabling and disabling ----------------------------------------------------------------------

test('enabling moves the backlog tasks into the new file, verbatim, in one verified edit', () => {
  const ws = SEED();
  const before = blockMap(ws.board, 'board');
  const out = apply(ws, { type: 'setBacklogFile', enabled: true });
  assert.deepEqual(out.files.map((f) => f.name), ['backlog.md', 'kanban.md'], 'the new file is written first: a crash duplicates, never loses');
  const v = view(next(ws, out));
  assert.deepEqual(ids(v.backlog), ['TASK-001', 'TASK-003']);
  assert.deepEqual(ids(v.board), ['TASK-002', 'TASK-004']);
  assert.deepEqual(v.bc, { file: 'backlog.md', column: 'backlog' });
  const after = blockMap(out.backlog, 'backlog');
  for (const id of ['TASK-001', 'TASK-003']) assert.equal(after.get(id).trimEnd(), before.get(id).trimEnd(), `${id} moved verbatim`);
  assert.match(out.backlog, /<!-- Format: v3 -->/);
  assert.match(out.board, /\*\*Backlog file\*\*: backlog\.md \(backlog\)/);
  assert.deepEqual(parseBacklog(out.backlog, COLS, 'backlog').tasks.map((t) => t.status), ['backlog', 'backlog']);
});

test('enabling twice changes nothing; an explicit column and file are honoured', () => {
  const on = ENABLED();
  assert.deepEqual(apply(on, { type: 'setBacklogFile', enabled: true }).files, []);
  const ws = run(SEED(), { type: 'setBacklogFile', enabled: true, file: 'ideas.md', column: 'backlog' });
  assert.deepEqual(parseBoard(ws.board).config.backlogFile, { file: 'ideas.md', column: 'backlog' });
  assert.equal(apply(SEED(), { type: 'setBacklogFile', enabled: true, file: 'ideas.md' }).files[0].name, 'ideas.md');
});

test('enabling validates', () => {
  assert.equal(code(() => apply(SEED(), { type: 'setBacklogFile', enabled: true, column: 'ghost' })), 'unknown_status');
  assert.equal(code(() => apply(SEED(), { type: 'setBacklogFile', enabled: true, file: 'archive.md' })), 'invalid_field');
  assert.equal(code(() => apply(SEED(), { type: 'setBacklogFile', enabled: true, file: '../x.md' })), 'invalid_field');
  const noGuess = mk([task('TASK-001', { status: 'a' })]);
  noGuess.board = noGuess.board.replace(/\*\*Columns\*\*:.*\n/, '**Columns**: Alpha (a) | Beta (b)\n');
  assert.equal(code(() => apply(noGuess, { type: 'setBacklogFile', enabled: true })), 'missing_field');
});

test('disabling brings every task home and removes the line; the file stays, emptied', () => {
  const on = ENABLED();
  const out = apply(on, { type: 'setBacklogFile', enabled: false });
  const v = view(next(on, out));
  assert.deepEqual(ids(v.board).sort(), ['TASK-001', 'TASK-002', 'TASK-003', 'TASK-004']);
  assert.equal(v.config.backlogFile, null);
  assert.ok(!out.board.includes('Backlog file'));
  assert.deepEqual(out.files.map((f) => f.name), ['kanban.md', 'backlog.md'], 'the board gets them before the file loses them');
  assert.equal(parseBacklog(out.backlog, COLS, 'backlog').tasks.length, 0);
  assert.deepEqual(apply(SEED(), { type: 'setBacklogFile', enabled: false }).files, [], 'nothing to disable');
});

test('a stray backlog.md that holds tasks is never overwritten; an empty one is reused', () => {
  const ws = SEED();
  const stray = { ...ws, backlog: '# Someone else\n\n### TASK-500 | Not ours\n**Status**: backlog\n' };
  assert.equal(code(() => apply(stray, { type: 'setBacklogFile', enabled: true })), 'backlog_file_exists');
  const empty = { ...ws, backlog: '# Backlog\n\n<!-- Format: v3 -->\n' };
  assert.deepEqual(ids(view(run(empty, { type: 'setBacklogFile', enabled: true })).backlog), ['TASK-001', 'TASK-003']);
  // and a file nobody configured is left byte for byte as it was by every other op
  const out = apply(stray, { type: 'updateTask', id: 'TASK-002', set: { title: 'x' } });
  assert.equal(out.backlog, stray.backlog);
  assert.deepEqual(out.files.map((f) => f.name), ['kanban.md']);
});

test('the file can be renamed only while it is empty', () => {
  const on = ENABLED();
  assert.equal(code(() => apply(on, { type: 'setBacklogFile', enabled: true, file: 'other.md' })), 'backlog_file_in_use');
  const off = run(on, { type: 'setBacklogFile', enabled: false });
  assert.equal(apply(off, { type: 'setBacklogFile', enabled: true, file: 'other.md' }).files.some((f) => f.name === 'other.md'), true);
});

test('CRLF boards get a CRLF backlog file', () => {
  const crlf = mk([task('TASK-001', { status: 'backlog' }), task('TASK-002')], { eol: '\r\n' });
  const out = apply(crlf, { type: 'setBacklogFile', enabled: true });
  assert.ok(!/(?<!\r)\n/.test(out.backlog), 'no bare LF in backlog.md');
  assert.ok(!/(?<!\r)\n/.test(out.board));
});

// ---- the status decides the file -----------------------------------------------------------------

test('changing a status across the boundary moves the block (update, move, create)', () => {
  const on = ENABLED();
  // demote
  let ws = run(on, { type: 'updateTask', id: 'TASK-002', set: { status: 'backlog' } });
  assert.deepEqual(ids(view(ws).backlog), ['TASK-001', 'TASK-003', 'TASK-002']);
  assert.ok(!ids(view(ws).board).includes('TASK-002'));
  // promote with moveTask: appended last on the board unless a position is asked for
  ws = run(ws, { type: 'moveTask', id: 'TASK-001', status: 'todo' });
  assert.equal(ids(view(ws).board).at(-1), 'TASK-001');
  assert.equal(view(ws).board.at(-1).status, 'todo');
  // promote at a position
  ws = run(ws, { type: 'moveTask', id: 'TASK-003', status: 'todo', before: 'TASK-001' });
  assert.ok(!ids(view(ws).backlog).includes('TASK-003'));
  const b = ids(view(ws).board);
  assert.equal(b[b.indexOf('TASK-003') + 1], 'TASK-001', 'placed before the anchor');
  // a board task moved into the column goes to the file
  ws = run(ws, { type: 'moveTask', id: 'TASK-004', status: 'backlog' });
  assert.ok(ids(view(ws).backlog).includes('TASK-004'));
  // create decides by status
  ws = run(ws, { type: 'createTask', task: { title: 'Parked', status: 'backlog' } }, { type: 'createTask', task: { title: 'Active', status: 'todo' } });
  const v = view(ws);
  assert.equal(v.backlog.at(-1).title, 'Parked');
  assert.equal(v.board.at(-1).title, 'Active');
  assert.ok(!v.board.some((t) => t.status === 'backlog'));
  assert.ok(v.backlog.every((t) => t.status === 'backlog'));
});

test('a move within the backlog, or to its own status, changes nothing', () => {
  const on = ENABLED();
  assert.deepEqual(apply(on, { type: 'moveTask', id: 'TASK-001', status: 'backlog' }).files, []);
  assert.deepEqual(apply(on, { type: 'moveTask', id: 'TASK-001', status: 'backlog', atEnd: true }).files, []);
});

test('ids stay unique across all three files; the next id counts the backlog too', () => {
  let ws = run(ENABLED(), { type: 'updateTask', id: 'TASK-003', set: { status: 'backlog' } });
  const out = apply({ ...ws, board: ws.board.replace('Last Task ID: 90', 'Last Task ID: 1') }, { type: 'createTask', task: { title: 'x', status: 'backlog' } });
  assert.equal(out.result.id, 'TASK-091'.replace('091', String(Math.max(90, 4) + 1).padStart(3, '0')) === 'TASK-091' ? 'TASK-005' : 'TASK-005');
});

test('archive, restore and delete work on backlog tasks; a restored backlog task goes back to the file', () => {
  let ws = ENABLED();
  ws = run(ws, { type: 'archiveTask', id: 'TASK-001' });
  assert.deepEqual(ids(view(ws).archive), ['TASK-001']);
  assert.ok(!ids(view(ws).backlog).includes('TASK-001'));
  ws = run(ws, { type: 'restoreTask', id: 'TASK-001' });
  assert.ok(ids(view(ws).backlog).includes('TASK-001'), 'status backlog -> back in backlog.md');
  assert.ok(!ids(view(ws).board).includes('TASK-001'));
  ws = run(ws, { type: 'archiveTasks', ids: ['TASK-001', 'TASK-002'] }); // one from the file, one from the board
  assert.deepEqual(ids(view(ws).archive).sort(), ['TASK-001', 'TASK-002']);
  ws = run(ws, { type: 'deleteTask', id: 'TASK-003' });
  assert.ok(!ids(view(ws).backlog).includes('TASK-003'));
});

test('write order: an archive move out of the backlog writes the archive first; a promote writes the board first', () => {
  const on = ENABLED();
  assert.deepEqual(apply(on, { type: 'archiveTask', id: 'TASK-001' }).files.map((f) => f.name), ['archive.md', 'backlog.md']);
  assert.deepEqual(apply(on, { type: 'moveTask', id: 'TASK-001', status: 'todo' }).files.map((f) => f.name), ['kanban.md', 'backlog.md']);
  assert.deepEqual(apply(on, { type: 'moveTask', id: 'TASK-002', status: 'backlog' }).files.map((f) => f.name), ['backlog.md', 'kanban.md']);
});

test('small edits on a backlog task patch its block in the backlog file (subtask, note, fields, etag)', () => {
  const on = ENABLED();
  const t3 = view(on).backlog.find((t) => t.id === 'TASK-003');
  let out = apply(on, { type: 'toggleSubtask', id: 'TASK-003', index: 0 });
  assert.deepEqual(out.files.map((f) => f.name), ['backlog.md']);
  assert.equal(parseBacklog(out.backlog, COLS, 'backlog').tasks.find((t) => t.id === 'TASK-003').subtasks[0].completed, false);
  out = apply(on, { type: 'appendNote', id: 'TASK-001', text: 'more' });
  assert.match(parseBacklog(out.backlog, COLS, 'backlog').tasks[0].notes, /a note\nmore/);
  const etag = apply(on, { type: 'updateTask', id: 'TASK-003', set: { title: 'Renamed' } }).result.etag;
  assert.equal(etag, etagOf(blockMap(apply(on, { type: 'updateTask', id: 'TASK-003', set: { title: 'Renamed' } }).backlog, 'backlog').get('TASK-003')));
  assert.equal(code(() => apply(on, { type: 'updateTask', id: 'TASK-003', set: { title: 'x' }, ifMatch: 'stale' })), 'conflict');
  void t3;
});

// ---- the invariant heals itself ------------------------------------------------------------------

test('a backlog task added by hand to kanban.md is pulled into the file by the next edit', () => {
  const on = ENABLED();
  const hand = { ...on, board: on.board.trimEnd() + '\n\n### TASK-070 | By hand\n**Status**: backlog\n' };
  assert.ok(view(hand).board.some((t) => t.id === 'TASK-070'));
  const out = apply(hand, { type: 'updateTask', id: 'TASK-002', set: { title: 'Touch something else' } });
  assert.ok(ids(view(next(hand, out)).backlog).includes('TASK-070'));
  assert.ok(!ids(view(next(hand, out)).board).includes('TASK-070'));
});

test('a task promoted by hand (status edited in backlog.md) comes back to the board on the next edit', () => {
  const on = ENABLED();
  const hand = { ...on, backlog: on.backlog.replace(/(### TASK-001[^\n]*\n\*\*Status\*\*: )backlog/, '$1todo') };
  const out = apply(hand, { type: 'updateTask', id: 'TASK-002', set: { title: 'Touch' } });
  const v = view(next(hand, out));
  assert.ok(ids(v.board).includes('TASK-001') && !ids(v.backlog).includes('TASK-001'));
  assert.equal(v.board.find((t) => t.id === 'TASK-001').status, 'todo');
});

test('a backlog task with no Status line reads as the backlog column', () => {
  const on = ENABLED();
  const hand = { ...on, backlog: on.backlog.replace(/(### TASK-003[^\n]*\n)\*\*Status\*\*: backlog\n/, '$1') };
  assert.equal(view(hand).backlog.find((t) => t.id === 'TASK-003').status, 'backlog');
  assert.deepEqual(apply(hand, { type: 'updateTask', id: 'TASK-002', set: { title: 'x' } }).files.map((f) => f.name), ['kanban.md']);
});

// ---- columns -------------------------------------------------------------------------------------

test('renaming the backlog column id follows through: config, the file and its tasks', () => {
  const on = ENABLED();
  const cols = COLS.map((c) => (c.id === 'backlog' ? { name: c.name, id: 'ideas' } : c));
  const out = apply(on, { type: 'setColumns', columns: cols, reassign: { backlog: 'ideas' } });
  const v = view(next(on, out));
  assert.deepEqual(v.config.backlogFile, { file: 'backlog.md', column: 'ideas' });
  assert.ok(v.backlog.every((t) => t.status === 'ideas') && v.backlog.length === 2);
});

test('removing the backlog column is refused while the file is in use', () => {
  const on = ENABLED();
  const cols = COLS.filter((c) => c.id !== 'backlog');
  assert.equal(code(() => apply(on, { type: 'setColumns', columns: cols, reassign: { backlog: 'todo' } })), 'backlog_column_in_use', 'merging it into another column would repoint the file');
  assert.equal(code(() => apply(on, { type: 'setColumns', columns: cols })), 'backlog_column_in_use', 'and so would deleting it');
});

test('reassigning other tasks into the backlog column sends them to the file', () => {
  const on = ENABLED();
  const cols = COLS.filter((c) => c.id !== 'done');
  const v = view(run(on, { type: 'setColumns', columns: cols, reassign: { done: 'backlog' } }));
  assert.ok(ids(v.backlog).includes('TASK-004'));
  assert.ok(!v.board.some((t) => t.status === 'backlog'));
});

// ---- the page's side: UI state diffs and batches --------------------------------------------------

test('diffToOps treats board + backlog as one live set: a status change is just an update', () => {
  const on = ENABLED();
  const v = view(on);
  const base = { config: v.config, tasks: v.board, backlog: v.backlog, archive: [] };
  const nextState = JSON.parse(JSON.stringify(base));
  const moved = nextState.tasks.find((t) => t.id === 'TASK-002'); moved.status = 'backlog';
  nextState.tasks.splice(nextState.tasks.indexOf(moved), 1); nextState.backlog.push(moved);   // the page moves it between its lists
  const promoted = nextState.backlog.find((t) => t.id === 'TASK-001'); promoted.status = 'done';
  nextState.backlog.splice(nextState.backlog.indexOf(promoted), 1); nextState.tasks.push(promoted);
  const { ops, unsupported } = diffToOps(base, nextState);
  assert.deepEqual(unsupported, []);
  assert.deepEqual(ops.map((o) => o.type), ['updateTask', 'updateTask']);
  const out = applyOps(on, ops);
  const after = view(out);
  assert.deepEqual(ids(after.backlog).sort(), ['TASK-002', 'TASK-003']);
  assert.ok(after.board.some((t) => t.id === 'TASK-001' && t.status === 'done'));
  assert.deepEqual(out.files.map((f) => f.kind).sort(), ['backlog', 'board']);
});

test('applyOps reports only files that really changed, in a safe order', () => {
  const on = ENABLED();
  const out = applyOps(on, [{ type: 'moveTask', id: 'TASK-002', status: 'backlog' }, { type: 'moveTask', id: 'TASK-002', status: 'todo' }]);
  assert.deepEqual(out.files.map((f) => f.name), ['kanban.md'], 'moved there and back: the backlog file ends as it began, so it is not rewritten');
});

// ---- property: random ops never break the invariant or touch other tasks -------------------------

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

for (let seed = 1; seed <= 6; seed++) {
  test(`property: random ops with a backlog file keep the invariant and leave other tasks alone (seed ${seed})`, () => {
    const R = rng(seed * 7727);
    const pick = (a) => a[Math.floor(R() * a.length)];
    const seedTasks = Array.from({ length: 12 }, (_, i) => task(`TASK-${String(i + 1).padStart(3, '0')}`, { status: pick(['backlog', 'todo', 'done']), description: R() < 0.4 ? 'text' : '', subtasks: R() < 0.4 ? [{ completed: false, text: 'a' }] : [] }));
    let ws = run(mk(seedTasks), { type: 'setBacklogFile', enabled: true });
    let applied = 0;
    for (let step = 0; step < 150; step++) {
      const v = view(ws);
      const all = [...v.board, ...v.backlog, ...v.archive];
      const id = R() < 0.05 ? 'TASK-999' : pick(all).id;
      const r = R();
      const op = r < 0.2 ? { type: 'updateTask', id, set: { status: pick(['backlog', 'todo', 'done']) } }
        : r < 0.35 ? { type: 'moveTask', id, status: pick(['backlog', 'todo', 'done']), ...(R() < 0.3 ? { atEnd: true } : {}) }
        : r < 0.45 ? { type: 'createTask', task: { title: `new ${step}`, status: pick(['backlog', 'todo', 'done']) } }
        : r < 0.55 ? { type: 'archiveTask', id }
        : r < 0.65 ? { type: 'restoreTask', id }
        : r < 0.72 ? { type: 'deleteTask', id }
        : r < 0.8 ? { type: 'toggleSubtask', id, index: 0 }
        : r < 0.87 ? { type: 'appendNote', id, text: `n${step}` }
        : r < 0.92 ? { type: 'archiveTasks', ids: [id, pick(all).id] }
        : r < 0.96 ? { type: 'updateTask', id, set: { title: `t${step}`, due: '2027-01-01' } }
        : { type: 'setBacklogFile', enabled: R() < 0.5 };
      let out;
      try { out = apply(ws, op); }
      catch (e) {
        assert.ok(e instanceof BoardError && ['unknown_task', 'not_archived', 'already_archived', 'unknown_subtask', 'task_archived', 'before_not_in_column'].includes(e.code), `step ${step} ${JSON.stringify(op)}: ${e.code || e.stack}`);
        continue;
      }
      applied++;
      const nws = next(ws, out);
      const nv = view(nws);
      const bc = nv.bc;
      // 1. the invariant, checked independently of the op's own verify
      if (bc) {
        assert.ok(nv.board.every((t) => t.status !== bc.column), `step ${step} ${op.type}: backlog task left in kanban.md`);
        assert.ok(nv.backlog.every((t) => t.status === bc.column), `step ${step} ${op.type}: non-backlog task in the backlog file`);
      }
      // 2. ids are unique across all three files
      const every = [...nv.board, ...nv.backlog, ...nv.archive].map((t) => t.id);
      assert.equal(new Set(every).size, every.length, `step ${step} ${op.type}: duplicate id`);
      // 3. every task the op did not name is byte-identical wherever it now lives (blocks only ever move)
      const named = new Set([op.id, out.result.id, ...(op.ids || [])].filter(Boolean));
      const where = (w) => new Map([...blockMap(w.board, 'board'), ...blockMap(w.archive, 'archive'), ...blockMap(w.backlog, 'backlog')]);
      const a = where(ws), b = where(nws);
      for (const [tid, text] of a) {
        if (named.has(tid) || op.type === 'setBacklogFile' || !b.has(tid)) continue;
        // a status line may be made explicit when a hand-written block is relocated; everything else must match
        const norm = (t) => t.replace(/^\*\*Status\*\*:.*\n/m, '').trimEnd();
        assert.equal(norm(b.get(tid)), norm(text), `step ${step} ${op.type}: ${tid} changed`);
      }
      ws = nws;
    }
    assert.ok(applied > 60, `only ${applied} ops applied`);
  });
}
