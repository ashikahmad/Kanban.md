// Locators and surgical edits on the raw lines of kanban.md / archive.md.
//
// A Doc is the file as an array of lines (each keeping its own terminator) plus its EOL style.
// Every function here edits a Doc in place by splicing whole lines or replacing a substring of one
// line, so every byte it does not name stays exactly as it was (hand formatting, CRLF, unknown
// sections). The locators reuse the same patterns as the parser in board.js, and ops.js verifies
// every result by re-parsing it, so a disagreement between the two aborts the write.
import { splitLines, stripEol, lineEol, detectEol, toEol } from './text.js';
import { generateBoard, generateTaskBlock } from './board.js';
import { formatHousekeepingSpec } from './housekeeping-spec.js';

export class Doc {
    constructor(text) {
        this.lines = splitLines(text);
        this.eol = detectEol(text);
    }
    toString() { return this.lines.join(''); }
}

// Thrown by a patcher that cannot express an edit line-wise on this particular layout; ops.js then
// regenerates just that one task block.
export class Fallback extends Error {}

const HEADER_RE = /^###\s+TASK-(\d+)\s*\|\s*(.+?)\s*$/;
const META_LINE_RE = /^\*\*(Status|Order|Priority|Category|Assigned|Created|Started|Due|Finished|Tags)\*\*/;
const STOP_RE = /^\*\*(Subtasks|Notes|Links|Review|Dependencies)\*\*/;
// One metadata field per line, in this fixed order. [task key, label in the file]
const FIELDS = [['status', 'Status'], ['order', 'Order'], ['priority', 'Priority'], ['category', 'Category'], ['assignees', 'Assigned'],
    ['created', 'Created'], ['started', 'Started'], ['due', 'Due'], ['completed', 'Finished'], ['tags', 'Tags']];
const FIELD_LABELS = FIELDS.map(([, l]) => l).join('|');
const FIELD_LINE = new RegExp(`^(\\s*\\*\\*(${FIELD_LABELS})\\*\\*\\s*:[ \\t]*)(.*)$`);
const taskId = (digits) => 'TASK-' + digits.padStart(3, '0');
const isBlank = (line) => stripEol(line).trim() === '';

// ---- locating ---------------------------------------------------------------------------------

