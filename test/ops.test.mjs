// Tests for the surgical patch layer (core/ops.js + core/patch.js).  Run: npm test
//   1. exact diffs: each op touches exactly the lines it should
//   2. validation: bad input is rejected with a stable code and nothing is written
//   3. property test: random op sequences on every fixture never fail verification, never touch a
//      task other than the one named, and never change the file's line endings
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOp } from '../core/ops.js';
import { parseBoard, parseArchive, orderedTasks } from '../core/board.js';
import { BoardError, diffStats, diffLines, splitLines } from '../core/text.js';
import { Doc, blocksOf } from '../core/patch.js';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}.md`, import.meta.url), 'utf8');
const today = () => '2026-01-01';
const apply = (ws, op) => applyOp(ws, op, { today });
const demo = () => ({ board: fx('demo.kanban'), archive: fx('demo.archive') });
const stats = (a, b) => diffStats(a, b);
const removedAdded = (a, b) => { const s = stats(a, b); return [s.removed, s.added]; };
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof BoardError, `expected BoardError, got ${e && e.stack}`); return e.code; } return null; };

// ---- exact diffs -------------------------------------------------------------------------------

test('updateTask status touches exactly one line', () => {
  const ws = demo();
  const out = apply(ws, { type: 'updateTask', id: 'TASK-004', set: { status: 'done' } });
  assert.deepEqual(removedAdded(ws.board, out.board), [1, 1]);
  assert.equal(out.archive, ws.archive);
  assert.deepEqual(out.files.map((f) => f.name), ['kanban.md']);
});

test('moveTask edits the status in place: one line, file order unchanged', () => {
  const ws = demo();
  const out = apply(ws, { type: 'moveTask', id: 'TASK-004', status: 'done' });
  assert.deepEqual(removedAdded(ws.board, out.board), [1, 1]);
  assert.deepEqual(parseBoard(out.board).tasks.map((t) => t.id), parseBoard(ws.board).tasks.map((t) => t.id));
  assert.equal(parseBoard(out.board).tasks.find((t) => t.id === 'TASK-004').status, 'done');
});

test('moveTask into the same column with no anchor is a no-op', () => {
  const ws = demo();
  const t = parseBoard(ws.board).tasks[3];
  const out = apply(ws, { type: 'moveTask', id: t.id, status: t.status });
  assert.equal(out.board, ws.board);
  assert.deepEqual(out.files, []);
});

test('moveTask atEnd relocates the block after the last task of the target column', () => {
  const ws = demo();
  const out = apply(ws, { type: 'moveTask', id: 'TASK-001', status: 'review', atEnd: true });
  const tasks = parseBoard(out.board).tasks;
  const col = tasks.filter((t) => t.status === 'review').map((t) => t.id);
  assert.equal(col[col.length - 1], 'TASK-001');
  // only the moved block changes: every other block is byte-identical
  const before = blockMap(ws.board), after = blockMap(out.board);
  for (const [id, text] of before) if (id !== 'TASK-001') assert.equal(after.get(id).trimEnd(), text.trimEnd(), id);
});

test('moveTask rejects before and atEnd together', () => {
  assert.equal(code(() => apply(demo(), { type: 'moveTask', id: 'TASK-001', status: 'review', before: 'TASK-010', atEnd: true })), 'invalid_field');
});

test('moveTask with before places the task right before the anchor', () => {
  const ws = demo();
  const out = apply(ws, { type: 'moveTask', id: 'TASK-001', status: 'in-progress', before: 'TASK-007' });
  const ids = parseBoard(out.board).tasks.map((t) => t.id);
  assert.equal(ids[ids.indexOf('TASK-001') + 1], 'TASK-007');
});

test('toggleSubtask flips a single character', () => {
  const ws = demo();
  const out = apply(ws, { type: 'toggleSubtask', id: 'TASK-001', index: 1 });
  assert.deepEqual(removedAdded(ws.board, out.board), [1, 1]);
  const [h] = diffLines(ws.board, out.board);
  assert.equal(h.del[0].replace('[ ]', '[x]'), h.add[0]);
});

test('addSubtask adds exactly one line', () => {
  const ws = demo();
  const out = apply(ws, { type: 'addSubtask', id: 'TASK-001', text: 'Ship it' });
  assert.deepEqual(removedAdded(ws.board, out.board), [0, 1]);
});

test('updateTask tags/priority/due change only their lines', () => {
  const ws = demo();
  const out = apply(ws, { type: 'updateTask', id: 'TASK-002', set: { priority: 'Low', due: '2026-12-01', tags: ['api', 'perf'] } });
  assert.deepEqual(removedAdded(ws.board, out.board), [3, 3]);
});

test('createTask appends one block and bumps Last Task ID in place', () => {
  const ws = demo();
  const out = apply(ws, { type: 'createTask', task: { title: 'Brand new', status: 'backlog', priority: 'High', category: 'Backend', tags: ['api'] } });
  assert.equal(out.result.id, 'TASK-020');
  const s = stats(ws.board, out.board);
  assert.equal(s.removed, 1); // the Last Task ID line
  assert.match(out.board, /Last Task ID: 020 -->/); // zero padding preserved
  const tasks = parseBoard(out.board).tasks;
  assert.equal(tasks[tasks.length - 1].title, 'Brand new');
  assert.equal(tasks[tasks.length - 1].created, '2026-01-01');
});

test('createTask never reuses an id that only exists in the archive', () => {
  const ws = { board: fx('demo.kanban').replace('Last Task ID: 019', 'Last Task ID: 001'), archive: fx('demo.archive') };
  const archiveMax = Math.max(...parseArchive(ws.archive, []).tasks.map((t) => parseInt(t.id.slice(5), 10)));
  const out = apply(ws, { type: 'createTask', task: { title: 'x' } });
  assert.ok(parseInt(out.result.id.slice(5), 10) > Math.max(archiveMax, 19));
});

test('archiveTask moves the block verbatim, restoreTask brings it back', () => {
  const ws = demo();
  const original = blockMap(ws.board).get('TASK-003');
  const a = apply(ws, { type: 'archiveTask', id: 'TASK-003' });
  assert.deepEqual(a.files.map((f) => f.name), ['archive.md', 'kanban.md']); // archive first: a crash duplicates, never loses
  assert.equal(blockMap(a.archive, 'archive').get('TASK-003').trimEnd(), original.trimEnd());
  assert.ok(!blockMap(a.board).has('TASK-003'));
  const r = apply({ board: a.board, archive: a.archive }, { type: 'restoreTask', id: 'TASK-003' });
  assert.deepEqual(r.files.map((f) => f.name), ['kanban.md', 'archive.md']); // destination first
  assert.equal(blockMap(r.board).get('TASK-003').trimEnd(), original.trimEnd());
  assert.ok(!blockMap(r.archive, 'archive').has('TASK-003'));
});

test('archiving with no archive.md creates one marked v2', () => {
  const out = apply({ board: fx('demo.kanban'), archive: null }, { type: 'archiveTask', id: 'TASK-003' });
  assert.match(out.archive, /<!-- Format: v2 -->/);
  assert.equal(parseArchive(out.archive, parseBoard(out.board).config.columns).tasks[0].id, 'TASK-003');
});

test('an unmarked, empty legacy archive gets the v2 marker', () => {
  const out = apply({ board: fx('demo.kanban'), archive: fx('root.archive') }, { type: 'archiveTask', id: 'TASK-003' });
  assert.equal(parseArchive(out.archive, []).formatV2, true);
});

test('restoring a task whose column is gone falls back to the first column', () => {
  const ws = { board: fx('demo.kanban'), archive: fx('demo.archive').replace(/\*\*Status\*\*: \w[\w-]*/, '**Status**: vanished') };
  const id = parseArchive(ws.archive, parseBoard(ws.board).config.columns).tasks[0].id;
  const out = apply(ws, { type: 'restoreTask', id });
  const t = parseBoard(out.board).tasks.find((x) => x.id === id);
  assert.equal(t.status, parseBoard(out.board).config.columns[0].id);
});

test('deleteTask removes just that block', () => {
  const ws = demo();
  const out = apply(ws, { type: 'deleteTask', id: 'TASK-004' });
  assert.equal(parseBoard(out.board).tasks.length, parseBoard(ws.board).tasks.length - 1);
  assert.deepEqual(removedAdded(ws.board, out.board), [stats(ws.board, out.board).removed, 0]);
});

test('hand-written sections and formatting around a change are preserved byte for byte', () => {
  const ws = { board: fx('edge-extras.kanban'), archive: fx('edge-v2.archive') };
  const out = apply(ws, { type: 'toggleSubtask', id: 'TASK-001', index: 0 });
  assert.deepEqual(removedAdded(ws.board, out.board), [1, 1]);
  assert.match(out.board, /\*\*Links\*\*:\n- \[ \] https:\/\/example.com\/a\n- spec: docs\/spec.md/);
  assert.match(out.board, /\*\*Review\*\*:\nLooks fine\./);
});

test('CRLF files stay CRLF', () => {
  const ws = { board: fx('edge-crlf.kanban'), archive: null };
  for (const op of [
    { type: 'updateTask', id: 'TASK-001', set: { description: 'a\nb', tags: ['q'], due: '2030-01-01' } },
    { type: 'appendNote', id: 'TASK-002', text: 'n1\nn2' },
    { type: 'addSubtask', id: 'TASK-001', text: 'sub' },
    { type: 'createTask', task: { title: 'new', notes: 'a\nb', subtasks: [{ text: 's' }] } },
    { type: 'archiveTask', id: 'TASK-002' },
  ]) {
    const out = apply(ws, op);
    assert.ok(!/(?<!\r)\n/.test(out.board), `bare LF in board after ${op.type}`);
  }
});

test('LF files never gain a CR', () => {
  const out = apply(demo(), { type: 'createTask', task: { title: 'x', notes: 'a\nb' } });
  assert.ok(!out.board.includes('\r'));
});

test('a no-change updateTask writes nothing', () => {
  const ws = demo();
  const t = parseBoard(ws.board).tasks[0];
  const out = apply(ws, { type: 'updateTask', id: t.id, set: { title: t.title, status: t.status, tags: t.tags, description: t.description } });
  assert.deepEqual(out.files, []);
});

test('description/subtasks/notes can be added, replaced and removed', () => {
  let ws = { board: fx('edge-extras.kanban'), archive: null };
  const step = (set) => { const out = apply(ws, { type: 'updateTask', id: 'TASK-004', set }); ws = { board: out.board, archive: null }; return parseBoard(ws.board).tasks.find((t) => t.id === 'TASK-004'); };
  assert.equal(step({ description: 'one\ntwo' }).description, 'one\ntwo');
  assert.equal(step({ subtasks: [{ text: 'a' }, { text: 'b', completed: true }] }).subtasks.length, 2);
  assert.equal(step({ notes: 'first\nsecond' }).notes, 'first\nsecond');
  assert.equal(step({ subtasks: [{ text: 'a' }, { text: 'c' }, { text: 'd' }] }).subtasks.length, 3);
  assert.equal(step({ description: 'changed' }).description, 'changed');
  assert.equal(step({ notes: '' }).notes, '');
  assert.equal(step({ subtasks: [] }).subtasks.length, 0);
  assert.equal(step({ description: '' }).description, '');
});

test('setConfigList and setColumns edit one config line each', () => {
  const ws = demo();
  const a = apply(ws, { type: 'setConfigList', name: 'categories', values: ['A', 'B'] });
  assert.deepEqual(removedAdded(ws.board, a.board), [1, 1]);
  assert.deepEqual(parseBoard(a.board).config.categories, ['A', 'B']);
  const cols = parseBoard(ws.board).config.columns;
  const b = apply(ws, { type: 'setColumns', columns: [...cols, { name: 'Later', id: 'later' }] });
  assert.deepEqual(removedAdded(ws.board, b.board), [1, 1]);
});

test('setColumns requires a home for tasks of a removed column, and updates the archive too', () => {
  const ws = demo();
  const cols = parseBoard(ws.board).config.columns;
  const kept = cols.filter((c) => c.id !== 'review');
  assert.equal(code(() => apply(ws, { type: 'setColumns', columns: kept })), 'orphaned_tasks');
  const out = apply(ws, { type: 'setColumns', columns: kept, reassign: { review: 'backlog' } });
  assert.ok(parseBoard(out.board).tasks.every((t) => t.status !== 'review'));
});

test('a missing config line is inserted; a missing config section is created', () => {
  const noCats = fx('demo.kanban').replace(/\*\*Categories\*\*:.*\n\n/, '');
  const a = apply({ board: noCats, archive: null }, { type: 'setConfigList', name: 'categories', values: ['Only'] });
  assert.deepEqual(parseBoard(a.board).config.categories, ['Only']);
  const b = apply({ board: fx('edge-minimal.kanban'), archive: null }, { type: 'setConfigList', name: 'tags', values: ['t1'] });
  assert.deepEqual(parseBoard(b.board).config.tags, ['t1']);
});

test('a missing Last Task ID comment is inserted on create', () => {
  const out = apply({ board: fx('edge-minimal.kanban'), archive: null }, { type: 'createTask', task: { title: 'x' } });
  assert.equal(parseBoard(out.board).config.lastTaskId, 8);
});

// ---- validation --------------------------------------------------------------------------------

test('validation errors carry stable codes and the valid choices', () => {
  const ws = demo();
  const err = (op) => { try { apply(ws, op); } catch (e) { return e; } return null; };
  const e = err({ type: 'updateTask', id: 'TASK-001', set: { status: 'nope' } });
  assert.equal(e.code, 'unknown_status');
  assert.ok(e.valid.includes('backlog'));
  assert.equal(err({ type: 'updateTask', id: 'TASK-001', set: { priority: 'Banana' } }).code, 'unknown_priority');
  assert.equal(err({ type: 'updateTask', id: 'TASK-001', set: { priority: 'High', category: '' } }).code, 'meta_incomplete');
  assert.equal(err({ type: 'updateTask', id: 'TASK-001', set: { due: '2026-13-45' } }).code, 'invalid_date');
  assert.equal(err({ type: 'updateTask', id: 'TASK-001', set: { description: '## heading' } }).code, 'invalid_description');
  assert.equal(err({ type: 'updateTask', id: 'TASK-001', set: { tags: ['bad tag!'] } }).code, 'invalid_tag');
  assert.equal(err({ type: 'updateTask', id: 'TASK-001', set: { colour: 'red' } }).code, 'unknown_field');
  assert.equal(err({ type: 'updateTask', id: 'TASK-999', set: { title: 'x' } }).code, 'unknown_task');
  assert.equal(err({ type: 'createTask', task: {} }).code, 'missing_field');
  assert.equal(err({ type: 'bogus' }).code, 'unknown_op');
  assert.equal(err({ type: 'moveTask', id: 'TASK-001', status: 'done', before: 'TASK-001' }).code, 'unknown_task');
  assert.equal(err({ type: 'moveTask', id: 'TASK-001', status: 'done', before: 'TASK-007' }).code, 'before_not_in_column');
  assert.equal(err({ type: 'toggleSubtask', id: 'TASK-001', index: 99 }).code, 'unknown_subtask');
  assert.equal(err({ type: 'restoreTask', id: 'TASK-001' }).code, 'not_archived');
});

test('ifMatch detects a task that changed since it was read', () => {
  const ws = demo();
  const first = apply(ws, { type: 'updateTask', id: 'TASK-001', set: { title: 'One' } });
  const second = { board: first.board, archive: first.archive };
  assert.equal(code(() => apply(second, { type: 'updateTask', id: 'TASK-001', set: { title: 'Two' }, ifMatch: 'stale' })), 'conflict');
  const ok = apply(second, { type: 'updateTask', id: 'TASK-001', set: { title: 'Two' }, ifMatch: first.result.etag });
  assert.equal(parseBoard(ok.board).tasks.find((t) => t.id === 'TASK-001').title, 'Two');
});

test('legacy V1 boards must be migrated first', () => {
  assert.equal(code(() => apply({ board: fx('examples-v1.kanban'), archive: null }, { type: 'createTask', task: { title: 'x' } })), 'needs_migration');
});

test('a duplicate task id is refused rather than guessed at', () => {
  const dup = fx('demo.kanban') + '\n### TASK-001 | Duplicate\n**Status**: backlog\n';
  assert.equal(code(() => apply({ board: dup, archive: null }, { type: 'updateTask', id: 'TASK-001', set: { title: 'x' } })), 'ambiguous_id');
});

// ---- property test -----------------------------------------------------------------------------

function blockMap(text, kind = 'board') {
  const doc = new Doc(text);
  return new Map(blocksOf(doc, kind).map((b) => [b.id, doc.lines.slice(b.start, b.end).join('')]));
}
const headerOf = (text) => { const l = splitLines(text); const i = l.findIndex((x) => /^###\s+TASK-/.test(x)); return (i < 0 ? l : l.slice(0, i)).join(''); };

const noOrder = (t) => t.replace(/(?<=^|\n)[ \t]*\*\*Order\*\*:[^\r\n]*\r?\n/g, ''); // key-writing ops may touch other tasks' Order lines only
const eolMode = (t) => { const n = (t.match(/\n/g) || []).length, c = (t.match(/\r\n/g) || []).length; return c === 0 ? 'lf' : c === n ? 'crlf' : 'mixed'; };

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
const ALLOWED = new Set(['meta_incomplete', 'unknown_status', 'unknown_priority', 'unknown_task', 'task_archived', 'already_archived', 'not_archived',
  'before_not_in_column', 'unknown_subtask', 'invalid_field', 'invalid_date', 'invalid_description', 'invalid_tag', 'orphaned_tasks', 'invalid_column',
  'conflict', 'missing_field', 'invalid_notes', 'unknown_field']);

function randomOp(R, ws) {
  const pick = (a) => a[Math.floor(R() * a.length)];
  const chance = (p) => R() < p;
  const bp = parseBoard(ws.board);
  const ap = ws.archive ? parseArchive(ws.archive, bp.config.columns).tasks : [];
  const cols = bp.config.columns.map((c) => c.id);
  const prios = bp.config.priorities.map((p) => p.replace(/[^\w\s]+/, '').trim());
  const ids = [...bp.tasks, ...ap].map((t) => t.id);
  const id = chance(0.04) ? 'TASK-999' : pick(ids);
  const text = (n = 3) => Array.from({ length: 1 + Math.floor(R() * n) }, () => pick(WORDS) + ' ' + pick(WORDS)).join('\n');
  const date = () => `20${20 + Math.floor(R() * 9)}-0${1 + Math.floor(R() * 9)}-1${Math.floor(R() * 9)}`;
  const fields = () => {
    const f = {};
    if (chance(0.3)) f.title = text(1);
    if (chance(0.3)) f.status = chance(0.05) ? 'nope' : pick(cols);
    if (chance(0.3)) { const on = chance(0.8); f.priority = on ? pick(prios) : ''; f.category = on ? pick(['Backend', 'Design', 'Frontend']) : ''; if (on && chance(0.5)) f.assignees = [pick(['@a', '@b']), '@c']; else if (!on) f.assignees = []; }
    if (chance(0.3)) f.tags = chance(0.2) ? [] : [pick(['x', 'y', 'z-1']), pick(['p', 'q'])];
    if (chance(0.25)) f.due = chance(0.3) ? '' : date();
    if (chance(0.15)) f.started = chance(0.3) ? '' : date();
    if (chance(0.15)) f.completed = chance(0.5) ? '' : date();
    if (chance(0.3)) f.description = chance(0.25) ? '' : text();
    if (chance(0.3)) f.subtasks = Array.from({ length: Math.floor(R() * 4) }, () => ({ text: pick(WORDS), completed: chance(0.4) }));
    if (chance(0.12)) f.order = chance(0.3) ? '' : Math.floor(R() * 20) * 500;
    if (chance(0.3)) f.notes = chance(0.25) ? '' : text();
    return f;
  };
  if (chance(0.04)) return { type: 'sortTasks', mode: pick(['blocks', 'ids', 'positions', 'clear', undefined]), scope: pick(['board', 'archive', 'both']), order: pick(['asc', 'desc']) };
  const r = R();
  if (r < 0.14) return { type: 'createTask', task: { title: text(1), ...fields() } };
  if (r < 0.38) return { type: 'updateTask', id, set: fields() };
  if (r < 0.52) return { type: 'moveTask', id, status: pick(cols), ...(chance(0.3) ? { before: pick(ids) } : chance(0.15) ? { atEnd: true } : {}) };
  if (r < 0.60) return { type: 'toggleSubtask', id, index: Math.floor(R() * 4) };
  if (r < 0.66) return { type: 'addSubtask', id, text: text(1) };
  if (r < 0.74) return { type: 'appendNote', id, text: text() };
  if (r < 0.82) return { type: 'archiveTask', id };
  if (r < 0.90) return { type: 'restoreTask', id };
  if (r < 0.94) return { type: 'deleteTask', id };
  if (r < 0.97) return { type: 'setConfigList', name: pick(['categories', 'users', 'tags', 'priorities']), values: ['k1', 'k2'].concat(chance(0.5) ? ['k3'] : []) };
  return { type: 'setColumns', columns: [...bp.config.columns, { name: 'Extra ' + Math.floor(R() * 99), id: 'extra' + Math.floor(R() * 99) }].slice(0, bp.config.columns.length + 1) };
}

const withKeys = (board, archive) => applyOp({ board, archive }, { type: 'sortTasks', mode: 'positions' }).board;
const PROPERTY_FIXTURES = [
  ['demo-ordered', withKeys(fx('demo.kanban'), fx('demo.archive')), fx('demo.archive')],
  ['crlf-ordered', withKeys(fx('edge-crlf.kanban'), null), null],
  ['extras-ordered', withKeys(fx('edge-extras.kanban'), fx('edge-v2.archive')), fx('edge-v2.archive')],
  ['demo', fx('demo.kanban'), fx('demo.archive')],
  ['examples-v2', fx('examples-v2.kanban'), fx('examples-v2.archive')],
  ['edge-crlf', fx('edge-crlf.kanban'), null],
  ['edge-extras', fx('edge-extras.kanban'), fx('edge-v2.archive')],
];

for (const [name, board, archive] of PROPERTY_FIXTURES) {
  for (const seed of [1, 2, 3, 4]) {
    test(`property: ${name} seed ${seed}: random ops verify, touch only the named task, keep EOLs`, () => {
      const R = rng(seed * 7919 + name.length);
      let ws = { board, archive };
      let applied = 0;
      for (let step = 0; step < 150; step++) {
        const op = randomOp(R, ws);
        let out;
        try { out = apply(ws, op); }
        catch (e) {
          assert.ok(e instanceof BoardError && ALLOWED.has(e.code), `step ${step} ${JSON.stringify(op)}: unexpected ${e.code || e.stack} ${JSON.stringify(e.details || '').slice(0, 300)}`);
          continue;
        }
        applied++;
        // 1. every task other than the one named is byte-identical (modulo its trailing blank line)
        const affected = new Set([op.id, out.result.id].filter(Boolean));
        for (const kind of ['board', 'archive']) {
          const a = blockMap(ws[kind] ?? '', kind), b = blockMap(out[kind] ?? '', kind);
          for (const [id, text] of a) {
            if (affected.has(id) || op.type === 'setColumns' || !b.has(id)) continue;
            assert.equal(noOrder(b.get(id)).trimEnd(), noOrder(text).trimEnd(), `step ${step} ${op.type}: ${id} in ${kind} changed`);
          }
        }
        // 1b. with manual ordering on, a move never relocates a block
        if (op.type === 'moveTask' && parseBoard(ws.board).tasks.some((t) => t.order != null)) {
          assert.deepEqual(parseBoard(out.board).tasks.map((t) => t.id), parseBoard(ws.board).tasks.map((t) => t.id), `step ${step}: block moved under manual ordering`);
        }
        // 2. the file header (config) only changes for config ops and the Last Task ID of a create
        if (op.type !== 'setConfigList' && op.type !== 'setColumns') {
          const norm = (t) => (op.type === 'createTask' ? t.replace(/Last Task ID: \d+/, 'Last Task ID: N') : t);
          assert.equal(norm(headerOf(out.board)), norm(headerOf(ws.board)), `step ${step} ${op.type}: header changed`);
        }
        // 3. a file that used one line ending still does (mixed files are left as they were)
        for (const [k, text] of [['board', out.board], ['archive', out.archive]]) {
          if (text === null) continue;
          const was = k === 'archive' && ws.archive === null ? eolMode(ws.board) : eolMode(ws[k]);
          if (was === 'crlf') assert.ok(!/(?<!\r)\n/.test(text), `step ${step} ${op.type}: bare LF in ${k}`);
          if (was === 'lf') assert.ok(!text.includes('\r'), `step ${step} ${op.type}: CR in ${k}`);
        }
        // 4. re-applying an identical updateTask changes nothing
        if (op.type === 'updateTask') {
          const again = apply({ board: out.board, archive: out.archive }, op);
          assert.deepEqual(again.files, [], `step ${step}: updateTask not idempotent`);
        }
        ws = { board: out.board, archive: out.archive };
      }
      assert.ok(applied > 40, `only ${applied} ops applied; generator too strict`);
    });
  }
}

// ---- awkward layouts: the single-block fallback --------------------------------------------------

const WEIRD = `# Weird

