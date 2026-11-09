# Kanban.md Project Board

<!-- Config: Last Task ID: 39 -->
<!-- Format: v3 -->
<!-- Kanban.md board. Format, rules and tools (app, CLI, MCP): https://github.com/ashikahmad/Kanban.md -->

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

Open a public board with ?board=<url-to-kanban.md> and view it read-only. Built on a data-source layer: a folder source reads and writes the project folder as today; a web source reads kanban.md, archive.md and the backlog file from the URL and is always read-only. The same layer later carries browser storage (TASK-004) and Save as folder project (TASK-003). Design: docs/design/github-pages-plan.md.
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

Keep a board inside the browser with no folder, which makes the app interactive in Firefox and Safari: edits are kept locally and written to files only when the user chooses ('Save to files'). Needs clear indicators of where the data is and whether it differs from the folder it came from or from the last export; UX notes: sources-ux.md in the git history. Agents can read it only while a tab is open (no bridge yet). Pairs with TASK-035 (open a folder read-only, then make an editable copy) and TASK-003 (save as folder project / download). Design notes: docs/design/browser-storage-plan.md.

**Notes**:
Not doing it for now. Prefer `kanbanmd serve` as described in TASK-037

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

A first product page that links to this board, hosts the app, and later offers sample boards. Plan and hand-off brief: docs/design/github-pages-plan.md.

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

### TASK-033 | Task links: Blocked by
**Status**: in-progress  
**Priority**: Medium  
**Category**: Format  
**Created**: 2026-11-03  
**Tags**: #app #cli #mcp #format  

A task can list the tasks it waits on (**Blocked by**: TASK-007, TASK-012). Only that direction is stored; what a task blocks is derived. The card shows a lock with the number of blockers still open; the details list both directions and link to them; a TASK-012 in a description becomes a link. A blocker in the backlog file counts as open and can be moved to the board from the details. Advice only: nothing is enforced, and there are no link types, graph or auto-status changes on purpose (that is where a tracker is the better tool). Older versions read the line as description text.

### TASK-034 | Revisit the Dependencies section
**Status**: ideas  
**Priority**: Low  
**Category**: Format  
**Created**: 2026-11-03  
**Tags**: #format  

The parser reserves **Links**, **Review** and **Dependencies** as sections that are kept verbatim and cannot be edited (core/board.js, core/patch.js; the page reports them as unsupported). Nothing reads them and the format has no spec for them; they exist so hand-written or imported sections survive the v3 migration. With **Blocked by** now the real way to link tasks, decide: keep the preserved sections as they are, make them editable (and define a format), or drop the support. Questions to answer: do any real boards use them, what would editing look like, and does dropping them risk losing text on old files.

### TASK-035 | Firefox and Safari: open a local folder read-only (picked-folder source)
**Status**: in-progress  
**Priority**: Medium  
**Category**: App  
**Created**: 2026-11-07  
**Tags**: #app  

Folder mode needs showDirectoryPicker, which Firefox and Safari lack. Add a 'picked folder' data source next to folderSource and webSource (src/scripts/03a-sources.js): read kanban.md, archive.md and the backlog file from an <input webkitdirectory> pick, writable: false, same read-only banner as the web board (03b-web-board.js). No polling: the files are a snapshot, so offer 'Pick again' to refresh. Where showDirectoryPicker is missing, the Folder button leads here instead of a dead end. Saving back is out of scope: editing in these browsers comes from kanbanmd serve (TASK-037); a browser-storage source (TASK-004) is parked. Mozilla thread 1264779 is only about file:// links and does not help.

**Notes**:
Built: picked-folder source (pickedSource in 03a-sources.js, 03c-picked-folder.js), hidden webkitdirectory input used when showDirectoryPicker is missing. Checked with simulated Firefox files in the page: good folder, nested and non-md files ignored, no kanban.md, not a board, write refused. Banner: Read-only, Pick the folder again, Edit with kanbanmd (copies the serve command). Not checked in a real Firefox; drag-and-drop not added.

