// Tests for io/node-fs.js (atomic, compare-and-swap writes) and the kanbanmd CLI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { mutate, readWorkspace } from '../io/node-fs.js';
import { migrateBoardText, migrateArchiveText } from '../core/migrate.js';
import { parseBoard } from '../core/board.js';

const fixture = (n) => new URL(`./fixtures/${n}.md`, import.meta.url).pathname;
const CLI = new URL('../cli/kanbanmd.js', import.meta.url).pathname;
const WORKER = new URL('./tools/worker.mjs', import.meta.url).pathname;

// A project folder holding the demo board, migrated to the current (v3) format.
function project({ raw = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kanbanmd-'));
  const board = readFileSync(fixture('demo.kanban'), 'utf8'), archive = readFileSync(fixture('demo.archive'), 'utf8');
  if (raw) { writeFileSync(join(dir, 'kanban.md'), board); writeFileSync(join(dir, 'archive.md'), archive); return dir; }
  const b = migrateBoardText(board).text;
  writeFileSync(join(dir, 'kanban.md'), b);
  writeFileSync(join(dir, 'archive.md'), migrateArchiveText(archive, parseBoard(b).config.columns).text);
  return dir;
}
const read = (dir, f = 'kanban.md') => readFileSync(join(dir, f), 'utf8');
const tmpLeft = (dir) => readdirSync(dir).filter((f) => f.endsWith('.tmp'));

test('mutate writes the change, leaves no temp file, and logs the activity', async () => {
  const dir = project();
  const out = await mutate(dir, { type: 'moveTask', id: 'TASK-004', status: 'done' }, { actor: 'tester' });
  assert.deepEqual(out.files, ['kanban.md']);
  assert.equal(parseBoard(read(dir)).tasks.find((t) => t.id === 'TASK-004').status, 'done');
  assert.deepEqual(tmpLeft(dir), []);
  const log = read(dir, '.kanban-activity.jsonl').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(log.length, 1);
  assert.equal(log[0].actor, 'tester');
  assert.equal(log[0].id, 'TASK-004');
});

test('dryRun returns the diff and writes nothing', async () => {
  const dir = project();
  const before = read(dir);
  const out = await mutate(dir, { type: 'toggleSubtask', id: 'TASK-001', index: 0 }, { dryRun: true });
  assert.match(out.diff, /^-- \[ \]|^\+- \[x\]/m);
  assert.equal(read(dir), before);
  assert.ok(!existsSync(join(dir, '.kanban-activity.jsonl')));
});

test('a failure just before the rename leaves the original untouched and no temp file', async () => {
  const dir = project();
  const before = read(dir);
  await assert.rejects(
    mutate(dir, { type: 'deleteTask', id: 'TASK-004' }, { hooks: { beforeRename: () => { throw new Error('disk full'); } } }),
    /disk full/);
  assert.equal(read(dir), before);
  assert.deepEqual(tmpLeft(dir), []);
});

test('archiving writes the archive first, then the board', async () => {
  const dir = project();
  const order = [];
  await mutate(dir, { type: 'archiveTask', id: 'TASK-003' }, { hooks: { beforeRename: (p) => { order.push(p.split('/').pop()); } } });
  assert.deepEqual(order, ['archive.md', 'kanban.md']);
});

test('a foreign write between compute and commit forces a recompute; both edits survive', async () => {
  const dir = project();
  let calls = 0;
  const hooks = {
    afterCompute: () => {
      if (calls++ === 0) { // the page saves something else while we hold a computed result
        writeFileSync(join(dir, 'kanban.md'), read(dir).replace('Fix flicker when switching workspaces', 'Foreign edit'));
      }
    },
  };
  await mutate(dir, { type: 'updateTask', id: 'TASK-002', set: { title: 'Mine' } }, { hooks });
  assert.equal(calls, 2, 'the first attempt must be discarded and recomputed');
  const tasks = parseBoard(read(dir)).tasks;
  assert.equal(tasks.find((t) => t.id === 'TASK-007').title, 'Foreign edit');
  assert.equal(tasks.find((t) => t.id === 'TASK-002').title, 'Mine');
  assert.deepEqual(tmpLeft(dir), []);
});

test('a lock held by a live writer makes others wait, then report busy', async () => {
  const dir = project();
  mkdirSync(join(dir, '.kanban.lock'));
  await assert.rejects(mutate(dir, { type: 'deleteTask', id: 'TASK-004' }, { lockTimeoutMs: 150 }), (e) => e.code === 'busy');
  assert.ok(existsSync(join(dir, '.kanban.lock')), 'a lock we did not take must not be removed');
});

test('a stale lock left by a crashed writer is broken', async () => {
  const dir = project();
  mkdirSync(join(dir, '.kanban.lock'));
  const old = new Date(Date.now() - 60_000);
  utimesSync(join(dir, '.kanban.lock'), old, old);
  await mutate(dir, { type: 'deleteTask', id: 'TASK-004' }, { lockStaleMs: 5000 });
  assert.ok(!parseBoard(read(dir)).tasks.some((t) => t.id === 'TASK-004'));
  assert.ok(!existsSync(join(dir, '.kanban.lock')));
});

test('six concurrent processes: no lost task, no duplicate id, board still parses', async () => {
  const dir = project();
  const initial = parseBoard(read(dir)).tasks.length;
  const names = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff'];
  const perWorker = 6;
  const results = await Promise.all(names.map((n) => new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [WORKER, dir, n, String(perWorker)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    p.on('exit', (c) => (c === 0 ? resolve(JSON.parse(out)) : reject(new Error(`worker ${n} exited ${c}: ${err}`))));
  })));
  const created = results.reduce((s, r) => s + r.created, 0);
  assert.equal(created, names.length * perWorker);
  const parsed = parseBoard(read(dir));
  assert.equal(parsed.tasks.length, initial + created);
  const ids = parsed.tasks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate task id');
  const maxId = Math.max(...ids.map((i) => parseInt(i.slice(5), 10)));
  assert.equal(parsed.config.lastTaskId, maxId);
  // every appended note landed too
  const notes = parsed.tasks.map((t) => t.notes).join('\n');
  for (const n of names) for (let i = 0; i < perWorker; i++) assert.ok(notes.includes(`${n} note ${i}`), `${n} note ${i} lost`);
  assert.deepEqual(tmpLeft(dir), []);
});

