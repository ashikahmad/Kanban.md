// kanbanmd init: set a project up so AI agents find and use the board tools instead of hand-editing kanban.md.
// Offline, idempotent and conservative: it creates or merges small files, never overwrites something it did
// not write (a JSON file it cannot parse, a different "kanban" server entry, an edited skill), and with
// `dryRun` it changes nothing and only reports. It returns a report; the CLI prints it as JSON.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { createDefaultBoardContent } from '../core/index.js';
import { BoardError } from '../core/text.js';
import { projectBlock } from '../core/guide.js';
import { findBoardDir, BOARD_FOLDER } from '../io/board-dir.js';

const START = '<!-- kanbanmd:start -->', END = '<!-- kanbanmd:end -->';
const SKILL_REL = '.claude/skills/markdown-task-manager/SKILL.md';
const SKILL_SOURCE = new URL('../' + SKILL_REL, import.meta.url);

// What each agent needs. `mcp`: the project file that registers the server and the key it lives under.
// `instr`: files that get the instruction block. `skill`: Claude Code skills. `print`: no project-level MCP file
// exists (the client's config is global), so the entry is only printed.
export const AGENTS = {
    claude: { label: 'Claude Code', mcp: { file: '.mcp.json', key: 'mcpServers' }, instr: ['CLAUDE.md'], skill: true },
    cursor: { label: 'Cursor', mcp: { file: '.cursor/mcp.json', key: 'mcpServers' }, instr: ['AGENTS.md'] },
    vscode: { label: 'VS Code / GitHub Copilot', mcp: { file: '.vscode/mcp.json', key: 'servers', stdio: true }, instr: ['.github/copilot-instructions.md'] },
    gemini: { label: 'Gemini CLI', mcp: { file: '.gemini/settings.json', key: 'mcpServers' }, instr: ['GEMINI.md'] },
    codex: { label: 'Codex CLI', print: 'codex', instr: ['AGENTS.md'] },
    generic: { label: 'Any other agent (AGENTS.md only)', instr: ['AGENTS.md'] },
};
export const AGENT_NAMES = Object.keys(AGENTS);

export function parseAgents(value) {
    const names = String(value).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const out = names.includes('all') ? [...AGENT_NAMES] : names;
    const bad = out.filter((n) => !AGENTS[n]);
    if (bad.length || !out.length) {
        throw new BoardError('usage', `Unknown agent "${bad[0] || value}"`, { hint: `Use --agent ${AGENT_NAMES.join('|')} (comma separated) or all`, valid: AGENT_NAMES });
    }
    return [...new Set(out)];
}

// Ask which agents to set up (numbers, comma separated; Enter picks Claude Code).
export async function promptAgents(input = process.stdin, output = process.stderr) {
    const rl = createInterface({ input, output });
    try {
        output.write('Which AI agents should be set up?\n');
        AGENT_NAMES.forEach((n, i) => output.write(`  ${i + 1}. ${AGENTS[n].label}\n`));
        const answer = (await rl.question('Numbers, comma separated, or "all" [1]: ')).trim();
        if (!answer) return ['claude'];
        if (answer.toLowerCase() === 'all') return [...AGENT_NAMES];
        const picked = answer.split(',').map((s) => AGENT_NAMES[Number(s.trim()) - 1]);
        if (picked.some((p) => !p)) throw new BoardError('usage', `"${answer}" is not a list of numbers from 1 to ${AGENT_NAMES.length}`);
        return [...new Set(picked)];
    } finally { rl.close(); }
}

const instructions = (pkg, folder) => `${START}
${projectBlock(pkg, folder)}
${END}
`;

const serverEntry = (pkg, stdio) => ({ ...(stdio ? { type: 'stdio' } : {}), command: 'npx', args: ['-y', pkg, 'mcp'] });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Insert or refresh the marked block in a Markdown file's text. Returns the new text, or null when the markers are broken.
function withBlock(text, block) {
    const s = text.indexOf(START), e = text.indexOf(END);
    if (s < 0 && e < 0) return text.trim() ? text.replace(/\s*$/, '\n\n') + block : block;
    if (s < 0 || e < s) return null;
    return text.slice(0, s) + block.trimEnd() + text.slice(e + END.length);
}

