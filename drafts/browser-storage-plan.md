# Draft: browser-storage mode + MCP for human/AI collaboration

Status: **draft / plan only**. Nothing in `src/` has been changed.
Branch it was written on: `redesign`.

## 1. Goal

Today the board only works if the user picks a folder and the app reads and writes `kanban.md` / `archive.md` through the File System Access API (Chromium only). The idea is a second storage option: keep the board inside the browser (origin storage) and serve it from there, with no folder, no permission prompts, and a working app in Firefox and Safari.

The file mode stays. Browser mode is an additional backend, chosen per project.

The tool is used by a human and AI agents **at the same time**, so whichever storage is used, agents must be able to connect through an **MCP server** (section 5A). That adds a local hub process and a concurrency model, and it reorders the phases.

## 2. How it works today (what I found)

Persistence is spread over a handful of places, all reaching straight for file handles:

| Concern | Where | What it does |
|---|---|---|
| State | `01-state.js` | globals `directoryHandle`, `kanbanFileHandle`, `archiveFileHandle`, `currentKanbanContent` |
| Read board | `04-io.js` `loadKanbanFile()` | `getFileHandle('kanban.md')` → `file.text()` → `parseMarkdown()`; creates default files on `NotFoundError`; V1→V2 migration |
| Write board | `06-filters.js` `autoSave()` | `generateMarkdown()` → `createWritable()`; called from 16 sites |
| Read archive | `10-archive.js` `loadArchive()` | `getFileHandle('archive.md')` → `parseTaskBlocks()`; V2 migration |
| Write archive | `10-archive.js` `saveArchive()` | builds markdown inline → `createWritable()` |
| Backups | `04-io.js` `backupOriginal()` | writes `*.v1-backup.md` next to the originals |
| Project list | `03-storage.js` | IndexedDB `TaskManagerDB/settings/recentProjects` holds **directory handles** + custom name; switch / rename / delete / restore-on-load; permission re-verify |
| Entry UI | `index.html`, `13-toolbar.js`, `03-storage.js` | "Folder" menu item → `showDirectoryPicker()`; welcome screen copy in `02-i18n.js` |
| Support gate | `02-i18n.js:1147` | `alert()` if `showDirectoryPicker` is missing |

Two facts make this cheap to extend:

1. **The markdown text is the single serialization boundary.** `parseMarkdown(string)` and `generateMarkdown()` / `saveArchive()` already convert between app state and a string. Nothing downstream cares where the string came from.
2. **IndexedDB is already used** (`TaskManagerDB`), and localStorage is already used for theme and language.

So the real seam is only ~6 functions, not the whole app.

## 3. Requirements

### Must
- R1. Create, edit, move, archive and restore tasks with no folder selected; data survives reload and browser restart.
- R2. Multiple projects, same as today (list, switch, rename, delete, custom name).
- R3. File mode keeps working unchanged. Existing users' stored directory handles stay valid.
- R4. **No data loss path**: a board that only lives in browser storage must be easy to back up and impossible to wipe by accident.
- R5. Same parser/generator, so a board is byte-compatible between the two modes.

### Should
- R6. Works in Firefox and Safari (no File System Access dependency in browser mode).
- R7. Import `kanban.md` (+ optional `archive.md`) into a browser project; export a project back to `.md` files.
- R8. Warn when the same project is open in two tabs.
- R9. Ask the browser for persistent storage.

### Must (added: human and AI work on the same board at the same time)
- R10. An AI agent can read and change the board through an **MCP server**, in **both** file mode and browser mode.
- R11. A human and an agent can edit simultaneously without silently overwriting each other (see section 5A).
- R12. The human sees agent changes live (no manual reload), and can tell what the agent changed.
- R13. The MCP server is local-only and not reachable by arbitrary websites.

