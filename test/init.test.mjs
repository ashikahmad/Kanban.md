import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runInit, parseAgents, AGENT_NAMES } from '../cli/init.js';

const PKG = '@scope/kanbanmd';
const tmp = () => mkdtempSync(join(tmpdir(), 'kbinit-'));
const read = (d, f) => readFileSync(join(d, f), 'utf8');
const act = (r, f) => r.actions.find((a) => a.file === f);

test('claude on a fresh folder: board, .mcp.json, skill and a CLAUDE.md block', () => {
    const d = tmp();
    const r = runInit({ dir: d, agents: ['claude'], pkg: PKG });
    assert.deepEqual(r.actions.map((a) => a.file), ['kanban.md', '.mcp.json', '.claude/skills/markdown-task-manager/SKILL.md', 'CLAUDE.md']);
    assert.deepEqual(JSON.parse(read(d, '.mcp.json')), { mcpServers: { kanban: { command: 'npx', args: ['-y', PKG, 'mcp'] } } });
    assert.match(read(d, 'CLAUDE.md'), /kanbanmd:start[\s\S]*npx -y @scope\/kanbanmd board[\s\S]*kanbanmd:end/);
    assert.match(read(d, 'kanban.md'), /^# Kanban Board/);
    assert.ok(r.next.some((n) => /approve/.test(n)));
});

test('a second run changes nothing', () => {
    const d = tmp();
    runInit({ dir: d, agents: ['claude', 'cursor', 'vscode', 'gemini', 'codex'], pkg: PKG });
    const again = runInit({ dir: d, agents: ['claude', 'cursor', 'vscode', 'gemini', 'codex'], pkg: PKG });
    assert.ok(again.actions.every((a) => a.action === 'unchanged'), JSON.stringify(again.actions));
});

test('every agent writes its own files; codex prints its global config; vscode uses "servers"', () => {
    const d = tmp();
    const r = runInit({ dir: d, agents: AGENT_NAMES, pkg: PKG });
    for (const f of ['.mcp.json', '.cursor/mcp.json', '.vscode/mcp.json', '.gemini/settings.json', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.github/copilot-instructions.md']) assert.ok(existsSync(join(d, f)), f);
    assert.equal(JSON.parse(read(d, '.vscode/mcp.json')).servers.kanban.type, 'stdio');
    assert.equal(r.manual.length, 1);
    assert.match(r.manual[0].text, /mcp_servers\.kanban/);
    assert.equal(r.actions.filter((a) => a.file === 'AGENTS.md').length, 1, 'shared file handled once');
});

test('an existing .mcp.json keeps its other servers', () => {
    const d = tmp();
    writeFileSync(join(d, '.mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'x' } }, extra: 1 }));
    runInit({ dir: d, agents: ['claude'], pkg: PKG });
    const j = JSON.parse(read(d, '.mcp.json'));
    assert.deepEqual(Object.keys(j.mcpServers), ['other', 'kanban']);
    assert.equal(j.extra, 1);
});

test('a different kanban entry is kept unless --force', () => {
    const d = tmp();
    writeFileSync(join(d, '.mcp.json'), JSON.stringify({ mcpServers: { kanban: { command: 'mine' } } }));
    const r = runInit({ dir: d, agents: ['claude'], pkg: PKG, board: false });
    assert.equal(act(r, '.mcp.json').action, 'kept');
    assert.equal(JSON.parse(read(d, '.mcp.json')).mcpServers.kanban.command, 'mine');
    runInit({ dir: d, agents: ['claude'], pkg: PKG, force: true, board: false });
    assert.equal(JSON.parse(read(d, '.mcp.json')).mcpServers.kanban.command, 'npx');
});

test('a file that is not plain JSON is never overwritten', () => {
    const d = tmp();
    mkdirSync(join(d, '.vscode'));
    const original = '{\n  // my servers\n  "servers": {}\n}\n';
    writeFileSync(join(d, '.vscode/mcp.json'), original);
    const r = runInit({ dir: d, agents: ['vscode'], pkg: PKG });
    assert.equal(act(r, '.vscode/mcp.json').action, 'skipped');
    assert.equal(read(d, '.vscode/mcp.json'), original);
    assert.equal(r.manual[0].file, '.vscode/mcp.json');
});

test('instructions: text outside the markers is untouched, the block is refreshed, broken markers are left alone', () => {
    const d = tmp();
    writeFileSync(join(d, 'AGENTS.md'), '# Mine\n\nKeep this.\n');
    runInit({ dir: d, agents: ['generic'], pkg: PKG });
    let t = read(d, 'AGENTS.md');
    assert.ok(t.startsWith('# Mine\n\nKeep this.\n\n<!-- kanbanmd:start -->'));
    writeFileSync(join(d, 'AGENTS.md'), t.replace('Archive only when asked.', 'OLD TEXT').replace('# Mine', '# Mine edited'));
    runInit({ dir: d, agents: ['generic'], pkg: PKG });
    t = read(d, 'AGENTS.md');
    assert.ok(t.startsWith('# Mine edited'));
    assert.ok(!t.includes('OLD TEXT') && t.includes('Archive only when asked.'));
    writeFileSync(join(d, 'AGENTS.md'), '<!-- kanbanmd:start -->\nno end marker\n');
    const r = runInit({ dir: d, agents: ['generic'], pkg: PKG });
    assert.equal(act(r, 'AGENTS.md').action, 'skipped');
    assert.equal(read(d, 'AGENTS.md'), '<!-- kanbanmd:start -->\nno end marker\n');
});

test('an edited skill is kept unless --force; an existing board is never touched', () => {
    const d = tmp();
    writeFileSync(join(d, 'kanban.md'), '# my board\n');
    runInit({ dir: d, agents: ['claude'], pkg: PKG });
    assert.equal(read(d, 'kanban.md'), '# my board\n');
    const skill = join(d, '.claude/skills/markdown-task-manager/SKILL.md');
    writeFileSync(skill, 'edited');
    assert.equal(act(runInit({ dir: d, agents: ['claude'], pkg: PKG }), '.claude/skills/markdown-task-manager/SKILL.md').action, 'kept');
    assert.equal(readFileSync(skill, 'utf8'), 'edited');
    runInit({ dir: d, agents: ['claude'], pkg: PKG, force: true });
    assert.notEqual(readFileSync(skill, 'utf8'), 'edited');
});

test('--dry-run writes nothing; the --no-* switches skip their part', () => {
    const d = tmp();
    const r = runInit({ dir: d, agents: AGENT_NAMES, pkg: PKG, dryRun: true });
    assert.ok(r.actions.length > 5);
    assert.deepEqual(execFileSync('ls', ['-A', d]).toString().trim(), '');
    const r2 = runInit({ dir: d, agents: ['claude'], pkg: PKG, mcp: false, skill: false, instructions: false, board: false });
    assert.deepEqual(r2.actions, []);
});

test('agent names: lists, all, and a clear error for unknown ones', () => {
    assert.deepEqual(parseAgents('claude, Cursor,claude'), ['claude', 'cursor']);
    assert.deepEqual(parseAgents('all'), AGENT_NAMES);
    assert.throws(() => parseAgents('claude,nope'), (e) => e.code === 'usage' && /nope/.test(e.message));
});

test('the CLI: kanbanmd init --agent codex --yes writes AGENTS.md and a usable board', () => {
    const d = tmp();
    const cli = new URL('../cli/kanbanmd.js', import.meta.url).pathname;
    const out = JSON.parse(execFileSync(process.execPath, [cli, '--dir', d, 'init', '--agent', 'codex'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString());
    assert.equal(out.ok, true);
    assert.ok(existsSync(join(d, 'AGENTS.md')));
    const board = JSON.parse(execFileSync(process.execPath, [cli, '--dir', d, 'board']).toString());
    assert.equal(board.ok, true);
});

test('the published package holds the CLI, core, MCP server, page and skill, and no dev files', () => {
    const out = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
    const files = out[0].files.map((f) => f.path);
    for (const must of ['cli/kanbanmd.js', 'cli/serve.js', 'cli/init.js', 'core/index.js', 'io/node-fs.js', 'mcp/server.js', 'mcp/tools.js', 'kanbanmd.html', '.claude/skills/markdown-task-manager/SKILL.md', 'package.json', 'LICENSE']) assert.ok(files.includes(must), `missing ${must}`);
    for (const f of files) assert.ok(!/^(test|src|drafts|board|docs|node_modules|site)\//.test(f), `should not ship ${f}`);
});
