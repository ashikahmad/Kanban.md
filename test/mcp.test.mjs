// The MCP server end to end: spawned over real stdio and driven with the SDK's own client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { migrateBoardText, migrateArchiveText } from '../core/migrate.js';
import { parseBoard } from '../core/board.js';
import { mutate } from '../io/node-fs.js';

const SDK = new URL('../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/', import.meta.url);
const installed = existsSync(new URL('client/index.js', SDK));
const skip = installed ? false : 'run `npm install` in mcp/ to enable the MCP tests';
const raw = (n) => readFileSync(new URL(`./fixtures/${n}.md`, import.meta.url), 'utf8');

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'kanbanmd-mcp-'));
  const b = migrateBoardText(raw('demo.kanban')).text;
  writeFileSync(join(dir, 'kanban.md'), b);
  writeFileSync(join(dir, 'archive.md'), migrateArchiveText(raw('demo.archive'), parseBoard(b).config.columns).text);
  return dir;
}

async function connect(dir, { env, args = [], name = 'test' } = {}) {
  const { Client } = await import(new URL('client/index.js', SDK));
  const { StdioClientTransport } = await import(new URL('client/stdio.js', SDK));
  const server = new URL('../mcp/server.js', import.meta.url).pathname;
  const transport = new StdioClientTransport({ command: process.execPath, args: env ? [server, ...args] : [server, '--dir', dir, ...args], env: env && { ...process.env, ...env } });
  const client = new Client({ name, version: '0' });
  await client.connect(transport);
  return client;
}
const call = async (c, name, args) => { const r = await c.callTool({ name, arguments: args }); return { error: r.isError, body: JSON.parse(r.content[0].text) }; };

test('server lists the tools with small schemas and short instructions', { skip }, async () => {
  const c = await connect(project());
  try {
    const { tools } = await c.listTools();
    assert.deepEqual(tools.map((t) => t.name), ['get_board', 'get_task', 'get_config', 'get_board_stats', 'get_changes_since', 'save_task', 'move_task', 'subtask', 'add_note', 'archive_tasks', 'restore_task', 'delete_task', 'sort_tasks', 'update_config']);
    assert.ok(JSON.stringify(tools).length < 7200, 'schemas are paid on every session');
    assert.ok(c.getInstructions().length < 600);
    assert.ok(tools.every((t) => t.inputSchema.type === 'object' && t.description));
  } finally { await c.close(); }
});

test('server answers the read tools', { skip }, async () => {
  const c = await connect(project());
  try {
    const board = await call(c, 'get_board', { status: 'review', limit: 2 });
    assert.equal(board.error, undefined);
    assert.equal(board.body.tasks.length, 2);
    assert.equal(board.body.total, 3);
    const task = await call(c, 'get_task', { id: board.body.tasks[0].id });
    assert.equal(task.body.id, board.body.tasks[0].id);
    assert.ok(task.body.description);
    assert.deepEqual((await call(c, 'get_config', {})).body.priorities, ['Critical', 'High', 'Medium', 'Low']);
    assert.equal((await call(c, 'get_board', { archived: true })).body.total, 4);
    assert.equal((await call(c, 'get_board_stats', {})).body.total, 15);
    assert.deepEqual((await call(c, 'get_changes_since', {})).body.changes, []);
  } finally { await c.close(); }
});

test('errors come back as tool errors with a code and the valid choices', { skip }, async () => {
  const c = await connect(project());
  try {
    const bad = await call(c, 'get_board', { status: 'nope' });
    assert.equal(bad.error, true);
    assert.equal(bad.body.error.code, 'unknown_status');
    assert.ok(bad.body.error.valid.includes('review'));
    assert.equal((await call(c, 'get_task', { id: 'TASK-999' })).body.error.code, 'unknown_task');
    assert.equal((await call(c, 'no_such_tool', {})).body.error.code, 'unknown_tool');
  } finally { await c.close(); }
});

