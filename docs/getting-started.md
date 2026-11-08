# Getting started

Kanban.md is one HTML file. You open it in a browser, point it at a folder, and it reads and writes the Markdown files in that folder. There is nothing to install and no server to run.

## Requirements

- To edit boards, a Chromium-based desktop browser: Chrome 86+, Edge 86+, Opera 72+ or Brave 1.17+. Opening a folder needs the File System Access API.
- Firefox, Safari and iOS/iPadOS cannot open folders for editing; Android has limited support. See [Firefox and Safari](#firefox-and-safari) below. Any browser can also [view a board from the web](using-the-board.md#viewing-a-board-from-the-web), read-only.
- Windows, macOS and Linux all work.

## Install in three steps

1. Download `kanbanmd.html` from this repository.
2. Open it in your browser (double-click).
3. Pick a folder to keep your tasks in.

If the folder is empty, the app creates `kanban.md` and `archive.md` for you (pick a `board/` folder, see below). You can name the project, and the app remembers it for next time.

**Want to look around first?** Pick a folder from `docs/examples` in this repository, for instance `orbit-product-board`. It holds a small sample board ("Orbit Product Board") with dummy tasks and a few archived ones.

## Where to put the files

### In a `board/` folder (recommended)

```
my-project/
├── board/
│   ├── kanban.md
│   ├── archive.md
│   └── backlog.md     # only if you switch the backlog file on
├── src/
└── package.json
```

Open `kanbanmd.html`, pick `my-project/board/`, and start creating tasks. The board sits next to the code, so tasks and commits live in the same repository, and the three board files stay together with nothing else in the folder. `kanbanmd init` creates this layout, and the AI tools and `kanbanmd serve` find a `board/` folder on their own.

### In the project root or another folder

Older projects keep `kanban.md` and `archive.md` right in the project folder, and that still works: pick that folder. `docs/` also works for the tools. Any other folder (`.tasks/`, `docs/tasks/`, ...) works in the app; the tools and `serve` then need `--dir` (or `KANBANMD_DIR`) to point at it.

### Version them, or not

Task files work well under version control: you get history, review and sync for free. If you would rather keep them out of git, add the `board/` folder (or `kanban.md` and `archive.md`) to `.gitignore`.

The tools can leave a few working files in the folder. Add these to `.gitignore`:

```
.kanban.lock/
.kanban-activity.jsonl
.*.tmp
```

## Where to keep `kanbanmd.html`

**One copy per project.** Put `kanbanmd.html` in the project folder, next to `board/`. Each project is self-contained and you can commit the app with it, but you update each copy by hand.

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

## Firefox and Safari

These browsers lack the File System Access API, so the **Folder** button works differently:

- **Open a folder, read-only.** Pick the folder: the board is shown as it was at that moment. Nothing is written, and nothing is uploaded: the browser may call the folder dialog an "Upload", so the app explains that first, each time. The status bar at the bottom shows *Read-only*, the folder name and when it was read. Click the read time to refresh: a browser cannot re-read a folder by itself, so the app asks you to choose the same folder again (choosing a different one opens that board instead).
- **Edit the real folder with `kanbanmd serve`.** In the project folder run:

  ```bash
  npx -y @ashikahmad/kanbanmd serve                       # needs Node 18 or newer; or `kanbanmd serve` if installed globally
  ```

  It prints an address on `127.0.0.1` (and opens it). That page is the same app, now editing the folder, in any browser; its status bar shows *Served board* and whether the service is still running, and if you open another folder or a web board from there, the status bar and the menu's **Back to served board** return you. Agents using the CLI or MCP see the same files and your edits show up within a couple of seconds. The address carries a key for this run; other sites and other computers cannot use the service. Stop it with Ctrl-C. `--port N` picks the port (default 4777, the next free one if busy), `--no-open` skips opening the browser. It reaches only the folder it was started in; for another project, run it there too (it takes the next free port).
