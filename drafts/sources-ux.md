> Status: parked. Browser storage (TASK-004) is not planned for now; `kanbanmd serve` (TASK-037) is the way to edit in Firefox and Safari. Kept as reference.

# UX: four board sources (folder, web, picked folder, browser)

Status: draft for TASK-004, TASK-035, TASK-003. Nothing in `src/` is changed by this document.

## 1. Mental model

A board is always one of two things: a set of **files somewhere** (a folder on disk, a web address, a folder you picked) or a **copy kept inside this browser**. Files are the real thing; agents, git and other tools see them. A browser copy is a private working copy: fully editable, but invisible to everything outside this browser profile until you save it to files. So the app answers two questions at all times: *where is this board?* and *is that place safe?* "Safe" means a copy exists outside the browser, so clearing site data cannot lose it.

| Source | Where data lives | Editable | Who else can edit | Survives | How to get it out |
|---|---|---|---|---|---|
| Folder (Chromium) | Files in your folder | Yes, autosave | You, agents, git, other apps (page polls and merges) | Everything except deleting the files | Already files |
| Web | A URL, fetched at open | No | The site owner | Nothing is stored here; reopen the link | "Make an editable copy" |
| Picked folder (Firefox/Safari) | Your folder, read once into memory | No | You, agents (the page does not see changes until "Pick again") | Nothing is stored here; pick again after reload | "Make an editable copy" |
| Browser | IndexedDB of this site, this browser profile | Yes, autosave to IndexedDB | Nobody else; only this browser profile (agents cannot see it) | Reload, restart. Not: clear site data, private window, storage eviction, other browser or device | "Save to files" (zip), or "Save as folder" on Chromium |

## 2. Persistent indicator

Reuse the existing `#sourceBar` (`role="status"`, below the header, above the board, not dismissible). It shows for every source except Folder, which keeps today's hidden bar: the folder name in the project selector is already the "where", and a permanent "live" strip would be noise. Add a glyph per kind in the project selector (folder, globe, browser window) so the kind is visible even with the bar hidden.

Layout: `[icon] State sentence` then the source name/link, then one primary button and a `Details` text button. Details opens a small popover (focus moves into it, Esc closes) with the full facts: where the data is, origin folder and when copied, last saved time, whether storage is protected, and "Agents cannot see a browser board; save to files and open the folder to work with them."

| Source and state | Label (exact) | Intent | Button |
|---|---|---|---|
| Web | `Read-only` + link (as today) | lock icon, neutral (`--c-text`, `--c-fill`) | Make an editable copy |
| Picked folder | `Read-only · folder snapshot "{name}", read {time}` | lock icon, neutral | Make an editable copy; Pick again |
| Browser, never saved | `In this browser only · never saved to files` | hollow circle, `--c-warn` left border and 12% tint | Save to files |
| Browser, changed | `In this browser only · changed since last save ({time})` | filled dot, `--c-warn` | Save to files |
| Browser, in sync | `In this browser · matches files saved {time}` | check, `--c-ok` | Save to files (secondary) |
| Browser, other tab owns it | `Open in another tab · read-only here` | lock icon, neutral | Edit here instead |
| Browser, not persisting | `Not being saved in this browser (private window?)` | triangle, `--c-danger` | Save to files |

Rules. State is never color alone: each state has a distinct icon shape and its own words. Text stays `--c-text` (warn/ok/danger colors are only for the icon and the left border, so contrast holds in light and dark). `{time}` is relative under a day ("2 hours ago"), else a date, with the exact time in `title` and in Details. Screen readers: the bar text is a polite live region, updated **only when the state changes** (never on each autosave, never when a relative time ticks); the time is refreshed silently. All controls are real buttons in tab order after the header. On narrow screens the bar shows only icon plus the first segment (`In this browser only`) and the rest moves into Details.

## 3. Dirty-state model

One saved baseline per browser board: `exportHash` and `exportAt` (null until the first save). A hash (FNV-1a over `kanban.md` plus `archive.md` text) is computed after each autosave.

- **never-saved**: `exportHash` is null.
- **changed**: current hash differs from `exportHash`.
- **in-sync**: current hash equals `exportHash`. Self-correcting: edit then undo returns to in-sync.