test('every call re-reads the files: edits by other writers show up immediately', { skip }, async () => {
  const dir = project();
  const c = await connect(dir);
  try {
    const before = await call(c, 'get_board', { status: 'backlog' });
    await mutate(dir, { type: 'updateTask', id: 'TASK-001', set: { title: 'Edited elsewhere' } }, { actor: 'cli-test' });
    const after = await call(c, 'get_board', { status: 'backlog' });
    assert.notEqual(after.body.rev, before.body.rev);
    assert.equal(after.body.tasks.find((t) => t.id === 'TASK-001').title, 'Edited elsewhere');
    const log = await call(c, 'get_changes_since', {});
    assert.deepEqual(log.body.changes.map((x) => [x.actor, x.op, x.id]), [['cli-test', 'updateTask', 'TASK-001']]);
    assert.equal(log.body.rev, after.body.rev);
  } finally { await c.close(); }
});

test('the project folder can come from the environment, and a missing board is a clear error', { skip }, async () => {
  const c = await connect(null, { env: { KANBANMD_DIR: project() } });
  try { assert.equal((await call(c, 'get_config', {})).body.tasks, 15); } finally { await c.close(); }
  const empty = await connect(mkdtempSync(join(tmpdir(), 'kanbanmd-empty-')));
  try {
    const r = await call(empty, 'get_board', {});
    assert.equal(r.error, true);
    assert.equal(r.body.error.code, 'no_board');
  } finally { await empty.close(); }
});

// ---- writes ----------------------------------------------------------------------------------------

test('save_task creates (no id) and changes (id); the ack is small and carries the etag', { skip }, async () => {
  const dir = project();
  const c = await connect(dir);
  try {
    const made = await call(c, 'save_task', { title: 'Via MCP', status: 'backlog', priority: 'High', category: 'Backend', tags: ['api'], subtasks: [{ text: 'one' }] });
    assert.equal(made.error, undefined);
    assert.deepEqual(Object.keys(made.body).sort(), ['etag', 'files', 'id', 'ok']);
    assert.equal(made.body.id, 'TASK-020');
    const seen = await call(c, 'get_task', { id: made.body.id });
    assert.equal(seen.body.etag, made.body.etag, 'the ack etag is the task\'s current etag');
    assert.deepEqual(seen.body.subtasks, [{ completed: false, text: 'one' }]);
    const upd = await call(c, 'save_task', { id: made.body.id, due: '2027-01-01', priority: 'Low', ifMatch: made.body.etag });
    assert.equal(upd.body.ok, true);
    assert.notEqual(upd.body.etag, made.body.etag);
    assert.equal((await call(c, 'get_task', { id: made.body.id })).body.due, '2027-01-01');
    assert.equal((await call(c, 'save_task', { description: 'no title and no id' })).body.error.code, 'missing_field');
  } finally { await c.close(); }
});

test('ifMatch protects against overwriting someone else\'s edit', { skip }, async () => {
  const dir = project();
  const c = await connect(dir);
  try {
    const t = (await call(c, 'get_task', { id: 'TASK-002' })).body;
    await mutate(dir, { type: 'updateTask', id: 'TASK-002', set: { title: 'Changed by the page or another agent' } }, { actor: 'other' });
    const r = await call(c, 'save_task', { id: 'TASK-002', title: 'My stale edit', ifMatch: t.etag });
    assert.equal(r.error, true);
    assert.equal(r.body.error.code, 'conflict');
    assert.equal((await call(c, 'get_task', { id: 'TASK-002' })).body.title, 'Changed by the page or another agent');
  } finally { await c.close(); }
});