Constraint that shapes everything: **an MCP server is a separate process and cannot read the page's IndexedDB.** Today's `AI_WORKFLOW.md` flow works only because the agent edits `kanban.md` on disk. So browser mode needs a bridge, and both modes need a safe way to handle concurrent writers (today the app loads once and then overwrites the whole file from memory, so an agent edit made while the page is open would be lost on the next autosave).

## 4. Decision: where to store it

The request says "local storage". Recommendation: **use IndexedDB, not `localStorage`**, and hide the choice behind the adapter so it can be swapped.

| | localStorage | IndexedDB (recommended) |
|---|---|---|
| Quota | ~5 MB per origin, string only | hundreds of MB+, structured |
| API | sync, blocks main thread on every autosave | async |
| Already in repo | theme/language only | yes (`TaskManagerDB`) |
| Multi-project | needs key juggling | one store, key per project |
| Cross-tab | `storage` event | needs `BroadcastChannel` (trivial) |

Boards here are ~100 KB of markdown, so localStorage would physically work. IndexedDB is still the better home because writes are async, quota is not a worry, and the code already exists. Both are equally wiped by "Clear site data", so neither is safer for durability; durability comes from export (section 6).

**What to store: the two markdown strings**, not parsed JSON. That keeps R5 (one parser, one generator), makes import/export a copy, and avoids a second schema to migrate.

## 5. Design

### 5.1 Storage adapter (the seam)

New file `src/scripts/03a-backends.js`. One interface, two implementations:

```
Backend {
  kind: 'fs' | 'browser'
  readBoard():   Promise<string | null>    // null = not found
  writeBoard(md): Promise<void>
  readArchive(): Promise<string | null>
  writeArchive(md): Promise<void>
  writeBackup(name, md): Promise<boolean>  // for the V1 migration guard
  exportFiles():  Promise<{ 'kanban.md': string, 'archive.md': string }>
}
```

- `FsBackend(dirHandle)`: today's `getFileHandle` / `createWritable` code moved verbatim.
- `BrowserBackend(projectId)`: reads and writes IndexedDB.

`state` gets one variable, `backend`, replacing `directoryHandle` / `kanbanFileHandle` / `archiveFileHandle` as the thing the load/save code talks to. `currentKanbanContent` stays.

### 5.2 IndexedDB layout

Reuse `TaskManagerDB` and bump `DB_VERSION` 2 → 3. Add one object store `boards`.

```
boards:  key = projectId (string, uuid)
  { kanban: string, archive: string, backups: { 'kanban.v1-backup.md': string, ... }, updatedAt: number, rev: number }

settings/recentProjects (existing): array of project records, now with a discriminator
  FS record      (unchanged): { name, customName, lastAccessed, handle }
  Browser record (new)      : { name, customName, lastAccessed, backend: 'browser', projectId }
```

Records without `backend` are treated as `'fs'`, so existing users migrate with zero work. `onupgradeneeded` only adds the store; it never touches `settings`.

Matching on `p.name === directoryHandle.name` (used in rename/delete/save) is fragile once browser projects exist, because two browser projects can share a name. Switch these to a stable key (`projectId` for browser, `name` for fs).

### 5.3 Call-site changes

| File | Change |
|---|---|
| `01-state.js` | add `backend`, `currentProject`; keep handles private to `FsBackend` |
| `04-io.js` `loadKanbanFile` | `content = await backend.readBoard()`; `null` → create defaults via `backend.writeBoard/writeArchive`. Parse and V1 migration logic untouched |
| `04-io.js` `backupOriginal` | delegates to `backend.writeBackup` |
| `06-filters.js` `autoSave` | `await backend.writeBoard(generateMarkdown())` |
| `10-archive.js` `loadArchive/saveArchive` | `backend.readArchive/writeArchive`; split the inline markdown builder into `generateArchiveMarkdown()` so export can reuse it |
| `03-storage.js` | project CRUD becomes backend-aware; add `createBrowserProject(name)`; `switchProject` / `tryRestorePreviousDirectory` branch on `backend` (browser projects skip `verifyPermission`, they never expire) |
| `02-i18n.js:1147` | the unsupported-browser `alert` only fires if the user tries file mode; browser mode never needs it |
| `index.html` / welcome screen | two entry points (section 5.4) |