### TASK-036 | One-line install: npm package, kanbanmd init, project .mcp.json
**Status**: in-progress  
**Priority**: Medium  
**Category**: MCP  
**Created**: 2026-11-07  
**Tags**: #mcp #cli  

Agents fall back to editing kanban.md by hand when the MCP is not configured. Plan: see 'Plan: installer' in firefox-serve-brief.md in the git history. One npm package 'kanbanmd' (check the name is free): bin kanbanmd with commands mcp, serve, init; @modelcontextprotocol/sdk is the only dependency (kept, loaded lazily by 'mcp'). 'npx -y kanbanmd init' (offline, idempotent, --dry-run): default board if missing; merge mcpServers.kanban into project .mcp.json (keep other servers, abort on invalid JSON); copy the skill; marker-delimited use-the-tools block in AGENTS.md and CLAUDE.md. Also 'claude mcp add kanban -- npx -y kanbanmd mcp'. Tests: init cases, npm pack file list, packed tarball runs help, serve and an MCP handshake. Docs: ai-agents.md and README one-liners. Needs the owner's npm account to publish.

**Notes**:
Built, not published. Package @ashikahmad/kanbanmd (scoped), commands mcp / serve / init; init --agent claude,cursor,vscode,gemini,codex,generic|all (asks on a terminal), idempotent, never overwrites what it did not write, --dry-run. SDK is the only dependency (moved to root; mcp/package.json removed). 12 new tests (334 pass); packed tarball installed in an empty project and init, board, serve and an MCP handshake (14 tools) all worked. Docs updated. Left: set repository fields after the repo move (TASK-038), then npm publish by the owner, then check the one-liners from a clean folder. Details: drafts/firefox-serve-brief.md.

### TASK-037 | kanbanmd serve: local service that serves the page and makes any browser read-write
**Status**: in-progress  
**Priority**: Medium  
**Category**: App  
**Created**: 2026-11-07  
**Tags**: #app #cli  

Run 'kanbanmd serve --dir .' (zero-dependency node:http, 127.0.0.1, stable default port 4777 then next free). It serves the bundled kanbanmd.html and a small API, so the page and API always match and Firefox/Safari edit the real folder; agents see the same files. The page uses a new serviceSource (read/version/write over fetch, If-Match etag, same polling/merge as folderSource; SSE push optional).
Access: no handshake dialog (running the command is the consent). Server prints and opens /?t=<one-time token>; it sets an HttpOnly SameSite=Strict cookie and redirects with the token stripped. Check Host and Origin on every request (DNS rebinding, cross-site writes); serve only kanban.md, archive.md and the backlog file; write through the locked, verified io/node-fs.js path.
Hosted app or picked-folder (TASK-035) banner: 'Read-only. To edit, run npx kanbanmd serve in your project' with a copy button; no cross-origin connect from the hosted page for now (optional --allow-origin later). Chromium keeps the folder picker. Builds on TASK-035; complements TASK-004 (browser storage, for users without Node) and TASK-036 (install). Tests: token, bad token, bad Host/Origin, conflict, path whitelist.