test('move_task, subtask, add_note, archive_tasks, restore_task, delete_task', { skip }, async () => {
  const dir = project();
  const c = await connect(dir);
  try {
    assert.equal((await call(c, 'move_task', { id: 'TASK-004', status: 'done' })).body.ok, true);
    assert.equal((await call(c, 'get_task', { id: 'TASK-004', fields: ['status'] })).body.status, 'done');
    assert.equal((await call(c, 'move_task', { id: 'TASK-004', status: 'nope' })).body.error.code, 'unknown_status');
    assert.equal((await call(c, 'subtask', { id: 'TASK-001', toggle: 0 })).body.ok, true);
    assert.equal((await call(c, 'subtask', { id: 'TASK-001', add: 'Ship it' })).body.ok, true);
    const t1 = (await call(c, 'get_task', { id: 'TASK-001' })).body;
    assert.equal(t1.subtasks[0].completed, true);
    assert.equal(t1.subtasks.at(-1).text, 'Ship it');
    assert.equal((await call(c, 'subtask', { id: 'TASK-001', toggle: 'Ship it', done: true })).body.ok, true);
    assert.equal((await call(c, 'subtask', { id: 'TASK-001' })).body.error.code, 'missing_field');
    assert.equal((await call(c, 'add_note', { id: 'TASK-003', text: 'Waiting on legal.' })).body.ok, true);
    assert.equal((await call(c, 'get_task', { id: 'TASK-003', fields: ['notes'] })).body.notes, 'Waiting on legal.');

    const arch = await call(c, 'archive_tasks', { ids: ['TASK-003', 'TASK-005'] });
    assert.deepEqual(arch.body.ids, ['TASK-003', 'TASK-005']);
    assert.deepEqual(arch.body.files, ['archive.md', 'kanban.md']);
    assert.equal((await call(c, 'get_task', { id: 'TASK-003' })).body.archived, true);
    assert.equal((await call(c, 'archive_tasks', { ids: ['TASK-006', 'TASK-404'] })).body.error.code, 'unknown_task');
    assert.equal((await call(c, 'get_task', { id: 'TASK-006' })).body.id, 'TASK-006', 'all or nothing');
    assert.equal((await call(c, 'restore_task', { id: 'TASK-003' })).body.ok, true);
    assert.equal((await call(c, 'delete_task', { id: 'TASK-005' })).body.ok, true);
    assert.equal((await call(c, 'get_task', { id: 'TASK-005' })).body.error.code, 'unknown_task');
  } finally { await c.close(); }
});

test('sort_tasks needs an explicit mode; update_config edits lists, columns and the housekeeping policy', { skip }, async () => {
  const dir = project();
  const c = await connect(dir);
  try {
    assert.equal((await call(c, 'sort_tasks', {})).body.error.code, 'missing_field');
    assert.equal((await call(c, 'sort_tasks', { mode: 'positions' })).body.ok, true);
    assert.equal((await call(c, 'get_config', {})).body.manualOrder, true);
    assert.equal((await call(c, 'sort_tasks', { mode: 'clear' })).body.ok, true);

    const cfg = await call(c, 'update_config', { categories: ['A', 'B'], tags: ['x', 'y'], housekeeping: { done: { column: 'done', afterDays: 7 }, max: 50 } });
    assert.equal(cfg.body.ok, true);
    const after = (await call(c, 'get_config', {})).body;
    assert.deepEqual(after.categories, ['A', 'B']);
    assert.deepEqual(after.tags, ['x', 'y']);
    assert.deepEqual([after.housekeeping.done.afterDays, after.housekeeping.max], [7, 50]);
    const cols = after.columns;
    const moved = await call(c, 'update_config', { columns: cols.filter((x) => x.id !== 'review'), reassign: { review: 'backlog' } });
    assert.equal(moved.body.ok, true);
    assert.ok((await call(c, 'get_board', { status: 'backlog' })).body.total > 5);
    assert.equal((await call(c, 'update_config', {})).body.error.code, 'missing_field');
  } finally { await c.close(); }
});

test('dryRun previews the diff and writes nothing', { skip }, async () => {
  const dir = project();
  const before = readFileSync(join(dir, 'kanban.md'), 'utf8');
  const c = await connect(dir);
  try {
    const r = await call(c, 'move_task', { id: 'TASK-004', status: 'done', dryRun: true });
    assert.equal(r.body.dryRun, true);
    assert.match(r.body.diff, /^-\*\*Status\*\*: backlog {2}$/m);
    assert.match(r.body.diff, /^\+\*\*Status\*\*: done {2}$/m);
    assert.equal(readFileSync(join(dir, 'kanban.md'), 'utf8'), before);
    assert.deepEqual((await call(c, 'get_changes_since', {})).body.changes, []);
  } finally { await c.close(); }
});

test('a no-op write says so; an older-format project gets a pointer to migrate', { skip }, async () => {
  const dir = project();
  const c = await connect(dir);
  try {
    const t = (await call(c, 'get_task', { id: 'TASK-004' })).body;
    const same = await call(c, 'move_task', { id: 'TASK-004', status: t.status });
    assert.deepEqual([same.body.ok, same.body.changed], [true, false]);
  } finally { await c.close(); }
  const v2 = mkdtempSync(join(tmpdir(), 'kanbanmd-mcp-v2-'));
  writeFileSync(join(v2, 'kanban.md'), raw('demo.kanban'));
  const c2 = await connect(v2);
  try {
    const r = await call(c2, 'move_task', { id: 'TASK-004', status: 'done' });
    assert.equal(r.body.error.code, 'needs_migration');
    assert.match(r.body.error.hint, /migrate/);
    assert.equal((await call(c2, 'get_config', {})).body.migrationNeeded, true, 'reads still work');
  } finally { await c2.close(); }
});

