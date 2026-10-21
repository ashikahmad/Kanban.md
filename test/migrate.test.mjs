// Migration to format v3 (one metadata field per line) and the tolerant reading of older layouts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseBoard, parseArchive, generateBoard } from '../core/board.js';
import { migrateBoardText, migrateArchiveText } from '../core/migrate.js';
import { migrateProject, mutate } from '../io/node-fs.js';
import { BoardError } from '../core/text.js';

const raw = (n) => readFileSync(new URL(`./fixtures/${n}.md`, import.meta.url), 'utf8');
const pairs = JSON.parse(readFileSync(new URL('./pairs.json', import.meta.url), 'utf8'));
const CLI = new URL('../cli/kanbanmd.js', import.meta.url).pathname;
const norm = (tasks, eol) => tasks.map((t) => ({ ...t, notes: t.notes.replace(/\r?\n/g, eol), extra: t.extra.replace(/\r?\n/g, eol) }));

// ---- reading: both layouts mean the same thing --------------------------------------------------

test('joined (v2) and one-per-line (v3) metadata parse to the same task', () => {
  const head = (body) => `# B\n\n<!-- Format: v3 -->\n\n## Tasks\n\n### TASK-001 | T\n${body}\n`;
  const joined = parseBoard(head('**Status**: todo\n**Priority**: High | **Category**: Backend | **Assigned**: @a, @b\n**Created**: 2025-01-01 | **Due**: 2025-02-02\n**Tags**: #x #y')).tasks[0];
  const split = parseBoard(head('**Status**: todo\n**Priority**: High\n**Category**: Backend\n**Assigned**: @a, @b\n**Created**: 2025-01-01\n**Due**: 2025-02-02\n**Tags**: #x #y')).tasks[0];
  assert.deepEqual(joined, split);
  assert.equal(split.priority, 'High');
  assert.deepEqual(split.assignees, ['@a', '@b']);
  assert.equal(split.due, '2025-02-02');
});

test('fields are independent: priority alone, category alone, assignees alone all survive a round trip', () => {
  for (const body of ['**Priority**: High', '**Category**: Backend', '**Assigned**: @a', '**Priority**: Very High', '**Priority**: 🔴 Critical']) {
    const md = `# B\n\n<!-- Format: v3 -->\n\n## Tasks\n\n### TASK-001 | T\n**Status**: todo\n${body}\n`;
    const a = parseBoard(md);
    const b = parseBoard(generateBoard(a));
    assert.deepEqual(b.tasks, a.tasks, body);
  }
  assert.equal(parseBoard('# B\n\n<!-- Format: v3 -->\n\n## Tasks\n\n### TASK-001 | T\n**Status**: todo\n**Priority**: 🔴 Critical\n').tasks[0].priority, '🔴 Critical');
});

test('metadata is read only before the first section: lookalikes in notes are not fields', () => {
  const md = `# B\n\n<!-- Format: v3 -->\n\n## Tasks\n\n### TASK-001 | T\n**Status**: todo\n\n**Notes**:\nremember **Due**: 2030-01-01 and **Priority**: High\n`;
  const t = parseBoard(md).tasks[0];
  assert.equal(t.due, '');
  assert.equal(t.priority, '');
  assert.match(t.notes, /Due/);
});

test('the generator writes one field per line, in a fixed order, omitting empty ones', () => {
  const md = generateBoard(parseBoard(raw('demo.kanban')));
  assert.ok(!/^\*\*\w+\*\*:.* \| \*\*\w+\*\*:/m.test(md), 'no joined metadata lines');
  assert.match(md, /<!-- Format: v3 -->/);
  const block = md.split('### TASK-001')[1].split('###')[0];
  const labels = [...block.matchAll(/^\*\*(\w+)\*\*:/gm)].map((m) => m[1]);
  assert.deepEqual(labels, ['Status', 'Priority', 'Category', 'Assigned', 'Created', 'Tags', 'Subtasks']);
});

// ---- migrating text ------------------------------------------------------------------------------

for (const name of pairs.boards.filter((n) => !['edge-extras', 'edge-empty'].includes(n))) {
  test(`migrate board ${name}: reads back identically, is v3, and a second run changes nothing`, () => {
    const src = raw(`${name}.kanban`);
    const before = parseBoard(src);
    const out = migrateBoardText(src);
    assert.equal(out.changed, true);
    assert.equal(out.from, before.formatVersion);
    const after = parseBoard(out.text);
    assert.equal(after.formatVersion, 3);
    const eol = out.text.includes('\r\n') ? '\r\n' : '\n';
    assert.deepEqual(after.tasks, norm(before.tasks, eol));
    const again = migrateBoardText(out.text);
    assert.equal(again.changed, false);
    assert.equal(again.text, out.text);
  });
}

