# Kanban.md Project Board

<!-- Config: Last Task ID: 32 -->
<!-- Format: v3 -->

## ⚙️ Configuration

**Columns**: 💡 Ideas (ideas) | 📋 Planned (planned) | 🚀 In Progress (in-progress) | ✅ Done (done)

**Categories**: App, CLI, MCP, Format, Docs, Site

**Users**: @ashikahmad (Ashik Ahmad)

**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

**Tags**: #app #cli #mcp #format #docs #site #integration #need-help #good-first-issue

---

## Tasks

### TASK-001 | Read-only board from a URL
**Status**: in-progress  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Started**: 2026-10-22  
**Tags**: #app #site  

Open a public board with ?board=<url-to-kanban.md> and view it read-only. Built on a data-source layer: a folder source reads and writes the project folder as today; a web source reads kanban.md, archive.md and the backlog file from the URL and is always read-only. The same layer later carries browser storage (TASK-004) and Save as folder project (TASK-003). Design: drafts/github-pages-plan.md.

Decisions: same-origin URLs load at once, other hosts ask first; ?board= in the query string; no Reload button or polling for now; remote images in notes are allowed. Works without the File System Access API, so read-only boards also open in Firefox and Safari.

**Subtasks**:
- [x] PR 1: data-source layer and FolderSource, no behaviour change (existing page tests pass, contract test on an in-memory source)
- [x] PR 2: WebSource and ?board= (relative URLs, same-origin loads at once, other hosts ask first)
- [x] PR 2: read-only UI driven by source.writable (no drag, edit, delete, archive, columns, housekeeping; filters, search, archive view and Share kept) and banner
- [x] PR 2: errors (404, CORS, HTML instead of Markdown with github.com blob to raw rewrite, not a board) and a security pass on rendering untrusted files
- [x] PR 2: tests with a fake fetch; strings in English and French (German and Chinese fall back to English, see TASK-018)
- [x] PR 3: site links to the project and demo boards, docs

**Notes**:
Built on branch plan/read-only-url-board in three commits (data sources, web board, site and docs). The security pass found and fixed one injection: the code block label in task text was inserted unescaped. Waiting on review; move to Done once merged.

### TASK-002 | Sample boards menu in the app
**Status**: ideas  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app #site  

A menu item that opens the demo board and this project board for a quick look. Depends on the read-only URL board.

### TASK-003 | Convert a browser or read-only board to a folder project
**Status**: ideas  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app  

One-time "Save as folder project" that writes kanban.md and archive.md, with no ongoing sync. Download as files where the folder picker is unavailable.

### TASK-004 | Browser-storage mode
**Status**: ideas  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app  

Keep a board inside the browser with no folder, which also would make the app usable in Firefox and Safari. Agents could only read it while a tab is open. Design notes: drafts/browser-storage-plan.md.

### TASK-005 | Shared task viewer, editor and exporter page
**Status**: ideas  
**Priority**: Low  
**Category**: Site  
**Created**: 2026-10-22  
**Tags**: #site #app  

A page on the product site for opening a shared task block, editing it, and exporting it.

### TASK-006 | Keyboard shortcuts
**Status**: ideas  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app  

New task, search, move a card, switch project.

### TASK-007 | Export to PDF/HTML and simple statistics charts
**Status**: ideas  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app  

Printable board and progress charts.

### TASK-008 | Task templates
**Status**: ideas  
**Priority**: Low  
**Category**: Format  
**Created**: 2026-10-22  
**Tags**: #app #format  

Start a task from a predefined set of fields and subtasks.

### TASK-009 | File attachments and @mentions
**Status**: ideas  
**Priority**: Low  
**Category**: Format  
**Created**: 2026-10-22  
**Tags**: #app #format  

Link files to a task and mention people in notes.

### TASK-010 | Deadline reminders
**Status**: ideas  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app  

A gentle reminder for tasks due soon, without sending anything off the machine.

### TASK-011 | Full offline mode with a service worker
**Status**: ideas  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app #site  