// Run the setup. `dir` is the project folder; `agents` a list of AGENT_NAMES; `pkg` the package name for npx.
export function runInit({ dir, agents, pkg, dryRun = false, force = false, mcp = true, skill = true, instructions: wantInstr = true, board = true }) {
    const actions = [], manual = [], next = [];
    const abs = (rel) => join(dir, rel);
    const put = (rel, text, action, note) => {
        if (!dryRun) { mkdirSync(dirname(abs(rel)), { recursive: true }); writeFileSync(abs(rel), text); }
        actions.push({ file: rel, action, ...(note && { note }) });
    };
    const note = (rel, action, why) => actions.push({ file: rel, action, note: why });
    const seen = new Set();
    const once = (rel) => (seen.has(rel) ? false : seen.add(rel));

    // The board lives in its own folder: an existing one (board/, the project folder, docs/) is kept, else board/ is created.
    const found = findBoardDir(dir);
    const folder = found ? (relative(dir, found) || '.') : BOARD_FOLDER;
    if (board && !found) put(`${BOARD_FOLDER}/kanban.md`, createDefaultBoardContent(), 'created', 'a new empty board');

    for (const name of agents) {
        const a = AGENTS[name];

        if (mcp && a.mcp && once(a.mcp.file)) {
            const rel = a.mcp.file, entry = serverEntry(pkg, a.mcp.stdio);
            let obj = {}, ok = true;
            if (existsSync(abs(rel))) {
                try { obj = JSON.parse(readFileSync(abs(rel), 'utf8')); } catch { ok = false; }
                if (!obj || typeof obj !== 'object' || Array.isArray(obj) || (obj[a.mcp.key] !== undefined && (typeof obj[a.mcp.key] !== 'object' || Array.isArray(obj[a.mcp.key])))) ok = false;
            }
            if (!ok) {
                note(rel, 'skipped', 'it is not plain JSON (comments?) so it was left alone; add the "kanban" entry yourself');
                manual.push({ agent: name, file: rel, text: JSON.stringify({ [a.mcp.key]: { kanban: entry } }, null, 2) });
            } else {
                const had = existsSync(abs(rel)), cur = (obj[a.mcp.key] || {}).kanban;
                if (cur && same(cur, entry)) note(rel, 'unchanged');
                else if (cur && !force) note(rel, 'kept', 'it already has a different "kanban" server; use --force to replace it');
                else {
                    obj[a.mcp.key] = { ...(obj[a.mcp.key] || {}), kanban: entry };
                    put(rel, JSON.stringify(obj, null, 2) + '\n', had ? 'updated' : 'created');
                }
            }
        }

        if (mcp && a.print === 'codex') {
            manual.push({ agent: name, file: '~/.codex/config.toml (global)', text: `[mcp_servers.kanban]\ncommand = "npx"\nargs = ["-y", "${pkg}", "mcp"]` });
        }

        if (skill && a.skill && once(SKILL_REL)) {
            const want = readFileSync(SKILL_SOURCE, 'utf8');
            if (!existsSync(abs(SKILL_REL))) put(SKILL_REL, want, 'created');
            else if (readFileSync(abs(SKILL_REL), 'utf8') === want) note(SKILL_REL, 'unchanged');
            else if (force) put(SKILL_REL, want, 'updated');
            else note(SKILL_REL, 'kept', 'it differs from the packaged skill (edited or older); use --force to replace it');
        }

        if (wantInstr) for (const rel of a.instr || []) {
            if (!once(rel)) continue;
            const block = instructions(pkg, folder), had = existsSync(abs(rel));
            const cur = had ? readFileSync(abs(rel), 'utf8') : '';
            const out = withBlock(cur, block);
            if (out === null) note(rel, 'skipped', `its ${START} / ${END} markers are unbalanced; fix or remove them and run again`);
            else if (out === cur) note(rel, 'unchanged');
            else put(rel, out, had ? 'updated' : 'created', had ? 'only the marked block' : undefined);
        }
    }

    if (agents.includes('claude') && mcp) next.push('Claude Code asks you to approve the project MCP server the first time it starts a session here.');
    return { agents, dryRun, board: folder, actions, ...(manual.length && { manual }), ...(next.length && { next }) };
}
