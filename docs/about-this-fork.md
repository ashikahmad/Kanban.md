# About this fork

Kanban.md is a fork of [ioniks/MarkdownTaskManager](https://github.com/ioniks/MarkdownTaskManager), released under the Mozilla Public License 2.0 (see [`LICENSE`](../LICENSE)). The original project and its contributors created the idea this one is built on: a Kanban board that lives in plain Markdown files and runs from a single HTML file. Thank you.

This page is for anyone curious about how the two differ. You do not need it to use Kanban.md.

## What the original gave us

Up to its 2.0 release, the original project provided:

- The single-file, no-server app on the File System Access API, with drag and drop, task metadata, subtasks, filters, archive, multi-project and auto-save.
- Dark mode, four interface languages, mobile touch support, and security hardening against XSS.
- The AI-assistant workflow (`AI_WORKFLOW.md`, the per-assistant templates and the Claude Code skill).
- The "status as a field" file layout, with automatic, backed-up migration from the first format, and a modular `src/` tree compiled into the single HTML file.

All of that is still here.

## What changed in this fork

**Interface.** A redesign of the whole viewer: one compact top bar, inline multi-select filters that collapse on narrow screens, a single scroller with sticky column titles, compact cards with a priority dot and a slim progress bar, layered light and dark themes with an Auto / Light / Dark switch, and a token-based stylesheet instead of scattered inline styles.

**File format v3.** One metadata field per line (v2 joined priority, category and assignee on one line, which could silently lose a field), with each line ending in a Markdown hard break so the files read properly in any viewer. Older files migrate automatically with backups, and a migration is refused unless the result reads back identically.

**A shared core.** The parser and generator were extracted into a pure module (`core/`) with validated, minimal-patch operations. The page, the CLI and the MCP server all use it, so they agree on the format by construction.

**The CLI and MCP server.** `kanbanmd` and a 14-tool MCP server let agents read narrowly, write safely and cheaply, and work alongside you in the browser. See [Working with AI agents](ai-agents.md).

**Live collaboration.** The page saves by applying minimal patches to the files as they are *now* and watches them for outside changes, so human and agent edits merge instead of overwriting each other.

**Board-management features.** Optional manual card order, housekeeping nudges, an optional separate backlog file, and task sharing with a rendered preview.

**Project practice.** Documentation reorganised around what a user wants to do, a test suite (unit, property and end-to-end), and the project's own work tracked on a public Kanban.md board.

## Compatibility

- Boards from the original project open as they are. They are migrated to v3 the first time you open them in the app, and a backup is kept.
- If you need to go back, restore the `*.v1-backup.md` or `*.v2-backup.md` file the migration left beside the board.
- The Markdown stays plain Markdown: you can always read and edit it by hand.

## Licence and credit

Kanban.md keeps the original's MPL-2.0 licence, and the original copyright notices are preserved. If you use Kanban.md, please remember the original: <https://github.com/ioniks/MarkdownTaskManager>.
