// Text helpers shared by the patch layer: lines, hashing, deep equality, line diffs.
// Pure: no I/O, no DOM.

// Structured, fixable errors. `code` is stable and meant for programs; `message` and `hint` for
// the human or agent reading it.
export class BoardError extends Error {
    constructor(code, message, extra = {}) {
        super(message);
        this.name = 'BoardError';
        this.code = code;
        Object.assign(this, extra); // hint, valid, details, ...
    }
    toJSON() {
        const { code, message, hint, valid, details } = this;
        return { code, message, ...(hint && { hint }), ...(valid && { valid }), ...(details && { details }) };
    }
}

// Split into lines, each keeping its own terminator ("\n" or "\r\n"); the last may have none.
export function splitLines(text) {
    return text.match(/[^\n]*\n|[^\n]+$/g) || [];
}

export const stripEol = (line) => line.replace(/\r?\n$/, '');
export const lineEol = (line) => (/\r?\n$/.exec(line) || [''])[0];

// The file's line ending, taken from its first newline.
export function detectEol(text) {
    const i = text.indexOf('\n');
    return i > 0 && text[i - 1] === '\r' ? '\r\n' : '\n';
}

export const toEol = (text, eol) => text.replace(/\r?\n/g, eol);

// 53-bit string hash (cyrb53). Not cryptographic: used for change detection (etags), not security.
export function hash53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export const etagOf = (text) => hash53(text).toString(36);

export function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

// First path at which two JSON-like values differ, for error messages.
export function firstDifference(a, b, path = '') {
    if (deepEqual(a, b)) return null;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) {
        return { path, expected: a, actual: b };
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const d = firstDifference(a[k], b[k], `${path}/${k}`);
        if (d) return d;
    }
    return null;
}

// Line diff as hunks [{ at, del: [lines], add: [lines] }] where `at` is the index in `a`.
// Common prefix/suffix are trimmed first, then an LCS runs on the middle (capped, so a huge
// rewrite degrades to a single hunk instead of an O(n*m) blow-up).
export function diffLines(aText, bText) {
    const a = splitLines(aText), b = splitLines(bText);
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0;
    while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    const am = a.slice(p, a.length - s), bm = b.slice(p, b.length - s);
    if (!am.length && !bm.length) return [];
    if (am.length * bm.length > 4_000_000) return [{ at: p, del: am, add: bm }];

    const n = am.length, m = bm.length;
    const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            L[i][j] = am[i] === bm[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
        }
    }
    const hunks = [];
    let i = 0, j = 0, cur = null;
    const flush = () => { if (cur) { hunks.push(cur); cur = null; } };
    while (i < n || j < m) {
        if (i < n && j < m && am[i] === bm[j]) { flush(); i++; j++; continue; }
        if (!cur) cur = { at: p + i, del: [], add: [] };
        if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) cur.add.push(bm[j++]);
        else cur.del.push(am[i++]);
    }
    flush();
    return hunks;
}

// Summary used by tests and dry runs.
export function diffStats(aText, bText) {
    const hunks = diffLines(aText, bText);
    return {
        hunks: hunks.length,
        removed: hunks.reduce((n, h) => n + h.del.length, 0),
        added: hunks.reduce((n, h) => n + h.add.length, 0),
        firstLine: hunks.length ? hunks[0].at : null,
        lastLine: hunks.length ? Math.max(...hunks.map((h) => h.at + h.del.length)) : null,
    };
}

export function unifiedDiff(aText, bText, name = 'file', context = 3) {
    const a = splitLines(aText);
    const hunks = diffLines(aText, bText);
    if (!hunks.length) return '';
    const out = [`--- a/${name}`, `+++ b/${name}`];
    // Merge hunks whose context windows touch.
    const groups = [];
    for (const h of hunks) {
        const last = groups[groups.length - 1];
        if (last && h.at - (last.at + last.span) <= context * 2) { last.hunks.push(h); last.span = h.at + h.del.length - last.at; }
        else groups.push({ at: h.at, span: h.del.length, hunks: [h] });
    }
    let delta = 0;
    for (const g of groups) {
        const start = Math.max(0, g.at - context);
        const end = Math.min(a.length, g.at + g.span + context);
        const body = [];
        let pos = start, added = 0, removed = 0;
        for (const h of g.hunks) {
            for (; pos < h.at; pos++) body.push(' ' + stripEol(a[pos]));
            for (const l of h.del) { body.push('-' + stripEol(l)); removed++; pos++; }
            for (const l of h.add) { body.push('+' + stripEol(l)); added++; }
        }
        for (; pos < end; pos++) body.push(' ' + stripEol(a[pos]));
        const aLen = end - start, bLen = aLen - removed + added;
        out.push(`@@ -${start + 1},${aLen} +${start + 1 + delta},${bLen} @@`, ...body);
        delta += added - removed;
    }
    return out.join('\n') + '\n';
}
