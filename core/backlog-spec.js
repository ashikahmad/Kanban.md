// The optional "**Backlog file**:" config line. Pure, no imports besides the housekeeping spec.
//
//   **Backlog file**: backlog.md (backlog)
//
// The file name, and in brackets the id of the column whose tasks live in that file (like the
// "name (id)" convention of the Columns line). Without brackets the column is guessed from the
// column names, as the housekeeping policy does. No line = no backlog file.
//
// The invariant: with a backlog file configured, a task lives in that file exactly when its status is
// that column. Every op re-establishes it, so promoting or demoting a task is just changing its status.
import { resolveHousekeeping } from './housekeeping-spec.js';

export const BACKLOG_DEFAULT_FILE = 'backlog.md';
const RESERVED = new Set(['kanban.md', 'archive.md']);

export const isValidStoreFileName = (name) => /^[\w.-]+\.md$/.test(name) && !name.includes('..') && !RESERVED.has(name.toLowerCase());

// "backlog.md (backlog)" | "backlog.md" | "off" -> { file, column? } | null
export function parseBacklogFileSpec(text) {
    if (text === undefined || text === null) return null;
    const s = String(text).trim();
    if (!s || /^off$/i.test(s)) return null;
    const m = /^(\S+?)\s*(?:\(([^)]+)\))?\s*$/.exec(s);
    if (!m || !isValidStoreFileName(m[1])) return null;
    return { file: m[1], ...(m[2] && { column: m[2].trim() }) };
}

export function formatBacklogFileSpec(b) {
    if (!b) return 'off';
    return b.column ? `${b.file} (${b.column})` : b.file;
}

// The usable setting: the file and an existing column (explicit or guessed), or null when there is none.
export function resolveBacklogFile(config) {
    const b = config.backlogFile;
    if (!b) return null;
    const cols = config.columns || [];
    const column = (b.column && cols.some((c) => c.id === b.column) ? b.column : null) || (b.column ? null : resolveHousekeeping({ ...config, housekeeping: null }).backlog.column);
    return column ? { file: b.file, column } : null;
}
