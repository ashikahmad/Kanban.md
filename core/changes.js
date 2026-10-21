// Turn "the page's state differs from the last saved state" into a list of ops, and apply a list of
// ops to a pair of file texts. This is what lets the page keep mutating its in-memory arrays (and
// its ~16 save call sites) while the file is only ever changed by minimal, verified patches that are
// applied to the file's CURRENT content, so edits made elsewhere in the meantime survive.
//
// State shape (the page's own): { config, tasks, archive }  (see parseBoard / parseArchive).
// Not expressible as ops (reported in `unsupported`, caller falls back): changes to preserved
// sections (`extra`), the board title, or a task that appears directly in the archive.
import { applyOp } from './ops.js';
import { deepEqual } from './text.js';

const TASK_KEYS = ['title', 'status', 'order', 'priority', 'category', 'assignees', 'tags', 'created', 'started', 'due', 'completed', 'description', 'subtasks', 'notes'];
const LISTS = ['categories', 'users', 'priorities', 'tags'];
const byId = (tasks) => new Map(tasks.map((t) => [t.id, t]));

export function diffToOps(base, next) {
    const ops = [], unsupported = [];
    const bB = byId(base.tasks), bA = byId(base.archive), nB = byId(next.tasks), nA = byId(next.archive);
    const baseColumnIds = base.config.columns.map((c) => c.id);
    const nextColumnIds = next.config.columns.map((c) => c.id);

    // 1. deleted
    for (const id of [...bB.keys(), ...bA.keys()]) if (!nB.has(id) && !nA.has(id)) ops.push({ type: 'deleteTask', id });

    // 2. archived / restored
    for (const id of bB.keys()) if (nA.has(id)) ops.push({ type: 'archiveTask', id });
    for (const id of bA.keys()) if (nB.has(id)) ops.push({ type: 'restoreTask', id });

    // 3. columns. Tasks whose column id was renamed or removed are re-homed by `reassign`, so the
    //    per-task status updates for them are skipped below.
    const reassign = {};
    const colChanged = !deepEqual(base.config.columns, next.config.columns);
    const rehomed = new Set();
    if (colChanged) {
        for (const old of baseColumnIds.filter((id) => !nextColumnIds.includes(id))) {
            // Where did the tasks of this removed column end up? Renamed column: they followed it. Deleted
            // column: the page leaves a board task with the old id, which on disk means "first column"
            // (how an unknown status reads back); an archived task is left alone.
            const dest = new Map(); // destination -> task ids
            const note = (id, to) => dest.set(to, [...(dest.get(to) || []), id]);
            for (const [id, bt] of bB) {
                if (bt.status !== old) continue;
                const nt = nB.get(id) || nA.get(id);
                if (!nt) continue;
                if (nA.has(id) && !nextColumnIds.includes(nt.status)) continue; // archived with an orphan status: left alone, like the rest of the archive
                note(id, nextColumnIds.includes(nt.status) ? nt.status : nextColumnIds[0]);
            }
            for (const [id, bt] of bA) {
                if (bt.status !== old) continue;
                const nt = nA.get(id) || nB.get(id);
                if (nt && nextColumnIds.includes(nt.status)) note(id, nt.status);
            }
            if (!dest.size) continue;
            // The most common destination becomes the column-wide reassign; any task that went elsewhere
            // is moved by its own updateTask afterwards.
            const [to, ids] = [...dest.entries()].sort((a, b) => b[1].length - a[1].length)[0];
            reassign[old] = to;
            for (const id of ids) rehomed.add(id);
        }
        ops.push({ type: 'setColumns', columns: next.config.columns.map((c) => ({ name: c.name, id: c.id })), ...(Object.keys(reassign).length && { reassign }) });
    }

    // 4. field changes on tasks present in both
    const updatesFor = (bt, nt) => {
        const set = {};
        for (const k of TASK_KEYS) {
            if (k === 'status' && rehomed.has(nt.id)) continue;
            if (!deepEqual(bt[k], nt[k])) set[k] = k === 'order' && nt[k] === null ? '' : nt[k];
        }
        if (!deepEqual(bt.extra, nt.extra)) unsupported.push(`${nt.id}: preserved sections (Links/Review/Dependencies) cannot be edited`);
        return set;
    };
    for (const [id, nt] of [...nB, ...nA]) {
        const bt = bB.get(id) || bA.get(id);
        if (!bt) continue;
        let before = bt;
        if (bA.has(id) && nB.has(id)) { // restored: the restore op itself applies the page's fallback status
            const fallback = next.config.columns.some((c) => c.id === bt.status) ? bt.status : next.config.columns[0].id;
            before = { ...bt, status: fallback };
        }
        const set = updatesFor(before, nt);
        if (Object.keys(set).length) ops.push({ type: 'updateTask', id, set });
    }

    // 5. created (appended last, as the page appends)
    for (const [id, nt] of nB) {
        if (bB.has(id) || bA.has(id)) continue;
        const task = {};
        for (const k of TASK_KEYS) {
            const v = nt[k];
            if (k === 'order' ? v !== null : !(v === '' || (Array.isArray(v) && !v.length))) task[k] = v;
        }
        ops.push({ type: 'createTask', task, clientId: id });
    }
    for (const id of nA.keys()) if (!bA.has(id) && !bB.has(id)) unsupported.push(`${id}: a task appeared directly in the archive`);

    // 6. config lists
    for (const name of LISTS) {
        if (!deepEqual(base.config[name], next.config[name])) ops.push({ type: 'setConfigList', name, values: next.config[name] });
    }
    if (base.config.boardTitle !== next.config.boardTitle) unsupported.push('the board title changed');

    return { ops, unsupported };
}

// Apply ops in order to { board, archive } texts. Returns the final texts, the files to write (in a
// safe order) and each op's result. Stops at the first failing op (its BoardError carries `opIndex`).
export function applyOps(ws, ops, options = {}) {
    let cur = { board: ws.board, archive: ws.archive ?? null };
    const results = [];
    const touched = new Set();
    for (let i = 0; i < ops.length; i++) {
        const { clientId, ...op } = ops[i];
        let out;
        try { out = applyOp(cur, op, options); }
        catch (e) { e.opIndex = i; throw e; }
        for (const f of out.files) touched.add(f.name);
        cur = { board: out.board, archive: out.archive };
        results.push({ ...out.result, ...(clientId && { clientId }) });
    }
    // An archive move writes the archive first (a crash then duplicates a task rather than losing
    // it); a batch that only restores writes the board first. Anything else: board first.
    const types = new Set(ops.map((o) => o.type));
    const archiveFirst = types.has('archiveTask');
    const names = ['kanban.md', 'archive.md'].filter((n) => touched.has(n));
    if (archiveFirst) names.sort((a, b) => (a === 'archive.md' ? -1 : 1) - (b === 'archive.md' ? -1 : 1));
    return {
        board: cur.board,
        archive: cur.archive,
        results,
        files: names.map((name) => ({ name, text: name === 'kanban.md' ? cur.board : cur.archive })),
    };
}
