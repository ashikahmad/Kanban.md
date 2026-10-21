// diffToOps / applyOps: the bridge that lets the page keep mutating in-memory state while the file
// is only ever changed by minimal verified patches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diffToOps, applyOps } from '../core/changes.js';
import { parseBoard, parseArchive } from '../core/board.js';
import { migrateBoardText, migrateArchiveText } from '../core/migrate.js';
import { diffStats, BoardError, firstDifference } from '../core/text.js';

const raw = (n) => readFileSync(new URL(`./fixtures/${n}.md`, import.meta.url), 'utf8');
const board = migrateBoardText(raw('demo.kanban')).text;
const ws = { board, archive: migrateArchiveText(raw('demo.archive'), parseBoard(board).config.columns).text };
const clone = (v) => JSON.parse(JSON.stringify(v));
const stateOf = (w) => { const b = parseBoard(w.board); return { config: b.config, tasks: b.tasks, archive: w.archive ? parseArchive(w.archive, b.config.columns).tasks : [] }; };
const apply = (w, next) => { const { ops, unsupported } = diffToOps(stateOf(w), next); return { ops, unsupported, out: applyOps(w, ops) }; };

// What reading the file back should give for `next`: new tasks carry the ids the file assigned,
// a task whose column vanished reads back in the first column (archived: 'archived').
function expectedFrom(next, out, ops = []) {
  const idOf = Object.fromEntries(out.results.filter((r) => r.clientId).map((r) => [r.clientId, r.id]));
  const cols = next.config.columns.map((c) => c.id);
  // setColumns' reassign is column-wide: an archived task in a removed column follows it when there is
  // one; with none it keeps the old id, which reads back as 'archived'.
  const reassign = Object.assign({}, ...ops.filter((o) => o.type === 'setColumns').map((o) => o.reassign || {}));
  const fix = (t, fallback, archived = false) => ({ ...t, id: idOf[t.id] || t.id, status: cols.includes(t.status) ? t.status : archived && reassign[t.status] ? reassign[t.status] : fallback });
  return {
    tasks: Object.fromEntries(next.tasks.map((t) => fix(t, cols[0])).map((t) => [t.id, t])),
    archive: Object.fromEntries(next.archive.map((t) => fix(t, 'archived', true)).map((t) => [t.id, t])),
    config: next.config,
  };
}
function assertReadsBack(out, next, label = '', ops = []) {
  const exp = expectedFrom(next, out, ops);
  const got = stateOf({ board: out.board, archive: out.archive });
  const asMap = (arr) => Object.fromEntries(arr.map((t) => [t.id, t]));
  assert.ok(!firstDifference(exp.tasks, asMap(got.tasks)), `${label} board tasks ${JSON.stringify(firstDifference(exp.tasks, asMap(got.tasks)))}`);
  assert.ok(!firstDifference(exp.archive, asMap(got.archive)), `${label} archive tasks ${JSON.stringify(firstDifference(exp.archive, asMap(got.archive)))}`);
  assert.deepEqual(got.config.columns, exp.config.columns, `${label} columns`);
  for (const k of ['categories', 'users', 'priorities', 'tags']) assert.deepEqual(got.config[k], exp.config[k], `${label} ${k}`);
}

test('no change, no ops', () => {
  const { ops, unsupported } = diffToOps(stateOf(ws), stateOf(ws));
  assert.deepEqual(ops, []);
  assert.deepEqual(unsupported, []);
});

test('a form edit becomes one updateTask with only the changed fields', () => {
  const next = clone(stateOf(ws));
  Object.assign(next.tasks[2], { title: 'Retitled', due: '2027-01-01', tags: ['#x'] });
  const { ops, out } = apply(ws, next);
  assert.deepEqual(ops, [{ type: 'updateTask', id: next.tasks[2].id, set: { title: 'Retitled', due: '2027-01-01', tags: ['#x'] } }]);
  assert.ok(diffStats(ws.board, out.board).removed <= 3);
  assertReadsBack(out, next);
});

test('create appends last, archive and restore move blocks, delete removes them', () => {
  const next = clone(stateOf(ws));
  const [moved] = next.tasks.splice(1, 1); next.archive.push(moved);
  const [back] = next.archive.splice(0, 1); next.tasks.push(back);
  next.tasks.splice(0, 1);
  next.tasks.push({ ...clone(next.tasks[0]), id: 'TASK-999', title: 'Brand new', subtasks: [{ completed: true, text: 's' }], notes: 'n', extra: '' });
  const { ops, out } = apply(ws, next);
  assert.deepEqual(ops.map((o) => o.type), ['deleteTask', 'archiveTask', 'restoreTask', 'createTask']);
  assertReadsBack(out, next);
  assert.equal(out.files.map((f) => f.name)[0], 'archive.md', 'an archive move writes the archive first');
});