for (const [archive, board] of Object.entries(pairs.archives)) {
  test(`migrate archive ${archive}: tasks identical, own heading lines kept, marker added`, () => {
    const cols = parseBoard(raw(`${board}.kanban`)).config.columns;
    const src = raw(`${archive}.archive`);
    const out = migrateArchiveText(src, cols);
    assert.equal(parseArchive(out.text, cols).formatVersion, 3);
    assert.deepEqual(parseArchive(out.text, cols).tasks, norm(parseArchive(src, cols).tasks, out.text.includes('\r\n') ? '\r\n' : '\n'));
    const headingBefore = src.split(/^###\s+TASK-/m)[0].split('\n').filter((l) => l.trim() && !/Format:/.test(l));
    const headingAfter = out.text.split(/^###\s+TASK-/m)[0].split('\n').filter((l) => l.trim() && !/Format:/.test(l));
    assert.deepEqual(headingAfter, headingBefore);
    assert.equal(migrateArchiveText(out.text, cols).changed, false);
  });
}

test('migration keeps CRLF files CRLF and a Last Task ID, the title and the config', () => {
  const out = migrateBoardText(raw('edge-crlf.kanban')).text;
  assert.ok(!/(?<!\r)\n/.test(out));
  const c = parseBoard(out).config;
  assert.equal(c.lastTaskId, 2);
  assert.equal(c.boardTitle, 'CRLF Board');
  assert.deepEqual(c.columns.map((x) => x.id), ['todo', 'done']);
});

test('migration refuses a file it cannot read back exactly, and says why', () => {
  let err;
  try { migrateBoardText(raw('edge-extras.kanban')); } catch (e) { err = e; }
  assert.ok(err instanceof BoardError);
  assert.equal(err.code, 'migration_unsafe');
  assert.deepEqual(err.details, { blocks: 5, parsed: 4, unique: 4 });
});

test('a v3 file is returned untouched', () => {
  const v3 = migrateBoardText(raw('demo.kanban')).text;
  assert.equal(migrateBoardText(v3).text, v3);
  assert.equal(migrateBoardText(v3).changed, false);
});

// ---- migrating a project folder ------------------------------------------------------------------

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'kanbanmd-mig-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}
const demoV2 = () => project({ 'kanban.md': raw('demo.kanban'), 'archive.md': raw('demo.archive') });
const read = (dir, f) => readFileSync(join(dir, f), 'utf8');

test('migrateProject: backs up both originals, writes v3, leaves no temp files', async () => {
  const dir = demoV2();
  const before = { b: read(dir, 'kanban.md'), a: read(dir, 'archive.md') };
  const out = await migrateProject(dir);
  assert.equal(out.changed, true);
  assert.deepEqual(out.files.sort(), ['archive.md', 'kanban.md']);
  assert.deepEqual(out.backups.sort(), ['archive.v2-backup.md', 'kanban.v2-backup.md']);
  assert.equal(read(dir, 'kanban.v2-backup.md'), before.b);
  assert.equal(read(dir, 'archive.v2-backup.md'), before.a);
  assert.equal(parseBoard(read(dir, 'kanban.md')).formatVersion, 3);
  assert.equal(parseArchive(read(dir, 'archive.md'), []).formatVersion, 3);
  assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith('.tmp') || f === '.kanban.lock'), []);
});

test('migrateProject: dry run shows the diff and writes nothing; a migrated project is a no-op', async () => {
  const dir = demoV2();
  const before = read(dir, 'kanban.md');
  const d = await migrateProject(dir, { dryRun: true });
  assert.equal(d.dryRun, true);
  assert.match(d.diff, /^\+\*\*Category\*\*: /m);
  assert.equal(read(dir, 'kanban.md'), before);
  assert.ok(!existsSync(join(dir, 'kanban.v2-backup.md')));
  await migrateProject(dir);
  const again = await migrateProject(dir);
  assert.equal(again.changed, false);
});

test('migrateProject: an existing backup is never overwritten', async () => {
  const dir = demoV2();
  writeFileSync(join(dir, 'kanban.v2-backup.md'), 'precious older backup');
  const out = await migrateProject(dir);
  assert.equal(read(dir, 'kanban.v2-backup.md'), 'precious older backup');
  assert.ok(out.backups.some((b) => /^kanban\.v2-backup\.\d+\.md$/.test(b)));
});

test('migrateProject: an unsafe file aborts everything, nothing is written, no backup either', async () => {
  const dir = project({ 'kanban.md': raw('edge-extras.kanban'), 'archive.md': raw('edge-v2.archive') });
  await assert.rejects(migrateProject(dir), (e) => e.code === 'migration_unsafe');
  assert.deepEqual(readdirSync(dir).sort(), ['archive.md', 'kanban.md']);
  assert.equal(read(dir, 'kanban.md'), raw('edge-extras.kanban'));
});

test('migrateProject: handles a v1 board with no archive file', async () => {
  const dir = project({ 'kanban.md': raw('examples-v1.kanban') });
  const out = await migrateProject(dir);
  assert.deepEqual(out.files, ['kanban.md']);
  assert.deepEqual(out.backups, ['kanban.v1-backup.md']);
});

test('edits are refused with a pointer to migrate until the project is migrated, then work', async () => {
  const dir = demoV2();
  await assert.rejects(mutate(dir, { type: 'updateTask', id: 'TASK-001', set: { title: 'x' } }), (e) => e.code === 'needs_migration' && /migrate/.test(e.hint));
  assert.equal(read(dir, 'kanban.md'), raw('demo.kanban'));
  await migrateProject(dir);
  await mutate(dir, { type: 'updateTask', id: 'TASK-001', set: { title: 'Now it works', priority: 'Low' } });
  assert.equal(parseBoard(read(dir, 'kanban.md')).tasks[0].title, 'Now it works');
});

test('cli: migrate (dry run, real run, and repeat)', () => {
  const dir = demoV2();
  const run = (...a) => JSON.parse(spawnSync(process.execPath, [CLI, '--dir', dir, ...a], { encoding: 'utf8' }).stdout);
  const d = run('--dry-run', 'migrate');
  assert.equal(d.ok, true);
  assert.equal(d.dryRun, true);
  assert.deepEqual(d.from, { 'kanban.md': 2, 'archive.md': 2 });
  const r = run('migrate');
  assert.equal(r.changed, true);
  assert.equal(run('migrate').changed, false);
  assert.equal(run('move', 'TASK-004', 'done').ok, true);
});