The 16 `autoSave()` callers do not change.

### 5.4 UI

- **Welcome screen**: two cards. "Work in this browser" (primary, instant, no prompt) and "Open a folder" (existing). On Firefox/Safari the folder card is disabled with a one-line explanation.
- **More menu**: "Folder" becomes "Open folder…"; add "New browser project", "Import .md…", "Export .md…".
- **Project selector**: browser projects get a small badge (e.g. a browser icon vs. the folder glyph already used).
- **Banner on browser projects**: "Stored in this browser only. Export regularly." with an Export action. Dismissible per project.
- New i18n keys in all languages (the file has ~1150 lines, so budget for it; fall back to English for any not translated).

### 5.5 Safety and durability (R4, R8, R9)

- Call `navigator.storage.persist()` on first browser project creation, `navigator.storage.estimate()` to show usage.
- **Export** = download `kanban.md` and `archive.md` (zip is optional; two files via a single multi-download is awkward, so start with a combined "Export" that downloads both sequentially, add zip later if wanted).
- **Import** = file input accepting `.md`; run the existing parse-total-guard (`tasks.length === blockCount`) before accepting, so a malformed file never silently replaces a board. Always create a rolling backup entry first.
- **Rolling snapshots**: keep the last N (say 10) board snapshots in `boards.backups`, written at most once per few minutes. Cheap insurance against bugs in the app itself.
- **Two tabs**: `BroadcastChannel('kanbanmd:'+projectId)` announces writes. On receiving one, the other tab shows "Updated in another tab, reload" and goes read-only. Optimistic `rev` check on write prevents lost updates if the message is missed.
- **Eviction**: Safari can purge script-writable storage after 7 days without interaction when not installed/persisted. Surface that risk in the banner copy for Safari, rely on `persist()` where granted.

### 5.6 Optional later: bridge to files

Not for the first pass, but the adapter makes it possible: a "Link to folder" action that copies a browser project into a chosen directory and flips the project to `FsBackend`, and the reverse ("Move into browser"). That would resolve the AI-workflow gap without a hybrid sync engine.

## 5A. Human + AI at the same time (MCP)

### 5A.1 Architecture: one local hub

```
 Claude Code / Desktop / other MCP clients
          |  MCP (Streamable HTTP  http://127.0.0.1:PORT/mcp,
          |       or  `kanbanmd-mcp --stdio` shim that forwards to the hub)
          v
   +-------------- kanbanmd hub (Node, optional, separate from the HTML) -------------+
   |  board ops (shared core)   rev counter   event log   WebSocket to the page(s)    |
   +--------------------------------------------------------------------------------+
          |  file mode: reads/writes kanban.md + archive.md in the project folder
          |  browser mode: relays ops to the open tab, keeps a mirror snapshot
          v
   kanbanmd.html (the UI; talks to the hub when it is running, works standalone when not)
```

Why a hub rather than "the MCP server just edits the file":
- Several agents may be connected at once; with stdio each client spawns its own process, so a **single long-running hub** is the one place that orders writes. The stdio shim only forwards to it (and starts it if needed).
- It is the only way an agent can reach browser-mode data.
- It can push change events to the page, which a bare file edit cannot.

The HTML stays a single dependency-free file and still works with no hub (R3 holds). The hub is opt-in and lives in its own folder (e.g. `mcp/`) with its own `package.json`, so the "no runtime dependencies" property of `kanbanmd.html` is not touched.

### 5A.2 Who is the source of truth

