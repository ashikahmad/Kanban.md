// Task links: **Blocked by** is the only stored relation. "Blocks" is derived from it, so the two can never
// disagree. Advice only: nothing here stops a move or a save.

// A task is finished when it sits in the board's last column or has been archived (an archived task counts as
// done whatever its status line says: archiving is how a finished task leaves the board).
// `where` says which file a task lives in: 'board' | 'backlog' | 'archive'.
export function indexTasks({ board = [], backlog = [], archive = [] }) {
    const byId = new Map();
    for (const [where, tasks] of [['archive', archive], ['backlog', backlog], ['board', board]]) {
        for (const task of tasks) byId.set(task.id, { task, where });
    }
    return byId;
}

export function isFinished(entry, columns) {
    if (!entry) return false;
    if (entry.where === 'archive') return true;
    return columns.length > 0 && entry.task.status === columns[columns.length - 1].id;
}

// What a task waits on: { open: [entry], done: [entry], unknown: [id] }. `open` is what the badge counts; a
// blocker in the backlog file is open, an id that matches no task is unknown and counts for nothing.
export function blockersOf(task, byId, columns) {
    const out = { open: [], done: [], unknown: [] };
    for (const id of task.blockedBy || []) {
        const entry = byId.get(id);
        if (!entry) out.unknown.push(id);
        else (isFinished(entry, columns) ? out.done : out.open).push(entry);
    }
    return out;
}

// The tasks whose **Blocked by** names `id`, board and backlog first (they are the ones still in play).
export function blockedByThis(id, byId) {
    return [...byId.values()].filter(({ task }) => (task.blockedBy || []).includes(id));
}

// Does following **Blocked by** links from `id` come back to it? (A warning in the UI, never an error.)
export function hasCycle(id, byId) {
    const seen = new Set();
    const walk = (cur) => {
        for (const next of (byId.get(cur)?.task.blockedBy) || []) {
            if (next === id) return true;
            if (seen.has(next)) continue;
            seen.add(next);
            if (walk(next)) return true;
        }
        return false;
    };
    return walk(id);
}
