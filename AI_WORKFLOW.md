# 🤖 Guidelines for AI Assistants

This file contains general guidelines for all AI assistants (Claude, ChatGPT, Copilot, Gemini, etc.) using this Markdown task management system.

A human uses the board in the browser (the `kanbanmd.html` app; a project may keep its copy under another name) **at the same time** as you. Your edits appear on their screen within a couple of seconds, and theirs reach you through the same files. Work in small, targeted edits so neither of you overwrites the other.

---

## 🧰 1. Use the tools if you have them

If your session has the **Kanban MCP server** (tools such as `get_board`, `save_task`, `move_task`), or you can run the **`kanbanmd` CLI**, use them instead of reading and editing the Markdown yourself. They are cheaper, they validate every change, and they never overwrite someone else's edit.

| I want to… | MCP tool | CLI |
|---|---|---|
| see what is in a column / assigned to someone / overdue | `get_board` (filters: `status`, `assignee`, `tag`, `priority`, `text`, `overdue`, `dueBefore`) | `kanbanmd board --status review --assignee @bob` |
| read one task in full | `get_task` | `kanbanmd task TASK-014` |
| know valid columns, priorities, users, tags | `get_config` | `kanbanmd config` |
| get counts, overdue, housekeeping suggestions | `get_board_stats` | `kanbanmd stats` |
| create or change a task | `save_task` (no `id` = create) | `kanbanmd create …` / `update <id> --field value` |
| change a task's column | `move_task` | `kanbanmd move TASK-014 done` |
| tick or add a subtask | `subtask` | `kanbanmd toggle TASK-014 0` / `subtask TASK-014 "text"` |
| add to the notes | `add_note` | `kanbanmd note TASK-014 "text"` |
| archive / restore / delete | `archive_tasks`, `restore_task`, `delete_task` | `kanbanmd archive TASK-014` … |
| list the archive or the backlog file | `get_board` with `archived: true` / `backlog: true` | `kanbanmd archived` / `kanbanmd backlog` |
| change columns, lists, policies | `update_config` | `kanbanmd config …`, `columns`, `housekeeping --set` |

**Rules when you use the tools**

1. **Read narrowly.** Filter with `get_board`, fetch detail with `get_task`. Do not open `kanban.md` to look around: a big board is tens of thousands of tokens and the tools answer in a few hundred.
2. **Never edit the files by hand while the tools are available.** Every write is one validated, atomic edit that merges with the human's concurrent changes.
3. **Pass the task's `etag` as `ifMatch`** when you change something you read earlier. A `conflict` error means someone changed it meanwhile: read it again and redo your change.
4. **Preview with `dryRun`** (CLI: `--dry-run`) when a change is large or you are unsure; it returns the diff and writes nothing.
5. **Errors tell you what to do.** They carry a code and, where it helps, the valid choices (`unknown_status` lists the column ids). Fix the argument and retry.
6. **`needs_migration`** means the project is still in an older file format. Do not rewrite it yourself: tell the user to open the board in the browser (it migrates, keeping a backup) or run `kanbanmd migrate`.
7. **Housekeeping.** If `get_board_stats` returns `housekeeping` suggestions (finished tasks piling up, an old or large backlog), **tell the user**. Do not archive anything without being asked.
8. **Order and the backlog file are the user's choice.** Moving a task is a one-line edit by default. `sort_tasks` rewrites a file-wide order and always needs an explicit `mode`: never call it unprompted. If the board has a backlog file, a task whose status is the backlog column lives there; a status change moves it in or out, you do not manage the file.

If you have **no** tools, follow section 2.

---

## 📋 2. The task format (when you edit the files yourself)

Format **v3**: one field per line, each line ending in **two spaces** (a Markdown hard break, so any viewer shows the fields on separate lines; the parser accepts lines without them). (Older boards used `**Priority**: … | **Category**: …` on one line; they still read correctly and are migrated automatically, but write the layout below.)

```markdown
### TASK-XXX | Task title
**Status**: <column-id>
**Priority**: High
**Category**: Backend
**Assigned**: @user1, @user2
**Created**: YYYY-MM-DD
**Started**: YYYY-MM-DD
**Due**: YYYY-MM-DD
**Finished**: YYYY-MM-DD
**Tags**: #tag1 #tag2

Free text description. **NO `##` or `###` headings allowed**.