| Mode | Source of truth | Agent write path | Agent works when tab is closed? |
|---|---|---|---|
| File | the `.md` files | hub parses, applies op, writes file | yes |
| Browser | the tab's IndexedDB | hub forwards op to the tab over WebSocket, tab applies and saves | **reads yes (mirror), writes no** |
| Browser + "Sync to file" (later) | files in a chosen folder | same as file mode | yes |

Honest limitation: with browser-only storage there is no durable thing an agent can write to once the tab is closed. The mirror lets agents *read* a last-known snapshot; writes return a clear "open the board in a browser tab" error rather than queueing and surprising the user later. If agents need to work unattended, that project should be a file project (or use the later "Link to folder" move). This is the key trade-off to confirm in section 9.

### 5A.3 Shared core (prerequisite)

Parsing and generating currently live as globals inside `src/scripts/*.js` and depend on `config`/`tasks` globals and `t()`. The hub needs the exact same logic or it will drift and corrupt boards. Extract a pure module:

- `core/board.js`: `parseBoard(md)`, `parseArchive(md)`, `generateBoard(state)`, `generateArchive(state)`, and an `applyOp(state, op)` reducer. No DOM, no `window`, no i18n (archive title strings passed in).
- `build.mjs` inlines it into `kanbanmd.html`; the hub imports it directly.
- Guard with golden tests: parse then generate must reproduce `docs/demo/kanban.md` and `examples/kanban.md` task-for-task.

### 5A.4 Concurrency model

Problems to solve:
1. **Lost updates.** Page autosave rewrites the whole file from memory.
2. **ID collisions.** `Last Task ID` is read once; human and agent can both mint `TASK-028`.
3. **Edit conflicts.** Human has task X open in the edit form while the agent changes X.

