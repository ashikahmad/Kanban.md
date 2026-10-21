# Working with AI agents

Kanban.md is built so a person and an AI agent can use the same board at the same time. You work in the browser; the agent works on the same files; each sees the other's changes within a couple of seconds.

An agent can always edit the Markdown directly. That costs tokens (the whole file on every read), invites formatting mistakes, and can overwrite what you are doing. The optional **`kanbanmd` CLI** and **MCP server** avoid all three: they read only what is asked, validate every change, and write minimal patches that merge with your concurrent edits.

## Set up the MCP server

```bash
npm run mcp:install      # once: installs the MCP SDK inside mcp/
```

(The page and the CLI have no dependencies; only the MCP server needs this step.)

Then add the server to your MCP client, pointing `--dir` at the folder that holds `kanban.md`:

```bash
claude mcp add kanban -- node /path/to/Kanban.md/mcp/server.js --dir /path/to/your/project
```

or in a JSON config:

```json
{ "mcpServers": { "kanban": { "command": "node", "args": ["/path/to/Kanban.md/mcp/server.js", "--dir", "/path/to/your/project"] } } }
```

Add `--read-only` (or set `KANBANMD_READONLY=1`) to expose only the five read tools. That uses fewer tokens and makes writing impossible.

## The tools

| Tool | What it does |
|---|---|
| `get_board` | Compact list in display order, with filters (`status`, `assignee`, `tag`, `priority`, `category`, `text`, `overdue`, `dueBefore`) and paging. `archived: true` or `backlog: true` list those files |
| `get_task` | One task in full, with its `etag` |
| `get_config` | Valid columns, priorities, categories, users and tags |
| `get_board_stats` | Counts by status, assignee and priority; overdue; due soon; housekeeping suggestions |
| `get_changes_since` | Edits made through the tools since a timestamp |
| `save_task` | Create (no `id`) or change (`id`) a task |
| `move_task` | Change a task's column in place (a one-line edit); `before` or `atEnd` also set the position |
| `subtask`, `add_note` | Add or tick a subtask; append to the notes |
| `archive_tasks`, `restore_task`, `delete_task` | The archive lifecycle |
| `sort_tasks` | File-wide reorder, always with an explicit `mode` |
| `update_config` | Lists, columns, housekeeping policy, backlog file |

Every write accepts `dryRun` (preview the diff, write nothing), and most accept `ifMatch` (the `etag` from a read: the write fails with `conflict` if the task changed since). Errors carry a code and the valid choices.

## The CLI

The same operations, for scripts, CI and agents that only have a shell:

```bash
node cli/kanbanmd.js --dir . board --status in-progress --assignee @alice
node cli/kanbanmd.js --dir . move TASK-014 done
node cli/kanbanmd.js --dir . --dry-run housekeeping --apply     # preview a clean-up
npm link                                                         # optional: makes `kanbanmd` a global command
```

`kanbanmd --help` lists everything. Output is always one JSON document.

## Why it is cheaper and safer

Measured on the example boards with `npm run measure` (tokens estimated as bytes / 4):

| | Reading the file | With the tools |
|---|---|---|
| "What is in this column?" on a 100-task board | ~20,000 tokens | ~1,000 |
| Read one task | ~20,000 | ~280 |
| Move a task, tick a subtask, add a note | read the file + an edit call | 25–60 |
| Instructions loaded per session | ~4,100 (`AI_WORKFLOW.md` + the skill) | ~1,800 for all 14 tools, ~650 read-only |

- **Minimal patches.** Moving a card changes one line. Everything outside the change is byte-for-byte untouched.
- **Verified.** Every edit is re-parsed and must read back exactly as intended, or nothing is written.
- **Concurrent-safe.** The tools take turns with a lock, the browser re-reads before it writes, and IDs are assigned atomically.
- **Readable anywhere.** Each metadata field is on its own line and ends in two spaces (a Markdown hard break), so the files display correctly in any Markdown viewer.

## Telling your assistant about the board

[`AI_WORKFLOW.md`](../AI_WORKFLOW.md) holds the rules for agents: use the tools first, fall back to the file format, reference tasks in commits, archive only on request. Copy it into your project and point your assistant at it.

Each assistant has its own configuration file. Starter templates (named `*.md.exemple`) are in the repository root:

| Assistant | Config file | Location | Template |
|---|---|---|---|
| Claude | `CLAUDE.md` | project root | `CLAUDE.md.exemple` |
| GitHub Copilot | `copilot-instructions.md` | `.github/` | `COPILOT.md.exemple` |
| OpenAI CLI | `OPENAI_CLI.md` | project root | `OPENAI_CLI.md.exemple` |
| ChatGPT | `CHATGPT.md` or a custom GPT | root or web | `CHATGPT.md.exemple` |
| Gemini | `GEMINI.md` or `instructions.md` | root or `.gemini/` | `GEMINI.md.exemple` |
| Qwen | `QWEN.md` | project root | `QWEN.md.exemple` |
| Codeium / Windsurf | `instructions.md` | `.windsurf/` or `.codeium/` | `CODEIUM.md.exemple` |

Typical setup for a project:

```bash
cp AI_WORKFLOW.md your-project/
cp CLAUDE.md.exemple your-project/CLAUDE.md                 # or the template for your assistant
mkdir -p your-project/.github
cp COPILOT.md.exemple your-project/.github/copilot-instructions.md
```

### Claude Code skill

A ready-made skill lives in `.claude/skills/markdown-task-manager`. Copy the whole folder (its metadata is in `SKILL.md`) and restart Claude Code:

```bash
cp -R .claude/skills/markdown-task-manager ~/.claude/skills/
```

Once installed, Claude Code detects projects that contain `kanban.md` and follows the format on its own. You can just ask:

- "Create a task to implement authentication"
- "Update TASK-007 with results"
- "List all tasks in progress"
- "Archive completed tasks"

## What agents do on the board

- Create tasks and break them into subtasks.
- Move them between columns and tick subtasks as work progresses.
- Record the result in the task's `**Notes**`.
- Reference the task in commits (`TASK-042`).
- Leave finished tasks in Done, and archive only when asked.

That leaves a complete, searchable, git-tracked record of what was done and why.

### Prompts that work well

```
Plan [feature]                 Do TASK-014            Where are we?
Break down TASK-014            Continue TASK-014      Weekly status
Search the archive for [word]  Archive completed tasks
```