**Subtasks**:
- [ ] First subtask
- [x] Completed subtask

**Notes**:
Additional notes with subsections `**Title**:`.

**Result**:
What was done.

**Modified files**:
- file.js (lines 42-58)
```

**Fields.** Required: `### TASK-XXX |`, `**Status**:` (the column id: this is what places the task in a column). Everything else is optional and independent: a task may have a priority and no category. Empty fields are simply left out. Optional `**Order**: 3000` (a number) sets a manual card order; leave it alone unless you are asked to reorder.

**Order of the lines:** Status, Order, Priority, Category, Assigned, Created, Started, Due, Finished, Tags, description, Subtasks, Notes.

**❌ Forbidden:** `## Title` or `### Title` inside a task, and `**Subtasks**` / `**Notes**` without the colon. All tasks share one `## Tasks` section, so a stray heading breaks parsing.

**Valid values:** `Status` must be a column id from the Configuration; `Priority` one of the configured priorities without its emoji (`🔴 Critical` is written `Critical`); dates are `YYYY-MM-DD`.

### Cheap reads without tools

```bash
grep -nE "^### TASK-|^\*\*Status\*\*:" kanban.md        # overview: id + status
sed -n '/^### TASK-042 /,/^### TASK-/p' kanban.md        # one task
grep -n "^\*\*Status\*\*: in-progress" kanban.md          # a column
```

### Cheap writes without tools

- **Move a task** by editing its single `**Status**:` line. Never cut and paste the block.
- **New task:** append the block at the end of the file and bump `<!-- Config: Last Task ID: N -->`.
- **Finish a task:** change `**Status**`, add `**Finished**: YYYY-MM-DD`, document the result in `**Notes**:`.

---

## 🔄 3. Workflow

### 1. New request
1. Create the task (tool: `save_task`; or append a block) with `Status` = the first column id.
2. Break it into subtasks if needed.

### 2. Start work
1. Move it to the in-progress column and set `Started`.
2. Tick subtasks as you go (`subtask`), add notes (`add_note`).

### 3. Finish work
1. Move it to the done column and set `Finished`.
2. Document in `**Notes**:` the `**Result**:`, `**Modified files**:`, `**Technical decisions**:` and `**Tests performed**:`.

### 4. Archiving

**⚠️ Tasks are NOT archived immediately.** Finished tasks stay in the done column. Archive only when the user asks (or agrees to a housekeeping suggestion).

---

## 📝 Examples

### Simple task

```markdown
### TASK-001 | Fix login bug
**Status**: todo
**Priority**: Critical
**Category**: Backend
**Assigned**: @bob
**Created**: 2025-01-20
**Due**: 2025-01-21
**Tags**: #bug #urgent

Users cannot log in. Error 500 in logs.

**Notes**:
Check Redis, related to yesterday's deployment.
```

### Complete task

```markdown
### TASK-042 | Notification system
**Status**: done
**Priority**: High
**Category**: Backend
**Assigned**: @alice
**Created**: 2025-01-15
**Started**: 2025-01-18
**Finished**: 2025-01-22
**Tags**: #feature

Real-time notifications with WebSockets.

**Subtasks**:
- [x] Setup WebSocket server
- [x] REST API
- [x] Email sending

**Notes**:

**Result**:
✅ Functional system with WebSocket, REST API and emails.

**Modified files**:
- src/websocket/server.js (lines 1-150)

**Technical decisions**:
- Socket.io for WebSockets

**Tests performed**:
- ✅ 100 simultaneous connections
```

---

## 🎯 Golden Rules

### ✅ ALWAYS
1. Create the task BEFORE coding
2. Use the tools when you have them; otherwise the strict format (no `##` in tasks)
3. Break it down if complex
4. Real-time progress
5. Document the result in `**Notes**:`
6. Reference tasks in commits (`TASK-XXX`)
7. Leave finished tasks in "Done" (archive only on user request)

### ❌ NEVER
1. `## Title` in a task
2. Code without creating a task
3. Forget to check off subtasks
4. Archive immediately, or act on a housekeeping suggestion unasked
5. Rewrite a whole file when a one-line edit will do

---

## 📦 File Structure

```
your-project/
├── kanban.md        # active tasks (required)
├── archive.md       # archived tasks (created on first archive)
└── backlog.md       # only if the board has a backlog file (optional)
```

### kanban.md