// Line index just after the "## Tasks" heading, or -1.
export function tasksStart(lines) {
    const i = lines.findIndex((l) => /^##\s+Tasks\s*$/.test(stripEol(l)));
    return i < 0 ? -1 : i + 1;
}

// Task blocks at or after line `from`: [{ id, start, end }], end exclusive.
export function findBlocks(lines, from = 0) {
    const heads = [];
    for (let i = Math.max(0, from); i < lines.length; i++) {
        const m = HEADER_RE.exec(stripEol(lines[i]));
        if (m) heads.push({ id: taskId(m[1]), start: i });
    }
    return heads.map((h, k) => ({ ...h, end: k + 1 < heads.length ? heads[k + 1].start : lines.length }));
}

// Blocks of the board's "## Tasks" section, or of a whole archive.
export function blocksOf(doc, kind) {
    return findBlocks(doc.lines, kind === 'board' ? Math.max(0, tasksStart(doc.lines)) : 0);
}

export function locateTask(doc, kind, id) {
    const hits = blocksOf(doc, kind).filter((b) => b.id === id);
    if (hits.length !== 1) return null; // missing, or ambiguous (duplicate id): never guess
    return { ...hits[0], kind };
}

export const blockText = (doc, loc) => doc.lines.slice(loc.start, loc.end).join('');

// Where each field of a block lives. Indices are absolute line numbers; -1 / null = absent.
export function fieldsOf(doc, loc) {
    const { start, end } = loc;
    const L = (i) => stripEol(doc.lines[i]);
    const f = {
        header: start, fields: {},
        desc: null, descInterleaved: false,
        subHeaders: [], subItems: [], notes: -1, extraStart: -1, stop: end, lastContent: start,
    };
    let inSub = false;
    for (let i = start + 1; i < end; i++) {
        const line = L(i);
        if (line.trim()) f.lastContent = i;
        if (f.stop === end && STOP_RE.test(line)) f.stop = i;
        if (f.notes < 0 && /\*\*Notes\*\*:[ \t\r]*$/.test(line) && lineEol(doc.lines[i])) f.notes = i;
        if (f.extraStart < 0 && /^\s*\*\*(Links|Review|Dependencies)\*\*\s*:/i.test(line)) f.extraStart = i;

        // subtasks: same state machine as the parser
        if (/^\s*\*\*Subtasks\*\*/i.test(line)) { inSub = true; f.subHeaders.push(i); continue; }
        if (inSub && /^\s*\*\*[^*\r\n]+\*\*\s*:/.test(line)) inSub = false;
        if (inSub) {
            const m = /- \[(x| )\] (.+)/.exec(line);
            if (m) f.subItems.push({ line: i, box: m.index + 3, completed: m[1] === 'x', text: m[2].trim() });
        }
    }
    // metadata fields: the first line per label before the first section, like the parser. A line
    // that joins several fields with " | " (hand-edited, or older files) registers each of them,
    // all marked joined, so an edit falls back to rewriting the block instead of mangling the line.
    for (let i = start + 1; i < f.stop; i++) {
        const line = L(i);
        const m = FIELD_LINE.exec(line);
        if (!m) continue;
        const parts = line.split(new RegExp(`\\s*\\|\\s*(?=\\*\\*(?:${FIELD_LABELS})\\*\\*\\s*:)`));
        parts.forEach((part, k) => {
            const pm = new RegExp(`^\\s*\\*\\*(${FIELD_LABELS})\\*\\*\\s*:\\s*(.*?)\\s*$`).exec(part);
            if (pm && !f.fields[pm[1]]) f.fields[pm[1]] = { line: i, valueStart: k === 0 ? m[1].length : -1, value: pm[2], joined: parts.length > 1 };
        });
    }
    // description: non-blank, non-metadata lines before the first stop line
    const dl = [];
    let interleaved = false;
    for (let i = start + 1; i < f.stop; i++) {
        const line = L(i);
        if (META_LINE_RE.test(line) || FIELD_LINE.test(line)) { if (dl.length) interleaved = true; continue; }
        if (line.trim()) dl.push(i);
    }
    if (dl.length) f.desc = { first: dl[0], last: dl[dl.length - 1], count: dl.length };
    f.descInterleaved = interleaved;
    return f;
}

// ---- line-level helpers -----------------------------------------------------------------------

const withEol = (doc, text) => text + doc.eol;
function ensureEolAt(doc, i) {
    if (i >= 0 && i < doc.lines.length && !lineEol(doc.lines[i])) doc.lines[i] += doc.eol;
}
function insertLines(doc, at, texts) {
    if (at > 0) ensureEolAt(doc, at - 1);
    doc.lines.splice(at, 0, ...texts.map((t) => withEol(doc, t)));
}
function replaceInLine(doc, i, from, to, text) {
    const eol = lineEol(doc.lines[i]);
    const body = stripEol(doc.lines[i]);
    doc.lines[i] = body.slice(0, from) + text + body.slice(to) + eol;
}
function removeLines(doc, from, to) { doc.lines.splice(from, to - from); }
// Remove lines [from, to) plus one adjacent blank line, so no double blank is left behind.
function removeRegion(doc, from, to) {
    if (from > 0 && isBlank(doc.lines[from - 1])) from--;
    removeLines(doc, from, to);
}

// ---- task field edits (each takes the doc and a located block) --------------------------------

export function setTitle(doc, loc, title) {
    const m = /^(###\s+TASK-\d+\s*\|\s*)(.+?)(\s*)$/.exec(stripEol(doc.lines[loc.start]));
    replaceInLine(doc, loc.start, m[1].length, m[1].length + m[2].length, title);
}

// The text a task value takes on its line, or null when the field should be absent.
export function fieldText(key, value) {
    if (key === 'assignees') return value.length ? value.join(', ') : null;
    if (key === 'tags') return value.length ? value.join(' ') : null;
    if (key === 'order') return value === null || value === undefined ? null : String(value);
    return value ? String(value) : null;
}

// Current text of a metadata line (the value after the label), or null when absent.
export function getField(doc, loc, key) {
    const label = FIELDS.find(([k]) => k === key)[1];
    const e = fieldsOf(doc, loc).fields[label];
    return e ? e.value : null;
}

// Set one metadata field to `value` (a task value; empty/null removes the line). Edits just that
// line, or inserts it in canonical order after the nearest field above it that exists.
export function setField(doc, loc, key, value) {
    const idx = FIELDS.findIndex(([k]) => k === key);
    const label = FIELDS[idx][1];
    const text = fieldText(key, value);
    const f = fieldsOf(doc, loc);
    const e = f.fields[label];
    if (e) {
        if (e.joined) throw new Fallback('metadata fields joined on one line');
        if (text === null) removeLines(doc, e.line, e.line + 1);
        else replaceInLine(doc, e.line, e.valueStart, stripEol(doc.lines[e.line]).length, text);
        return;
    }
    if (text === null) return;
    let at = loc.start + 1;
    for (let i = 0; i < idx; i++) {
        const above = f.fields[FIELDS[i][1]];
        if (above) at = Math.max(at, above.line + 1);
    }
    insertLines(doc, at, [`**${label}**: ${text}`]);
}

// Description: the non-blank lines between the metadata and the first section.
export function setDescription(doc, loc, description) {
    const f = fieldsOf(doc, loc);
    if (f.descInterleaved) throw new Fallback('metadata inside description');
    const newLines = description ? description.split('\n') : [];
    if (f.desc) {
        if (newLines.length) {
            doc.lines.splice(f.desc.first, f.desc.last - f.desc.first + 1, ...newLines.map((l) => withEol(doc, l)));
            ensureEolAt(doc, f.desc.first + newLines.length - 1);
        } else {
            removeRegion(doc, f.desc.first, f.desc.last + 1);
        }
        return;
    }
    if (!newLines.length) return;
    // After the last metadata line, set off by blank lines (the generator's layout).
    let at = loc.start + 1;
    for (let i = loc.start + 1; i < f.stop; i++) if (META_LINE_RE.test(stripEol(doc.lines[i]))) at = i + 1;
    const block = ['', ...newLines];
    const next = doc.lines[at];
    if (next !== undefined && at < loc.end && !isBlank(next)) block.push('');
    insertLines(doc, at, block);
}

// ---- subtasks ---------------------------------------------------------------------------------

const itemText = (s) => `- [${s.completed ? 'x' : ' '}] ${s.text}`;

// Where a brand-new **Subtasks** section goes: before the first extra/notes section, else at the
// end of the block's content.
function newSectionAt(doc, loc, f) {
    const marks = [f.extraStart, f.notes].filter((i) => i >= 0);
    return marks.length ? Math.min(...marks) : f.lastContent + 1;
}

function insertSubtaskSection(doc, loc, f, items) {
    const at = newSectionAt(doc, loc, f);
    const lines = ['', '**Subtasks**:', ...items.map(itemText)];
    if (at > 0 && isBlank(doc.lines[at - 1])) lines.shift(); // already set off by a blank line
    if (at < loc.end && !isBlank(doc.lines[at])) lines.push('');
    insertLines(doc, at, lines);
}

export function toggleSubtaskAt(doc, loc, index, completed) {
    const f = fieldsOf(doc, loc);
    const it = f.subItems[index];
    if (!it) throw new Fallback('no such subtask');
    replaceInLine(doc, it.line, it.box, it.box + 1, completed ? 'x' : ' ');
}

export function setSubtasks(doc, loc, subtasks) {
    const f = fieldsOf(doc, loc);
    const items = f.subItems;
    // Same texts, only completion flags differ: flip single characters.
    if (items.length === subtasks.length && items.every((it, i) => it.text === subtasks[i].text)) {
        subtasks.forEach((s, i) => { if (s.completed !== items[i].completed) toggleSubtaskAt(doc, loc, i, s.completed); });
        return;
    }
    if (f.subHeaders.length > 1) throw new Fallback('several Subtasks sections');
    if (!items.length) {
        if (f.subHeaders.length) throw new Fallback('empty Subtasks section');
        if (subtasks.length) insertSubtaskSection(doc, loc, f, subtasks);
        return;
    }
    const first = items[0].line, last = items[items.length - 1].line;
    for (let i = first; i <= last; i++) {
        if (!items.some((it) => it.line === i) && !isBlank(doc.lines[i])) throw new Fallback('foreign lines among subtasks');
    }
    if (subtasks.length) {
        doc.lines.splice(first, last - first + 1, ...subtasks.map((s) => withEol(doc, itemText(s))));
        ensureEolAt(doc, first + subtasks.length - 1);
    } else {
        removeRegion(doc, f.subHeaders.length ? f.subHeaders[0] : first, last + 1);
    }
}

export function addSubtask(doc, loc, subtask) {
    const f = fieldsOf(doc, loc);
    if (f.subHeaders.length > 1) throw new Fallback('several Subtasks sections');
    if (f.subItems.length) {
        insertLines(doc, f.subItems[f.subItems.length - 1].line + 1, [itemText(subtask)]);
    } else if (f.subHeaders.length) {
        insertLines(doc, f.subHeaders[0] + 1, [itemText(subtask)]);
    } else {
        insertSubtaskSection(doc, loc, f, [subtask]);
    }
}

// ---- notes ------------------------------------------------------------------------------------

export function setNotes(doc, loc, notes) {
    const f = fieldsOf(doc, loc);
    const newLines = notes ? notes.split(/\r?\n/) : [];
    if (f.notes >= 0) {
        if (newLines.length) {
            doc.lines.splice(f.notes + 1, f.lastContent - f.notes, ...newLines.map((l) => withEol(doc, l)));
            ensureEolAt(doc, f.notes + newLines.length);
        } else {
            removeRegion(doc, f.notes, f.lastContent + 1);
        }
        return;
    }
    if (newLines.length) insertLines(doc, f.lastContent + 1, ['', '**Notes**:', ...newLines]);
}

// The line ending that terminates a block's last non-blank line (what a newly appended line follows).
export function lastContentEol(doc, loc) {
    const f = fieldsOf(doc, loc);
    return lineEol(doc.lines[f.lastContent]) || doc.eol;
}

export function appendNote(doc, loc, text) {
    const f = fieldsOf(doc, loc);
    const newLines = text.split(/\r?\n/);
    if (f.notes >= 0 && f.lastContent > f.notes) insertLines(doc, f.lastContent + 1, newLines);
    else setNotes(doc, loc, text);
}

// ---- whole blocks -----------------------------------------------------------------------------

// Regenerate one task block canonically (fallback when a layout cannot be patched line-wise).
export function replaceBlock(doc, loc, task) {
    const lines = splitLines(toEol(generateTaskBlock(task), doc.eol));
    doc.lines.splice(loc.start, loc.end - loc.start, ...lines);
}

// Make a block's text safe to paste at the end of a file: ends with a newline and a blank line.
function normalizeBlockLines(doc, lines) {
    const out = [...lines]; // verbatim: a block keeps the line endings it already has
    if (!out.length) return out;
    if (!lineEol(out[out.length - 1])) out[out.length - 1] += doc.eol;
    if (!isBlank(out[out.length - 1])) out.push(doc.eol);
    return out;
}

// True when every line of the doc ends the same way (so a foreign line ending would stand out).
export function hasUniformEol(doc) {
    const ends = new Set(doc.lines.map(lineEol).filter(Boolean));
    return ends.size <= 1;
}

// Reorder the task blocks of a file: the block now at position i is the one that was at order[i].
// Everything before the first block is untouched, and every block moves verbatim.
export function reorderBlocks(doc, kind, order) {
    const blocks = blocksOf(doc, kind);
    const pieces = blocks.map((b) => doc.lines.slice(b.start, b.end));
    const head = doc.lines.slice(0, blocks[0].start);
    const body = order.flatMap((from, i) => (i === order.length - 1 ? pieces[from] : normalizeBlockLines(doc, pieces[from])));
    doc.lines = [...head, ...body];
}

// Re-terminate every line of a block with `eol` (only when moving between files that differ).
export const convertBlockEol = (lines, eol) => lines.map((l) => toEol(l, eol));

export function cutBlock(doc, loc) {
    const lines = doc.lines.splice(loc.start, loc.end - loc.start);
    return lines;
}

// Insert block lines before line index `at` (use doc.lines.length to append).
export function pasteBlock(doc, at, blockLines) {
    const lines = normalizeBlockLines(doc, blockLines);
    if (at > 0) ensureEolAt(doc, at - 1);
    // keep a blank line between the previous content and the pasted block
    if (at > 0 && !isBlank(doc.lines[at - 1])) lines.unshift(doc.eol);
    doc.lines.splice(at, 0, ...lines);
}

export function appendBlockText(doc, text) {
    pasteBlock(doc, doc.lines.length, splitLines(toEol(text, doc.eol)));
}

// Mark an (empty) archive as v3 so the app does not "migrate" it later.
export function setArchiveMarker(doc, version = 3) {
    const i = doc.lines.findIndex((l) => /<!--\s*Format:/i.test(l));
    if (i >= 0) replaceInLine(doc, i, 0, stripEol(doc.lines[i]).length, `<!-- Format: v${version} -->`);
    else insertLines(doc, Math.min(1, doc.lines.length), [`<!-- Format: v${version} -->`]);
}

// ---- header comment and config ----------------------------------------------------------------

export function setLastTaskId(doc, n) {
    const re = /<!-- Config: Last Task ID: (\d+) -->/;
    const i = doc.lines.findIndex((l) => re.test(l));
    if (i >= 0) {
        const m = re.exec(doc.lines[i]);
        const digits = m[1];
        const at = m.index + m[0].indexOf(digits);
        replaceInLine(doc, i, at, at + digits.length, String(n).padStart(digits.length, '0'));
        return;
    }
    const comment = `<!-- Config: Last Task ID: ${n} -->`;
    if (doc.lines.length > 1 && isBlank(doc.lines[1])) insertLines(doc, 2, [comment]);
    else insertLines(doc, Math.min(1, doc.lines.length), ['', comment]);
}

const CONFIG_LABELS = { columns: 'Columns', categories: 'Categories', users: 'Users', priorities: 'Priorities', tags: 'Tags', housekeeping: 'Housekeeping' };

function configRange(doc) {
    const h = doc.lines.findIndex((l) => stripEol(l).startsWith('## ⚙️ Configuration'));
    if (h < 0) return null;
    let to = doc.lines.length;
    for (let i = h + 1; i < doc.lines.length; i++) {
        if (/^---/.test(doc.lines[i]) || /^##\s/.test(doc.lines[i])) { to = i; break; }
    }
    return { from: h + 1, to };
}

// Set one config list line (**Columns** / **Categories** / ...). `value` is the text after the label.
// `fullConfig` (the new config) is used only to create the whole section when the file has none.
export function setConfigLine(doc, key, value, fullConfig) {
    const label = CONFIG_LABELS[key];
    const range = configRange(doc);
    if (!range) {
        const gen = splitLines(generateBoard({ config: fullConfig, tasks: [] }));
        const a = gen.findIndex((l) => stripEol(l).startsWith('## ⚙️ Configuration'));
        const b = gen.findIndex((l) => /^##\s+Tasks\s*$/.test(stripEol(l)));
        const at = Math.max(0, tasksStart(doc.lines) - 1);
        insertLines(doc, at, gen.slice(a, b).map(stripEol));
        return;
    }
    const re = new RegExp(`\\*\\*${label}\\*\\*:\\s*(.+)`);
    for (let i = range.from; i < range.to; i++) {
        const m = re.exec(stripEol(doc.lines[i]));
        if (m) { replaceInLine(doc, i, m.index, stripEol(doc.lines[i]).length, `**${label}**: ${value}`); return; }
    }
    const blockBefore = range.to > 0 && !isBlank(doc.lines[range.to - 1]);
    insertLines(doc, range.to, [...(blockBefore ? [''] : []), `**${label}**: ${value}`, '']);
}

// Remove one config line (and the blank line after it). No-op when absent.
export function removeConfigLine(doc, key) {
    const range = configRange(doc);
    if (!range) return;
    const re = new RegExp(`\\*\\*${CONFIG_LABELS[key]}\\*\\*:\\s*(.+)`);
    for (let i = range.from; i < range.to; i++) {
        if (re.test(stripEol(doc.lines[i]))) {
            removeLines(doc, i, i + (i + 1 < doc.lines.length && isBlank(doc.lines[i + 1]) ? 2 : 1));
            return;
        }
    }
}

export const configValueText = {
    columns: (v) => v.map((c) => `${c.name} (${c.id})`).join(' | '),
    categories: (v) => v.join(', '),
    users: (v) => v.join(', '),
    priorities: (v) => v.join(' | '),
    tags: (v) => v.map((t) => '#' + t).join(' '),
    housekeeping: (v) => formatHousekeepingSpec(v),
};
