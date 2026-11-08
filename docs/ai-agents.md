# Working with AI agents

Kanban.md is built so a person and an AI agent can use the same board at the same time. You work in the browser; the agent works on the same files; each sees the other's changes within a couple of seconds.

Agents work on the board through tools, not by editing the Markdown. Editing the files costs tokens (the whole file on every read), invites formatting mistakes, and can overwrite what you are doing. The **MCP server** and the **`kanbanmd` CLI** avoid all three: they read only what is asked, validate every change, and write minimal patches that merge with your concurrent edits. There is one set of rules for every agent (`kanbanmd guide`), so there are no separate instructions or templates per assistant.

## The workflow

The board lives in its own `board/` folder at the project root (`kanban.md`, `archive.md`, `backlog.md`, with nothing else in it). The tools find it by themselves: the folder given with `--dir` or `KANBANMD_DIR`, else `board/`, else a `kanban.md` in the project folder, else `docs/`.

1. **Create the task first.** A clear title, a short description that says what "done" means, links to related docs. Big work is split into subtasks. What an agent notices on the way becomes a new task, not extra scope.
2. **Move it to in-progress when work starts.** `Started` is set for you. Subtasks are ticked as work goes on, and notes record decisions and where work stopped.
3. **Finish with a Result note, then move it to done.** `Finished` is set for you; moving a task back out of done clears it.
4. **Commit with the task id in the message and the board change in the same commit.** Move the task to done before committing, so one commit holds the code and its record. A forgotten update can go in a follow-up commit. Agents commit only when asked.
5. **Lasting knowledge belongs in the docs**, not in tasks: specs, decisions, how-tos. The task links the doc and the doc names the task id.

At the start of a session an agent looks at the in-progress tasks and the ones assigned to it, and continues those before taking something new. It never archives, deletes, sorts or reorders unasked; when `get_board_stats` suggests housekeeping, it tells you.

`kanbanmd guide` prints these rules (about 500 tokens). MCP clients also receive them from the server, and `init` adds a short pointer to them in the project's instruction file.

## Set up the agents

One command, run in your project folder, sets everything up:

```bash
npx -y @ashikahmad/kanbanmd init                      # asks which agents (Enter = Claude Code)
npx -y @ashikahmad/kanbanmd init --agent claude,cursor
npx -y @ashikahmad/kanbanmd init --dry-run --agent all   # preview, writes nothing
```

From a clone of this repository, use `node /path/to/Kanban.md/cli/kanbanmd.js init` instead (run `npm install` in the clone once; the MCP SDK is its only dependency).

`--agent` takes a comma-separated list of `claude`, `cursor`, `vscode`, `gemini`, `codex`, `generic` or `all`. Per agent, `init` writes:

| Agent | MCP server entry | Instruction block | Also |
|---|---|---|---|
| `claude` | `.mcp.json` | `CLAUDE.md` | the skill in `.claude/skills/` (the same rules) |
| `cursor` | `.cursor/mcp.json` | `AGENTS.md` | |
| `vscode` (Copilot) | `.vscode/mcp.json` | `.github/copilot-instructions.md` | |
| `gemini` | `.gemini/settings.json` | `GEMINI.md` | |
| `codex` | printed (its config is global: `~/.codex/config.toml`) | `AGENTS.md` | |
| `generic` | | `AGENTS.md` | |

It also creates a starter `board/kanban.md` if the project has no board yet (an existing `kanban.md` in the project folder or in `docs/` is kept where it is). The instruction block is four lines between `<!-- kanbanmd:start -->` and `<!-- kanbanmd:end -->`: where the board is, use the tools and never hand-edit, and run `kanbanmd guide` for the rules. Running `init` again changes nothing; it refreshes only that block. It never overwrites a JSON file it cannot parse, a different `kanban` server entry or an edited skill (use `--force` to replace those), and `--no-mcp`, `--no-skill`, `--no-instructions` and `--no-board` skip a part. Claude Code asks you to approve a project MCP server the first time.

To add only the MCP server, with no files written:

```bash
claude mcp add kanban -- npx -y @ashikahmad/kanbanmd mcp
```

or in any client's JSON config:

```json
{ "mcpServers": { "kanban": { "command": "npx", "args": ["-y", "@ashikahmad/kanbanmd", "mcp"] } } }
```

The server finds the board folder from where it is started (clients start it from the project folder); add `--dir /path` to point elsewhere. Add `--read-only` (or set `KANBANMD_READONLY=1`) to expose only the five read tools. That uses fewer tokens and makes writing impossible.

## The tools

| Tool | What it does |
|---|---|
| `get_board` | Compact list in display order, with filters (`status`, `assignee`, `tag`, `priority`, `category`, `text`, `overdue`, `dueBefore`) and paging. `archived: true` or `backlog: true` list those files |
| `get_task` | One task in full, with its `etag` |
| `get_config` | Valid columns, priorities, categories, users and tags |
| `get_board_stats` | Counts by status, assignee and priority; overdue; due soon; housekeeping suggestions |
| `get_changes_since` | Edits made through the tools since a timestamp |
| `save_task` | Create (no `id`) or change (`id`) a task |
| `move_task` | Change a task's column in place; `before` or `atEnd` also set the position. Into in-progress sets Started, into done sets Finished |
| `subtask`, `add_note` | Add or tick a subtask; append to the notes |
| `archive_tasks`, `restore_task`, `delete_task` | The archive lifecycle |
| `sort_tasks` | File-wide reorder, always with an explicit `mode` |
| `update_config` | Lists, columns, housekeeping policy, backlog file |

Every write accepts `dryRun` (preview the diff, write nothing), and most accept `ifMatch` (the `etag` from a read: the write fails with `conflict` if the task changed since). Errors carry a code and the valid choices.

## The CLI

The same operations, for scripts, CI and agents that only have a shell:

```bash
node cli/kanbanmd.js board --status in-progress --assignee @alice
node cli/kanbanmd.js move TASK-014 done
node cli/kanbanmd.js --dry-run housekeeping --apply     # preview a clean-up
node cli/kanbanmd.js guide                              # the rules an agent follows
npm link                                                         # optional: makes `kanbanmd` a global command
```

`kanbanmd --help` lists everything. Output is always one JSON document (`guide` prints text). To change a task you read earlier safely, pass its `etag` as `--if-match`.

## Why it is cheaper and safer

Measured on the example boards with `npm run measure` (tokens estimated as bytes / 4):

| | Reading the file | With the tools |
|---|---|---|
| "What is in this column?" on a 100-task board | ~20,000 tokens | ~1,000 |
| Read one task | ~20,000 | ~280 |
| Move a task, tick a subtask, add a note | read the file + an edit call | 25–60 |
| Instructions loaded per session | | ~2,300 for all 14 tools and the rules, ~1,100 read-only |

- **Minimal patches.** Moving a card changes one line. Everything outside the change is byte-for-byte untouched.
- **Verified.** Every edit is re-parsed and must read back exactly as intended, or nothing is written.
- **Concurrent-safe.** The tools take turns with a lock, the browser re-reads before it writes, and IDs are assigned atomically.
- **Readable anywhere.** Each metadata field is on its own line and ends in two spaces (a Markdown hard break), so the files display correctly in any Markdown viewer.

## The Claude Code skill

`init --agent claude` also installs the skill in `.claude/skills/markdown-task-manager` (the rules above, plus a description that makes Claude Code use them whenever tasks come up). To install it for every project instead, copy the folder to `~/.claude/skills/` and restart Claude Code. You can then just ask:

- "Create a task to implement authentication"
- "Update TASK-007 with results"
- "List all tasks in progress"

Other assistants need nothing beyond the instruction block that `init` writes, because the rules come from the tools.

## What agents do on the board

- Create tasks and break them into subtasks.
- Move them between columns and tick subtasks as work progresses.
- Record the result in the task's `**Notes**`.
- Reference the task in commits (`TASK-042`), with the board change in the same commit.
- Leave finished tasks in Done, and archive only when asked.

That leaves a complete, searchable, git-tracked record of what was done and why.

### Prompts that work well

```
Plan [feature]                 Do TASK-014            Where are we?
Break down TASK-014            Continue TASK-014      Weekly status
Search the archive for [word]  Archive completed tasks
```
