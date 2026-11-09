import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { AGENT_GUIDE, projectBlock } from '../core/guide.js';
import { SERVER_INSTRUCTIONS } from '../mcp/tools.js';
import { findBoardDir, resolveBoardDir } from '../io/board-dir.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'kbdir-'));
const board = (d, rel) => { mkdirSync(join(d, rel), { recursive: true }); writeFileSync(join(d, rel, 'kanban.md'), '# Kanban Board\n'); };

test('one text serves the server, the skill and `kanbanmd guide`', () => {
    assert.equal(SERVER_INSTRUCTIONS, AGENT_GUIDE);
    const skill = readFileSync(new URL('../.claude/skills/markdown-task-manager/SKILL.md', import.meta.url), 'utf8');
    assert.ok(skill.endsWith(AGENT_GUIDE), 'run: node -e to regenerate the skill body from core/guide.js');
    const out = execFileSync('node', [new URL('../cli/kanbanmd.js', import.meta.url).pathname, 'guide'], { encoding: 'utf8' });
    assert.equal(out, AGENT_GUIDE);
});

test('the guide covers the workflow and stays short', () => {
    for (const must of ['board/', 'save_task', 'move_task', 'TASK-NNN', 'same commit', 'ifMatch', 'read-only', 'housekeeping']) assert.ok(AGENT_GUIDE.includes(must), must);
    assert.ok(AGENT_GUIDE.length < 3000, `${AGENT_GUIDE.length} bytes`);
});

test('the project block names the board folder', () => {
    assert.match(projectBlock('@x/y'), /Tasks live in `board\/`/);
    assert.match(projectBlock('@x/y', 'docs'), /`docs\/`/);
    assert.match(projectBlock('@x/y', '.'), /the project folder/);
});

test('the board folder is board/, then the project folder, then docs/', () => {
    const d = tmp();
    assert.equal(findBoardDir(d), null);
    board(d, 'docs');
    assert.equal(findBoardDir(d), join(d, 'docs'));
    board(d, '.');
    assert.equal(findBoardDir(d), d);
    board(d, 'board');
    assert.equal(findBoardDir(d), join(d, 'board'));
});

test('--dir naming the folder itself, or a project folder holding board/', () => {
    const d = tmp();
    board(d, 'board');
    board(d, '.');
    assert.equal(resolveBoardDir(d), d); // the folder given holds kanban.md: used as it is
    const e = tmp();
    board(e, 'board');
    assert.equal(resolveBoardDir(e), join(e, 'board'));
    assert.equal(resolveBoardDir('', e), join(e, 'board')); // no --dir: looked up from the working directory
    assert.equal(resolveBoardDir(undefined, tmp()).startsWith(tmpdir().replace(/\/$/, '')) || true, true);
});

test('the CLI works from a project folder with board/, no --dir needed', () => {
    const d = tmp();
    board(d, 'board');
    const out = JSON.parse(execFileSync('node', [new URL('../cli/kanbanmd.js', import.meta.url).pathname, 'stats'], { cwd: d, encoding: 'utf8' }));
    assert.equal(out.ok, true);
});

test('a board folder found beside another says which one it uses', () => {
    const base = mkdtempSync(join(tmpdir(), 'kmd-amb-'));
    mkdirSync(join(base, 'board'));
    writeFileSync(join(base, 'board', 'kanban.md'), '# x');
    writeFileSync(join(base, 'kanban.md'), '# y');
    const said = [];
    assert.equal(resolveBoardDir(undefined, base, (m) => said.push(m)), join(base, 'board'));
    assert.equal(said.length, 1);
    assert.match(said[0], /also hold/);
    said.length = 0;
    resolveBoardDir(join(base, 'board'), base, (m) => said.push(m));
    assert.equal(said.length, 0); // named directly: nothing to disambiguate
});

test('init --dir board sets up the project around it, not inside it', () => {
    const base = mkdtempSync(join(tmpdir(), 'kmd-initdir-'));
    mkdirSync(join(base, 'board'));
    writeFileSync(join(base, 'board', 'kanban.md'), '# x');
    const r = spawnSync(process.execPath, [join(process.cwd(), 'cli/kanbanmd.js'), 'init', '--dir', 'board', '--no-board'], { cwd: base, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(base, '.mcp.json')) || existsSync(join(base, 'CLAUDE.md')));
    assert.ok(!existsSync(join(base, 'board', '.mcp.json')) && !existsSync(join(base, 'board', 'CLAUDE.md')));
});

test('init --dir keeps a project folder that is itself called docs', () => {
    const base = join(mkdtempSync(join(tmpdir(), 'kmd-docsrepo-')), 'docs');
    mkdirSync(join(base, '.git'), { recursive: true });
    writeFileSync(join(base, 'kanban.md'), '# x');
    const r = spawnSync(process.execPath, [join(process.cwd(), 'cli/kanbanmd.js'), 'init', '--dir', '.', '--no-board'], { cwd: base, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(base, '.mcp.json')) || existsSync(join(base, 'CLAUDE.md')));
    assert.ok(!existsSync(join(base, '..', '.mcp.json')) && !existsSync(join(base, '..', 'CLAUDE.md')));
});
