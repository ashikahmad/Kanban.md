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

async function connect(dir, { env } = {}) {
  const { Client } = await import(new URL('client/index.js', SDK));
  const { StdioClientTransport } = await import(new URL('client/stdio.js', SDK));
  const server = new URL('../mcp/server.js', import.meta.url).pathname;
  const transport = new StdioClientTransport({ command: process.execPath, args: env ? [server] : [server, '--dir', dir], env: env && { ...process.env, ...env } });
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(transport);
  return client;
}
const call = async (c, name, args) => { const r = await c.callTool({ name, arguments: args }); return { error: r.isError, body: JSON.parse(r.content[0].text) }; };

test('server lists the read tools with small schemas and short instructions', { skip }, async () => {
  const c = await connect(project());
  try {
    const { tools } = await c.listTools();
    assert.deepEqual(tools.map((t) => t.name), ['get_board', 'get_task', 'get_config', 'list_archive', 'get_board_stats', 'get_changes_since']);
    assert.ok(JSON.stringify(tools).length < 3600, 'schemas are paid on every session');
    assert.ok(c.getInstructions().length < 400);
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
    assert.equal((await call(c, 'list_archive', {})).body.total, 4);
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
