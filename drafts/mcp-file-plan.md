# Draft: one board core, surgical file edits, shared by the page, a CLI and an MCP server

Status: **draft / plan only**. Nothing in `src/` has been changed.
Supersedes the scope of [browser-storage-plan.md](browser-storage-plan.md) (browser storage and a WebSocket hub are out of scope now; that file is kept only as a record).

## 1. Goal and principles

A human (in `kanbanmd.html`) and AI agents work on the **same `kanban.md` / `archive.md`**, at the same time, without stepping on each other, and without agents burning tokens on markdown.

1. **One core.** A single module knows how to read the board, validate a change and write it. The page, a CLI and the MCP server are thin front ends over it. They cannot disagree about the format.
2. **Surgical writes.** A change touches only the bytes it must. Moving a card is a one-line diff. Everything else in the file, including hand-written formatting, stays byte-for-byte.
3. **Files stay the source of truth.** Plain Markdown in git, still editable by a human or by an agent with no tooling at all.
4. **Cheap and predictable for agents.** Compact filtered reads, minimal write acknowledgements, validation with fixable errors, server-assigned ids, no silent overwrites.

## 2. Where we are today

| Fact | Consequence |
|---|---|
| Parse and generate are globals in `src/scripts/04-io.js`, `11-generate.js`, `10-archive.js` (the archive writer duplicates the task-emitting loop), tied to `config` / `tasks` / `t()` and noisy `console.log` | cannot be reused outside the page |
| `autoSave()` regenerates the **entire** file from memory on every change (`06-filters.js`) | one card move rewrites ~15 KB; any external edit made while the page is open is overwritten; diffs are noisy after the first normalizing write |
| The file is read once at load, never again | no way to notice an agent's edit |
| An agent loads whole files: `examples/kanban.md` is 15 KB (~3.8k tokens) for 18 tasks, `AI_WORKFLOW.md` + skill add ~4.7k tokens of format rules | cost grows linearly with the board; rules are paid every session |
| `Last Task ID` is hand-incremented | two writers collide |

(Token figures are size ÷ 4 estimates; Phase 3 measures them properly.)

## 3. Requirements

**Must**
- R1. A core library: read (with source positions), validate, patch, verify. No DOM, no `window`, no i18n, no logging.
- R2. Every write is a minimal text patch against the **latest** file content; bytes outside the patch are unchanged.
- R3. The page uses the same core for its writes (so it also stops clobbering outside edits).
- R4. MCP tools and a CLI for read, create, update, move, archive, restore and config changes, over the same core.
- R5. Reads are filterable and field-selectable; defaults are compact.
- R6. Writes validate against the board's own config and return structured, fixable errors.
- R7. Ids are assigned inside the write, never by the caller.
- R8. Atomic, concurrency-safe file writes.
- R9. No format change; output stays valid v2 markdown. No new runtime dependency for `kanbanmd.html`.

**Should**
- R10. `dry_run` returning the exact diff.
- R11. Small activity log so the human can see what an agent changed.
- R12. Works with any stdio MCP client with one line of config.

**Out of scope:** browser/IndexedDB storage, a daemon or WebSocket hub, remote access.

## 4. Architecture

