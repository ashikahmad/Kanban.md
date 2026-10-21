// Node file port: reads the two board files and applies an op to them safely.
//
// Writers that go through this module (CLI, MCP server, any number of processes) take turns via
// an exclusive lock directory (mkdir is atomic), so their read-modify-write cycles never
// interleave. The page cannot take that lock, so it is covered by a second layer: just before the
// rename, every file that was read is re-read and its hash compared, and if anything moved the
// op is recomputed from the fresh content. Each file is replaced atomically (temp file in the same
// directory, fsync, rename), so a reader never sees a half-written file. The only remaining gap is
// a foreign writer landing between that last check and the rename (microseconds); the per-task
// etag (ifMatch) is the tool for callers that need certainty beyond that.
import { promises as fs } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join, basename, dirname } from 'node:path';
import { applyOp } from '../core/ops.js';
import { BoardError, unifiedDiff } from '../core/text.js';

const BOARD = 'kanban.md', ARCHIVE = 'archive.md', ACTIVITY = '.kanban-activity.jsonl', LOCK = '.kanban.lock';
const sha = (s) => (s === null ? '-' : createHash('sha1').update(s).digest('hex'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readOptional(path) {
    try { return await fs.readFile(path, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

export async function readWorkspace(dir) {
    const board = await readOptional(join(dir, BOARD));
    if (board === null) throw new BoardError('no_board', `No ${BOARD} in ${dir}`, { hint: 'Pass --dir pointing at the project folder.' });
    return { board, archive: await readOptional(join(dir, ARCHIVE)) };
}

// Write `text` to a temp file next to `path` and return handles to commit (rename) or abort it.
async function stage(path, text) {
    const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
    const fh = await fs.open(tmp, 'w');
    try {
        await fh.writeFile(text, 'utf8');
        await fh.sync();
    } catch (e) {
        await fh.close();
        await fs.rm(tmp, { force: true });
        throw e;
    }
    await fh.close();
    return { tmp, path, abort: () => fs.rm(tmp, { force: true }), commit: () => fs.rename(tmp, path) };
}

// Exclusive, cross-process lock on a project folder. A lock older than `staleMs` is assumed
// to belong to a crashed process and is broken.
async function withLock(dir, fn, { timeoutMs = 15000, staleMs = 10000 } = {}) {
    const lock = join(dir, LOCK);
    const started = Date.now();
    for (;;) {
        try { await fs.mkdir(lock); break; }
        catch (e) {
            if (e.code !== 'EEXIST') throw e;
            try {
                const { mtimeMs } = await fs.stat(lock);
                if (Date.now() - mtimeMs > staleMs) { await fs.rm(lock, { recursive: true, force: true }); continue; }
            } catch { /* released between the mkdir and the stat: just retry */ }
            if (Date.now() - started > timeoutMs) {
                throw new BoardError('busy', 'Another process is writing to this board', { hint: 'Retry the call.' });
            }
            await sleep(2 + Math.random() * 8);
        }
    }
    try { return await fn(); }
    finally { await fs.rm(lock, { recursive: true, force: true }); }
}

async function logActivity(dir, entry) {
    const path = join(dir, ACTIVITY);
    try {
        await fs.appendFile(path, JSON.stringify(entry) + '\n');
        const { size } = await fs.stat(path);
        if (size > 256 * 1024) { // keep the log bounded
            const lines = (await fs.readFile(path, 'utf8')).trimEnd().split('\n');
            await fs.writeFile(path, lines.slice(-1000).join('\n') + '\n');
        }
    } catch { /* the activity log is best effort and must never fail a write */ }
}

// Apply one op to the project in `dir`. Returns { result, files, diff? }.
export async function mutate(dir, op, { dryRun = false, retries = 8, actor = 'cli', today, hooks = {}, lockTimeoutMs, lockStaleMs } = {}) {
    const attempt = async () => {
        const ws = await readWorkspace(dir);
        const hashes = { [BOARD]: sha(ws.board), [ARCHIVE]: sha(ws.archive) };
        const out = applyOp(ws, op, { today });
        if (hooks.afterCompute) await hooks.afterCompute(); // test seam: lets a test interleave a foreign write
        const names = out.files.map((f) => f.name);

        if (dryRun) {
            const diff = out.files.map((f) => unifiedDiff(f.name === BOARD ? ws.board : (ws.archive || ''), f.text, f.name)).join('');
            return { done: { result: out.result, files: names, diff, dryRun: true } };
        }
        if (!out.files.length) return { done: { result: out.result, files: [] } };

        const staged = [];
        try {
            for (const f of out.files) staged.push(await stage(join(dir, f.name), f.text));
            // Last check before the renames: did a writer outside the lock (the page) move anything?
            const now = { [BOARD]: sha(await readOptional(join(dir, BOARD))), [ARCHIVE]: sha(await readOptional(join(dir, ARCHIVE))) };
            if (now[BOARD] !== hashes[BOARD] || now[ARCHIVE] !== hashes[ARCHIVE]) {
                await Promise.all(staged.map((s) => s.abort()));
                return { retry: true };
            }
            for (const s of staged) {
                if (hooks.beforeRename) await hooks.beforeRename(s.path);
                await s.commit();
            }
        } catch (e) {
            await Promise.all(staged.map((s) => s.abort()));
            throw e;
        }
        await logActivity(dir, { ts: new Date().toISOString(), actor, op: op.type, id: out.result.id || null, files: names });
        return { done: { result: out.result, files: names } };
    };

    const run = async () => {
        for (let i = 0; i <= retries; i++) {
            const r = await attempt();
            if (r.done) return r.done;
            await sleep(2 + Math.random() * 10 * (i + 1));
        }
        throw new BoardError('busy', 'The board kept changing underneath this edit; gave up after several retries', { hint: 'Retry the call.' });
    };
    return dryRun ? run() : withLock(dir, run, { timeoutMs: lockTimeoutMs, staleMs: lockStaleMs });
}