<!-- Config: Last Task ID: 5 -->
<!-- Format: v2 -->

## ⚙️ Configuration

**Columns**: To Do (todo) | Done (done)

**Categories**: A, B

**Users**: @a

**Priorities**: High | Low

**Tags**: #t

---

## Tasks

### TASK-001 | Dates apart
**Status**: todo
**Created**: 2025-01-01
Some text between
**Due**: 2025-02-02

### TASK-002 | Odd dates order
**Status**: todo
**Due**: 2025-03-03 | **Created**: 2025-03-01

### TASK-003 | Interleaved
**Status**: todo
First description line
**Tags**: #a
Second description line

### TASK-004 | Two subtask sections
**Status**: todo

**Subtasks**:
- [ ] a

**Subtasks**:
- [ ] b

### TASK-005 | Foreign lines among subtasks
**Status**: todo

**Subtasks**:
- [ ] a
a stray remark
- [ ] b

### TASK-006 | Untouched neighbour
**Status**: done
**Priority**: Low | **Category**: B
`;

test('layouts the line patcher cannot express fall back to regenerating that one block', () => {
  const ws = { board: WEIRD, archive: null };
  const cases = [
    ['TASK-001', { due: '' }],
    ['TASK-001', { started: '2025-01-05' }],
    ['TASK-002', { started: '2025-03-02' }],
    ['TASK-003', { description: 'rewritten' }],
    ['TASK-004', { subtasks: [{ text: 'only' }] }],
    ['TASK-005', { subtasks: [{ text: 'x' }, { text: 'y', completed: true }] }],
  ];
  for (const [id, set] of cases) {
    const out = apply(ws, { type: 'updateTask', id, set });
    const t = parseBoard(out.board).tasks.find((x) => x.id === id);
    for (const [k, v] of Object.entries(set)) assert.deepEqual(t[k], k === 'subtasks' ? v.map((x) => ({ completed: !!x.completed, text: x.text })) : v, `${id} ${k}`);
    const before = blockMap(ws.board), after = blockMap(out.board);
    for (const [other, text] of before) if (other !== id) assert.equal(after.get(other).trimEnd(), text.trimEnd(), `${other} changed by an edit to ${id}`);
  }
  for (const op of [{ type: 'addSubtask', id: 'TASK-004', text: 'c' }, { type: 'toggleSubtask', id: 'TASK-005', index: 1 }]) {
    const out = apply(ws, op);
    assert.equal(parseBoard(out.board).tasks.length, 6);
  }
});

test('a layout the patcher handles in place stays surgical', () => {
  const out = apply({ board: WEIRD, archive: null }, { type: 'updateTask', id: 'TASK-001', set: { due: '2026-02-02' } });
  assert.deepEqual(removedAdded(WEIRD, out.board), [1, 1]); // the date is replaced where it sits
});

// ---- explicit sort -----------------------------------------------------------------------------

test('sortTasks orders blocks by numeric id and moves them verbatim', () => {
  let ws = demo();
  // shuffle first: move the highest id to the front, and one in the middle to the end
  ws = { ...ws, board: apply(ws, { type: 'moveTask', id: 'TASK-015', status: 'backlog', before: 'TASK-001' }).board };
  ws = { ...ws, board: apply(ws, { type: 'moveTask', id: 'TASK-007', status: 'in-progress', atEnd: true }).board };
  assert.notDeepEqual(parseBoard(ws.board).tasks.map((t) => t.id), parseBoard(ws.board).tasks.map((t) => t.id).sort());
  const out = apply(ws, { type: 'sortTasks' });
  const ids = parseBoard(out.board).tasks.map((t) => t.id);
  assert.deepEqual(ids, [...ids].sort());
  const before = blockMap(ws.board), after = blockMap(out.board);
  for (const [id, text] of before) assert.equal(after.get(id).trimEnd(), text.trimEnd(), id);
  assert.equal(headerOf(out.board), headerOf(ws.board));
  assert.equal(out.archive, ws.archive);
});

test('sortTasks compares ids numerically, supports desc, and is a no-op when already sorted', () => {
  const board = fx('edge-extras.kanban').replace('### TASK-004 | Bare task', '### TASK-1000 | Big\n\n### TASK-004 | Bare task');
  const asc = apply({ board, archive: null }, { type: 'sortTasks' });
  const ids = parseBoard(asc.board).tasks.map((t) => t.id);
  assert.equal(ids[ids.length - 1], 'TASK-1000', 'TASK-1000 sorts after TASK-004 numerically (alphabetically it would come first)');
  assert.deepEqual(apply({ board: asc.board, archive: null }, { type: 'sortTasks' }).files, []);
  const desc = apply({ board: asc.board, archive: null }, { type: 'sortTasks', order: 'desc' });
  assert.deepEqual(parseBoard(desc.board).tasks.map((t) => t.id), [...ids].reverse());
  assert.equal(parseBoard(desc.board).tasks[0].id, 'TASK-1000');
});

test('sortTasks can sort the archive, and both files', () => {
  const ws = { board: fx('demo.kanban'), archive: fx('demo.archive') };
  const rev = apply(ws, { type: 'sortTasks', scope: 'archive', order: 'desc' });
  assert.equal(rev.board, ws.board);
  assert.deepEqual(rev.files.map((f) => f.name), ['archive.md']);
  const both = apply({ board: ws.board, archive: rev.archive }, { type: 'sortTasks', scope: 'both' });
  const ids = parseArchive(both.archive, []).tasks.map((t) => t.id);
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(code(() => apply(ws, { type: 'sortTasks', by: 'title' })), 'invalid_field');
});

// ---- manual ordering (**Order** keys) ----------------------------------------------------------

const ids = (text) => parseBoard(text).tasks.map((t) => t.id);
const col = (text, status) => orderedTasks(parseBoard(text).tasks).filter((t) => t.status === status).map((t) => t.id);
const keyed = () => ({ board: apply(demo(), { type: 'sortTasks', mode: 'positions' }).board, archive: fx('demo.archive') });

test('without keys nothing changes: display order is file order', () => {
  const tasks = parseBoard(fx('demo.kanban')).tasks;
  assert.deepEqual(orderedTasks(tasks).map((t) => t.id), tasks.map((t) => t.id));
  assert.ok(tasks.every((t) => t.order === null));
});

test('sort positions switches ordering on: one inserted line per task, nothing else, idempotent', () => {
  const ws = demo();
  const out = apply(ws, { type: 'sortTasks', mode: 'positions' });
  const n = parseBoard(ws.board).tasks.length;
  assert.deepEqual(removedAdded(ws.board, out.board), [0, n]);
  assert.deepEqual(parseBoard(out.board).tasks.map((t) => t.order), Array.from({ length: n }, (_, i) => (i + 1) * 1000));
  assert.deepEqual(ids(out.board), ids(ws.board)); // blocks did not move
  assert.deepEqual(apply({ board: out.board, archive: ws.archive }, { type: 'sortTasks', mode: 'positions' }).files, []);
});

test('sort ids writes keys that reflect id order, not file order', () => {
  let ws = demo();
  ws = { ...ws, board: apply(ws, { type: 'moveTask', id: 'TASK-015', status: 'backlog', before: 'TASK-001' }).board }; // block relocation (no keys yet)
  const out = apply(ws, { type: 'sortTasks', mode: 'ids' });
  const shown = orderedTasks(parseBoard(out.board).tasks).map((t) => t.id);
  assert.deepEqual(shown, [...shown].sort());
  assert.deepEqual(ids(out.board), ids(ws.board)); // file order untouched
  const desc = apply({ board: out.board, archive: ws.archive }, { type: 'sortTasks', mode: 'ids', order: 'desc' });
  assert.deepEqual(orderedTasks(parseBoard(desc.board).tasks).map((t) => t.id), [...shown].reverse());
});

test('sort clear removes every key and display order falls back to file position', () => {
  const ws = keyed();
  const moved = apply(ws, { type: 'moveTask', id: 'TASK-015', status: 'backlog', before: 'TASK-001' });
  const out = apply({ board: moved.board, archive: ws.archive }, { type: 'sortTasks', mode: 'clear' });
  assert.ok(parseBoard(out.board).tasks.every((t) => t.order === null));
  assert.ok(!out.board.includes('**Order**'));
  assert.deepEqual(orderedTasks(parseBoard(out.board).tasks).map((t) => t.id), ids(out.board));
});

test('under ordering a move before a task is a status+key edit and never moves a block', () => {
  const ws = keyed();
  const out = apply(ws, { type: 'moveTask', id: 'TASK-001', status: 'in-progress', before: 'TASK-007' });
  assert.deepEqual(removedAdded(ws.board, out.board), [2, 2]);
  assert.deepEqual(ids(out.board), ids(ws.board));
  const c = col(out.board, 'in-progress');
  assert.equal(c[c.indexOf('TASK-001') + 1], 'TASK-007');
});

test('under ordering a move atEnd lands last in the column; a plain move keeps the key', () => {
  const ws = keyed();
  const a = apply(ws, { type: 'moveTask', id: 'TASK-003', status: 'in-progress', atEnd: true });
  const c = col(a.board, 'in-progress');
  assert.equal(c[c.length - 1], 'TASK-003');
  const key = parseBoard(ws.board).tasks.find((t) => t.id === 'TASK-002').order;
  const b = apply(ws, { type: 'moveTask', id: 'TASK-002', status: 'in-progress' });
  assert.equal(parseBoard(b.board).tasks.find((t) => t.id === 'TASK-002').order, key);
  assert.deepEqual(removedAdded(ws.board, b.board), [1, 1]); // status line only
});

test('moving to where a task already is changes nothing', () => {
  const ws = keyed();
  const c = col(ws.board, 'in-progress');
  assert.deepEqual(apply(ws, { type: 'moveTask', id: c[0], status: 'in-progress', before: c[1] }).files, []);
  assert.deepEqual(apply(ws, { type: 'moveTask', id: c[c.length - 1], status: 'in-progress', atEnd: true }).files, []);
});

test('when two neighbours leave no room, the keys are renumbered and the order is still right', () => {
  let ws = keyed();
  const set = (id, order) => { ws = { ...ws, board: apply(ws, { type: 'updateTask', id, set: { order } }).board }; };
  const c = col(ws.board, 'in-progress');
  set(c[0], 5); set(c[1], 6); // adjacent integers: nothing fits between them
  const mover = col(ws.board, 'backlog')[0];
  const out = apply(ws, { type: 'moveTask', id: mover, status: 'in-progress', before: c[1] });
  const after = col(out.board, 'in-progress');
  assert.equal(after[after.indexOf(mover) + 1], c[1]);
  assert.equal(after[after.indexOf(mover) - 1], c[0]);
});

test('createTask under ordering gets the next key and goes last; a hand-added task sorts last until keyed', () => {
  const ws = keyed();
  const out = apply(ws, { type: 'createTask', task: { title: 'New', status: 'backlog' } });
  const max = Math.max(...parseBoard(ws.board).tasks.map((t) => t.order));
  assert.equal(parseBoard(out.board).tasks.at(-1).order, max + 1000);
  assert.equal(col(out.board, 'backlog').at(-1), out.result.id);
  // a task added by hand with no key sorts after the keyed ones, in file order
  const hand = ws.board + '\n### TASK-100 | By hand\n**Status**: backlog\n';
  assert.equal(col(hand, 'backlog').at(-1), 'TASK-100');
  // the first positional op keys it, so it cannot jump ahead
  const moved = apply({ board: hand, archive: ws.archive }, { type: 'moveTask', id: 'TASK-001', status: 'backlog', atEnd: true });
  assert.equal(col(moved.board, 'backlog').at(-1), 'TASK-001');
  assert.ok(parseBoard(moved.board).tasks.every((t) => t.order !== null));
});

test('order can be set and cleared by hand, and bad values are rejected', () => {
  const ws = demo();
  const a = apply(ws, { type: 'updateTask', id: 'TASK-002', set: { order: 4200 } });
  assert.deepEqual(removedAdded(ws.board, a.board), [0, 1]);
  assert.match(a.board, /\*\*Status\*\*: backlog\n\*\*Order\*\*: 4200\n\*\*Priority\*\*: High/); // right after Status
  const b = apply({ board: a.board, archive: ws.archive }, { type: 'updateTask', id: 'TASK-002', set: { order: '' } });
  assert.equal(b.board, ws.board);
  assert.equal(code(() => apply(ws, { type: 'updateTask', id: 'TASK-002', set: { order: -3 } })), 'invalid_field');
  assert.equal(code(() => apply(ws, { type: 'updateTask', id: 'TASK-002', set: { order: 1.5 } })), 'invalid_field');
});

test('archiving keeps the key with the block, and restoring keeps it', () => {
  const ws = keyed();
  const key = parseBoard(ws.board).tasks.find((t) => t.id === 'TASK-003').order;
  const a = apply(ws, { type: 'archiveTask', id: 'TASK-003' });
  assert.equal(parseArchive(a.archive, parseBoard(a.board).config.columns).tasks.find((t) => t.id === 'TASK-003').order, key);
  const r = apply({ board: a.board, archive: a.archive }, { type: 'restoreTask', id: 'TASK-003' });
  assert.equal(parseBoard(r.board).tasks.find((t) => t.id === 'TASK-003').order, key);
});

test('an Order line is metadata, never part of the description', () => {
  const t = parseBoard(keyed().board).tasks[0];
  assert.equal(t.order, 1000);
  assert.ok(!t.description.includes('Order'));
});