test('writes are logged under the connecting client\'s name', { skip }, async () => {
  const dir = project();
  const c = await connect(dir, { name: 'claude-code' });
  try {
    await call(c, 'move_task', { id: 'TASK-004', status: 'done' });
    await call(c, 'update_config', { tags: ['a'], categories: ['b'] });
    const log = (await call(c, 'get_changes_since', {})).body.changes;
    assert.deepEqual(log.map((x) => [x.actor, x.op]), [['claude-code', 'moveTask'], ['claude-code', 'setConfigList'], ['claude-code', 'setConfigList']]);
  } finally { await c.close(); }
});

test('--read-only exposes only the read tools and refuses writes', { skip }, async () => {
  const c = await connect(project(), { args: ['--read-only'] });
  try {
    const { tools } = await c.listTools();
    assert.deepEqual(tools.map((t) => t.name), ['get_board', 'get_task', 'get_config', 'get_board_stats', 'get_changes_since']);
    assert.ok(JSON.stringify(tools).length < 2600);
    const r = await call(c, 'move_task', { id: 'TASK-004', status: 'done' });
    assert.equal(r.error, true);
    assert.equal(r.body.error.code, 'unknown_tool');
    assert.ok(!r.body.error.valid.includes('move_task'));
  } finally { await c.close(); }
});

test('two servers writing to one project at once lose nothing', { skip }, async () => {
  const dir = project();
  const [a, b] = await Promise.all([connect(dir, { name: 'agent-a' }), connect(dir, { name: 'agent-b' })]);
  try {
    const work = (c, who) => Promise.all(Array.from({ length: 6 }, (_, i) => call(c, 'save_task', { title: `${who} ${i}` })));
    const [ra, rb] = await Promise.all([work(a, 'A'), work(b, 'B')]);
    assert.ok([...ra, ...rb].every((r) => r.body.ok), JSON.stringify([...ra, ...rb].find((r) => !r.body.ok)));
    const all = (await call(a, 'get_board', { limit: 100 })).body;
    assert.equal(all.total, 15 + 12);
    const ids = all.tasks.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, 'unique ids');
  } finally { await a.close(); await b.close(); }
});

test('the backlog file over MCP: enable, list, promote and demote by status, archive from it', { skip }, async () => {
  const dir = project();
  const c = await connect(dir);
  try {
    assert.equal((await call(c, 'get_board', { backlog: true })).body.error.code, 'no_backlog_file');
    const on = await call(c, 'update_config', { backlogFile: { enabled: true, column: 'backlog' } });
    assert.equal(on.body.ok, true);
    assert.deepEqual(on.body.files, ['backlog.md', 'kanban.md']);
    const bl = (await call(c, 'get_board', { backlog: true })).body;
    assert.ok(bl.total >= 3);
    const first = bl.tasks[0].id;
    assert.equal((await call(c, 'get_task', { id: first })).body.backlog, true);
    assert.equal((await call(c, 'get_config', {})).body.backlogFile.column, 'backlog');
    const promoted = await call(c, 'move_task', { id: first, status: 'in-progress' });
    assert.equal(promoted.body.ok, true);
    assert.deepEqual(promoted.body.files, ['kanban.md', 'backlog.md']);
    assert.equal((await call(c, 'get_task', { id: first })).body.backlog, undefined);
    assert.equal((await call(c, 'move_task', { id: first, status: 'backlog' })).body.ok, true, 'demoted again');
    assert.equal((await call(c, 'get_task', { id: first })).body.backlog, true);
    const arch = await call(c, 'archive_tasks', { ids: [first] });
    assert.deepEqual(arch.body.files, ['archive.md', 'backlog.md']);
    assert.equal((await call(c, 'get_board_stats', {})).body.backlog, bl.total - 1);
    assert.equal((await call(c, 'update_config', { backlogFile: { enabled: false } })).body.ok, true);
    assert.equal((await call(c, 'get_board', { backlog: true })).body.error.code, 'no_backlog_file');
  } finally { await c.close(); }
});
