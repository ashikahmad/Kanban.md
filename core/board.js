// Slugify a column name/heading to an id (lowercase, drop emoji/punctuation, dash spaces).
// MUST stay identical to the id derivation used when a column has no explicit (id), so that
// slug(heading) === column.id holds. NOTE: \w (no /u flag) strips accents — "Terminé" → "termin"
// — which is consistent with how the id was derived, but means an explicit id like "termine"
// won't match a "## Terminé" heading by slug (name match still works). Known, guarded limit.
export function legacySlug(s) {
    return s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

// Parse a kanban.md into { config, tasks, formatV2 }. Pure: no globals, no I/O.
export function parseBoard(content) {
    const tasks = [];
    const config = {
        lastTaskId: 0,
        columns: [],
        categories: [],
        users: [],
        priorities: [],
        tags: [],
        boardTitle: 'Kanban Board'
    };

    // Preserve the board's H1 title so a custom title survives a save/migration instead of
    // being reset to the default. Only the FIRST line is considered (the title is always
    // line 1 in both V1 and generated V2 files); this avoids ever mistaking a "# heading"
    // inside a task description for the board title. A non-matching first line keeps the
    // default — never injects wrong content. "##"/"###" can't match (single "#" + space).
    const firstLine = content.split('\n', 1)[0].replace(/\r$/, ''); // tolerate CRLF files
    const titleMatch = firstLine.match(/^#[ \t]+(.+?)[ \t]*$/);
    if (titleMatch) config.boardTitle = titleMatch[1].trim();

    // Parse config comment
    const configMatch = content.match(/<!-- Config: Last Task ID: (\d+) -->/);
    if (configMatch) {
        config.lastTaskId = parseInt(configMatch[1]);
    }

    // Parse config section. Stop at the first of: a `---` separator (V2/legacy with
    // separator), the next `## ` heading (legacy file whose config isn't followed by
    // `---`), or end-of-file. Requiring `---` would make a legacy file without it fall
    // back to DEFAULT columns/categories/users/tags, silently losing the user's config.
    const configSection = content.match(/## ⚙️ Configuration\s+([\s\S]*?)(?:\n---|\n##\s|$)/);
    if (configSection) {
        const configText = configSection[1];

        // Parse columns - FIXED REGEX
        const columnsMatch = configText.match(/\*\*Columns\*\*:\s*(.+)/);
        if (columnsMatch) {
            const usedColIds = new Set();
            config.columns = columnsMatch[1].split('|').map((col, idx) => {
                col = col.trim();
                if (!col) return null;
                const match = col.match(/^(.+?)\s*\((.+?)\)\s*$/);
                let name, baseId;
                if (match) {
                    name = match[1].trim();
                    baseId = match[2].trim();
                } else {
                    // No explicit (id): derive a slug from the name so legacy files
                    // without ids still parse (e.g. "📝 To Do" → "to-do") instead of being dropped.
                    name = col;
                    baseId = legacySlug(col) || ('col' + (idx + 1));
                }
                // Ensure ids are unique (handles slug or explicit-id collisions deterministically).
                let id = baseId, n = 2;
                while (usedColIds.has(id)) id = `${baseId}-${n++}`;
                usedColIds.add(id);
                return { name, id };
            }).filter(Boolean);
        }

        // Parse categories
        const categoriesMatch = configText.match(/\*\*Categories\*\*:\s*(.+)/);
        if (categoriesMatch) {
            config.categories = categoriesMatch[1].split(',').map(c => c.trim()).filter(Boolean);
        }

        // Parse users
        const usersMatch = configText.match(/\*\*Users\*\*:\s*(.+)/);
        if (usersMatch) {
            config.users = usersMatch[1].split(',').map(u => u.trim()).filter(Boolean);
        }

        // Parse priorities
        const prioritiesMatch = configText.match(/\*\*Priorities\*\*:\s*(.+)/);
        if (prioritiesMatch) {
            config.priorities = prioritiesMatch[1].split('|').map(p => p.trim()).filter(Boolean);
        }

        // Parse tags
        const tagsMatch = configText.match(/\*\*Tags\*\*:\s*(.+)/);
        if (tagsMatch) {
            // Same pattern as task tags, so separators like "#bug, #feature" don't leave a comma on the name
            config.tags = (tagsMatch[1].match(/#[\w-]+/g) || []).map(t => t.slice(1));
        }
    }

    // Default columns if not found
    if (config.columns.length === 0) {
        config.columns = [
            { name: '📝 To Do', id: 'todo' },
            { name: '🚀 In Progress', id: 'in-progress' },
            { name: '👀 In Review', id: 'in-review' },
            { name: '✅ Done', id: 'done' }
        ];
    }

    // Default categories if not found
    if (config.categories.length === 0) {
        config.categories = ['Frontend', 'Backend', 'Design', 'DevOps', 'Tests', 'Documentation'];
    }

    // Default users if not found
    if (config.users.length === 0) {
        config.users = ['@user (User)'];
    }

    // Default priorities if not found
    if (config.priorities.length === 0) {
        config.priorities = ['🔴 Critical', '🟠 High', '🟡 Medium', '🟢 Low'];
    }

    // Default tags if not found
    if (config.tags.length === 0) {
        config.tags = ['bug', 'feature', 'ui', 'backend', 'urgent', 'refactor', 'docs', 'test'];
    }

    // Parse tasks. V2: a single "## Tasks" section where each task carries its own
    // **Status** field. Legacy: one "## <Column>" section per status (status inferred
    // from the section). The **Status** field wins; the section is the fallback → old
    // kanban.md files keep working unchanged.
    // Detect V2 by an explicit format marker, OR by a "## Tasks" heading with no legacy
    // column section present (so a legacy column literally named "Tasks" is never
    // mis-detected and silently dropped).
    const reEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hasMarker = /<!--\s*Format:\s*v2\s*-->/i.test(content);
    const hasTasksHeading = /(^|\n)##\s+Tasks\s*(\n|$)/.test(content);
    // A legacy column section is detected by its exact name OR by the slug of any "## "
    // heading matching a column id. The slug arm lets an old/hand-edited file whose heading
    // lost its emoji ("## Backlog" for a "📝 Backlog (backlog)" column) still be classified
    // legacy instead of mis-read as V2. It is gated on !hasTasksHeading: a V2-shaped file
    // (single "## Tasks") must NOT be dragged to the legacy path just because a column id
    // happens to equal slug("Tasks")/slug("Configuration") — that would ignore the **Status**
    // fields and corrupt statuses. The exact-name arm still handles a legacy column named
    // literally "Tasks". Real V2 files carry the marker and win via hasMarker regardless.
    const sectionTitles = [...content.matchAll(/(?:^|\n)##\s+([^\r\n]+?)\s*(?:\n|$)/g)].map(m => m[1].trim());
    const hasColumnSections = config.columns.some(c =>
        new RegExp(`(^|\\n)##\\s+${reEscape(c.name)}\\s*(\\n|$)`).test(content) ||
        (!hasTasksHeading && sectionTitles.some(t => legacySlug(t) === c.id)));
    const hasUnified = hasMarker || (hasTasksHeading && !hasColumnSections);

    if (hasUnified) {
        // The "## Tasks" section runs to the end of the file, so a "## " or "### "
        // heading inside a task's notes/description never truncates the board.
        const body = content.replace(/^[\s\S]*?(?:^|\n)##\s+Tasks\s*(?:\n|$)/, '');
        tasks.push(...parseTaskBlocks(body, config.columns[0].id, true, config.columns));
    } else {
        // Legacy: status comes from the section only — never honour a stray
        // **Status** line that might sit inside an old task's notes.
        config.columns.forEach(column => {
            tasks.push(...parseTasksFromSection(content, column.name, column.id, false, config.columns));
        });
    }

    return { config, tasks, formatV2: hasUnified };
}

// Extract the "## <sectionName>" section, then parse its task blocks.
// Used by the legacy column path and by the archive (each column / "Archives"
// is its own section). The V2 unified path calls parseTaskBlocks() directly.
function parseTasksFromSection(content, sectionName, statusId, honorStatusField = false, columns = []) {
    const sections = content.split(/\n##\s+/);
    // Pass 1 — exact/legacy NAME match. Byte-for-byte the previous behaviour (same
    // substring strip), so a section heading equal to the column name parses exactly as
    // before. A name match always wins over a slug match (pass 2 only runs if none here).
    for (let section of sections) {
        if (section.startsWith(sectionName)) {
            return parseTaskBlocks(section.substring(sectionName.length).trim(), statusId, honorStatusField, columns);
        }
    }
    // Pass 2 — id-centred SLUG fallback: a heading whose slug equals the column id
    // (emoji/case/spacing-insensitive). Strip the whole title line here (the slug is
    // computed on the full title, so the title must not leak into the body).
    for (let section of sections) {
        const nl = section.search(/\r?\n/);
        const title = (nl >= 0 ? section.slice(0, nl) : section).trim();
        if (legacySlug(title) === statusId) {
            return parseTaskBlocks(nl >= 0 ? section.slice(nl).trim() : '', statusId, honorStatusField, columns);
        }
    }
    return [];
}

// Parse "### TASK-NNN | Title" blocks from a chunk of markdown. The split is anchored
// to line starts so a "### TASK-" appearing mid-line in notes is not split on.
export function parseTaskBlocks(sectionContent, statusId, honorStatusField = false, columns = []) {
    const tasksFound = [];
    // Only a real, line-anchored "### TASK-<digits> | <title>" header starts a block.
    // A malformed "### TASK-foo" or a header-like line inside notes is NOT a boundary,
    // so it neither drops the following content nor truncates the surrounding task.
    const headerRe = /^###\s+TASK-(\d+)\s*\|\s*(.+?)\s*$/gm;
    const headers = [...sectionContent.matchAll(headerRe)];
    headers.forEach((h, i) => {
        const titlePart = h[2].trim();
        if (!titlePart) return;
        const start = h.index + h[0].length;
        const end = i + 1 < headers.length ? headers[i + 1].index : sectionContent.length;
        const taskContent = sectionContent.slice(start, end);
        const taskId = 'TASK-' + h[1].padStart(3, '0');
        const task = parseTask(taskId, titlePart, taskContent, statusId, honorStatusField, columns);
        if (task) tasksFound.push(task);
    });
    return tasksFound;
}

// Parse individual task. `columns` is the board's column list, used to validate **Status**.
function parseTask(id, title, content, fallbackStatus, honorStatusField = false, columns = []) {
    // V2: the **Status** field is authoritative when present and a valid column id;
    // otherwise fall back to the section-derived status (legacy files / archive).
    let status = fallbackStatus;
    if (honorStatusField) {
        const statusMatch = content.match(/^\s*\*\*Status\*\*:\s*([^\r\n]+)/im);
        if (statusMatch) {
            const s = statusMatch[1].trim();
            if (columns.some(c => c.id === s)) status = s;
        }
    }
    const task = {
        id,
        title: title.trim(),
        status,
        priority: '',
        category: '',
        assignees: [],
        tags: [],
        created: '',
        started: '',
        due: '',
        completed: '',
        description: '',
        subtasks: [],
        notes: '',
        extra: '' // verbatim passthrough for unsupported sections (see below)
    };

    // Parse metadata line
    const metaMatch = content.match(/\*\*Priority\*\*:\s*(\w+)\s*\|\s*\*\*Category\*\*:\s*([^|]+?)(?:\s*\|\s*\*\*Assigned\*\*:\s*(.+?))?$/m);
    if (metaMatch) {
        task.priority = metaMatch[1].trim();
        task.category = metaMatch[2].trim();
        if (metaMatch[3]) {
            task.assignees = metaMatch[3].split(',').map(a => a.trim());
        }
    }

    // Parse dates - support all date fields
    const createdMatch = content.match(/\*\*Created\*\*:\s*([\d-]+)/);
    if (createdMatch) task.created = createdMatch[1];

    const startedMatch = content.match(/\*\*Started\*\*:\s*([\d-]+)/);
    if (startedMatch) task.started = startedMatch[1];

    const dueMatch = content.match(/\*\*Due\*\*:\s*([\d-]+)/);
    if (dueMatch) task.due = dueMatch[1];

    const completedMatch = content.match(/\*\*Finished\*\*:\s*([\d-]+)/);
    if (completedMatch) task.completed = completedMatch[1];

    // Parse tags
    const tagsMatch = content.match(/\*\*Tags\*\*:\s*(.+)/);
    if (tagsMatch) {
        task.tags = tagsMatch[1].match(/#[\w-]+/g) || [];
    }

    // Parse description (text after dates/tags but before "**Sous-tâches**" or "**Notes**")
    const lines = content.split('\n');
    let descriptionLines = [];
    let inDescription = false;

    for (let line of lines) {
        // Skip metadata lines
        if (line.match(/^\*\*(Status|Priority|Category|Assigned|Created|Started|Due|Finished|Tags)\*\*/)) {
            continue;
        }
        // Stop at subsections
        if (line.match(/^\*\*(Subtasks|Notes|Links|Review|Dependencies)\*\*/)) {
            break;
        }
        // Collect description lines
        if (line.trim() && !inDescription) {
            inDescription = true;
        }
        if (inDescription && line.trim()) {
            descriptionLines.push(line.trim());
        }
    }
    task.description = descriptionLines.join('\n'); // full text — the card clamps the display via CSS

    // Parse subtasks — ONLY inside the **Subtasks** section (until the next "**Field**:" or
    // end), not globally. A global scan would also collect "- [ ]" lines that live inside a
    // preserved **Links**/**Review**/**Dependencies** section (or in notes); the generator
    // would then re-emit them BOTH as subtasks and inside task.extra, duplicating them on
    // every parse→generate→parse cycle (subtasks growing 2→4→6…). Scoping keeps it 1:1.
    let inSubtasksSection = false;
    for (let line of lines) {
        if (/^\s*\*\*Subtasks\*\*/i.test(line)) { inSubtasksSection = true; continue; }
        if (inSubtasksSection && /^\s*\*\*[^*\r\n]+\*\*\s*:/.test(line)) inSubtasksSection = false;
        if (inSubtasksSection) {
            const m = line.match(/- \[(x| )\] (.+)/);
            if (m) task.subtasks.push({ completed: m[1] === 'x', text: m[2].trim() });
        }
    }

    // Parse notes - everything after **Notes**: until end of task
    const notesMatch = content.match(/\*\*Notes\*\*:\s*\n([\s\S]*?)$/);
    if (notesMatch) {
        task.notes = notesMatch[1].trim();
    }

    // Preserve unsupported sections verbatim. SCOPE: exactly **Links**/**Review**/**Dependencies**
    // — the three headers the description loop STOPS at but never stores, so they alone vanish
    // on save/migration. Other "**Field**:" content is already kept elsewhere: before a
    // stop-word it stays in the description; after **Notes** it stays in the greedy notes tail.
    // (A non-standard "**Foo**:" placed between **Subtasks** and **Notes** is the one acknowledged
    // gap — rare, and a fully generic capture would clash with bold-prefixed description lines.)
    // Capture each section from its header to the next recognised section or end; the generator
    // re-emits task.extra between subtasks and notes. Description/notes parsing are untouched.
    const extraStart = /^\s*\*\*(Links|Review|Dependencies)\*\*\s*:/i;
    const extraStop = /^\s*\*\*(Status|Priority|Category|Assigned|Created|Started|Due|Finished|Tags|Subtasks)\*\*/i;
    const extraLines = [];
    let capturingExtra = false;
    for (let line of lines) {
        // Stop the whole scan at **Notes**: notes is captured greedily to end-of-block, so
        // anything after it is already preserved there — scanning past it would double-capture.
        if (/^\s*\*\*Notes\*\*/i.test(line)) break;
        if (extraStart.test(line)) { capturingExtra = true; extraLines.push(line); continue; }
        if (capturingExtra && extraStop.test(line)) { capturingExtra = false; }
        if (capturingExtra) extraLines.push(line);
    }
    task.extra = extraLines.join('\n').trim();

    return task;
}

// Parse an archive.md into { tasks, formatV2 }. The archive is a flat list of task blocks
// whatever its section heading says (any language). **Status** is honoured when it names one of
// `columns` (the board's columns), so an archived task keeps the column it came from; otherwise
// the status is 'archived'.
export function parseArchive(content, columns = []) {
    return {
        tasks: parseTaskBlocks(content, 'archived', true, columns),
        formatV2: /<!--\s*Format:\s*v2\s*-->/i.test(content)
    };
}

const DEFAULT_CATEGORIES = ['Frontend', 'Backend', 'Design', 'DevOps', 'Tests', 'Documentation'];
const DEFAULT_USERS = ['@user (User)'];
const DEFAULT_PRIORITIES = ['🔴 Critical', '🟠 High', '🟡 Medium', '🟢 Low'];
const DEFAULT_TAGS = ['bug', 'feature', 'ui', 'backend', 'urgent', 'refactor', 'docs', 'test'];

// The config lists (Categories / Users / Tags) keep ONLY the user-configured values, de-duplicated.
// Values that appear only on tasks are NOT folded back in — doing so made these lines grow without
// bound on every save (every tag/category/user ever used stuck forever). Autocomplete still
// surfaces task-derived values at runtime. Empty lists fall back to the defaults. Returns a copy.
export function normalizeConfig(config) {
    const out = { ...config };
    out.categories = [...new Set(config.categories || [])];
    out.users = [...new Set(config.users || [])];
    out.tags = [...new Set(config.tags || [])];
    if (out.categories.length === 0) out.categories = [...DEFAULT_CATEGORIES];
    if (out.users.length === 0) out.users = [...DEFAULT_USERS];
    if (!out.priorities || out.priorities.length === 0) out.priorities = [...DEFAULT_PRIORITIES];
    if (out.tags.length === 0) out.tags = [...DEFAULT_TAGS];
    return out;
}

// One task as a v2 block (kanban.md and archive.md share this format). Ends with a blank line.
export function generateTaskBlock(task) {
    let md = `### ${task.id} | ${task.title}\n`;
    md += `**Status**: ${task.status}\n`;

    let meta = '';
    if (task.priority) meta += `**Priority**: ${task.priority}`;
    if (task.category) meta += ` | **Category**: ${task.category}`;
    if (task.assignees.length > 0) meta += ` | **Assigned**: ${task.assignees.join(', ')}`;
    if (meta) md += meta + '\n';

    let dates = '';
    if (task.created) dates += `**Created**: ${task.created}`;
    if (task.started) dates += (dates ? ' | ' : '') + `**Started**: ${task.started}`;
    if (task.due) dates += (dates ? ' | ' : '') + `**Due**: ${task.due}`;
    if (task.completed) dates += (dates ? ' | ' : '') + `**Finished**: ${task.completed}`;
    if (dates) md += dates + '\n';

    if (task.tags.length > 0) {
        md += `**Tags**: ${task.tags.join(' ')}\n`;
    }

    if (task.description) {
        md += `\n${task.description}\n`;
    }

    if (task.subtasks.length > 0) {
        md += `\n**Subtasks**:\n`;
        task.subtasks.forEach(st => {
            md += `- [${st.completed ? 'x' : ' '}] ${st.text}\n`;
        });
    }

    // Re-emit preserved unsupported sections verbatim (before Notes, so a re-parse captures them
    // again as task.extra rather than folding them into notes).
    if (task.extra) {
        md += `\n${task.extra}\n`;
    }

    if (task.notes) {
        md += `\n**Notes**:\n${task.notes}\n`;
    }

    return md + `\n`; // one blank line between tasks, no ---
}

// Whole-board serializer: { config, tasks } -> kanban.md text.
// The Format marker makes V2 detection unambiguous (vs a legacy column named "Tasks").
// V2 is a single "## Tasks" section; each task carries its own **Status** (= its column) and its
// order in the file is its rank within its column, so moving a task between columns is a
// one-line **Status** edit.
export function generateBoard({ config, tasks }) {
    const cfg = normalizeConfig(config);
    const boardTitle = (cfg.boardTitle && cfg.boardTitle.trim()) || 'Kanban Board';
    let md = `# ${boardTitle}\n\n<!-- Config: Last Task ID: ${cfg.lastTaskId} -->\n<!-- Format: v2 -->\n\n`;

    md += `## ⚙️ Configuration\n\n`;
    md += `**Columns**: ${cfg.columns.map(c => `${c.name} (${c.id})`).join(' | ')}\n\n`;
    md += `**Categories**: ${cfg.categories.join(', ')}\n\n`;
    md += `**Users**: ${cfg.users.join(', ')}\n\n`;
    md += `**Priorities**: ${cfg.priorities.join(' | ')}\n\n`;
    md += `**Tags**: ${cfg.tags.map(t => '#' + t).join(' ')}\n\n`;
    md += `---\n\n`;

    md += `## Tasks\n\n`;
    tasks.forEach(task => { md += generateTaskBlock(task); });
    return md;
}

// archive.md text. `strings` carries the localized heading lines: { title, desc, section }.
export function generateArchive(tasks, strings) {
    let md = `${strings.title}\n<!-- Format: v2 -->\n\n${strings.desc}\n\n${strings.section}\n\n`;
    tasks.forEach(task => { md += generateTaskBlock(task); });
    return md;
}

// Content for a brand-new kanban.md / archive.md.
export function createDefaultBoardContent() {
    return `# Kanban Board

<!-- Config: Last Task ID: 0 -->
<!-- Format: v2 -->

## ⚙️ Configuration

**Columns**: 📝 To Do (todo) | 🚀 In Progress (in-progress) | 👀 In Review (in-review) | ✅ Done (done)

**Categories**: Frontend, Backend, Design, DevOps, Tests, Documentation

**Users**: @user (User)

**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

**Tags**: #bug #feature #ui #backend #urgent #refactor #docs #test

---

## Tasks
`;
}

export function createDefaultArchiveContent(strings) {
    return `${strings.title}

${strings.desc}

${strings.section}

`;
}
