# Getting started

Kanban.md is one HTML file. You open it in a browser, point it at a folder, and it reads and writes the Markdown files in that folder. There is nothing to install and no server to run.

## Requirements

- A Chromium-based desktop browser: Chrome 86+, Edge 86+, Opera 72+ or Brave 1.17+. The app needs the File System Access API.
- Firefox and Safari are not supported, and neither are iOS/iPadOS. Android has limited support. (Any browser can [view a board from the web](using-the-board.md#viewing-a-board-from-the-web), read-only.)
- Windows, macOS and Linux all work.

## Install in three steps

1. Download `kanbanmd.html` from this repository.
2. Open it in your browser (double-click).
3. Pick a folder to keep your tasks in.

If the folder is empty, the app creates `kanban.md` and `archive.md` for you. You can name the project, and the app remembers it for next time.

**Want to look around first?** Pick the `docs/demo` folder of this repository. It holds a small sample board ("Orbit Product Board") with dummy tasks and a few archived ones.

## Where to put the files

### In your project root

```
my-project/
├── kanban.md
├── archive.md
├── src/
└── package.json
```

Open `kanbanmd.html`, pick `my-project/`, and start creating tasks. This keeps the board next to the code, so tasks and commits live in the same repository.

### In a subfolder

```
my-project/
├── .tasks/            # or docs/tasks/, .kanban/, ...
│   ├── kanban.md
│   └── archive.md
└── src/
```

Pick the `.tasks/` folder when the app asks.

### Version them, or not

Task files work well under version control: you get history, review and sync for free. If you would rather keep them out of git, add `kanban.md`, `archive.md` (or the folder) to `.gitignore`.

The tools can leave a few working files in the folder. Add these to `.gitignore`:

```
.kanban.lock/
.kanban-activity.jsonl
.*.tmp
```

## Where to keep `kanbanmd.html`

**One copy per project.** Put `kanbanmd.html` next to `kanban.md`. Each project is self-contained and you can commit the app with it, but you update each copy by hand.

**One shared copy.** Keep a single `kanbanmd.html` somewhere like `~/tools/`, bookmark it, and open any project folder from it. The app remembers your last 10 projects, so switching is one click.

A shell alias makes the shared copy quick to open:

```bash
# ~/.zshrc or ~/.bashrc
alias tasks='open ~/tools/kanbanmd.html'        # macOS
alias tasks='xdg-open ~/tools/kanbanmd.html'    # Linux
```

## Your first minute

1. Click **+ Task**, give it a title, and save. The card appears in the first column.
2. Drag the card to another column. Only the card's `Status` line changes in the file.
3. Click the card to see its details, tick subtasks, or add notes.
4. Open `kanban.md` in any editor. Your changes are already there, and edits you make in the editor appear in the browser within a couple of seconds.

Next: [Using the board](using-the-board.md), or [working with AI agents](ai-agents.md).

## Bringing tasks from somewhere else

There is no importer. The format is plain Markdown, so a short script (or an AI agent) can convert an export from Trello, Jira, Linear, GitHub Issues or Notion into the format described in [File format](file-format.md). Run `kanbanmd migrate --dry-run` or open the folder in the app to check the result.

## Privacy and permissions

- Nothing is sent over the network. There is no telemetry, no analytics, no account and no CDN: the whole app is in the one HTML file and works offline.
- The app downloads something only when you open a [board from the web](using-the-board.md#viewing-a-board-from-the-web) with `?board=`, and only from the address you give. For another site it asks first.
- The page asks for exactly two things: read and write access to the folder you pick, and IndexedDB to remember your recent projects in your browser.
- The source is readable in the HTML file, and in `src/`.