**Notes**:
Built: cli/serve.js (node:http, zero deps), 'kanbanmd serve [--port N] [--no-open]', serviceSource + openServiceBoard in the page, banner 'Editing via kanbanmd' / 'kanbanmd stopped'. Auth: key in the printed URL -> HttpOnly SameSite=Strict cookie; Host/Origin checks; X-Kanbanmd header on writes; file whitelist; 5 MB cap; atomic temp+rename; optional If-Match. Tests: test/serve.test.mjs (8). Checked end to end in the browser: page edit reached the file, an agent note reached the page via polling, stopping the service shows the disconnected banner. Not done: SSE push, a hosted-page opt-in (--allow-origin), Windows/Linux open-browser check, a real Firefox run.
Decision: scope stays one folder. No --root project list, no folder browser; one serve per project. Easier to explain and trust.
Menu pass: sources grouped first (Open folder…, Open from a web address…), then board tools, project, app. On a served page the folder item reads 'Open another folder…' and a 'Back to <folder>' item returns to the served board. In browsers without folder editing it reads 'Open folder (read-only)…'. Empty separators hide. German and Chinese strings added for web.*, picked.*, service.*.
Review pass: footer status bar replaces the source banner. Shows the open source and, on a served page, the served board's state (ok / stopped / expired) even while another source is open; a chip returns to the served board; 'Synced hh:mm:ss' on the right. Fixed: ?board= now wins over the served board, 401/403 shows 'Session expired', Firefox served page keeps the read-only label, empty picked folder says so, t() no longer mangles $& in names, service key uses the full path. Skipped: If-Match from the page (needs a per-file version in write()), page-side unit tests.
Refresh pass: the footer's read time on a read-only board is now a button with a trailing refresh icon. A web board is fetched again; a picked folder opens an explainer dialog (choose the same folder again; another folder opens that board). Read-only sources use a text fingerprint as their version, so a refresh toasts 'Board updated' or 'Already up to date' and only redraws on change. The 'Refresh folder…' menu item is gone.

### TASK-038 | Move to a fresh GitHub repo (leave the fork network)
**Status**: done  
**Priority**: Medium  
**Category**: Docs  
**Created**: 2026-11-07  
**Due**: 2026-11-08  
**Finished**: 2026-11-08  
**Tags**: #docs  

Kanban.md has drifted far from ioniks/MarkdownTaskManager and has no PRs of its own open, so replace the GitHub fork with a fresh repo instead of asking Support to detach it. Credit and licence stay in the files (MPL-2.0 LICENSE and notices, README credit line, docs/about-this-fork.md).
Checklist: (1) decide the name (same name keeps the Pages URL and links) and rename or archive the old repo first so the name is free; (2) create the new repo, push all branches and tags with full history (git push --mirror) so commits and authorship stay; (3) recreate settings: Pages source = GitHub Actions, description, topics, branch protection; issues on if wanted; (4) fix the places that name the repo: README, docs, site-src, the source comment and GitHub menu link in the app (PR #11), package metadata, git remote origin; keep the upstream remote locally; (5) old PRs #1 to #11 and their discussion are not carried over, so note the old repo's address in the README or keep it archived; (6) verify the Pages deploy and the hosted app, then archive or delete the old repo. Ask the owner before deleting anything.

**Notes**:
Done 2026-11-08: old repo renamed to ashikahmad/Kanban.md-old and archived (PRs #1-11 stay there); new public ashikahmad/Kanban.md created with master, three unmerged branches, all tags and full history; Pages source = Actions (site live again); dev branch created from master; package.json repository/homepage/bugs set; note added to docs/about-this-fork.md. Not carried over: PRs #1-11, the fork label.

### TASK-039 | AI workflow redesign: one agent guide, auto dates, board folder
**Status**: done  
**Priority**: High  
**Category**: MCP  
**Assigned**: @ashikahmad (Ashik Ahmad)  
**Created**: 2026-11-08  
**Started**: 2026-11-08  
**Finished**: 2026-11-08  

One contract for every agent (kanbanmd guide, also the MCP instructions and the skill), tools first and never hand-edited files; moves set Started and Finished; the board lives in board/ and is found automatically. Replaces AI_WORKFLOW.md and the seven per-assistant templates. Docs: docs/ai-agents.md.

**Notes**:
Result: core/guide.js holds the single contract text (kanbanmd guide, MCP server instructions, skill body; a test keeps the three equal). core/ops.js moveTask sets Started into in-progress and Finished into done, and clears Finished on leaving done (columns matched by role). io/board-dir.js finds board/, then the project folder, then docs/; CLI, mcp and serve use it. init creates board/kanban.md and writes a four-line block. Removed AI_WORKFLOW.md and the seven *.md.exemple files. Audit fixes: server version from package.json, --if-match in --help, get_board_stats description, token numbers. Tested: npm test (344 pass). Not done: the page's own drag and drop does not set Started/Finished yet.

