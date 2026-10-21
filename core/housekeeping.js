// Housekeeping: which tasks a board would be better off without, per its policy (see
// housekeeping-spec.js). Suggestions only: nothing here changes a file. Acting on one is an
// ordinary op (archiveTasks), so it is one verified diff and can be previewed with dry_run.
import { parseBoard, parseBacklog } from './board.js';
import { resolveBacklogFile } from './backlog-spec.js';
import { resolveHousekeeping } from './housekeeping-spec.js';
import { dayNumber, localToday } from './dates.js';

const LIST_CAP = 20;

// The board plus, when a backlog file is configured, its tasks: housekeeping is about all live tasks.
function loadLive(ws) {
    const bp = parseBoard(ws.board);
    const bf = resolveBacklogFile(bp.config);
    const store = bf && typeof ws.backlog === 'string' ? parseBacklog(ws.backlog, bp.config.columns, bf.column).tasks : [];
    return { bp, bf, live: [...bp.tasks, ...store] };
}

function candidates(bp, live, policy, today) {
    const now = dayNumber(today);
    const age = (iso) => { const d = dayNumber(iso); return d === null || now === null ? null : now - d; };
    const done = policy.done.column ? bp.tasks.filter((t) => t.status === policy.done.column) : [];
    const doneOld = done.filter((t) => t.completed && age(t.completed) >= policy.done.afterDays)
        .sort((a, b) => a.completed.localeCompare(b.completed));
    const backlog = policy.backlog.column ? live.filter((t) => t.status === policy.backlog.column) : [];
    const backlogStale = backlog.filter((t) => {
        const created = t.created ? age(t.created) : null;
        const overdue = t.due && !t.completed ? age(t.due) : null; // how long past its due date, if it is
        return (created !== null && created >= policy.backlog.afterDays) || (overdue !== null && overdue >= policy.backlog.afterDays);
    }).sort((a, b) => (a.created || '').localeCompare(b.created || ''));
    return { done, doneOld, backlog, backlogStale };
}

// { policy, suggestions: [{ kind, count, ..., ids (capped), message }] }; suggestions is empty when
// nothing is over a threshold (so it costs nothing to include).
export function getHousekeeping(ws, { today = localToday() } = {}) {
    const { bp, bf, live } = loadLive(ws);
    const policy = resolveHousekeeping(bp.config);
    const out = { policy, suggestions: [] };
    if (!policy.enabled) return out;
    const c = candidates(bp, live, policy, today);
    const capped = (tasks) => tasks.slice(0, LIST_CAP).map((t) => t.id);

    if (c.doneOld.length) {
        const undated = c.done.filter((t) => !t.completed).length;
        out.suggestions.push({
            kind: 'archive_done', count: c.doneOld.length, afterDays: policy.done.afterDays, ids: capped(c.doneOld), ...(undated && { undated }),
            message: `${c.doneOld.length} task(s) in "${policy.done.column}" were finished ${policy.done.afterDays}+ days ago: archive them to keep the board small.`,
        });
    }
    if (c.backlogStale.length) {
        out.suggestions.push({
            kind: 'stale_backlog', count: c.backlogStale.length, afterDays: policy.backlog.afterDays, ids: capped(c.backlogStale),
            message: `${c.backlogStale.length} task(s) in "${policy.backlog.column}" are ${policy.backlog.afterDays}+ days old: review, archive or delete them.`,
        });
    }
    // A big backlog is the one thing a separate file fixes: suggest it (once it is on, there is nothing to suggest).
    if (!bf && c.backlog.length > policy.backlogFileAbove) {
        out.suggestions.push({ kind: 'backlog_large', count: c.backlog.length, max: policy.backlogFileAbove, column: policy.backlog.column, message: `${c.backlog.length} tasks in "${policy.backlog.column}" (limit ${policy.backlogFileAbove}): move them to their own backlog file to keep the board small.` });
    }
    if (bp.tasks.length > policy.max) {
        out.suggestions.push({ kind: 'board_large', count: bp.tasks.length, max: policy.max, message: `${bp.tasks.length} tasks on the board (limit ${policy.max}): archive what is finished.` });
    }
    return out;
}

// Every id the stale-backlog nudge flags (the page highlights those cards).
export function staleBacklogIds(ws, { today = localToday() } = {}) {
    const { bp, live } = loadLive(ws);
    const policy = resolveHousekeeping(bp.config);
    if (!policy.enabled) return [];
    return candidates(bp, live, policy, today).backlogStale.map((t) => t.id);
}

// Every id the "archive done" nudge would archive (the suggestion's own list is capped for display).
export function archiveCandidates(ws, { today = localToday() } = {}) {
    const { bp, live } = loadLive(ws);
    const policy = resolveHousekeeping(bp.config);
    if (!policy.enabled) return [];
    return candidates(bp, live, policy, today).doneOld.map((t) => t.id);
}
