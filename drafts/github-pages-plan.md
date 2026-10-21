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

1. **Read-only board from a URL** (`?board=<url>`). A new feature in the app: fetch `kanban.md` (and a sibling `archive.md`), parse with the existing pure `core/`, render with all edit controls and autosave disabled. It is the first network request the app would make, so it must be opt-in and documented. Board idea on `board/kanban.md`.
2. **Sample boards menu** in the app that opens the demo board and the project board through the read-only URL feature.
3. **Convert a read-only or browser board to a folder project** ("Save as folder project"; one time, no sync).
4. **Shared task viewer / editor / exporter page.** Opens a task block shared from the app's Share dialog, and lets you view, tweak, and export it.

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
