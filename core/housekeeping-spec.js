// The optional "**Housekeeping**:" config line and the policy it resolves to. Pure, no imports.
//
//   **Housekeeping**: done=done after=30d | backlog=backlog after=90d | max=200
//   **Housekeeping**: off
//
// Absent line = the defaults below (nudges are ON by default; they only ever suggest, never act).
// Only what is written in the line is stored in config.housekeeping; resolveHousekeeping fills in
// the rest, and guesses the done / backlog columns from their names when none is configured.
export const HOUSEKEEPING_DEFAULTS = { doneAfterDays: 30, backlogAfterDays: 90, max: 200, backlogFileAbove: 100 };

const DONE_NAME = /^(done|completed?|closed|finished|released|shipped)$/i;
const BACKLOG_NAME = /backlog/i;
const plain = (s) => s.replace(/[^\w\s-]/g, '').trim();

// "done=done after=30d | backlog=backlog after=90d | max=200" | "off"  ->  { enabled, done?, backlog?, max? } | null
export function parseHousekeepingSpec(text) {
    if (text === undefined || text === null) return null;
    const out = { enabled: true };
    for (const seg of String(text).split('|').map((s) => s.trim()).filter(Boolean)) {
        if (/^off$/i.test(seg)) return { enabled: false };
        // a segment is "<name>[=<value>] [after=<N>d]": done=done after=30d, backlog after=90d, max=200
        const [head, ...rest] = seg.split(/\s+/);
        const [name, value] = head.split('=');
        const kv = Object.fromEntries(rest.map((tok) => tok.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.toLowerCase(), v]));
        const days = kv.after !== undefined && /^\d+d?$/i.test(kv.after) ? parseInt(kv.after, 10) : undefined;
        const key = name.toLowerCase();
        if (key === 'done' || key === 'backlog') out[key] = { ...(value && { column: value }), ...(days !== undefined && { afterDays: days }) };
        else if (key === 'max' && /^\d+$/.test(value || '')) out.max = parseInt(value, 10);
    }
    return out;
}

export function formatHousekeepingSpec(h) {
    if (!h) return '';
    if (h.enabled === false) return 'off';
    const parts = [];
    const side = (name, v) => { if (v) parts.push([`${name}=${v.column || ''}`.replace(/=$/, ''), v.afterDays !== undefined ? `after=${v.afterDays}d` : ''].filter(Boolean).join(' ')); };
    side('done', h.done);
    side('backlog', h.backlog);
    if (h.max !== undefined) parts.push(`max=${h.max}`);
    return parts.join(' | ') || 'on';
}

// Canonical stored form of a user-supplied object (what parse(format(x)) gives back).
export function normalizeHousekeeping(h) {
    return parseHousekeepingSpec(formatHousekeepingSpec(h)) || null;
}

// The full policy for a board: explicit values, else defaults; done / backlog columns guessed by name.
export function resolveHousekeeping(config) {
    const h = config.housekeeping || { enabled: true };
    const cols = config.columns || [];
    const find = (re) => (cols.find((c) => re.test(c.id) || re.test(plain(c.name))) || {}).id || null;
    const known = (id) => (id && cols.some((c) => c.id === id) ? id : null);
    return {
        enabled: h.enabled !== false,
        done: { column: known(h.done && h.done.column) || (h.done && h.done.column ? null : find(DONE_NAME)), afterDays: (h.done && h.done.afterDays) ?? HOUSEKEEPING_DEFAULTS.doneAfterDays },
        backlog: { column: known(h.backlog && h.backlog.column) || (h.backlog && h.backlog.column ? null : find(BACKLOG_NAME)), afterDays: (h.backlog && h.backlog.afterDays) ?? HOUSEKEEPING_DEFAULTS.backlogAfterDays },
        max: h.max ?? HOUSEKEEPING_DEFAULTS.max,
        backlogFileAbove: HOUSEKEEPING_DEFAULTS.backlogFileAbove,
    };
}