Installable app that works offline when hosted.

### TASK-012 | IDE plugin
**Status**: ideas  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #integration  

View and move tasks from inside an editor, starting with VS Code.

### TASK-013 | Cross-device sync through git or a synced folder
**Status**: ideas  
**Priority**: Low  
**Category**: Format  
**Created**: 2026-10-22  
**Tags**: #format  

Guidance and tooling for keeping a board in sync across machines, without a server.

### TASK-014 | WebMCP: let in-browser agents drive the open tab
**Status**: ideas  
**Priority**: Low  
**Category**: MCP  
**Created**: 2026-10-22  
**Tags**: #mcp  

Expose board tools through the emerging page-level tool API. Support still needs checking.

### TASK-015 | MCP resources and prompts
**Status**: ideas  
**Priority**: Low  
**Category**: MCP  
**Created**: 2026-10-22  
**Tags**: #mcp  

Offer the board and common workflows as MCP resources and prompts, beyond tools.

### TASK-016 | Publish the CLI and MCP server on npm
**Status**: ideas  
**Priority**: Low  
**Category**: CLI  
**Created**: 2026-10-22  
**Tags**: #cli #mcp  

Install with npx or npm i -g instead of cloning the repository.

### TASK-017 | Per-task change attribution
**Status**: ideas  
**Priority**: Low  
**Category**: Format  
**Created**: 2026-10-22  
**Tags**: #format  

An optional Updated field, or marking who (a person or an agent) last changed a task.

### TASK-018 | German and Simplified Chinese translations of the newest interface strings
**Status**: planned  
**Priority**: Medium  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app #need-help  

New strings added recently exist in English and French only; German and Simplified Chinese fall back to English. Native speakers welcome: strings live in src/scripts/02-i18n.js.

### TASK-019 | Replace the browser confirm/prompt dialogs with in-app ones
**Status**: planned  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app #good-first-issue  

The native dialogs are inconsistent with the redesigned interface.

### TASK-020 | Age done tasks that have no Finished date in the housekeeping nudge
**Status**: planned  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app #good-first-issue  

Done tasks with no Finished date cannot be aged, so they never appear in the "archive done" suggestion.

### TASK-021 | Manual card order inside the backlog file
**Status**: planned  
**Priority**: Low  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app #good-first-issue  

Order keys are ignored for tasks in backlog.md today.

### TASK-022 | Manual test pass in Chrome with the real folder picker
**Status**: planned  
**Priority**: High  
**Category**: App  
**Created**: 2026-10-22  
**Tags**: #app #need-help  

The automated page checks use a fake in-memory folder; the real File System Access picker needs a person to click through once per release.

### TASK-023 | GitHub Pages product site
**Status**: planned  
**Priority**: Medium  
**Category**: Site  
**Created**: 2026-10-22  
**Tags**: #site  

A first product page that links to this board, hosts the app, and later offers sample boards. Plan and hand-off brief: drafts/github-pages-plan.md.

### TASK-024 | Rewrite the README and docs; open this board
**Status**: in-progress  
**Priority**: High  
**Category**: Docs  
**Assigned**: @ashikahmad  
**Created**: 2026-10-22  
**Started**: 2026-10-22  
**Tags**: #docs  

The README now describes what Kanban.md is today, and the details live in docs/. The fork history moves to its own page. Good enough first, polish later.

**Subtasks**:
- [x] Split the old README into docs/ pages
- [x] Write docs/about-this-fork.md
- [x] Create and seed this board
- [x] Write the short README
- [x] Write the GitHub Pages hand-off doc
- [x] Translate the README to French
- [x] Check every link

### TASK-025 | Interface redesign
**Status**: done  
**Priority**: Medium  
**Category**: App  
**Created**: 2026-10-20  
**Finished**: 2026-10-21  
**Tags**: #app  

A compact, layered interface for the whole viewer.