// ---- CLI ---------------------------------------------------------------------------------------

const cli = (dir, args, input) => {
  const r = spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { input, encoding: 'utf8' });
  return { code: r.status, json: JSON.parse(r.stdout) };
};

test('cli: list and show', () => {
  const dir = project();
  const l = cli(dir, ['list', '--status', 'review']);
  assert.equal(l.json.ok, true);
  assert.ok(l.json.tasks.length > 0 && l.json.tasks.every((t) => t.status === 'review'));
  assert.deepEqual(Object.keys(l.json.tasks[0]).sort(), ['assignees', 'due', 'id', 'priority', 'status', 'tags', 'title']);
  const s = cli(dir, ['show', 'TASK-001']);
  assert.equal(s.json.task.id, 'TASK-001');
  assert.equal(cli(dir, ['show', 'TASK-999']).json.error.code, 'unknown_task');
});

test('cli: sort reorders by id on request', () => {
  const dir = project();
  cli(dir, ['move', 'TASK-001', 'done', '--at-end']);
  const before = parseBoard(read(dir)).tasks.map((t) => t.id);
  assert.notDeepEqual(before, [...before].sort());
  assert.equal(cli(dir, ['sort']).json.error.code, 'missing_field');
  assert.equal(cli(dir, ['sort', '--mode', 'blocks']).json.ok, true);
  const after = parseBoard(read(dir)).tasks.map((t) => t.id);
  assert.deepEqual(after, [...after].sort());
});