```markdown
# Kanban Board

<!-- Config: Last Task ID: 42 -->
<!-- Format: v3 -->

## ⚙️ Configuration

**Columns**: 📝 To Do (todo) | 🚀 In Progress (in-progress) | 👀 Review (in-review) | ✅ Done (done)

**Categories**: Frontend, Backend, DevOps

**Users**: @alice, @bob

**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

**Tags**: #bug, #feature, #docs

**Housekeeping**: done=done after=30d | backlog=backlog after=90d | max=200      (optional)

**Backlog file**: backlog.md (backlog)                                            (optional)

---

## Tasks

### TASK-001 | Title
**Status**: todo
[...]
```

> **Columns** carry an `(id)`: it is what each task's `**Status**:` points to. All tasks live in the one `## Tasks` section and a task's column is its `**Status**:`.
>
> **Housekeeping** (optional; on by default with these numbers): the app and the tools nudge the user to archive tasks finished 30+ days ago, review a backlog older than 90 days, and watch a board over 200 tasks. `off` silences it.
>
> **Backlog file** (optional): tasks whose status is the named column live in `backlog.md` instead of `kanban.md`, and the board shows that column as a stub with a panel. A task moves between the two files when its status changes.

### archive.md

```markdown
# Task Archive

<!-- Format: v3 -->

> Archived tasks

## ✅ Archives

### TASK-001 | Archived task
**Status**: done
[... full content ...]
```

An archived task keeps its `**Status**` so it can be restored to the right column.

---

## 🔧 User Commands

```bash
# Planning
"Plan [feature]"
"Create roadmap for 3 months"

# Execution
"Do TASK-XXX"
"Continue TASK-XXX"

# Tracking
"Where are we?"
"Weekly status"

# Modifications
"Break down TASK-XXX"
"Add subtask to TASK-XXX"

# Search
"Search in archives: [keyword]"

# Maintenance
"Archive completed tasks"
```

---

## 📘 Git Integration

```bash
# Commits with reference
git commit -m "feat: Add feature (TASK-042 - 3/5)"
git commit -m "fix: Bug fix (TASK-001)"

# Branches
git checkout -b feature/TASK-042-notifications
```

Add `.kanban.lock/`, `.kanban-activity.jsonl` and `.*.tmp` to `.gitignore`: they are working files of the tools.

---

## 📁 AI-Specific Configuration

Each AI has its own configuration file:

| AI Assistant | Configuration File | Location |
|--------------|-------------------|----------|
| **Claude** | `CLAUDE.md` | Project root |
| **GitHub Copilot** | `copilot-instructions.md` | `.github/` |
| **OpenAI CLI** | `OPENAI_CLI.md` | Project root |
| **ChatGPT** | `CHATGPT.md` or Custom GPT | Root or Web |
| **Gemini** | `GEMINI.md` or `instructions.md` | Root or `.gemini/` |
| **Qwen** | `QWEN.md` or `.qwenrc` | Project root |
| **Codeium / Windsurf** | `instructions.md` | `.windsurf/` or `.codeium/` |

**These files must:**
1. Reference this file `AI_WORKFLOW.md`
2. Be adapted to each AI's specifics
3. Remain minimalist (only a few lines)

### Minimal Template for AI Configuration File

```markdown
# 🤖 Instructions for [AI NAME]

## 📋 Task Management System

**Every action = One documented task in the Kanban board**

## 📚 Complete Documentation

**⚠️ READ IMMEDIATELY**: `AI_WORKFLOW.md`

It says how to use the Kanban tools (MCP / `kanbanmd` CLI) and, without them, the file format.

## ⚙️ Critical Rules

1. Use the Kanban tools when you have them; never hand-edit `kanban.md` then.
2. Without tools: one field per line, **no `##` or `###` headings inside a task**.
3. Archive only when the user asks.

---

**Read `AI_WORKFLOW.md` now.**
```

---

## 🎓 First Use

On your first interaction with the AI:

```
"Read AI_WORKFLOW.md and use the task system"
```

The AI will read this file, learn the tools and the workflow, and be ready to manage tasks.

**Create a task:** `"Plan adding a real-time notification system"`
**Work on a task:** `"Do TASK-007"`
**Status update:** `"Where are we?"`
**Archive:** `"Archive completed tasks"`

---

**This guide ensures complete transparency and traceability of AI work.**
