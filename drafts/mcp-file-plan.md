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

**5.3 Ops.** A closed set of small operations, each pure: `(state, op) -> {state', changes}`. The same set is what the page emits, what the CLI parses and what MCP tools map to. Rules the UI applies today (auto `Started` / `Finished` dates on column moves, defaults like `Created`) are extracted into ops so no front end can differ.

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

## 6. Write protocol

> Diagram: see **Write protocol** in [mcp-file-diagrams.md](mcp-file-diagrams.md#write-protocol).

- **Granularity of conflict.** The lock is per task (`etag`), not per file. Two writers on different tasks both succeed; a same-task race returns `conflict` with the current task so the agent can retry cheaply.
- **Optimistic, not locking.** `ifMatch` is optional. Without it the op applies to the latest content (fine for additive ops like `append_note`).
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
| `move_task` | `status`, optional `before` id; applies the UI's date rules |
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
- File-backed only; no hub, no browser storage.
- Stdio MCP server plus CLI, both thin over one core.
- Surgical patches with a verify step; no whole-file regeneration after migration.
- Page patches the latest file via diff-to-ops.
- Writes to V1 files require the explicit migration first.

**Open**
1. **Tool granularity** (about ten fine-grained tools vs fewer broad ones): start fine-grained, measure, merge if heavy?
2. **Distribution:** script in this repo only, or also an npm package?
3. **Multi-project:** one server per project folder (matches stdio, simplest), or one server over several?
4. **Position semantics:** is "status change keeps file position" an acceptable default for `move_task`, with a block move only when `before` is given? (File order is the rank within a column.)
5. **Dependencies:** the MCP server needs `@modelcontextprotocol/sdk`; the CLI and core can stay dependency-free. OK to depend on the SDK?
6. **Activity log location and format:** `.kanban-activity.jsonl` beside the board, or inside a `.kanban/` folder?

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Locator disagrees with the parser | wrong bytes patched | verify step aborts the write; shared regexes; property tests |
| Core extraction changes output | reformatted boards for current users | golden + byte-diff vs current build; no logic edits while moving code |
| Diff-to-ops in the page misses a change | UI edit not persisted | after write, re-parse and compare to in-memory state; surface a warning and fall back to reload |
| Same-task race between page and agent | lost field edit | per-task etag, `conflict` response, edit-form prompt |
| Two-file archive move interrupted | task in both files | archive-first order; duplicate check on load |
| Polling lag (~2 s) | brief stale view | etag check at save time |
| Too many tools inflate context | eats the savings | start small, measure |
| Agent edits the file by hand anyway | back to unpredictable | still safe: parse guards and per-task patches tolerate it; docs say tools first |
| Windows rename-over-open-file | write fails | retry with backoff |