test('cli: manual ordering — positions turns it on, moves write keys, clear turns it off', () => {
  const dir = project();
  assert.equal(cli(dir, ['sort', '--mode', 'positions']).json.ok, true);
  const first = cli(dir, ['list', '--status', 'backlog']).json.tasks;
  assert.ok(first.every((t) => typeof t.order === 'number'));
  const [a, b] = [first[0].id, first[1].id];
  const fileOrder = parseBoard(read(dir)).tasks.map((t) => t.id);
  assert.equal(cli(dir, ['move', b, 'backlog', '--before', a]).json.ok, true);
  const shown = cli(dir, ['list', '--status', 'backlog']).json.tasks.map((t) => t.id);
  assert.deepEqual(shown.slice(0, 2), [b, a]);
  assert.deepEqual(parseBoard(read(dir)).tasks.map((t) => t.id), fileOrder, 'no block moved');
  assert.equal(cli(dir, ['sort', '--mode', 'clear']).json.ok, true);
  assert.ok(!read(dir).includes('**Order**'));
});

test('cli: create, move, update, note, archive', () => {
  const dir = project();
  const c = cli(dir, ['create', '--title', 'From the CLI', '--status', 'backlog', '--priority', 'High', '--category', 'Backend', '--tags', 'api,cli']);
  assert.equal(c.json.ok, true);
  const id = c.json.result.id;
  assert.equal(cli(dir, ['move', id, 'in-progress']).json.ok, true);
  assert.equal(cli(dir, ['update', id, '--due', '2027-05-05', '--description', 'hello']).json.ok, true);
  assert.equal(cli(dir, ['note', id, 'a', 'note']).json.ok, true);
  assert.equal(cli(dir, ['subtask', id, 'first step']).json.ok, true);
  assert.equal(cli(dir, ['toggle', id, '0']).json.ok, true);
  const t = parseBoard(read(dir)).tasks.find((x) => x.id === id);
  assert.equal(t.status, 'in-progress');
  assert.equal(t.due, '2027-05-05');
  assert.equal(t.notes, 'a note');
  assert.deepEqual(t.subtasks, [{ completed: true, text: 'first step' }]);
  assert.equal(cli(dir, ['archive', id]).json.ok, true);
  assert.ok(!parseBoard(read(dir)).tasks.some((x) => x.id === id));
  assert.match(read(dir, 'archive.md'), new RegExp(`### ${id} \\| From the CLI`));
});

test('cli: --dry-run prints a diff and changes nothing; errors are JSON with a non-zero exit', () => {
  const dir = project();
  const before = read(dir);
  const d = cli(dir, ['--dry-run', 'move', 'TASK-004', 'done', '--before', 'TASK-012']);
  assert.equal(d.json.dryRun, true);
  assert.match(d.json.diff, /^@@/m);
  assert.equal(read(dir), before);
  const e = cli(dir, ['move', 'TASK-004', 'nope']);
  assert.equal(e.code, 1);
  assert.equal(e.json.ok, false);
  assert.equal(e.json.error.code, 'unknown_status');
  assert.ok(e.json.error.valid.includes('done'));
  assert.equal(read(dir), before);
});

test('cli: apply reads a JSON op from stdin', () => {
  const dir = project();
  const r = cli(dir, ['apply', '-'], JSON.stringify({ type: 'updateTask', id: 'TASK-002', set: { title: 'Via stdin' } }));
  assert.equal(r.json.ok, true);
  assert.equal(parseBoard(read(dir)).tasks.find((t) => t.id === 'TASK-002').title, 'Via stdin');
});

test('cli: a missing project folder is a clear error', () => {
  const r = cli(mkdtempSync(join(tmpdir(), 'kanbanmd-empty-')), ['list']);
  assert.equal(r.code, 1);
  assert.equal(r.json.error.code, 'no_board');
});

test('readWorkspace tolerates a missing archive', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kanbanmd-'));
  copyFileSync(fixture('demo.kanban'), join(dir, 'kanban.md'));
  assert.equal((await readWorkspace(dir)).archive, null);
});
