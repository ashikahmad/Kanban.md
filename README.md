# 📋 Kanban.md

> **[🇫🇷 Version française / French version](./readmeFR.md)** (not yet updated for the redesign)

**Kanban task manager based on local Markdown files**

A complete task management system that transforms your Markdown files into an interactive Kanban board, without database or server. Perfect for developers, distributed teams and integration with AI assistants.

![Application Overview](docs/images/app-overview.jpg)
*The Kanban.md board with the demo data from `docs/demo` (light theme)*

> **About this fork.** Kanban.md is a fork of [ioniks/MarkdownTaskManager](https://github.com/ioniks/MarkdownTaskManager) (MPL-2.0, see `LICENSE`). The file format, the AI workflow and the single-file build are unchanged and fully compatible. This fork redesigns the interface:
>
> - **One compact top bar**: burger menu (left), search and filters, the **+ Task** button, and a theme menu (right)
> - **Inline multi-select filters** that show their state in place and collapse into one **Filters** button on narrow screens
> - **One scroller**: scroll anywhere and every column moves together, with sticky column titles
> - **Compact cards**: priority dot, quiet tags, a slim progress bar, and the edit button only on hover
> - **Layered light and dark themes** (page, columns, cards, popovers) with an Auto / Light / Dark switch
> - A token-based stylesheet (spacing, radius, type and colour variables) instead of scattered inline styles

---

## 🎯 What is it?

Markdown Task Manager is a **standalone web application** contained in a single HTML file (`kanbanmd.html`). It uses the browser's File System Access API to read and write directly to your local Markdown files.

### How it works

```
┌─────────────────────┐
│  kanbanmd.html  │  ← Single HTML file
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │   Browser    │  ← Chrome, Edge, Opera
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │  Your files  │  ← kanban.md + archive.md
    │   Markdown   │     (on your disk)
    └──────────────┘
```

**Advantages:**
- ✅ **Single file**: Easy to copy, share and maintain
- ✅ **100% local**: Your data stays on your machine
- ✅ **Git compatible**: Versionable, syncable, diffable
- ✅ **Plain text readable**: Editable with any editor
- ✅ **No server**: Works entirely in the browser
- ✅ **Multi-project**: Manage multiple projects with history
- ✅ **Dark mode & responsive**: Light/dark theme, mobile-ready with touch drag & drop
- ✅ **Multilingual**: English, French, German and Simplified Chinese
- ✅ **Humans and AI at the same time**: an optional CLI and MCP server edit the same files safely while you use the browser, and changes show up live
- ✅ **Cheap for AI**: an agent reads a few hundred tokens instead of the whole board

---

## ⚡ Quick Start

### Prerequisites

- **Compatible browser**: Chrome 86+, Edge 86+ or Opera 72+
- File System Access API is not available on Firefox or Safari

### Installation in 3 steps

1. **Download** `kanbanmd.html` from this repository
2. **Open it** in your browser (double-click)
3. **Select** a folder to store your tasks

That's all! 🎉

**Want to look around first?** Choose the `docs/demo` folder of this repository: it holds a small sample board ("Orbit Product Board") with dummy tasks and a few archived ones.

### First use

On first launch:
1. The application requests access to a folder
2. If the folder is empty, it automatically creates:
   - `kanban.md` - Your active tasks
   - `archive.md` - Your archived tasks
3. You can give a name to the project
4. The project is remembered for next sessions

---

## 📦 Project Installation

### Option 1: Root installation (recommended)

Simply copy 2 files to your project root:

```bash
my-project/
├── kanban.md          # ← Create this file (see template below)
├── archive.md         # ← Create this file (see template below)
├── src/
├── package.json
└── README.md
```

**Minimal kanban.md template:**
```markdown
# Kanban Board

<!-- Config: Last Task ID: 0 -->
<!-- Format: v3 -->

## ⚙️ Configuration

**Columns**: 📝 To Do (todo) | 🚀 In Progress (in-progress) | ✅ Done (done)

**Categories**: Frontend, Backend, Design

**Users**: @alice, @bob

**Tags**: #bug #feature #docs

---

## Tasks
```

**Minimal archive.md template:**
```markdown
# Task Archive

<!-- Format: v3 -->

> Archived tasks

## ✅ Archives
```

(Or simply open an empty folder: the app creates both files for you.)

Then:
1. Open `kanbanmd.html` in your browser
2. Select the `my-project/` folder
3. Start creating tasks!

### Option 2: Subdirectory installation

If you prefer to isolate task files:

```bash
my-project/
├── .tasks/            # ← or docs/tasks/, .kanban/, etc.
│   ├── kanban.md
│   └── archive.md
├── src/
└── package.json
```

Then, select the `.tasks/` folder when opening the application.

### Option 3: Add to .gitignore (optional)

If you don't want to version your tasks:

```bash
# .gitignore
kanban.md
archive.md
# or
.tasks/
```

**Note:** It is generally recommended to **version** task files to keep history and sync with the team.

---

## 🗂️ HTML File Management

You have 2 options to manage `kanbanmd.html`:

### Option A: One copy per project

```bash
project-1/
├── kanbanmd.html  # ← Local copy
├── kanban.md
└── archive.md

project-2/
├── kanbanmd.html  # ← Local copy
├── kanban.md
└── archive.md
```

**Advantages:**
- ✅ Complete autonomy for each project
- ✅ Works even if central file is modified
- ✅ Can be versioned with the project

**Disadvantages:**
- ❌ HTML file duplication
- ❌ Manual update in each project

### Option B: Single centralized file (recommended)

```bash
~/tools/
└── kanbanmd.html  # ← Single copy

~/projects/
├── project-1/
│   ├── kanban.md
│   └── archive.md
├── project-2/
│   ├── kanban.md
│   └── archive.md
└── project-3/
    ├── kanban.md
    └── archive.md
```

**Advantages:**
- ✅ Single file to maintain
- ✅ Automatic updates for all projects
- ✅ Disk space savings

**Disadvantages:**
- ❌ Dependency on external file

**How to use it:**
1. Keep `kanbanmd.html` in an accessible folder (e.g., `~/tools/`)
2. Create a shortcut/bookmark in your browser
3. Open it and select the desired project folder
4. The application remembers the last 10 projects

**Tip:** Create an alias to open it quickly:

```bash
# ~/.bashrc or ~/.zshrc
alias tasks='open ~/tools/kanbanmd.html'  # macOS
alias tasks='xdg-open ~/tools/kanbanmd.html'  # Linux
alias tasks='start ~/tools/kanbanmd.html'  # Windows
```

---

## 🤖 AI Assistants Integration

This system is designed to work with AI assistants to achieve **complete traceability** of work done.

### Principle

AI assistants (Claude, ChatGPT, Copilot, Gemini, etc.) can:
1. ✅ Create tasks with strict format in `kanban.md`
2. ✅ Break down complex tasks into subtasks
3. ✅ Update progress in real time
4. ✅ Document complete result in `**Notes**:`
5. ✅ Reference tasks in Git commits (`TASK-XXX`)
6. ✅ Archive on demand only (not automatically)

They can do it by editing the Markdown, or, better, through the **CLI / MCP server** (see *CLI and MCP server* below): cheaper in tokens, validated, and safe while you are using the board.

### Configuration

Each AI has its own configuration file that should reference `AI_WORKFLOW.md`:

| AI Assistant | Configuration File | Location |
|--------------|-------------------|----------|
| **Claude** (Anthropic) | `CLAUDE.md` | Project root |
| **GitHub Copilot** (Microsoft) | `copilot-instructions.md` | `.github/` |
| **OpenAI CLI** (GPT-4, GPT-3.5) | `OPENAI_CLI.md` | Project root |
| **ChatGPT** (OpenAI Web/Desktop) | `CHATGPT.md` or Custom GPT | Root or Web |
| **Gemini** (Google) | `GEMINI.md` or `instructions.md` | Root or `.gemini/` |
| **Qwen** (Alibaba) | `QWEN.md` or `.qwenrc` | Project root |
| **Codeium / Windsurf** | `instructions.md` | `.windsurf/` or `.codeium/` |

**Available templates:**
- `CLAUDE.md.exemple`
- `COPILOT.md.exemple`
- `CHATGPT.md.exemple`
- `GEMINI.md.exemple`
- `QWEN.md.exemple`
- `CODEIUM.md.exemple`
- `OPENAI_CLI.md.exemple`

### Quick Installation

**Step 1: Copy base files**

```bash
# Required files
cp AI_WORKFLOW.md your-project/
cp kanban.md your-project/
cp archive.md your-project/
```

**Step 2: Configure your preferred AI**

For **Claude**:
```bash
cp CLAUDE.md.exemple your-project/CLAUDE.md
```

**For Claude Code (CLI)**: A dedicated skill is available!
```bash
# Copy the skill directory (metadata lives in SKILL.md)
cp -R .claude/skills/markdown-task-manager ~/.claude/skills/
# Restart Claude Code to activate the skill
```

Claude Code reads the `SKILL.md` metadata inside this directory, which is why the whole folder must be copied. The `markdown-task-manager` skill enables Claude Code to automatically manage your tasks with the required strict format. Once installed globally, it's available across all your projects.

**Using the Claude Code skill:**
Once the skill is installed and Claude Code is restarted, the skill will automatically detect projects containing `kanban.md` and `archive.md`. You can simply ask:
- "Create a task to implement authentication"
- "Update TASK-007 with results"
- "List all tasks in progress"
- "Archive completed tasks"

Claude Code will automatically follow the strict format and manage your tasks correctly.

For **GitHub Copilot**:
```bash
mkdir -p your-project/.github
cp COPILOT.md.exemple your-project/.github/copilot-instructions.md
```

For **ChatGPT**:
```bash
cp CHATGPT.md.exemple your-project/CHATGPT.md
```

For **Gemini**:
```bash
mkdir -p your-project/.gemini
cp GEMINI.md.exemple your-project/.gemini/instructions.md
```

For **Windsurf / Codeium**:
```bash
mkdir -p your-project/.windsurf
cp CODEIUM.md.exemple your-project/.windsurf/instructions.md
```

For **OpenAI CLI**:
```bash
cp OPENAI_CLI.md.exemple your-project/OPENAI_CLI.md
```

For **Qwen**:
```bash
cp QWEN.md.exemple your-project/QWEN.md
```

**Step 3: Final structure**

```bash
your-project/
├── AI_WORKFLOW.md              # ← General guidelines for all AIs
├── CLAUDE.md                   # ← Claude configuration (optional)
├── .github/
│   └── copilot-instructions.md # ← Copilot configuration (optional)
├── .gemini/
│   └── instructions.md         # ← Gemini configuration (optional)
├── .windsurf/
│   └── instructions.md         # ← Windsurf configuration (optional)
├── kanban.md                   # ← Active tasks
├── archive.md                  # ← Archived tasks
└── src/
```

### First Use

**For Claude:**
```
"Read CLAUDE.md and use the task system"
```

**For GitHub Copilot:**
```
@workspace Read AI_WORKFLOW.md and create a task for [feature]
```

**For ChatGPT:**
1. Upload `CHATGPT.md` and `AI_WORKFLOW.md`
2. Say: `"Read these files and use the task system"`

**For Gemini:**
```
@workspace Read AI_WORKFLOW.md and plan [feature]
```

**For Windsurf / Codeium:**
```
Read AI_WORKFLOW.md and create TASK-001 for [feature]
```

**For OpenAI CLI:**
```bash
openai --system-file OPENAI_CLI.md "Read AI_WORKFLOW.md and create a task for [feature]"
```

**For Qwen:**
```bash
qwen --system-file QWEN.md "Read AI_WORKFLOW.md and plan [feature]"
```

### What AI does automatically

The AI will:
1. ✅ Read `AI_WORKFLOW.md` to understand format and workflow
2. ✅ Create tasks in `kanban.md` with strict format
3. ✅ Move tasks between columns according to progress
4. ✅ Check off subtasks as they are completed
5. ✅ Document complete result in `**Notes**:`
6. ✅ Reference tasks in Git commits
7. ✅ Leave completed tasks in "✅ Done" (archiving on request only)

### Traceability and transparency

With this system, you have:

- 📝 **Complete history**: Every AI action is documented
- 🔍 **Easy search**: Grep in Markdown files
- 📊 **Statistics**: Velocity, time spent, progress
- 🔗 **Git links**: Commits reference tasks
- 👥 **Collaboration**: Entire team sees what AI does
- 📦 **Archives**: Nothing is lost, everything is archived

### User Commands

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

## 🔌 CLI and MCP server (humans and AI at the same time)

The board is a pair of plain Markdown files, so an agent *can* edit them directly, but that costs tokens (the whole file on every read), invites formatting mistakes, and can overwrite what you are doing in the browser. The optional **`kanbanmd` CLI** and **MCP server** fix all three: they read only what is asked, validate every change, and write minimal patches that merge with your concurrent edits. Your browser picks the changes up within a couple of seconds; your own edits are merged the same way in the other direction.

### Set up the MCP server

```bash
npm run mcp:install          # once: installs the MCP SDK inside mcp/ (the page and the CLI need no dependencies)
```

Add it to your MCP client, pointing `--dir` at the project folder that holds `kanban.md`:

```bash
claude mcp add kanban -- node /path/to/Kanban.md/mcp/server.js --dir /path/to/your/project
```

```json
{ "mcpServers": { "kanban": { "command": "node", "args": ["/path/to/Kanban.md/mcp/server.js", "--dir", "/path/to/your/project"] } } }
```

Add `--read-only` (or `KANBANMD_READONLY=1`) to expose only the 5 read tools: fewer tokens, and no way to write.

### The tools

| Tool | What it does |
|---|---|
| `get_board` | Compact list in display order (summaries, filters: `status`, `assignee`, `tag`, `priority`, `category`, `text`, `overdue`, `dueBefore`, paging). `archived: true` / `backlog: true` list those files |
| `get_task` | One task in full, with its `etag` |
| `get_config` | Valid columns, priorities, categories, users, tags |
| `get_board_stats` | Counts by status / assignee / priority, overdue, due soon, housekeeping suggestions |
| `get_changes_since` | Edits made through the tools since a timestamp |
| `save_task` | Create (no `id`) or change (`id`) a task |
| `move_task` | Change column in place (a one-line edit); `before` / `atEnd` also set the position |
| `subtask`, `add_note` | Add or tick a subtask; append to the notes |
| `archive_tasks`, `restore_task`, `delete_task` | Archive lifecycle |
| `sort_tasks` | File-wide reorder, always with an explicit `mode` |
| `update_config` | Lists, columns, housekeeping policy, backlog file |

Every write takes `dryRun` (preview the diff, write nothing) and most take `ifMatch` (the `etag` from a read: fails with `conflict` if the task changed since). Errors carry a code and the valid choices.

### The CLI

The same operations without MCP, for scripts, CI and agents that only have a shell:

```bash
node cli/kanbanmd.js --dir . board --status in-progress --assignee @alice
node cli/kanbanmd.js --dir . move TASK-014 done
node cli/kanbanmd.js --dir . --dry-run housekeeping --apply      # preview a clean-up
npm link                                                          # optional: makes `kanbanmd` a global command
```

`kanbanmd --help` lists everything. Output is always one JSON document.

### Why it is cheaper and safer

Measured on the example boards (`npm run measure`; tokens estimated as bytes / 4):

| | Reading the file | With the tools |
|---|---|---|
| "What is in this column?" on a 100-task board | ~20,000 tokens | ~1,000 |
| Read one task | ~20,000 | ~280 |
| Move a task, tick a subtask, add a note | read the file + an edit call | 25-60 |
| Fixed cost per session | ~4,700 (format rules) | ~1,800 for all 14 tools, ~650 read-only |

- **Minimal patches**: moving a card changes one line, so git diffs stay readable. Everything outside the change is byte-for-byte untouched.
- **Verified**: every edit is re-parsed and must read back exactly as intended, or nothing is written.
- **Concurrent-safe**: tools take turns with a lock, the browser re-reads before it writes, and ids are assigned atomically.
- **Format**: tasks use one metadata field per line (format v3). Older files are migrated automatically (with a backup) when opened in the browser, or with `kanbanmd migrate`.

`AI_WORKFLOW.md` tells agents to use the tools first and falls back to the file rules.

---

## ✨ Application Features

### 1. Interactive Kanban View

![Kanban Board](docs/images/kanban-board.jpg)
*Dark theme, scrolled: the column titles stay in place and a hairline shows where cards pass underneath*

- **Customizable columns**: Create and organize your own columns
  - Default: 📝 To Do, 🚀 In Progress, 👀 Review, ✅ Done
  - Modifiable via the burger menu → **Columns**
- **Drag & Drop**: Move tasks between columns by dragging
- **One scroller**: Scrolling anywhere on the board moves every column together, so you never have to aim at a column. Column titles are sticky
- **Adaptive layout**: Columns have a minimum width (280px), share any extra space equally (up to 460px each) and the board scrolls sideways when they do not fit
- **Counters**: Number of tasks displayed next to each column title
- **Compact cards**: priority dot, ID, title, short description, category, assignees, tags and a progress bar. Click a tag, category, assignee or priority dot to filter. A pencil appears on hover to edit; click the card for its details

### 2. Complete Task Management

![Task Creation Modal](docs/images/task-modal.jpg)
*Complete task creation and editing modal with all metadata fields and subtasks*

![Task Details](docs/images/task-detail.jpg)
*Task details: metadata, tags, description, subtasks you can tick off, and notes*

**Creation:**
- Complete form with all fields
- Auto-generated ID (TASK-XXX)
- Required field validation

**Rich metadata:**
- **Title**: Unique identifier and short description
- **Priority**: Critical, High, Medium, Low (color coded)
- **Category**: Customizable (Frontend, Backend, etc.)
- **Assignment**: Multiple users possible (@user1, @user2)
- **Tags**: Multiple tags (#bug, #feature, etc.)
- **Dates**: Creation, start, due, end
- **Description**: Free text with Markdown support

**Subtasks:**
- Create, edit, delete subtasks
- Check/uncheck in real time
- Visual progress bar
- Counter (e.g., "3/5 subtasks completed")

**Editing:**
- Detailed editing modal for each task
- Modification of all fields
- Instant preview
- Auto-save

### 3. Advanced Filters

![Advanced Filters](docs/images/filters.jpg)
*Four filters beside the search box. Each button shows how many values are active; removable chips list them below*

**4 filters, each a checklist:**

1. **Tags**: filter by one or more tags (e.g. #bug, #feature)
2. **Category**: e.g. Frontend, Backend, Design
3. **User**: filter by assignment (e.g. @alice, @bob)
4. **Priority**: Critical, High, Medium, Low

**How it works:**
- Open a filter and tick one or more values. The button turns blue and shows a count (for example *Tags 2*)
- Click a tag, category, assignee or priority dot on a card to filter instantly
- **Values of the same filter are alternatives (OR)**: ticking tags *feature* and *bug* shows cards that have either
- **Different filters are combined (AND)**: *feature or bug* **and** *Frontend or Backend*
- Active values also appear as chips under the toolbar. Remove one with ✕, or use **Clear all** at the start of the row
- On narrow screens (under 1280px) the four buttons collapse into a single **Filters** button with a badge showing the number of active values

**Smart autocomplete:**
- Filters remember history
- Even archived values remain available

### 4. Archive System

![Archive View](docs/images/archives.jpg)
*Archive view showing completed tasks with search and restoration capabilities*

**Archiving:**
- Move completed tasks to `archive.md`
- Manual archiving (button in task)
- Organization by sections (e.g., by month, by sprint)

**Consultation:**
- Dedicated archive view (burger menu → **Archives**)
- Search in archives
- Detailed display of each archived task

**Restoration:**
- Restore a task to kanban
- Task returns to its original column
- Metadata preserved

**Persistent history:**
- Tags/categories/users from archived tasks remain in autocomplete
- Allows maintaining consistency between projects

### 5. Global Search

- A search box in the top bar, always visible
- Filters the board as you type, in titles, descriptions and notes
- Works together with the filters (a card must match the search **and** the filters)
- Find tasks by ID (e.g. "TASK-042") or by keywords
- The Archives dialog has its own search box

### 6. Interface Translation

**Multi-language support:**
- English, French, German and Simplified Chinese available
- Language selector in the burger menu
- Complete interface translation
- Seamless language switching

**Translated elements:**
- All UI buttons and labels
- Form fields and placeholders
- Column names and status messages
- Help text and instructions
- Error messages and notifications

**Note:** The markdown files (kanban.md, archive.md) content remains in your chosen language.

### 7. Multi-Project

![Multi-Project Selector](docs/images/multi-project.jpg)
*Quick project switcher showing recent projects with custom names*

**Project management:**
- Memorization of last 10 projects used
- Quick selector in header (dropdown)
- Custom names for each project
- Memorized file paths

**Navigation:**
- Instant project change
- Auto-restore last project on launch
- Burger menu → **Rename project**

**Storage:**
- Uses IndexedDB to store directory handles
- No need to re-select folder each time
- Persistent browser permissions

### 8. Auto-Save

- **Immediate save**: Each modification is written instantly, as a **minimal patch**: changing a card edits only that card's lines, so git diffs stay small
- **No "Save" button**: Everything is automatic
- **Picks up outside changes**: edits made by an AI agent, the CLI or a text editor appear within about two seconds. Your own edit is merged with theirs, never overwriting it; if you have the edit form open on a task that changed, you are asked before it is replaced
- **Compatible with external editing**: You can edit files manually

### 9. Other Features

- **Export**: Your Markdown files are already exported!
- **Themes**: Layered light and dark themes (page, columns, cards and menus get lighter the closer they are to you). The theme icon at the right edge offers **Auto** (follows the system), **Light** and **Dark**
- **Responsive**: Optimized for mobile — touch drag & drop, stacked forms, per-column "+" button
- **Keyboard**: **Esc** closes menus and dialogs
- **Keyboard shortcuts**: Quick navigation (coming soon)

### 10. Manual card order (optional)

By default a card sits where its block is in the file. The first time you drag a card to a spot, the app asks whether to **remember the order**: if you say yes, each task gets an `**Order**: 3000` line and every later move changes just two lines (no blocks move). Burger menu → **Manual order** switches it on or off, and **Reset order by task id** puts the cards back in id order.

### 11. Housekeeping nudges

A quiet bar under the header suggests keeping the board small: tasks **finished 30+ days ago** (button: *Archive done*, one confirmed step), **backlog tasks older than 90 days** (outlined), a board over **200 tasks**, or a backlog over **100 tasks** (button: *Move backlog to its own file*). *Snooze 7 days* hides it; *Dismiss* hides it until the numbers change. It never acts on its own. Change the numbers (or turn it off) in the burger menu → **Housekeeping**, or with the optional config line `**Housekeeping**: done=done after=30d | backlog=backlog after=90d | max=200` (`off` silences it).

### 12. Backlog file (optional)

For a very large backlog, a task whose status is the backlog column can live in its own **`backlog.md`**, keeping `kanban.md` small and fast. The backlog column becomes a stub with a count; **Open backlog** shows a panel where you can search, send a task to any column, or archive it. Dragging a card onto the stub parks it; changing a task's status moves it between the files. Switch it on with the nudge (past 100 backlog tasks) or burger menu → **Backlog file**. Config line: `**Backlog file**: backlog.md (backlog)`.

---

## 📁 File Structure

### Main files

```
your-project/
├── kanban.md          # Active tasks (required)
├── archive.md         # Archived tasks (created on the first archive)
├── backlog.md         # Backlog tasks (optional, see "Backlog file")
├── AI_WORKFLOW.md     # Guidelines for AI (optional)
└── [AI file].md       # Specific AI configuration (optional)
```

Working files the tools may create (add them to `.gitignore`): `.kanban.lock/`, `.kanban-activity.jsonl`, `.*.tmp`.

### Content of kanban.md

```markdown
# Kanban Board

<!-- Config: Last Task ID: 42 -->
<!-- Format: v3 -->

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

### TASK-003 | Completed task
**Status**: done
...
```

Every task carries its own **`**Status**:`** (a column id): that is what places it in a column, so moving a card is a one-line edit. Every metadata field has its own line and is optional (a task can have a priority and no category); empty fields are left out. An optional `**Order**: 3000` line holds the manual card order. Optional config lines: `**Housekeeping**: …` and `**Backlog file**: backlog.md (backlog)`.

> **Older files** (v1: one `## Section` per column; v2: priority, category and assignee joined on one line) open fine and are **migrated automatically** the first time you open them in the app, keeping a backup (`kanban.v1-backup.md` / `kanban.v2-backup.md`). The migration refuses anything that would not read back identically. From the command line: `kanbanmd migrate [--dry-run]`.

### Content of archive.md

```markdown
# Task Archive

<!-- Format: v3 -->

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
- [x] Implement email sending

**Notes**:

**Result**:
✅ Functional notification system with WebSocket, REST API and emails.

**Modified files**:
- src/websocket/server.js (lines 1-150)

**Technical decisions**:
- Socket.io for WebSockets (simpler than native ws)

**Tests performed**:
- ✅ 100 simultaneous connections OK
```

An archived task keeps its `**Status**` so it can be restored to the right column.

---

## 🎨 User Interface

### Top bar

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ☰  Kanban.md  [Project ▾]  [🔍 Search...]  [Tags ▾][Category ▾][User ▾][Priority ▾]  [+ Task]  ◐ │
└───────────────────────────────────────────────────────────────────────────┘
```

- **☰ Burger menu** (left): Archives, Columns, Folder, Rename project, Remove project from list, Language
- **[Project ▾]**: Recent project selector
- **Search and filters**: always reachable. On narrow screens the four filter buttons collapse into one **Filters** button
- **[+ Task]**: Create a task
- **◐ Theme** (right): Auto, Light or Dark

When filters are active, a slim row under the bar lists them as chips, starting with **Clear all**.

### Kanban

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Backlog   5  │ In Progress 3│ In Review  3 │ Done       4 │  ← sticky titles
├──────────────┼──────────────┼──────────────┼──────────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │
│ │ ● TASK-1 ✎│ │ │ ● TASK-6 ✎│ │ │ ● TASK-9 ✎│ │ │ ● TASK-12✎│ │   ● priority dot
│ │ Title    │ │ │ Title    │ │ │ Title    │ │ │ Title    │ │   ✎ on hover only
│ │ Short... │ │ │ Short... │ │ │ Short... │ │ │ Short... │ │
│ │ Cat @who │ │ │ Cat @who │ │ │ Cat @who │ │ │ Cat @who │ │
│ │ ▓▓▓░░ 3/5│ │ │ ▓▓▓▓░ 4/5│ │ │ ▓▓▓▓▓ 5/5│ │ │ ▓▓▓▓▓ 3/3│ │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

The whole board is one scroller, so scrolling anywhere moves all columns together.

### Task details

Click a card to open its details: metadata, tags, description, subtasks (tick them off in place) and notes. **Edit**, **Archive** and **Delete** are at the bottom; close with ✕, **Esc** or a click outside.

---

## 🛠️ Development

The application is built from `src/` into one self-contained file.

```bash
npm install          # once (build tools only; the output has no dependencies)
npm run build        # minified kanbanmd.html
npm run build:dev    # readable kanbanmd.html while you work
npm test             # unit, property and end-to-end tests
npm run mcp:install  # install the MCP SDK (enables the MCP server and its tests)
npm run measure      # token cost of reads and writes, raw file vs tools
```

- `core/` is the pure board logic (parse, generate, validated minimal-patch operations, reads, migration, housekeeping, the backlog file). The page bundles it (esbuild), and the CLI (`cli/`) and MCP server (`mcp/`) import it, so all three always agree on the format. `io/` is the Node file layer (atomic writes, locking).
- `test/` holds the tests; `test/tools/page-harness.js` and `page-checks.js` check the page in a browser against a fake in-memory folder (see the header of each file).
- `src/styles/00-variables.css` holds the design tokens: spacing, radius, type scale and the light and dark colour ladders. Change a colour or a size there.
- Surfaces are layered `--c-page` < `--c-column` < `--c-card` < `--c-pop`, so a new component only needs to pick the right level.
- `src/scripts/13-toolbar.js` holds the menus and popovers; `src/scripts/06-filters.js` the filter logic; `src/scripts/04a-persist.js` how the page saves and watches the files.
- `docs/demo/` contains the sample board used for the screenshots above.
- `drafts/mcp-file-plan.md` is the design record (decisions, measurements, a log of every step).

---

## 🔧 Configuration and Customization

### Kanban Columns

Customize your columns in `kanban.md`:

```markdown
**Columns**: 📝 Backlog (backlog) | 🔍 Analysis (analysis) | 🚀 Dev (dev) | 👀 Review (review) | ✅ Done (done)
```

Format: `Emoji Name (id) | ...`

Examples:
- Simple development: `To Do | In Progress | Done`
- Scrum: `Backlog | Sprint | In Progress | Review | Done`
- Extended Kanban: `Icebox | Backlog | Analysis | Dev | QA | Deploy | Done`

### Categories

Define your project categories:

```markdown
**Categories**: Frontend, Backend, Database, DevOps, Design, Tests, Documentation
```

Adapt to your context:
- Web: `UI, API, Database, DevOps`
- Mobile: `iOS, Android, Backend, Design`
- Data: `ETL, Analysis, ML, Visualization`

### Users

List team members:

```markdown
**Users**: @alice (Alice Martin), @bob (Bob Smith), @charlie (Charlie Brown)
```

Format: `@username (Full Name)`

### Priorities

Define priority levels with emojis for visual identification:

```markdown
**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
```

**Valid emoji icons:**
Priorities support a wide range of emojis that automatically map to colors. You can use any of these:

- **Circles**: 🔴 🟠 🟡 🟢 🔵 🟣 ⚪ ⚫
- **Squares**: 🟥 🟧 🟨 🟩 🟦 🟪
- **Hearts**: ❤️ 🧡 💛 💚 💙 💜 🤍 🖤
- **Diamonds**: 🔶 🔷 🔸 🔹
- **Stars**: ⭐ 🌟
- **Flags**: 🚩 🏴 🏳️
- **Alerts**: ⚠️ 🔥 💥 ⚡
- **Arrows**: ⬆️ ➡️ ⬇️
- **Symbols**: ❗ ❓ ❕ ❔

**Examples of priority systems:**
```markdown
# Traditional severity levels
**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

# Urgency indicators
**Priorities**: 🔥 Urgent | ⚡ Important | ⭐ Normal | ⬇️ Low

# Custom workflow
**Priorities**: 🚩 Blocker | ⚠️ Must Have | 💡 Nice to Have | 💤 Someday
```

**Note:** The emoji determines the badge color in the UI. For example, 🔴 displays as red, 🟢 as green, etc.

### Tags

Create an adapted tag system:

```markdown
**Tags**: #bug, #feature, #refactor, #docs, #urgent, #blocked, #tech-debt
```

Examples of tag systems:
- By type: `#bug`, `#feature`, `#refactor`, `#docs`
- By priority: `#urgent`, `#important`, `#nice-to-have`
- By status: `#blocked`, `#waiting`, `#in-review`
- By domain: `#security`, `#performance`, `#ux`, `#a11y`

---

## 🎯 Use Cases

### 1. Software Development

**Backlog management:**
- Create tasks from GitHub issues
- Plan sprints
- Track team velocity

**Bug tracking:**
- Tag `#bug` + critical priority
- Assignment to developers
- Resolution documentation

**Code reviews:**
- Dedicated column "👀 Review"
- Review checklist in subtasks
- Archiving with technical decisions

### 2. Project Management

**Product roadmap:**
- Create tasks for each feature
- Deadlines and milestones
- Progress tracking

**Team collaboration:**
- Multi-user assignment
- Filter by person
- Real-time visibility via Git

**Retrospectives:**
- Search in archives
- Statistics on completed tasks
- Velocity analysis

### 3. Personal Use

**Advanced ToDo lists:**
- Organize tasks by project
- Subtasks to break down
- Archives for history

**Personal projects:**
- Track side-projects
- Notes and learnings
- Goals with deadlines

**Journaling:**
- Task = journal entry
- Tags to categorize
- Archives = complete journal

### 4. Distributed Teams

**Git synchronization:**
```bash
git pull origin main          # Get updates
# Work in the application
git add kanban.md archive.md
git commit -m "Update tasks"
git push origin main          # Share with team
```

**Conflict resolution:**
```bash
# In case of conflict on kanban.md
git checkout --theirs kanban.md  # Take remote version
# or
git checkout --ours kanban.md    # Keep local version
# or resolve manually (simple Markdown format)
```

**Branch workflow:**
```bash
# Create a branch per feature
git checkout -b feature/TASK-042-notifications

# Reference task in commits
git commit -m "feat: Add WebSocket server (TASK-042 - 1/5)"
git commit -m "feat: Add notification API (TASK-042 - 2/5)"

# Merge and archive
git checkout main
git merge feature/TASK-042-notifications
# Move TASK-042 to "✅ Done" then archive
```

---

## 🌐 Compatibility

### Supported Browsers

| Browser | Minimum version | Support | Notes |
|---------|----------------|---------|-------|
| Chrome  | 86+            | ✅ Full | Recommended |
| Edge    | 86+            | ✅ Full | Recommended |
| Opera   | 72+            | ✅ Full | OK |
| Brave   | 1.17+          | ✅ Full | OK |
| Firefox | -              | ❌ Not supported | API not available |
| Safari  | -              | ❌ Not supported | API not available |

**Note:** File System Access API is required. It is not available on Firefox and Safari.

### Operating Systems

- ✅ **Windows** 10/11
- ✅ **macOS** 10.15+ (with Chrome/Edge)
- ✅ **Linux** (all distributions with Chrome/Edge/Opera)
- ✅ **Chrome OS**
- ❌ iOS/iPadOS (Safari only)
- ❌ Android (limited support)

### Performance

- **HTML file**: ~144 KB (everything included, no dependencies)
- **Loading**: Instant (< 100ms)
- **Parsing**: < 50ms for 1000 tasks
- **Memory**: ~10 MB (for 500 tasks)

---

## 📚 Additional Documentation

### In this repository

- **`AI_WORKFLOW.md`**: Complete guidelines for AI assistants
- **`/examples/`**: Examples of kanban.md and archive.md files
- **`/examples/README.md`**: Detailed Markdown format

### Templates

Download blank templates:
- [`kanban.md`](/examples/kanban.md) - Base template
- [`archive.md`](/examples/archive.md) - Archive template
- [`AI_WORKFLOW.md`](/AI_WORKFLOW.md) - Guidelines for AIs
- AI configuration templates: `CLAUDE.md.exemple`, `COPILOT.md.exemple`, etc.

### Markdown Format

Detailed format documentation in [`/examples/README.md`](/examples/README.md):
- Task structure
- Required/optional metadata
- Subtasks and notes
- Kanban configuration
- Complete examples

---

## 🔒 Security and Privacy

- ✅ **100% local data**: Nothing is sent to the Internet
- ✅ **No tracking**: No telemetry, no analytics
- ✅ **No account**: No authentication required
- ✅ **Explicit permissions**: User controls file access
- ✅ **Open code**: All JavaScript code is readable in HTML file
- ✅ **No CDN**: No external resources loaded
- ✅ **Offline**: Works without Internet connection

### Required permissions

The application only requests:
- **File Read/Write**: To access your Markdown files
- **IndexedDB**: To remember recent projects (local to browser)

No network, webcam, microphone or other permissions are required.

---

## 🚀 Advanced Getting Started

### With Git

```bash
# Clone repository
git clone https://github.com/your-username/markdown-task-manager.git
cd markdown-task-manager

# Open application
open kanbanmd.html  # macOS
xdg-open kanbanmd.html  # Linux
start kanbanmd.html  # Windows

# Or host locally (optional)
python -m http.server 8000
# Then open http://localhost:8000/kanbanmd.html
```

### Installation on a new project

```bash
# Create a new project with task system
mkdir my-project
cd my-project
git init

# Copy necessary files
cp /path/to/kanban.md .
cp /path/to/archive.md .
cp /path/to/AI_WORKFLOW.md .        # Optional (for AI)
cp /path/to/CLAUDE.md.exemple CLAUDE.md   # Optional (for Claude)

# First commit
git add .
git commit -m "chore: Initialize task management system"

# Open application
open /path/to/kanbanmd.html
# Select my-project/ folder
```

### Migration from existing system

**From Trello/Jira/Linear:**
1. Export your tasks to CSV
2. Use a script to convert to Markdown format
3. Import into `kanban.md`

**From GitHub Issues:**
```bash
# Use GitHub CLI
gh issue list --state all --json number,title,body,labels
# Convert to Markdown Task Manager format
```

**From Notion/Obsidian:**
1. Export to Markdown
2. Adjust format to match template
3. Import into application

---

## 🤝 Contribution

Contributions welcome! Here's how to help:

### Report a bug

1. Check that bug doesn't already exist in issues
2. Create an issue with:
   - Bug description
   - Steps to reproduce
   - Browser and version
   - Screenshots if applicable

### Propose a feature

1. Create an issue with `enhancement` tag
2. Describe feature and its usefulness
3. Wait for feedback before implementing

### Contribute code

1. Fork the repository
2. Create a branch (`git checkout -b feature/my-feature`)
3. Modify `kanbanmd.html` (everything is in this file)
4. Test in Chrome, Edge and Opera
5. Commit (`git commit -m "feat: Add feature"`)
6. Push (`git push origin feature/my-feature`)
7. Create a Pull Request

### Guidelines

- **Readability**: Commented and structured code
- **Performance**: Optimize for 1000+ tasks
- **Compatibility**: Test on Chrome, Edge, Opera
- **Accessibility**: Follow ARIA standards
- **Documentation**: Update README if necessary

---

## 📝 Roadmap

### Current version: 2.0

**Core (since 1.0)**
- ✅ Interactive Kanban with drag & drop
- ✅ Complete task management
- ✅ Advanced filters
- ✅ Archive system
- ✅ Multi-project
- ✅ Auto-save
- ✅ AI integration

**Added in 1.1 → 2.0**
- ✅ Extended priority system (50+ emoji icons) — *1.1*
- ✅ Dark mode (toggle + system auto-detection) — *1.2*
- ✅ German and Simplified Chinese translations — *1.2*
- ✅ Archived task detail view — *1.2*
- ✅ Mobile support: touch drag & drop, responsive layout, per-column "+" button — *1.3 (issue #12)*
- ✅ XSS hardening: escaped rendering + Markdown link scheme validation — *1.3.1*
- ✅ **Token-efficient status (status as a field)** — a task's column is a `**Status**:` field in a single `## Tasks` section, so moving a task between columns is a one-line edit; AIs read/update the board via cheap `grep` (no stored index). Backward-compatible parser + **automatic, safe V1→V2 migration on load** (creates a `.v1-backup.md`, no data loss); the archive is migrated too. — *2.0*
- ✅ Source split into `src/` and compiled to the single `kanbanmd.html` by a dependency-free Node build (`npm run build`) — *2.0*
- ✅ **Visible deadlines** — the **Due** date is shown on every card and highlighted (orange when due within 2 days, red once overdue); finished tasks are never flagged — *2.0*
- ✅ Migration fidelity — a custom H1 title is preserved (no longer reset to "Kanban Board"), the config Categories/Users/Tags lines no longer grow unbounded on every save, and the autocomplete fields are escaped — *2.0*

### Next versions

**Later**
- [ ] Keyboard shortcuts
- [ ] PDF/HTML export & visual statistics (charts)
- [ ] File attachments, @mentions, deadline reminders, task templates
- [ ] Full offline mode (Service Worker), cross-device sync, IDE plugin, optional local REST API

---

## 📄 License

Mozilla Public License 2.0 (MPL-2.0)

This project is distributed under MPL-2.0 license. You are free to:
- Use code in commercial and private projects
- Modify source code
- Distribute modified or unmodified code

Under condition of:
- Publishing modifications to files under MPL-2.0 license
- Including a copy of MPL-2.0 license
- Preserving copyright notices

See `LICENSE` file for more details.

---

## 🙏 Acknowledgments

Thanks to open-source community for:
- File System Access API (Google Chrome team)
- Markdown standards (CommonMark)
- User feedback and suggestions

---

## 📞 Support

**Questions?** Open an issue on GitHub

**Bugs?** Create an issue with `bug` tag

**Suggestions?** Create an issue with `enhancement` tag

---

**Created with ❤️ for those who love simplicity, control of their data, and transparency**

---

## 🎓 Getting Started Guide: Complete Scenarios

### Scenario 1: Solo developer on personal project

```bash
# 1. Download kanbanmd.html to ~/tools/
cd ~/tools
# [Download kanbanmd.html]

# 2. Create a new project
cd ~/projects
mkdir my-app
cd my-app
git init

# 3. Create task files
cat > kanban.md << 'EOF'
# Kanban Board

## ⚙️ Configuration

**Columns**: 📝 To Do | 🚀 In Progress | ✅ Done
**Categories**: Frontend, Backend, Database
**Users**: @me
**Tags**: #feature, #bug, #refactor

## 📝 To Do
## 🚀 In Progress
## ✅ Done

<!-- Config: Last Task ID: 000 -->
EOF

cat > archive.md << 'EOF'
# Task Archive
## ✅ Archives
EOF

# 4. Open application
open ~/tools/kanbanmd.html

# 5. Select my-app/ folder

# 6. Create your first task!
```

### Scenario 2: Team migrating from Trello

```bash
# 1. Install for team
git clone https://github.com/team/project.git
cd project

# 2. Add task system
cp ~/downloads/kanban.md .
cp ~/downloads/archive.md .
git add kanban.md archive.md
git commit -m "chore: Add task management system"
git push

# 3. Each team member:
# - Downloads kanbanmd.html
# - Clone/pull project
# - Opens kanbanmd.html
# - Selects project/ folder

# 4. Daily workflow:
git pull                    # Get updates
# [Work in app]
git add kanban.md
git commit -m "Update tasks"
git push                    # Share with team
```

### Scenario 3: Integration with Claude/ChatGPT

```bash
# 1. Complete installation with AI
cd my-project
cp ~/downloads/kanban.md .
cp ~/downloads/archive.md .
cp ~/downloads/AI_WORKFLOW.md .
cp ~/downloads/CLAUDE.md.exemple CLAUDE.md

# 2. First session with Claude
# Say: "Read CLAUDE.md and create a task to implement an auth system"

# 3. Claude will automatically:
# - Create TASK-001 in kanban.md
# - Break down into subtasks
# - Update as it progresses
# - Document result

# 4. You can visualize in app
open ~/tools/kanbanmd.html
# [Select my-project/]
# See TASK-001 with all subtasks checked!
```

---

**🎉 You're ready! Start organizing your tasks now.**
