# Hand-off: GitHub Pages product site

Status: not started. This is a brief for a separate session. It was split out of the README/docs rewrite (branch `docs/readme-rewrite`) on purpose; see "Why separate" below.

## Goal

Publish a small site on GitHub Pages that:

1. Is a **first product page** for Kanban.md: what it is, what you get, where it shines, what it is not for, how to start. The text should match the README; do not invent claims.
2. **Hosts the app** (`kanbanmd.html`) so a visitor can try it with one click, with no download.
3. **Links to the project board** (`board/kanban.md` on GitHub, and later a live read-only view of it).
4. Leaves room for a **shared task viewer / editor / exporter page** (see board ideas).
5. Eventually offers **sample boards** from a menu in the app (the demo board in `docs/demo` and this project's own board).

## What was checked already

- The app has no CDN or network dependencies; all code and styles are inlined in the one HTML file.
- Nothing in `src/` depends on being opened from `file://`. It uses `localStorage` (theme, per-project order choice, housekeeping snooze) and IndexedDB (recent project handles, `src/scripts/03-storage.js`), both per origin, and `window.showDirectoryPicker` (`03-storage.js`, around line 327).
- The folder picker works on any HTTPS origin, so the hosted app can open local folders. Files are read and written on the visitor's machine; nothing is uploaded.
- Per-origin storage means a hosted copy and a downloaded copy keep separate recent-project lists. All Pages sites under one account share the origin `<user>.github.io`, so their `localStorage`/IndexedDB are shared; keep the keys as they are (they are namespaced by project name) and do not add anything sensitive.
- Chrome may re-ask for folder permission each session.

## Still to verify

- Open the Pages-hosted file in Chrome and Edge, pick a folder, edit, reload, and check that the recent-projects list and folder permission behave.
- Confirm that nothing else assumes a relative path or a `file://` URL (the `share` feature and the `Share…` sheet in particular).

## Hosting approach

Do not publish from the `docs/` folder. `docs/` holds Markdown guides and screenshots, and publishing it as-is would expose them as the site root.

Preferred: a GitHub Actions workflow that builds a `site/` folder and deploys it with the Pages artifact action.

- Add a build step (a small script next to `build.mjs`, e.g. `npm run build:site`) that assembles:
  - `index.html` (the landing page)
  - `app/index.html` (a copy of the built `kanbanmd.html`; or `app/kanbanmd.html`)
  - `board/kanban.md` and `board/archive.md` (so the project board is served with CORS-friendly headers; GitHub Pages sends `Access-Control-Allow-Origin: *`)
  - `demo/kanban.md` and `demo/archive.md` (from `docs/demo`)
  - the screenshots from `docs/images` that the landing page uses
- The workflow runs `npm ci`, `npm run build`, `npm test`, then the site build, then deploys. Trigger on pushes to `master` that touch `src/`, `core/`, `board/`, `docs/` or the site files, plus manual dispatch.
- Repo settings: Pages source = "GitHub Actions". This needs the owner to enable it; it cannot be done from a branch.

## Landing page

- A single, static, fast page: inline CSS, no framework, no tracking, no external fonts or scripts (matches the app's privacy promise).
- Content: pitch, one hero screenshot, "What you get" (5–6 items), "Where it shines", "What it is not for", "Try it" (open the app; open the demo board), "Use it with AI agents" (3–4 lines, link to docs), links to docs on GitHub, the project board, the repository, and the credit line to the original project.
- Support light and dark mode with `prefers-color-scheme`, and work at phone width.
- Reuse the app's colour tokens (`src/styles/00-variables.css`) so the site and the app feel like one product.
- Take the copy from the new README, and give the layout real design attention (typography, spacing, a clear hero) rather than a default template.
- Remember that the app only works in Chromium desktop browsers: say so plainly on the page, and show a friendly note if `showDirectoryPicker` is missing.

## Later phases (depend on app features, not part of the first PR)

1. **Read-only board from a URL** (`?board=<url>`). Built on data sources, see [Data sources](#data-sources-for-the-read-only-url-board) below. Planned as TASK-001 on `board/kanban.md`.
2. **Sample boards menu** in the app that opens the demo board and the project board through the read-only URL feature.
3. **Convert a read-only or browser board to a folder project** ("Save as folder project"; one time, no sync).
4. **Shared task viewer / editor / exporter page.** Opens a task block shared from the app's Share dialog, and lets you view, tweak, and export it.

## Data sources (for the read-only URL board)

Where a board comes from is a data source. A folder source reads and writes the project folder, as the app does today. A web source reads from a URL and is always read-only. The page asks the source what it can do instead of keeping a separate read-only flag.

```js
DataSource {
  kind: 'folder' | 'web' | 'browser'      // 'browser' later (TASK-004, drafts/browser-storage-plan.md)
  label                                   // folder name, or host/path
  writable: boolean                       // web: always false
  read(name)    -> Promise<string|null>   // null = not found
  version(name) -> Promise<token|null>    // folder: lastModified; web: unused for now
  write(name, text) -> Promise<void>      // web: throws
}
```

The interface works on file names because saving already does (`readProjectFiles` / `writeProjectFile` in `04a-persist.js`, for `kanban.md`, `archive.md` and the backlog file). This replaces the `Backend` sketch in `drafts/browser-storage-plan.md` §5.1, which predates live sync.

- **`FolderSource(dirHandle)`**: the existing `getFileHandle` / `createWritable` code, moved. The state holds one `source` instead of `directoryHandle`, `kanbanFileHandle` and `archiveFileHandle`.
- **`WebSource(url)`**: resolves `kanban.md`, `archive.md` (missing is fine) and the backlog file the board names, against the board URL. Fetches with `credentials: 'omit'`, `referrerPolicy: 'no-referrer'` and a size cap. Only `http:` and `https:`.
- **Loading** is the same for every source. Migration, backups and default-file creation run only when `source.writable`.
- **Saving** (`persistNow` / `commit`) returns early when `!source.writable`: one check covers every write path.
- **UI**: `body.readonly` plus conditional rendering in the board, task detail, columns, toolbar, housekeeping and backlog scripts. No drag, edit, delete, archive, column or ordering controls; filters, search, the archive view, theme, language and Share stay. A banner shows "Read-only · host/path · Open a folder instead".
- **Recent projects** store a source record; records without `kind` are folders. Web boards are not added to the list for now.
- **Browsers**: a web source needs no File System Access API, so the unsupported-browser block applies only without `?board=`. Read-only boards then open in Firefox and Safari too.

Decisions:

- `?board=<url>` in the query string. Relative URLs resolve against the page, so the site links to `app/?board=../board/kanban.md`.
- Same-origin URLs load at once. Other hosts show "Load a board from *host*? [Load] [Cancel]" first. Without the parameter the app makes no request.
- No Reload button and no polling for now; `version()` leaves room for either later.
- Remote images in notes are allowed. Links still get `rel="noopener noreferrer"` and `javascript:` URLs are blocked; every render path must escape text from the file.

Errors, each with its own message: not found (404); blocked by CORS (suggest raw GitHub or GitHub Pages); HTML instead of Markdown (a `github.com/.../blob/...` link is rewritten to `raw.githubusercontent.com`); not a board.

Steps:

1. Data-source layer and `FolderSource`, no behaviour change. Existing page tests pass unchanged; a contract test runs against an in-memory source.
2. `WebSource`, `?board=`, the read-only UI and banner, errors, the security pass, tests with a fake `fetch`, strings in every language.
3. Site links to the project and demo boards, and docs. This unblocks the sample boards menu (TASK-002); Save as folder project (TASK-003) becomes "read from one source, write to a new `FolderSource`".

## Why separate

- It is design and deployment work, not documentation.
- It touches CI and repository settings, which need the owner's access.
- The sample-board menu needs a real app feature (read-only URL boards).
- Keeping it out of the docs rewrite keeps that change reviewable.

## Definition of done for the first PR

- `npm run build:site` produces a `site/` folder that works when served statically (`python3 -m http.server` in `site/`).
- The Actions workflow deploys it; the hosted app opens a local folder and edits it in Chrome and Edge.
- The landing page says nothing the README does not, and every link resolves.
- The README links to the site; the project board ideas "GitHub Pages product site" is moved to In Progress, then Done.
