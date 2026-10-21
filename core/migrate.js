// Migration of kanban.md / archive.md to the current format (v3: one metadata field per line).
//
// Accepts v1 (status by section) and v2 (joined metadata lines). The file is rewritten
// canonically, and the result is only returned if re-parsing it gives exactly the same tasks and
// configuration as the original: a migration that would lose or change anything is refused.
import { parseBoard, parseArchive, generateBoard, generateTaskBlock, normalizeConfig } from './board.js';
import { BoardError, deepEqual, firstDifference, detectEol, toEol, splitLines, stripEol } from './text.js';

export const CURRENT_VERSION = 3;

const unsafe = (message, details) => new BoardError('migration_unsafe', message, { details, hint: 'The file was left untouched. Fix the reported problem by hand and run the migration again.' });

// The parser keeps a file's line endings inside notes and preserved sections, so when a mixed
// file is rewritten with one ending, the expected tasks are normalized the same way.
const withEol = (tasks, eol) => tasks.map((t) => ({ ...t, notes: t.notes.replace(/\r?\n/g, eol), extra: t.extra.replace(/\r?\n/g, eol) }));

function assertTotalParse(md, tasks, what) {
    // Every "### TASK-" line must have produced exactly one distinct task, or a rewrite would drop one.
    const blocks = (md.match(/^###\s+TASK-/gm) || []).length;
    const unique = new Set(tasks.map((t) => t.id)).size;
    if (tasks.length !== blocks || unique !== blocks) {
        throw unsafe(`${what}: ${tasks.length} of ${blocks} task blocks could be read (${unique} distinct ids)`, { blocks, parsed: tasks.length, unique });
    }
}

// kanban.md text -> { text, from, changed }
export function migrateBoardText(md) {
    const before = parseBoard(md);
    const from = before.formatVersion;
    if (from >= CURRENT_VERSION) return { text: md, from, changed: false };
    assertTotalParse(md, before.tasks, 'kanban.md');

    const eol = detectEol(md);
    const text = toEol(generateBoard({ config: before.config, tasks: before.tasks }), eol);

    const after = parseBoard(text);
    const diff = firstDifference(
        { config: normalizeConfig(before.config), tasks: withEol(before.tasks, eol) },
        { config: after.config, tasks: after.tasks });
    if (diff || after.formatVersion !== CURRENT_VERSION) throw unsafe('kanban.md would not read back identically after migration', diff || { path: 'formatVersion' });
    return { text, from, changed: true };
}

// archive.md text -> { text, from, changed }. The archive's own heading lines (title, description,
// section, in whatever language) are kept verbatim; only the format marker and the task blocks change.
export function migrateArchiveText(md, columns) {
    const before = parseArchive(md, columns);
    const from = before.formatVersion;
    if (from >= CURRENT_VERSION) return { text: md, from, changed: false };
    assertTotalParse(md, before.tasks, 'archive.md');

    const eol = detectEol(md);
    const lines = splitLines(md);
    let firstTask = lines.findIndex((l) => /^###\s+TASK-/.test(l));
    if (firstTask < 0) firstTask = lines.length;
    const head = lines.slice(0, firstTask).filter((l) => !/<!--\s*Format:/i.test(l));
    if (!head.length) head.push('# Archive' + eol);
    head.splice(1, 0, `<!-- Format: v${CURRENT_VERSION} -->` + eol);
    while (head.length && stripEol(head[head.length - 1]).trim() === '') head.pop();
    const text = toEol(head.join('') + '\n\n' + before.tasks.map(generateTaskBlock).join(''), eol);

    const after = parseArchive(text, columns);
    const diff = firstDifference(withEol(before.tasks, eol), after.tasks);
    if (diff || after.formatVersion !== CURRENT_VERSION || !deepEqual(after.tasks.length, before.tasks.length)) {
        throw unsafe('archive.md would not read back identically after migration', diff || { path: 'formatVersion' });
    }
    return { text, from, changed: true };
}
