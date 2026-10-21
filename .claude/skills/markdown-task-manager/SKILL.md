---
name: markdown-task-manager
description: Use when managing tasks. The system is a Kanban task manager on local Markdown files (`kanban.md`, `archive.md`, optionally `backlog.md`) that a human edits in the kanbanmd.html web app at the same time. Prefer the Kanban MCP tools or the `kanbanmd` CLI; fall back to the file format described here.
---

# 📋 Markdown Task Manager Skill

Full guide: `AI_WORKFLOW.md` in the project root. This skill is the short version.

## When to use it

- Create tasks to document work to be done, plan features, track progress
- Report status ("where are we?"), archive on request

A human is using the board in the browser while you work. Make small, targeted edits.

## 1. Tools first

If the **Kanban MCP server** is connected (`get_board`, `get_task`, `save_task`, `move_task`, …) or you can run `kanbanmd`, use it. Do **not** read or hand-edit `kanban.md` then: the tools return a few hundred tokens instead of the whole file, validate every change, and merge with the human's concurrent edits.

| Intent | Tool |
|---|---|
| What is in a column / who has what / what is overdue | `get_board` (filters), `get_board_stats` |
| One task in full | `get_task` |
| Valid columns, priorities, users | `get_config` |
| Create / change a task | `save_task` (no `id` creates) |
| Change column | `move_task` |
| Subtasks, notes | `subtask`, `add_note` |
| Archive / restore / delete | `archive_tasks`, `restore_task`, `delete_task` |
| Archive or backlog file contents | `get_board` with `archived: true` / `backlog: true` |

Rules: pass the task's `etag` as `ifMatch` when changing something you read earlier (a `conflict` means re-read and redo); use `dryRun` to preview; errors list the valid choices; `needs_migration` means tell the user to open the board in the browser or run `kanbanmd migrate`; if `get_board_stats` returns `housekeeping` suggestions, **tell the user, never archive unasked**; `sort_tasks` rewrites a file-wide order, so never call it unprompted.

CLI equivalents: `kanbanmd board --status review`, `task TASK-014`, `move TASK-014 done`, `create --title … --status …`, `note`, `toggle`, `archive`, `stats`, `housekeeping`. Add `--dry-run` to preview.

## 2. Task format (only if you edit files yourself): v3, one field per line, each ending in two spaces (Markdown hard break; lines without them still parse)

```markdown
### TASK-XXX | Task title
**Status**: <column-id>
**Priority**: High
**Category**: Backend
**Assigned**: @user1, @user2
**Created**: YYYY-MM-DD
**Due**: YYYY-MM-DD
**Tags**: #tag1 #tag2

Free text description. **NO `##` or `###` headings allowed**.

**Subtasks**:
- [ ] First subtask
- [x] Completed subtask

**Notes**:
**Result**:
What was done.
```

Required: the `### TASK-XXX |` header and `**Status**:` (a column id). Everything else is optional and independent; leave empty fields out. Optional `**Order**: n` is a manual card order: leave it alone. Forbidden: `##`/`###` headings inside a task; `**Subtasks**`/`**Notes**` without the colon.

- **Move a task:** edit its one `**Status**:` line. Never cut and paste the block.
- **New task:** append the block at the end of `kanban.md` and bump `<!-- Config: Last Task ID: N -->`.
- If the Configuration has `**Backlog file**: backlog.md (backlog)`, tasks of that column live in `backlog.md`; a status change moves them. Do not manage the file.

## 3. Workflow

1. **New request:** create the task (status = first column), break into subtasks if needed.
2. **Start:** move to in-progress, set `Started`, tick subtasks as you go.
3. **Finish:** move to done, set `Finished`, document `**Result**:`, `**Modified files**:`, `**Technical decisions**:`, `**Tests performed**:` in `**Notes**:`.
4. **Archiving:** never automatic. Finished tasks stay in the done column until the user asks.
5. Reference tasks in commits (`TASK-XXX`).

## Golden rules

- Create the task before coding; progress in real time; document the result.
- Use the tools when you have them; otherwise the strict format.
- Never archive unasked; never rewrite a whole file when a one-line edit will do.