> Diagram: see **Architecture** in [mcp-file-diagrams.md](mcp-file-diagrams.md#architecture).

How it is built: `core/` is plain ES module code. `build.mjs` inlines it into `kanbanmd.html` (the file stays standalone), and the Node side imports it directly.

## 5. The core, layer by layer

**5.1 Read with positions.** `parseBoard(md)` returns today's `{config, tasks}` plus, for each task, a locator: byte span of the block and the line ranges of its parts (header, `Status`, meta line, dates line, tags line, description, subtasks, preserved extras, notes). The locator reuses the existing field regexes so there is one definition of "what a field is". Each task also gets an `etag` (hash of its block text) for optimistic locking.

**5.2 Validate.** `validateTask` / `validateOp` check status against column ids, priority/category/user/tag against config where the app already restricts them, `YYYY-MM-DD` dates, no `##`/`###` in descriptions, unique ids. These replace most of the prose rules in `AI_WORKFLOW.md`. Errors are `{code, message, hint, valid?}`, e.g. `unknown_status` with the list of valid ids.

**5.3 Ops.** A closed set of small operations, each pure: `(state, op) -> {state', changes}`. The same set is what the page emits, what the CLI parses and what MCP tools map to. Rules the UI applies today are extracted into ops so no front end can differ: `Created` defaults to today on create, restoring into a column that no longer exists falls back to the first column. (Phase 2 check: the UI sets `Started` / `Finished` only from the edit form, never on a move, so ops do not invent date rules either.)

**5.4 Patch.** Each op maps to the smallest text edit:

| Op | Bytes touched |
|---|---|
| set status | value on the `**Status**:` line |
| rename title | the `### TASK-n \| title` line |
| set priority / category / assignees | the meta line, rebuilt from its parsed parts; inserted after `Status` if absent |
| set created / started / due / finished | the dates line, same approach |
| set tags | the `**Tags**:` line |
| set description | the region between the metadata and the first of subtasks / extras / notes |
| toggle subtask | the single character in one `- [ ]` line |
| add subtask | one inserted line (creates `**Subtasks**:` if absent) |
| append note | text appended at the end of the block (creates `**Notes**:` if absent) |
| create task | new block appended at end of `## Tasks`, plus the number in `Last Task ID` |
| move to a position | block cut and pasted before the target task (only when a position is requested) |
| archive | block cut from `kanban.md`, **pasted verbatim** into `archive.md` |
| restore | the reverse; the block keeps its original `Status` |
| delete | block cut |
| set config | the single `**Columns**:` / `**Tags**:` / ... line |

Two rules keep diffs small and predictable:
- Anything not named by the op is never re-serialized. Unknown lines, preserved `**Links**` / `**Review**` / `**Dependencies**`, CRLF endings and hand formatting survive.
- A whole block is regenerated **only** for a task the patch cannot express line-wise, and then only that block, using the canonical serializer. A whole-file regenerate never happens after migration.

**5.5 Verify (the safety net).** Before anything is written: parse the patched text and check it equals `applyOp(state, op)`, and that every byte outside the declared patch region is identical. If either check fails the write is aborted and reported as `internal_verify_failed`. This is what lets us trust a locator that is built on regexes.

**5.6 V1 files.** Legacy files (status by section) cannot be patched line-wise. Writes to a V1 file fail with `needs_migration`, and migration stays the existing explicit one-time step (with backup) in the page, or `kanbanmd migrate` in the CLI. After that everything is surgical.

**5.7 Manual ordering: an optional `**Order**` key.** (Added in Phase 2.)

- **The field.** `**Order**: 3000` on a task, right after `**Status**`. It is optional, a non-negative integer, and absent from every board until someone asks for it. Boards without it parse, regenerate and diff exactly as before.
- **Display order.** Within a column, tasks sort by `Order`; tasks without one come after the keyed ones, in file order. With no keys at all this is simply file order. `orderedTasks()` in `core/board.js` is the one definition, used by the CLI, the MCP tools and (Phase 4) the page.
- **Opting in.** The first manual drag in the page asks "remember manual order?". Yes runs `sortTasks { mode: 'positions' }`: one inserted line per task, once, keys spaced by 1000 in the current order. No keeps today's behaviour (a drop relocates the block). Ordering is "on" whenever any task has a key; there is no separate flag in the file.
- **While it is on:** a plain move edits only `**Status**` (the card keeps its key, so it lands in the target column where its key says). `before X` writes a key halfway between X and its predecessor, `atEnd` writes the column's maximum plus 1000: each is a status line plus an `Order` line, never a block move. If two neighbours leave no room, the keys are renumbered evenly (one larger diff, rare). New tasks get the next key, so they still go last. A task added by hand with no key sorts last; the next positional op gives it a key. Archive and restore carry the key with the block.
- **Sorting has two meanings, both explicit** (`sortTasks`): `ids` assigns keys that reflect numeric id order, `positions` assigns keys that reflect the current order (also how ordering is switched on). `clear` removes every key (back to file position). `blocks`, the earlier behaviour, physically reorders blocks by id. The mode is always required: sorting is a file-wide change and is never guessed.
- **Compatibility.** An older copy of the app does not know the field and would show `**Order**: n` as description text. The current core reads it as metadata. Everything else in the format is unchanged.

**5.8 Format v3: one metadata field per line, and migration.** (Added in Phase 2.)

```markdown
### TASK-020 | Add rate limit dashboard
**Status**: in-progress
**Order**: 16000            (optional)
**Priority**: High          (every field below is optional, and independent of the others)
**Category**: Backend
**Assigned**: @bob, @alice
**Created**: 2026-10-21
**Started** / **Due** / **Finished**: YYYY-MM-DD
**Tags**: #api #perf

description lines ...
**Subtasks**: / **Links** / **Review** / **Dependencies** / **Notes**: as before
```

- **Why.** v2 joined priority, category and assignees on one line and the parser read them only as a group, so a priority without a category was silently dropped on save. With one field per line they are independent, a field change is a one-line diff, and the patcher needs one generic "set this labelled line" routine instead of special cases for the meta and dates lines.
- **Reading is tolerant, writing is strict.** The parser reads the metadata lines before a task's first section, one field per line or several joined with ` | `, and gets the same values. The generator and the patcher write only v3. `<!-- Format: v3 -->` marks the file. Priority and category are free text now (`Very High`, `🔴 Critical` are fine).
- **Edits need v3.** On a v1 or v2 file every op fails with `needs_migration`, pointing at `kanbanmd migrate`. Touching a task in a v2 archive does the same; an empty archive is simply stamped v3. A hand-edited joined line inside a v3 file is still handled: that one block is rewritten canonically.
- **Migration** (`core/migrate.js`, `kanbanmd migrate [--dry-run]`, and the page on load). It accepts v1 and v2, rewrites the file canonically, and is refused unless re-parsing the result gives exactly the same tasks and configuration; a file where some `### TASK-` header could not be read is refused outright. Backups `kanban.v<N>-backup.md` / `archive.v<N>-backup.md` are written first and never overwrite an existing backup. The archive keeps its own heading lines verbatim. Line endings are preserved (a mixed-ending file becomes uniform). Hand formatting inside a task (extra blank lines, spacing) is normalized, since the rewrite is canonical.

## 6. Write protocol

> Diagram: see **Write protocol** in [mcp-file-diagrams.md](mcp-file-diagrams.md#write-protocol).

- **Granularity of conflict.** The lock is per task (`etag`), not per file. Two writers on different tasks both succeed; a same-task race returns `conflict` with the current task so the agent can retry cheaply.
- **Two layers, because a hash check alone is not enough.** Writers that go through the shared Node port (CLI, MCP server, any number of processes) take turns with an exclusive lock directory (`.kanban.lock`, created with `mkdir`, broken if stale), so their read-modify-write cycles never interleave. The page cannot take that lock, so before each rename every file that was read is re-read and its hash compared; if a foreign writer moved it, the op is recomputed from the fresh content. A hash check alone was tried first and lost 27 of 36 concurrent creates in the test, because the write and fsync leave a window of milliseconds. Only a foreign write landing between the last check and the rename (microseconds) remains, and `ifMatch` covers callers that need certainty beyond that.
- **`ifMatch` is optional.** Without it the op applies to the latest content (fine for additive ops like `append_note`).
- **Archive moves touch two files.** Write the archive first, then remove from the board. A crash in between leaves the task in both files (visible and removable), never in neither. A startup check reports duplicates.
- **Ids.** `create_task` takes `max(Last Task ID, highest id in board and archive) + 1` inside the same read-patch-write.
- **Atomic write.** Temp file in the same directory + `rename`. On Windows rename can fail while another process holds the file; retry with backoff.

## 7. The page

Goal: the page uses the core without rewriting the 16 `autoSave()` call sites.

1. Keep a `baseTasks` / `baseConfig` snapshot of the last saved state.
2. `autoSave()` diffs current state against the base into ops (field changes, additions, removals, moves; order changes use a longest-increasing-subsequence pass so only displaced cards produce a move).
3. Re-read the file, apply those ops to the **fresh** content through the core, write the patch via the File System Access port, update the base.
4. External changes: poll `lastModified` while visible; re-parse, re-render, keep scroll and any open modal; if the task in the edit form changed, prompt "updated outside: reload fields / keep mine".

Step 3 is what fixes clobbering: the page patches the latest file instead of overwriting it, so agent edits to other tasks survive. Over time individual callers can emit ops directly instead of relying on the diff.

## 8. MCP tools, CLI, and where the tokens go

CLI and MCP expose the same operations. `kanbanmd get-board --status in-progress --assignee @alice` is useful for agents that only have a shell, for CI and for git hooks, and the MCP server is a small wrapper over it.

| Tool | Notes |
|---|---|
| `get_board` | filters (`status`, `assignee`, `tag`, `priority`, `category`, `text`, `due_before`) + `limit` / `offset`; returns config digest, board `rev`, and **summaries** (`id, title, status, priority, assignees, due, tags, etag`) |
| `get_task` | `id`, optional `fields[]` (`description`, `subtasks`, `notes`, `extra`) |
| `get_config` | column ids + names, categories, users, priorities, tags |
| `create_task` | id assigned; `created` defaults to today |
| `update_task` | partial patch; optional `ifMatch` |
| `move_task` | `status`; edits the **Status** line in place (one-line diff). Optional `before` id or `atEnd` relocates the block on request; same column and no position is a no-op |
| `sort_tasks` | `mode`: `ids` / `positions` write `Order` keys (see 5.7), `clear` removes them, `blocks` reorders file blocks by id; **`mode` is required, never defaulted** (it rewrites the file wholesale); `order` asc/desc; no-op if nothing would change |
| `toggle_subtask`, `add_subtask`, `append_note` | tiny writes |
| `archive_task`, `restore_task`, `list_archive` | archive lifecycle |
| `update_config` | add / rename / remove column (explicit target for orphans), categories, users, tags |
| `get_board_stats` | counts per status / assignee, overdue |
| `get_changes_since` | from the activity log, so an agent can refresh cheaply after a human edit |

Every write accepts `dry_run: true` and returns the unified diff instead of writing.

Why this is cheaper than reading files:

| Technique | Effect |
|---|---|
| Summaries instead of blocks (~60-80 bytes vs ~800 per task) | a 100-task board is ~2k tokens instead of ~20k |
| Server-side filters + pagination | "in progress for @alice" returns a few rows |
| Detail only on request (`get_task`, `fields[]`) | no reading the board to see one task |
| Archive never loaded unless asked | archive can be larger than the board |
| Minimal acks `{ok, id, rev, changed}` | no echo of the task after every edit |
| Fine-grained write tools with enum-typed args | a status change is ~20 tokens; format knowledge lives in tool schemas, so `AI_WORKFLOW.md` and most of the skill don't have to be loaded |
| Compact JSON, column **ids** not display names | smaller payloads |

Tension to manage: each tool's schema also costs tokens every session. Start with about ten tools and fold minor ones into `update_task` if the list feels heavy.

## 9. Layout

```
core/                    shared, pure ES module (also inlined into kanbanmd.html)
  read.js  validate.js  ops.js  patch.js  verify.js  serialize.js
cli/
  kanbanmd.js            commands over the core + Node fs port
mcp/
  server.js              stdio MCP, thin wrapper (dep: @modelcontextprotocol/sdk)
  package.json
io/
  node-fs.js             atomic write, hash CAS, activity log
src/                     the page (adapter: diff to ops, FS Access port, polling)
test/                    golden, property and concurrency tests
```

Client config (README):

```json
{ "mcpServers": { "kanban": { "command": "node", "args": ["/path/to/Kanban.md/mcp/server.js", "--dir", "/path/to/project"] } } }
```

`.kanban-activity.jsonl` sits next to the board, bounded in size, gitignored by default.

## 10. Phased plan

> Diagram: see **Phase order** in [mcp-file-diagrams.md](mcp-file-diagrams.md#phase-order).

1. **Core extraction, no behavior change.** Move parse / generate / archive writer into `core/`, build it into the page. Golden round-trip tests on `docs/demo` and `examples`; byte-identical output to the current build for the same actions. Highest regression risk, so first and alone.
2. **Surgical patch layer.** Locators, ops, patch, verify, plus the Node fs port. Drive it from the CLI so it is testable without a UI or MCP.
3. **Read tools** (CLI + MCP). Measure real token use against raw file reads on the example boards.
4. **Page on the core.** Base snapshot, diff-to-ops, apply to fresh content, polling, edit-form conflict prompt. Valuable on its own: it fixes clobbering for any external editor.
5. **Write tools** (CLI + MCP). `ifMatch`, `dry_run`, activity log, concurrency tests.
6. **Docs and polish.** README (EN + FR) "Connect an AI agent", shrink `AI_WORKFLOW.md` and the `markdown-task-manager` skill to "use the tools if present, else these rules", "changed by agent" flash on cards.

Phases 1 and 4 are the only ones that change existing page behavior.

## 11. Testing

- **Golden:** `generate(parse(file)) == file` for the shipped example and demo boards.
- **Untouched-bytes property test:** for random ops on the example boards, diff before/after and assert every changed line belongs to the op's declared region. This is the test that guards "diffs stay reasonable".
- **Format variants:** CRLF files, hand-edited blocks, preserved `**Links**` / `**Review**`, tasks with no optional lines, descriptions containing `**Notes**`-looking text.
- **Concurrency:** two writers on different tasks (both land), same field (one `conflict`), CLI write racing the page's autosave, killed process mid-write (no partial file).
- **Page parity:** the same sequence of actions through the page and through the CLI yields byte-identical files.

## 12. Decisions so far, and what is still open

**Decided**
- Format v3: one metadata field per line, tolerant reading of v1/v2, strict writing, explicit verified migration (5.8).
- Ordering: edits and moves are in place, new tasks are appended last, and manual order is an optional `**Order**` key that the user opts into (5.7).
- File-backed only; no hub, no browser storage.
- Stdio MCP server plus CLI, both thin over one core.
- Surgical patches with a verify step; no whole-file regeneration after migration.
- Page patches the latest file via diff-to-ops.
- Writes to V1 files require the explicit migration first.

**Open**
1. **Tool granularity** (about ten fine-grained tools vs fewer broad ones): start fine-grained, measure, merge if heavy?
2. **Distribution:** script in this repo only, or also an npm package?
3. **Multi-project:** one server per project folder (matches stdio, simplest), or one server over several?
4. **Ordering model: decided** (see 5.7). The page's part is Phase 4: ask on the first manual drag, then a drop onto a card sends `before`, a drop at the bottom of a column sends `atEnd`, and cards render in `orderedTasks()` order.
5. **Dependencies:** the MCP server needs `@modelcontextprotocol/sdk`; the CLI and core can stay dependency-free. OK to depend on the SDK?
6. **Activity log location and format:** `.kanban-activity.jsonl` beside the board, or inside a `.kanban/` folder?

## 11a. Phase 3 results: what the read tools cost

Reads are `get_board`, `get_task`, `get_config`, `list_archive`, `get_board_stats` and `get_changes_since`, available as CLI commands (`board`, `task`, `config`, `archived`, `stats`, `changes`) and as an MCP server (`mcp/server.js`, stdio, official SDK, its own `mcp/package.json` so the core, the CLI and the page stay dependency-free). `npm run measure` reproduces the table below from the real code.

Cost of answering a question: tokens for the call and its result, against reading the whole `kanban.md` (estimate: bytes / 4; Claude's tokenizer counts emoji, accents and non-English text higher per byte, so treat these as relative sizes). The 100-task board is the example board's tasks (long descriptions and notes) cloned.

| Question | demo (1,412 tok raw) | examples (3,763 tok raw) | synthetic (20,297 tok raw) |
|---|---|---|---|
| What is in a column? | ~205 tok (−85%) | ~236 tok (−94%) | ~1,021 tok (−95%) |
| Overdue for one person? | ~172 tok (−88%) | ~145 tok (−96%) | ~585 tok (−97%) |
| Find tasks mentioning a word | ~161 tok (−89%) | ~127 tok (−97%) | ~306 tok (−98%) |
| Read one task in full | ~137 tok (−90%) | ~295 tok (−92%) | ~282 tok (−99%) |
| Counts / how are we doing? | ~145 tok (−90%) | ~149 tok (−96%) | ~607 tok (−97%) |
| List every task (first 50) | ~674 tok (−52%) | ~902 tok (−76%) | ~2,481 tok (−88%) |

Fixed cost per session: the six tool schemas plus the server instructions are about **822 tokens**, against about **4,711 tokens** for the format rules an agent loads today (`AI_WORKFLOW.md` + the skill) that reads no longer need. Writes will still need some guidance, so that second number is the ceiling on what is saved, not a promise.

What keeps it small: summaries instead of blocks, filtering and paging on the server, `fields` to choose columns (id is always kept), empty fields omitted, the archive read only on request, capped overdue and due-soon lists, and short tool descriptions. A test pins the savings (`test/read.test.mjs`), so a change that bloats a response fails the build.

Behavioural notes: `get_board` rows are in display order (manual `Order` keys honoured), carry an `etag` usable as `ifMatch`, and the response carries `rev` (changes with any edit, including the page's). `get_changes_since` only knows edits made through the CLI and the MCP server, so `rev` is the reliable "did anything change?" signal. Reads accept v1/v2 boards (they only report `migrationNeeded`); only writes require v3.

## 12a. What Phase 2 found

- **The meta line was all or nothing** (fixed by format v3, see 5.8). In v2, `**Priority**` / `**Category**` / `**Assigned**` shared one line and the parser only read them as a group, so a priority without a category was lost on save, in the page too. Ops used to reject that combination (`meta_incomplete`); with one field per line the restriction is gone.
- **Mixed line endings exist in the wild.** `examples/kanban.md` (migrated by the app) has 152 CRLF lines among 505. The parser keeps CRLF inside notes and preserved sections but trims it in descriptions. Blocks therefore move verbatim, and are re-terminated only when the destination file is uniformly the other style.
- **A hash check is not a lock.** See section 6: concurrent processes lost updates until writers were serialized.
- **The fallback path is rare.** Across 2,400 random ops on four fixtures the one-block regeneration never fired; it exists for layouts like dates on separate lines, metadata inside a description, or two Subtasks sections, and has its own targeted tests.
- **Priority values** are the cleaned config entries (`🔴 Critical` is stored as `Critical`); with v3 they may be several words.

## 12b. Keeping the working file small (proposal, not built)

**Does size matter? Measured.** Synthetic boards cloned from the example tasks (about 800 bytes per task):

| Tasks | File | Raw read for an agent | `get_board` page (50) | read: parse + list | one edit (patch + verify) | page: render all cards |
|---|---|---|---|---|---|---|
| 100 | 78 KB | ~20k tok | ~2.4k tok | 1 ms | 2 ms | 6 ms |
| 1,000 | 775 KB | ~198k tok | ~2.4k tok | 11 ms | 19 ms | 103 ms (23k DOM nodes) |
| 5,000 | 3.9 MB | ~993k tok | ~2.4k tok | 54 ms | 100 ms | (3,000 tasks: 268 ms per render, 69k nodes) |

So size does not hurt an agent that uses the tools (flat cost, milliseconds even at 5,000). It hurts: an agent that reads the file raw anyway (a 1,000-task file does not fit in a context), the page beyond roughly 1,000 tasks (it rebuilds every card on each change and filter keystroke), git diffs and merges, and a human scrolling a long file. Nudging is therefore about hygiene and the fallback path, not tool-path performance.

**1. Housekeeping nudges (cheap, recommended).** One optional config line, thresholds editable by hand, in the page, or by `update_config`:

```
**Housekeeping**: done=done after=30d | backlog=backlog after=90d | max=200
```

- *done*: tasks in the named column whose `Finished` date is older than N days (undated done tasks are counted separately, since a task has no timestamp to age).
- *backlog*: tasks in the named column created more than N days ago, or past their due date by that long.
- *max*: warn when the board holds more than N tasks.
- Nudge only, never automatic. Delivery: a `housekeeping` block in `get_board_stats` and `get_config` (present only when something is over a threshold, so it costs nothing otherwise); `kanbanmd housekeeping [--apply]`; a dismissible banner in the page with Archive / Snooze 7 days / Dismiss (snooze kept in localStorage per project); the server instructions tell an agent to mention it to the user, not to act.
- Needs one write op: bulk archive (`archiveTasks { ids }` or `{ column, olderThanDays }`) so a clean-up is one verified edit and one diff, with `dry_run` as usual. (Belongs with the Phase 5 write tools.)

**2. A separate backlog file (opt-in, larger).** Treat `backlog.md` as a second side store next to `archive.md`: same v3 block format, same verified ops, ids still unique across all files.

- Config: `**Backlog file**: backlog.md` plus the column it holds. Moving a task into that column writes it to `backlog.md`; moving it out brings it back. Same status, same `Order` keys.
- Reads: `get_board` is unchanged (it lists the main file); `list_backlog` filters and pages the backlog; `get_task` finds a task in any file; stats count all three.
- Page: the backlog column becomes a count that opens a Backlog panel (search, promote), the way Archives works today. Rendering a lazily loaded column in the board itself is possible but is a separate, larger piece of work.
- Cost: every op that locates a task, allocates an id or sorts has to know a third file; migration and the activity log cover it too. Worth it only for boards whose backlog is in the hundreds; most boards are served by nudge 1 plus archiving.

**Suggested order:** Phase 4 (page on the core), Phase 5 (write tools, with bulk archive and `housekeeping`), then the backlog file as its own phase, built only if it is wanted after the nudges have been used.

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A migration changes meaning | Silent data change in someone's board | read-back equality required, unreadable blocks refuse the file, backups never overwritten, `--dry-run` diff |
| Locator disagrees with the parser | wrong bytes patched | verify step aborts the write; shared regexes; property tests |
| Core extraction changes output | reformatted boards for current users | golden + byte-diff vs current build; no logic edits while moving code |
| Diff-to-ops in the page misses a change | UI edit not persisted | after write, re-parse and compare to in-memory state; surface a warning and fall back to reload |
| Same-task race between page and agent | lost field edit | per-task etag, `conflict` response, edit-form prompt |
| Two-file archive move interrupted | task in both files | archive-first order; duplicate check on load |
| Polling lag (~2 s) | brief stale view | etag check at save time |
| Too many tools inflate context | eats the savings | start small, measure |
| Agent edits the file by hand anyway | back to unpredictable | still safe: parse guards and per-task patches tolerate it; docs say tools first |
| Windows rename-over-open-file | write fails | retry with backoff |

## 14. Progress log (steps executed after the plan was agreed; scope reviewed after each)

**Step 1: bundle the whole core into the page.** `build.mjs` bundles `core/index.js` with esbuild (dev dependency only) into one `KanbanCore` namespace; only an explicit list of names is bound as page globals (the page already owns names like `dueStatus`). `test/tools/page-harness.js` is a fake in-memory project folder (with modification times and an "external writer") for checking the page from the browser pane. Verified: all 7 fixture boards migrate through the page to output identical to the goldens. *Scope review:* the page grew from 122 KB to 158 KB; the entry will be trimmed to what the page uses once the later steps settle. No change to the plan.

**Step 2: diff-to-ops (`core/changes.js`).** `diffToOps(base, next)` turns "the page's state differs from the last saved state" into ops (delete, archive, restore, setColumns with a `reassign` map, updateTask with only the changed fields, createTask, setConfigList); `applyOps(ws, ops)` applies them to the file texts as they are NOW and returns the files to write in a safe order (archive first when anything is archived). Anything it cannot express (preserved sections, board title, a task created and archived within one save) is reported in `unsupported` so the caller can fall back. Verified by 12 seeds of 40 random UI-style edits each reading back exactly as intended, plus a test that an edit made elsewhere in the meantime survives and that a created task whose id was taken meanwhile gets the next free id. *Scope review:* the property test found and fixed two real column-edit cases (a deleted column's tasks reading back in the first column; tasks leaving a removed column to different places in one save). `setColumns` no longer refuses an orphaned *archived* task, since archived tasks may keep an old column id. Ordering is deliberately not diffed: reordering is always an explicit positional op (steps 3 and 4). No change to the plan.

**Step 3: the page saves through ops and watches the files** (`src/scripts/04a-persist.js`). Saving diffs the page's state against the state at the last load/save (`diffToOps`) and applies the ops to the files as they are *now*, so a one-card edit is a one-card diff and an agent's concurrent edit to another task is never overwritten. A save in flight never overwrites edits made meanwhile (the in-memory state is only replaced if it still equals what the save started from). If the ops cannot apply: when the files are unchanged since the base it falls back to the old whole-file write, otherwise it loads the disk version and says why. Drag and drop is an explicit `moveTask` op (before / atEnd). The page polls modification times every 2 s while visible, re-renders on outside changes, keeps scroll, refreshes an open detail view, and asks before replacing an open edit form whose task changed. Verified by `test/tools/page-checks.js` (14 behavioural checks against the fake folder, run in the browser pane): minimal diffs, outside-edit pickup, merge of my edit with an outside edit, id collision on create, drag and drop surviving an outside edit, archive ordering, edit during an in-flight save, column edits, v2-on-disk fallback, unsupported-change fallback, edit-form prompt, first archive creation, and the real form submit. *Scope review:* two latent bugs fixed on the way (an archive file handle from a previous project could be written to; opening the archive reloaded it behind the save logic's back). Not verifiable here: the real File System Access picker needs a user gesture, so the harness stands in for it; a manual pass in Chrome is on the final checklist. No change to the plan; the page is now 167 KB.

**Step 4: manual order in the page** (`src/scripts/08a-ordering.js`, `moveTask` in `08-board.js`). Cards render in `orderedTasks()` order. On a board with no `Order` keys the first drop asks once ("Remember the order of your cards?"): yes runs `sortTasks positions` and then the move (every later drop is a two-line diff, no block moves); no relocates the block as before. The answer is remembered per project (localStorage) and a drop that would change nothing neither asks nor writes. The "more" menu gets "Manual order: on/off" (turning it off asks, then removes every key) and, while on, "Reset order by task id". Outside changes to keys re-render in the new order. Verified by 5 more browser checks (19 in total) plus a look at the menu. *Scope review:* the two sort meanings you described map to: "reset to id order" = the menu item, "re-assign keys by file position" = turning ordering on (positions) after turning it off (clear); a dedicated "renumber" item is not needed because gaps are renumbered automatically when a drop finds no room. The prompt uses the browser's native confirm, like the rest of the app. No change to the plan.