Flips: autosave to IndexedDB recomputes the hash; a successful "Save to files" sets `exportHash` and `exportAt`. A zip download is not provable (the browser cannot confirm the user kept the file), so wording says "saved" only for the zip after the click and never claims more; on Chromium, "Save as folder" writes through a handle and is confirmed.

**Origin** (for boards made from a folder or URL): store `originName`, `originHash` (hash of the files at import) and `originAt`. This is metadata, not a live state; divergence from the origin is computed only when that folder is opened again (flow c).

Deliberately not tracked:
- Per-task or per-field diffs, edit counts: the banner needs a yes/no, not a changelog.
- Live divergence from the origin folder: the page cannot see a folder it did not open; computing it on re-open is exact and free.
- Whether the downloaded file reached disk: unknowable.
- Agent edits to exported files: out of reach until a bridge exists; not promised.
- Multiple saved versions or history: later (one "undo replace" snapshot only).

## 4. Flows

**(a) Firefox opens a folder, makes an editable copy, saves back**
1. Welcome shows `Open a folder (read-only)` (Firefox/Safari) plus `Start a board in this browser`. Click opens the native picker (`webkitdirectory`) or accepts a drop.
2. Board opens with the bar `Read-only · folder snapshot "acme", read 14:02` and buttons `Make an editable copy`, `Pick again`.
3. Click Make an editable copy. Dialog: title `Make an editable copy?`, body `This copies "acme" into this browser so you can edit it. Your folder is not changed. Agents will not see the copy until you save it to files.` Buttons `Make copy` (primary), `Cancel`. On confirm: write to IndexedDB, request persistent storage (this click is the user gesture), set `originName/originHash/originAt`, state becomes never-saved, toast `Copy ready. Edits are kept in this browser.`
4. User edits; the bar flips to `changed since last save`. For an imported board `exportHash` starts as the origin hash, so the bar first reads `matches files saved 14:02` (the time the folder was read), then flips on the first edit. Same three states, no extra case.
5. Save to files: menu offers `Download zip` (default) and, on Chromium, `Save to a folder`. Zip contains `kanban.md`, `archive.md`, and the backlog file if any. Toast: `Downloaded kanbanmd-acme.zip. Unzip it over your folder.`

Zip: no dependency. A store-only (uncompressed) zip writer is about 40 lines (local headers, central directory, CRC-32 table) and gives one download instead of two or three browser permission prompts. Fallback if it fails: individual files. Recommend the hand-rolled store-only zip.

**(b) First run on Firefox, no folder.** Welcome card `Start a board in this browser`. Creates the default empty board (same defaults as folder mode), state never-saved, persistent storage requested. First-edit hint, once: `This board lives in this browser. Use Save to files to keep a copy.`

**(c) Reopening the original folder.** Match by `originName`, then compare file hashes. Never prompt when nothing differs and never replace silently.
- Folder equals the browser copy: no prompt; bar shows in-sync.
- Folder equals `originHash`, copy changed: nothing to resolve; offer a quiet toast `Your browser copy "acme" has changes not in this folder.` with `Continue my copy`.
- Folder changed since you copied it AND the copy changed (both moved): dialog `"acme" changed in two places`. Body `The folder and your browser copy both changed since {originAt}.` Plus a compact list built from task blocks by id: `Only in folder: TASK-041. Only in browser copy: TASK-040. Different in both: TASK-004, TASK-012.` Buttons: `Keep my browser copy` (default), `Use the folder` (copy kept as "acme (browser copy)", not deleted), `Download my copy first`. No merge UI.
- Folder changed, copy untouched since import: offer `Update my copy from the folder` (replaces, with one undo snapshot).

**(d) Chromium: browser board to a real folder (TASK-003).** Menu `Save as folder…` opens `showDirectoryPicker` (readwrite). If the folder already has `kanban.md`: dialog `That folder already has a board. Replace its files with this one?` (`Replace`, `Choose another`). Writes the files, switches the source to Folder (live), toast `Now working in the folder "acme". Agents can see it.` The browser copy is kept, renamed `acme (browser copy)`, and a one-time line offers `Delete it`. Default is keep, because deleting is the only irreversible step.