test('a restore-only batch writes the board first', () => {
  const next = clone(stateOf(ws));
  next.tasks.push(next.archive.shift());
  const { out } = apply(ws, next);
  assert.equal(out.files.map((f) => f.name)[0], 'kanban.md');
});

test('column rename (name only), re-id (tasks follow), add, delete and reorder', () => {
  const base = stateOf(ws);
  // name only
  let next = clone(base); next.config.columns[1].name = 'Doing';
  assertReadsBack(apply(ws, next).out, next, 'rename');
  // id change: the page moves the tasks (board and archive) to the new id
  next = clone(base);
  const old = next.config.columns[1].id; next.config.columns[1].id = 'wip';
  for (const t of [...next.tasks, ...next.archive]) if (t.status === old) t.status = 'wip';
  const r = apply(ws, next);
  assert.deepEqual(r.ops.map((o) => o.type), ['setColumns']);
  assert.deepEqual(r.ops[0].reassign, { [old]: 'wip' });
  assertReadsBack(r.out, next, 're-id', r.ops);
  // add + reorder
  next = clone(base); next.config.columns.push({ name: 'Later', id: 'later' }); next.config.columns.reverse();
  assertReadsBack(apply(ws, next).out, next, 'add+reorder');
  // delete: the page leaves the tasks with the old id; on disk they land in the first column
  next = clone(base); const gone = next.config.columns.splice(2, 1)[0];
  const rr = apply(ws, next);
  assert.equal(rr.ops[0].reassign[gone.id], next.config.columns[0].id);
  assertReadsBack(rr.out, next, 'delete', rr.ops);
});

test('moving a task to a column that is created in the same save works', () => {
  const next = clone(stateOf(ws));
  next.config.columns.push({ name: 'Later', id: 'later' });
  next.tasks[0].status = 'later';
  const { ops, out } = apply(ws, next);
  assert.deepEqual(ops.map((o) => o.type), ['setColumns', 'updateTask']);
  assertReadsBack(out, next);
});

test('config lists become setConfigList ops', () => {
  const next = clone(stateOf(ws));
  next.config.categories = ['A', 'B']; next.config.tags = ['t1', 't2'];
  const { ops, out } = apply(ws, next);
  assert.deepEqual(ops.map((o) => o.type), ['setConfigList', 'setConfigList']);
  assertReadsBack(out, next);
});

test('what cannot be expressed is reported, not silently dropped', () => {
  const next = clone(stateOf(ws));
  next.tasks[0].extra = '**Links**:\n- x';
  next.config.boardTitle = 'Renamed';
  next.archive.push({ ...clone(next.tasks[1]), id: 'TASK-888' });
  const { unsupported } = diffToOps(stateOf(ws), next);
  assert.equal(unsupported.length, 3);
});

test('a failing op carries its index and leaves the texts untouched', () => {
  const next = clone(stateOf(ws));
  next.tasks[0].status = 'nope';
  const { ops } = diffToOps(stateOf(ws), next);
  assert.throws(() => applyOps(ws, ops), (e) => e instanceof BoardError && e.code === 'unknown_status' && e.opIndex === 0);
});

test('ops apply to the file as it is NOW: an edit made elsewhere in the meantime survives', () => {
  const base = stateOf(ws);
  const next = clone(base); next.tasks[3].title = 'My edit';
  const { ops } = diffToOps(base, next);
  // meanwhile, another writer changed a different task and appended one
  const elsewhere = applyOps(ws, [
    { type: 'updateTask', id: base.tasks[5].id, set: { title: 'Their edit' } },
    { type: 'createTask', task: { title: 'Their new task' } },
  ]);
  const merged = applyOps({ board: elsewhere.board, archive: elsewhere.archive }, ops);
  const tasks = parseBoard(merged.board).tasks;
  assert.equal(tasks.find((t) => t.id === base.tasks[3].id).title, 'My edit');
  assert.equal(tasks.find((t) => t.id === base.tasks[5].id).title, 'Their edit');
  assert.ok(tasks.some((t) => t.title === 'Their new task'));
});

test('a created task whose id was taken meanwhile gets the next free id', () => {
  const base = stateOf(ws);
  const next = clone(base);
  next.tasks.push({ ...clone(base.tasks[0]), id: 'TASK-020', title: 'Mine' });
  const { ops } = diffToOps(base, next);
  const theirs = applyOps(ws, [{ type: 'createTask', task: { title: 'Theirs' } }]); // takes TASK-020
  const merged = applyOps({ board: theirs.board, archive: theirs.archive }, ops);
  assert.equal(merged.results[0].id, 'TASK-021');
  assert.equal(merged.results[0].clientId, 'TASK-020');
  assert.deepEqual(parseBoard(merged.board).tasks.slice(-2).map((t) => t.title), ['Theirs', 'Mine']);
});

// ---- property: random UI-style edits always read back as intended -------------------------------

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'zeta'];