**Subtasks**:
- [x] One compact top bar with search, filters, + Task and a theme menu
- [x] Inline multi-select filters that collapse into one Filters button on narrow screens
- [x] One scroller with sticky column titles
- [x] Compact cards: priority dot, quiet tags, slim progress bar, edit on hover
- [x] Layered light and dark themes with an Auto / Light / Dark switch
- [x] Token-based stylesheet instead of scattered inline styles

### TASK-026 | File format v3 with safe migration
**Status**: done  
**Priority**: Medium  
**Category**: Format  
**Created**: 2026-10-20  
**Finished**: 2026-10-21  
**Tags**: #format  

One metadata field per line, so no field is lost on save, with every line ending in a Markdown hard break so the files read well in any viewer.

**Subtasks**:
- [x] One field per line (v2 joined priority, category and assignee)
- [x] Lines end in two spaces so any Markdown viewer shows one field per line
- [x] Automatic v1/v2 to v3 migration with backups
- [x] Migration refused unless the result reads back identically
- [x] kanbanmd migrate [--dry-run] on the command line

### TASK-027 | Shared core and minimal-patch writes
**Status**: done  
**Priority**: Medium  
**Category**: App  
**Created**: 2026-10-20  
**Finished**: 2026-10-21  
**Tags**: #format #app  

Board logic extracted into one pure module that the page, the CLI and the MCP server all use.

**Subtasks**:
- [x] Pure parse/generate module (core/)
- [x] Validated operations written as minimal patches (moving a card edits one line)
- [x] Every edit re-parsed and verified before it is written
- [x] Core bundled into the single HTML page by the build

### TASK-028 | CLI and MCP server
**Status**: done  
**Priority**: Medium  
**Category**: MCP  
**Created**: 2026-10-20  
**Finished**: 2026-10-21  
**Tags**: #cli #mcp  

Cheap, validated board access for AI agents and scripts.

**Subtasks**:
- [x] kanbanmd CLI with JSON output
- [x] MCP server with 14 tools and a read-only mode
- [x] dryRun on every write, ifMatch/etag conflict detection
- [x] Compact reads, with token cost measured against raw file reads
- [x] Atomic writes and locking in the Node file layer

### TASK-029 | Live sync between the browser and agents
**Status**: done  
**Priority**: Medium  
**Category**: App  
**Created**: 2026-10-20  
**Finished**: 2026-10-21  
**Tags**: #app #mcp  

The page and outside tools can edit the same board at once.

**Subtasks**:
- [x] Page saves by applying ops to the files as they are now
- [x] Outside edits picked up within about two seconds
- [x] Concurrent human and agent edits merged, never overwritten
- [x] Edit form asks before replacing a task that changed underneath it

### TASK-030 | Manual card order
**Status**: done  
**Priority**: Medium  
**Category**: App  
**Created**: 2026-10-20  
**Finished**: 2026-10-21  
**Tags**: #app  

Optional per-task Order keys so cards can be arranged by hand.

**Subtasks**:
- [x] First-drop prompt to remember the order
- [x] Each later move changes two lines
- [x] Menu switch to turn it on or off and to reset to id order

### TASK-031 | Housekeeping and backlog file
**Status**: done  
**Priority**: Medium  
**Category**: App  
**Created**: 2026-10-20  
**Finished**: 2026-10-21  
**Tags**: #app #format  

Keeps big boards small and fast.

**Subtasks**:
- [x] Nudge bar for old done tasks, stale backlog and oversized boards
- [x] Snooze and dismiss; the app never acts on its own
- [x] Configurable policy line
- [x] Optional separate backlog.md with a stub column and a panel
- [x] Backlog support in the CLI and MCP server

### TASK-032 | Task sharing
**Status**: done  
**Priority**: Medium  
**Category**: App  
**Created**: 2026-10-20  
**Finished**: 2026-10-21  
**Tags**: #app  

Share a task as plain text or as a Markdown block another board can import.

**Subtasks**:
- [x] Preview with a real GFM parser, escaped and sanitised
- [x] Raw / rendered toggle and options to leave out notes and assignees
- [x] Copy and the system share sheet