**(e) Leaving the page.** `beforeunload` is NOT used for changed-since-save: the data is in IndexedDB, so leaving is safe, and a prompt on every close would train users to ignore it. It is used only when persistence has failed (private window, quota error, write error), where leaving truly loses work: browser default text.

**(f) Same board in two tabs.** A Web Lock `kanbanmd:{boardId}` is held by the editing tab. A second tab opens that board read-only with the "other tab" bar and `Edit here instead`; confirming asks the first tab (BroadcastChannel) to drop to read-only and flush. The first tab shows `This board is now being edited in another tab. Reload to see its changes.` No concurrent writers, no merge.

**(g) Cleared or evicted storage.**
- Ask for `navigator.storage.persist()` on the first user gesture that creates a browser board (Firefox shows its own prompt; the dialog above says why). Details shows `Storage: protected` or `Storage: may be cleared by the browser`.
- No silent reliance: while state is never-saved or changed, escalate once per day per board: after 3 days (Safari without persistence: 5) unsaved, or 20+ edits since the last save, show a toast `This board only exists in this browser. Save a copy.` with `Save to files`. The bar itself never nags.
- Loss detection: a small marker in localStorage (board id, name, task count, `exportAt`). If it exists but IndexedDB has no such board: dialog `Your browser board "acme" is gone` / `The browser cleared its storage. Last saved copy: {exportAt}.` with `Open saved files…` and `Start a new board`. Honest limit: "Clear site data" wipes both, so this helps mainly with partial eviction.

## 5. Failure and edge copy

- Storage full: `The browser has no room left to save this board. Save to files now, then free space or clear old browser copies.` (opens the save menu; board stays usable in memory; danger bar).
- Storage denied (private window / IndexedDB blocked): `This browser is not letting the page keep a board (private window?). You can edit, but changes are lost when the tab closes.` Keeps `beforeunload` armed.
- Huge folder picked: ignore everything except `kanban.md`, `archive.md` and the backlog file by name at the top level; never read other files. If a board file exceeds 5 MB (same as web limit): `kanban.md is too large to open here (over 5 MB).` If the folder has thousands of entries, only the matching names are touched, so no warning is needed.
- Folder without `kanban.md`: `No kanban.md in "acme". Pick the folder that contains it, or start a new board here.` Buttons `Pick another folder`, `Start a board in this browser`. Never create files in a picked folder.
- Folder has `archive.md` but no board: same message; do not guess.
- Zip or save failure: `Could not create the download. Try Save as individual files.`
- Import blocked by parse guard (task count does not match blocks): `This board has a formatting problem and was not copied: {detail}.`

## 6. Recommended order

1. Source plumbing: `pickedFolderSource` (read-only, shared bar), `browserSource` on IndexedDB, welcome screen with both entries, Firefox warning rewritten to lead here.
2. Bar states for web and picked folder (reuse `sourceBar`, add Details popover).
3. Make an editable copy (import) with persistent storage request and parse guard.
4. Browser board bar states, dirty model (hash, `exportHash`), `Save to files` as store-only zip.
5. Failure copy: storage denied/full, `beforeunload` only on failed persistence.
6. Two-tab lock.
7. Re-open comparison (flow c) and loss detection marker.
8. Chromium `Save as folder` (TASK-003) and the escalating nudge.
9. Later: snapshots/undo, bridge for agents, history.

## 7. Open questions for the owner

1. May a browser board be the default on Firefox/Safari (welcome highlights "Start a board in this browser") even though agents cannot see it? This sets how loudly the agent limitation must be stated.
2. Should Chromium also offer browser boards, or only Folder? Offering both doubles the "which one am I in?" burden; recommendation is to hide browser boards on Chromium except as a result of a conversion.
3. Is a store-only zip acceptable, or must users be able to save straight into a folder on Firefox (not possible without the File System Access API)?
4. After a conversion to a folder, keep the browser copy by default (recommended) or delete it?
5. Is one browser board per origin enough for the MVP, or must the project selector hold several?