function mutate(R, state) {
  const pick = (a) => a[Math.floor(R() * a.length)];
  const chance = (p) => R() < p;
  const s = clone(state);
  const cols = () => s.config.columns.map((c) => c.id);
  const prios = s.config.priorities.map((p) => p.replace(/[^\w\s]+/, '').trim());
  const maxId = Math.max(...[...s.tasks, ...s.archive].map((t) => parseInt(t.id.slice(5), 10)));
  const steps = 1 + Math.floor(R() * 4);
  for (let i = 0; i < steps; i++) {
    const r = R();
    const t = s.tasks.length ? pick(s.tasks) : null;
    if (r < 0.35 && t) {
      if (chance(0.5)) t.title = `${pick(WORDS)} ${pick(WORDS)}`;
      if (chance(0.4)) t.status = pick(cols());
      if (chance(0.3)) { const on = chance(0.8); t.priority = on ? pick(prios) : ''; t.category = on ? pick(['A', 'B']) : ''; t.assignees = on && chance(0.5) ? ['@x'] : []; }
      if (chance(0.3)) t.tags = chance(0.3) ? [] : ['#' + pick(WORDS)];
      if (chance(0.3)) t.due = chance(0.3) ? '' : '2027-03-0' + (1 + Math.floor(R() * 9));
      if (chance(0.3)) t.description = chance(0.3) ? '' : `${pick(WORDS)}\n${pick(WORDS)}`;
      if (chance(0.3)) t.subtasks = Array.from({ length: Math.floor(R() * 4) }, () => ({ completed: chance(0.4), text: pick(WORDS) }));
      if (chance(0.3)) t.notes = chance(0.3) ? '' : `${pick(WORDS)} note`;
    } else if (r < 0.5) {
      s.tasks.push({ id: 'TASK-' + String(maxId + 1 + i).padStart(3, '0'), title: `new ${pick(WORDS)}`, status: pick(cols()), order: null, priority: '', category: '', assignees: [], tags: [], created: '2026-10-21', started: '', due: '', completed: '', description: chance(0.5) ? pick(WORDS) : '', subtasks: [], notes: '', extra: '' });
    } else if (r < 0.6 && t) s.tasks.splice(s.tasks.indexOf(t), 1);
    else if (r < 0.7 && t) { s.tasks.splice(s.tasks.indexOf(t), 1); s.archive.push(t); }
    else if (r < 0.78 && s.archive.length) s.tasks.push(s.archive.splice(Math.floor(R() * s.archive.length), 1)[0]);
    else if (r < 0.82 && s.archive.length) s.archive.splice(Math.floor(R() * s.archive.length), 1);
    else if (r < 0.88) s.config.columns[Math.floor(R() * s.config.columns.length)].name = `Col ${pick(WORDS)}`;
    else if (r < 0.91) { const c = s.config.columns[Math.floor(R() * s.config.columns.length)]; const old = c.id; c.id = 'id-' + pick(WORDS) + i; for (const x of [...s.tasks, ...s.archive]) if (x.status === old) x.status = c.id; }
    else if (r < 0.94) s.config.columns.push({ name: 'New ' + pick(WORDS), id: 'n' + Math.floor(R() * 1000) });
    else if (r < 0.96 && s.config.columns.length > 2) s.config.columns.splice(Math.floor(R() * s.config.columns.length), 1);
    else if (r < 0.98) s.config.categories = [pick(WORDS), pick(WORDS) + '2'];
    else s.config.tags = ['k' + Math.floor(R() * 9), 'm'];
  }
  return s;
}

for (let seed = 1; seed <= 12; seed++) {
  test(`property: random UI edits read back as intended (seed ${seed})`, () => {
    const R = rng(seed * 104729);
    let cur = ws;
    let checked = 0;
    for (let step = 0; step < 40; step++) {
      const base = stateOf(cur);
      const next = mutate(R, base);
      const { ops, unsupported } = diffToOps(base, next);
      // a task created and archived within ONE save cannot be addressed yet (the file assigns its id): the page falls back
      if (unsupported.length && unsupported.every((u) => /directly in the archive/.test(u))) continue;
      assert.deepEqual(unsupported, [], `step ${step} ${JSON.stringify(unsupported)}`);
      let out;
      try { out = applyOps(cur, ops); }
      catch (e) {
        // only an input the ops legitimately refuse (e.g. a column id clash) may fail
        assert.ok(e instanceof BoardError && ['invalid_column', 'orphaned_tasks', 'unknown_status', 'invalid_field'].includes(e.code), `step ${step}: ${e.code || e.stack}`);
        continue;
      }
      assertReadsBack(out, next, `seed ${seed} step ${step}`, ops);
      cur = { board: out.board, archive: out.archive };
      checked++;
    }
    assert.ok(checked > 20, `only ${checked} steps applied`);
  });
}