Design:
- Every board carries a monotonically increasing **`rev`** (hub/IndexedDB metadata; for files, derived from file mtime+size plus a hash, since the markdown format is not changed).
- All mutations are **operations**, not whole-file writes: `createTask`, `updateTask(id, patch)`, `moveTask`, `archiveTask`, `restoreTask`, `toggleSubtask`, `appendNote`, `updateConfig`. The page's existing code keeps mutating in-memory arrays; the adapter diffs against the last-saved base and sends ops (or, simplest first cut, does a **task-level three-way merge**: base = last saved, mine = in-memory, theirs = current on disk/hub; merge by task id, per-field when both sides changed the same task).
- **ID allocation is done by the authority** (hub, or the page's own write transaction in browser mode), never client-side.
- Page learns about outside changes via hub WebSocket push (or, with no hub, polling file `lastModified` every ~2s while visible). On change: re-parse, re-render, keep scroll and open modals.
- **Edit-form conflict**: if the task open in the form changed underneath, show "Updated by agent. Reload fields / keep mine" instead of overwriting.
- **Attribution**: each op carries an `actor` (`human` or the MCP client name). The hub keeps a bounded **event log**; the UI flashes recently changed cards and shows an "Agent activity" list. Attribution is *not* written into the markdown (format stays v2 and stays human/AI-readable); optional later: a `**Updated**` field.

### 5A.5 MCP surface

Tools (all return compact JSON; list calls are paginated/filterable to keep agent context small):

| Tool | Purpose |
|---|---|
| `list_projects`, `select_project` | multiple projects; default to the one open in the UI |
| `get_board` | config (columns, categories, users, priorities, tags) + task summaries, filterable by status/assignee/tag/priority/text |
| `get_task` | full task incl. subtasks and notes |
| `create_task` | fields per v2 format; server assigns id |
| `update_task` | partial patch; takes optional `expectedRev` for optimistic locking |
| `move_task` | change status (and optionally position) |
| `toggle_subtask`, `add_subtask` | common cheap edits |
| `append_note` | add to Notes without rewriting the task |
| `archive_task`, `restore_task`, `list_archive` | archive lifecycle |
| `update_config` | columns, categories, users, tags |
| `export_markdown` | return the v2 markdown for the board |

Resources: `kanban://<project>/board`, `kanban://<project>/task/<id>`, `kanban://<project>/archive` (read-only, so clients can attach context). Prompts: optional `plan-sprint`, `triage-backlog`.

Validation lives in the shared core: unknown column id, bad date, duplicate id, etc. return a structured error the agent can correct from. This replaces the prose rules in `AI_WORKFLOW.md` with something enforced, and the markdown-task-manager skill can be updated to prefer MCP tools when available and fall back to direct file edits otherwise.

### 5A.6 Security (R13)

A local HTTP/WebSocket server is reachable by any web page the user visits (CSRF, DNS rebinding), so:
- bind to `127.0.0.1` only;
- require a random per-install **token** (in the MCP client config for agents; handed to the page via a `#token=` URL fragment or a one-time pairing prompt, never in a query string);
- reject requests whose `Origin`/`Host` are not the expected local ones;
- no filesystem access outside registered project folders; resolve and verify paths;
- the page is an `Origin: null` / `file://` client in the common case, so the pairing step is the real authentication.

Known browser wrinkle to verify early: an `https://` page cannot open `ws://localhost` (mixed content, and Chrome's Private Network Access prompts). A `file://` or `http://localhost` page is fine. If the app is later hosted on https, the hub should serve the UI itself at `http://127.0.0.1:PORT/` (cheap to add, and then storage origin is stable too, which also helps the IndexedDB `file://` question).

### 5A.7 Optional: WebMCP

Browsers are starting to expose a page-level tool registration API (`navigator.modelContext`) so in-browser agents can call tools a page declares. That would let an agent *inside the browser* drive the tab directly with no hub. It is an emerging API and I have not verified current support, so it is a possible later add-on behind the same op layer, not something to build on.

## 6. Phased plan

**Phase 0: separate draft (this doc).** Decide the open questions in section 9.

**Phase 1: shared core + adapter, no behavior change.**
Extract `core/board.js` (5A.3) and introduce `FsBackend`; route `loadKanbanFile` / `autoSave` / `loadArchive` / `saveArchive` / `backupOriginal` through it. Check: demo and example boards load, edit, archive and V1-migrate identically; generated `kanban.md` is byte-identical to the current build for the same actions. Golden round-trip tests.

**Phase 2: `BrowserBackend` + project plumbing.**
IndexedDB v3 migration, `createBrowserProject`, backend-aware project list/switch/rename/delete/restore. Verify `file://` persistence first.

**Phase 3: UI.**
Welcome cards, menu items, badge, banner, i18n keys.

**Phase 4: import / export + safety.**
Import with total-parse guard, export, `persist()`, usage display, snapshots, cross-tab guard.

**Phase 5: concurrency in the page (useful with or without MCP).**
`rev` + three-way merge, authority-assigned ids, external-change detection (poll `lastModified` in file mode), live re-render, edit-form conflict prompt. This also fixes the existing risk that an external edit to `kanban.md` is clobbered by the next autosave.

**Phase 6: hub + MCP for file projects.**
`mcp/` package: Streamable HTTP MCP endpoint, stdio shim, token auth, tools from 5A.5 on top of the shared core, WebSocket push to the page, event log and "agent activity" UI. Update `AI_WORKFLOW.md` and the skill.

**Phase 7: MCP for browser projects.**
Page registers its project with the hub over WebSocket, executes forwarded ops against its own state, pushes mirror snapshots. Clear errors when no tab is open.

**Phase 8: polish and docs.**
README (EN + FR): the storage modes, when to use which, how to connect an agent (copy-paste MCP config), screenshots.

Each phase is a separate commit. Phases 1 and 5 touch existing behavior and get the heaviest testing. Phases 1 to 4 are the browser-storage feature; 5 to 7 are the human+AI feature. They can ship separately.

## 7. How to build it "as a draft"

- Work on a new branch off `redesign` (suggest `draft/browser-storage`), keeping the current uncommitted example-file changes out of it.
- `build.mjs` writes `kanbanmd.html` at the repo root. For the draft, add an `--out` option (e.g. `npm run build:draft` → `drafts/kanbanmd.browser.html`) so the draft build can sit next to the stable one and be opened side by side without overwriting it.

## 8. Test plan

No test suite exists, so verification is manual plus a small Node harness for the pure parts.

- **Round trip**: for `docs/demo/kanban.md` and `examples/kanban.md`, import → edit → export; exported file re-parses to an identical task list. Same assertion between file mode and browser mode.
- **Adapter contract**: one script run against both backends (in-memory fake for FS) asserting read-after-write, null-on-missing, backup-once semantics.
- **Migration**: open with an existing file-mode user's stored `recentProjects` (v2 DB) and confirm nothing is lost after the v3 upgrade.
- **Browser matrix**: Chrome (both modes), Firefox and Safari (browser mode only).
- **Failure cases**: quota exceeded, IndexedDB blocked (private window), second tab open, import of a malformed file, "Clear site data" (expect the banner and export to be the recovery path).
- **File opened from `file://`**: confirm IndexedDB persists for the page as opened from disk. This is the primary way people open `kanbanmd.html`, and storage origin behavior for `file://` differs between browsers, so this needs to be checked early in Phase 2 rather than assumed.

## 9. Open questions for you

1. **IndexedDB vs literal localStorage.** Fine to go with IndexedDB (recommended), or do you want localStorage specifically?
2. **Browser mode + agents when the tab is closed.** Plan says: agents can read a mirror but not write, and get a clear error. Acceptable? The alternative is a hub-owned store (hub becomes the authority and persists to its own folder), but that is really file mode with the hub as the owner, and the browser would become a thin client.
3. **Is a Node hub acceptable?** Agents cannot reach browser data without a local process. It stays optional and outside the single-file HTML, but it is a new thing to install and run. Alternative with no install: file mode only, agents edit files directly, and the page polls for changes (Phase 5 only).
4. **Agent attribution.** UI-only (event log, not in the markdown), or also persisted in the markdown?
5. **MCP transport defaults.** Streamable HTTP as the primary, stdio shim for clients that only spawn commands. OK?
6. **Scope of first cut.** Phases 1 to 4 (browser storage) first, or start with 1, 5, 6 (human+AI on files) since that serves your stated use case sooner?
7. **Languages.** Translate new strings into every language in `02-i18n.js` now, or English + French first and fall back for the rest?
8. **Default for new users.** Welcome screen shows both options equally, or browser mode as the highlighted default?

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| User clears site data / browser evicts storage | Total loss of a browser-only board | `persist()`, banner, export, rolling snapshots |
| Phase 1 refactor subtly changes file-mode writes | Regression for current users | byte-diff check on generated output; no logic edits during extraction |
| Name-based project matching collides | Wrong project renamed/deleted | stable project keys |
| `file://` storage quirks | Data not persisting for the main usage pattern | verify first in Phase 2 |
| Two tabs overwrite each other | Lost edits | BroadcastChannel + `rev` check |
| Human and agent edit the same task | Silent overwrite either way | `rev`, task-level three-way merge, edit-form conflict prompt |
| Parser logic duplicated in hub and page | Hub corrupts boards the page can read | one shared core module, golden tests |
| Local server reachable by websites | Any site could read or alter boards | 127.0.0.1 bind, token, Origin/Host checks, path confinement |
| Agent writes while tab is closed (browser mode) | Confusing or lost writes | reject with explicit error; offer file project / link to folder |
| Auto-save diffing bugs generate wrong ops | Corrupted board | start with whole-board three-way merge by task id; add snapshots before applying any external change |
| i18n volume | Slow, noisy diff | English/French first, fallback for the rest |
