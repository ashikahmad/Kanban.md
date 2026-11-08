# File format

A board is a pair of plain Markdown files (plus an optional third). You can read and edit them in any editor, and they display sensibly in any Markdown viewer: each metadata field sits on its own line and ends in two spaces, which Markdown renders as a line break.

```
your-project/
├── kanban.md       # active tasks and the board configuration (required)
├── archive.md      # archived tasks (created on the first archive)
└── backlog.md      # optional, for a very large backlog
```

The current format is **v3**, marked with `<!-- Format: v3 -->`. The sections below are the field-by-field reference; [`examples/`](examples) holds complete sample boards.

Under the format marker, a board usually carries one more comment that says what the file is and where its rules and tools live:

```markdown
<!-- Kanban.md board. Format, rules and tools (app, CLI, MCP): https://github.com/ashikahmad/Kanban.md -->
```

It is there for an agent or a person who comes across a board in a repository with nothing else to go on. Nothing reads it, so it is safe to delete. The app, the CLI and the MCP server write it when they create a file (`kanban.md`, `archive.md` or a backlog file) or migrate one to v3. Afterwards they keep it if it is there and never put it back once it is gone. Keep it on its own line: older versions read the format only from a line that is exactly `<!-- Format: vN -->`.

## `kanban.md`

```markdown
# Kanban Board

<!-- Config: Last Task ID: 42 -->
<!-- Format: v3 -->
<!-- Kanban.md board. Format, rules and tools (app, CLI, MCP): https://github.com/ashikahmad/Kanban.md -->

## ⚙️ Configuration

**Columns**: 📝 To Do (todo) | 🚀 In Progress (in-progress) | ✅ Done (done)

**Categories**: Frontend, Backend, Design

**Users**: @alice (Alice Martin), @bob (Bob Smith)

**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

**Tags**: #bug #feature #docs #refactor

---

## Tasks

### TASK-001 | My first task
**Status**: todo  
**Priority**: High  
**Category**: Frontend  
**Assigned**: @alice  
**Created**: 2025-01-20  
**Due**: 2025-02-01  
**Tags**: #feature #ui  

Task description...

**Subtasks**:
- [ ] First subtask
- [x] Completed subtask
- [ ] Last subtask

### TASK-002 | Other task
**Status**: in-progress
...
```

- `Last Task ID` is the counter used to generate the next ID. The app and tools keep it up to date.
- Each task has its own **`**Status**`** line holding a column id. That is what places it in a column, so moving a card is a one-line edit.
- Every metadata field has its own line and is optional. A task can have a priority and no category. Empty fields are left out.
- An optional `**Order**: 3000` line holds the manual card order (see [Using the board](using-the-board.md#optional-features)).
- An optional `**Blocked by**: TASK-007, TASK-012` line (written after `Tags`, read anywhere in the metadata) lists the tasks this one waits on. Only this direction is stored; "blocks" is worked out from it. The ids can name a task in `kanban.md`, the backlog file or the archive. A line whose value is not just task ids (say `**Blocked by**: waiting on legal`) is left alone as ordinary description text. It is advice only: nothing stops a blocked task from moving. Versions of the app, the CLI and the MCP server from before this field existed read the line as part of the description, keep it as long as the description is not edited away, and show it as plain text.
- Optional configuration lines: `**Housekeeping**: …` and `**Backlog file**: backlog.md (backlog)`.

## `archive.md`

```markdown
# Task Archive

<!-- Format: v3 -->
<!-- Kanban.md board. Format, rules and tools (app, CLI, MCP): https://github.com/ashikahmad/Kanban.md -->

> Archived tasks

## ✅ Archives

### TASK-042 | Implement notification system
**Status**: done  
**Priority**: High  
**Category**: Backend  
**Assigned**: @alice  
**Created**: 2025-01-15  
**Started**: 2025-01-18  
**Finished**: 2025-01-22  
**Tags**: #feature #notifications  

Real-time notification system with WebSockets.

**Subtasks**:
- [x] Setup WebSocket server
- [x] Create REST API

**Notes**:

**Result**:
Functional notification system with WebSocket, REST API and emails.

**Tests performed**:
- 100 simultaneous connections OK
```

An archived task keeps its `**Status**`, so it can be restored to the right column. The notes section is free-form: many teams record the result, the files touched and the decisions made.

## Older files migrate automatically

Files in the earlier formats (v1: one `## Section` per column; v2: priority, category and assignee joined on one line) open fine. The first time you open one in the app it is migrated to v3 and a backup is kept (`kanban.v1-backup.md` or `kanban.v2-backup.md`). A migration is refused unless the result reads back identically. To migrate from the command line:

```bash
kanbanmd migrate --dry-run     # preview
kanbanmd migrate
```

Files without the two trailing spaces on field lines still work; the spaces are added as lines are rewritten.

## Configuration

Everything is configured in the `## ⚙️ Configuration` block of `kanban.md`. You can edit it by hand or in the app (burger menu → **Columns**, and the task form).

### Columns

```markdown
**Columns**: 📝 Backlog (backlog) | 🔍 Analysis (analysis) | 🚀 Dev (dev) | 👀 Review (review) | ✅ Done (done)
```

The format is `Emoji Name (id) | …`. Some starting points:

- Simple: `To Do | In Progress | Done`
- Scrum: `Backlog | Sprint | In Progress | Review | Done`
- Extended: `Icebox | Backlog | Analysis | Dev | QA | Deploy | Done`

### Categories, users and tags

```markdown
**Categories**: Frontend, Backend, Database, DevOps, Design
**Users**: @alice (Alice Martin), @bob (Bob Smith)
**Tags**: #bug, #feature, #refactor, #docs, #urgent, #blocked
```

Users use the form `@username (Full Name)`. Pick categories and tags to fit your work: by area (`UI, API, DevOps`), by type (`#bug, #feature, #docs`), by state (`#blocked, #waiting`).

### Priorities

Each priority has an emoji, and the emoji decides the colour of the priority dot:

```markdown
**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
```

Supported emoji:

- **Circles:** 🔴 🟠 🟡 🟢 🔵 🟣 ⚪ ⚫
- **Squares:** 🟥 🟧 🟨 🟩 🟦 🟪
- **Hearts:** ❤️ 🧡 💛 💚 💙 💜 🤍 🖤
- **Diamonds:** 🔶 🔷 🔸 🔹
- **Stars:** ⭐ 🌟
- **Flags:** 🚩 🏴 🏳️
- **Alerts:** ⚠️ 🔥 💥 ⚡
- **Arrows:** ⬆️ ➡️ ⬇️
- **Symbols:** ❗ ❓ ❕ ❔

Other systems you could use:

```markdown
**Priorities**: 🔥 Urgent | ⚡ Important | ⭐ Normal | ⬇️ Low
**Priorities**: 🚩 Blocker | ⚠️ Must Have | 💡 Nice to Have | 💤 Someday
```

### Housekeeping and the backlog file

```markdown
**Housekeeping**: done=done after=30d | backlog=backlog after=90d | max=200
**Backlog file**: backlog.md (backlog)
```

`Housekeeping: off` silences the nudges. See [Using the board](using-the-board.md#optional-features).
