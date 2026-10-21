        // ===== Persistence =====
        // The page edits in-memory state. Saving turns the difference between that state and the state at
        // the last load/save into ops (core/changes.js) and applies them to the files AS THEY ARE NOW, so a
        // change made elsewhere in the meantime (an agent, the CLI, another tab) is never overwritten, and
        // a one-card edit is a one-card diff. Polling picks up such outside changes and re-renders.
        let persistBase = null;          // { config, tasks, archive, boardText, archiveText } as of the last load/save
        let currentArchiveText = null;   // archive.md text as of the last load/save (null = no file)
        let persistChain = Promise.resolve(true); // saves run one at a time, in order
        let persistBusy = false;
        let pollBusy = false;
        const lastSeenMtime = { board: null, archive: null };
        const jsonClone = (v) => JSON.parse(JSON.stringify(v));
        const PERSIST_LISTS = ['categories', 'users', 'priorities', 'tags'];

        function currentPageState() { return { config, tasks, archive: archivedTasks }; }

        function stateEquals(a, b) {
            return deepEqual(a.tasks, b.tasks) && deepEqual(a.archive, b.archive)
                && deepEqual(a.config.columns, b.config.columns)
                && PERSIST_LISTS.every((k) => deepEqual(a.config[k], b.config[k]));
        }

        // ---- reading and writing the project files ----
        async function readProjectFiles() {
            const bf = await kanbanFileHandle.getFile();
            const board = await bf.text();
            let archive = null, archiveMtime = null;
            try {
                if (!archiveFileHandle) archiveFileHandle = await directoryHandle.getFileHandle('archive.md');
                const af = await archiveFileHandle.getFile();
                archive = await af.text();
                archiveMtime = af.lastModified;
            } catch (e) {
                if (e.name !== 'NotFoundError') throw e;
                archiveFileHandle = null;
            }
            lastSeenMtime.board = bf.lastModified;
            lastSeenMtime.archive = archiveMtime;
            return { board, archive };
        }

        async function writeProjectFile(name, text) {
            let handle;
            if (name === 'kanban.md') handle = kanbanFileHandle;
            else handle = archiveFileHandle || (archiveFileHandle = await directoryHandle.getFileHandle('archive.md', { create: true }));
            const writable = await handle.createWritable();
            await writable.write(text);
            await writable.close();
        }

        async function refreshMtimes() {
            try {
                lastSeenMtime.board = (await kanbanFileHandle.getFile()).lastModified;
                lastSeenMtime.archive = archiveFileHandle ? (await archiveFileHandle.getFile()).lastModified : null;
            } catch (e) { /* the next poll will notice */ }
        }

        // ---- adopting what is on disk ----
        // Makes `boardText`/`archiveText` the new base. The in-memory state is replaced by what the files
        // say only if it was not edited since `expect` (the snapshot the save started from); otherwise the
        // local edits are kept and simply become the next save's difference. Returns true when replaced.
        function adoptTexts(boardText, archiveText, { expect = null, force = false } = {}) {
            const b = parseBoard(boardText);
            const a = archiveText === null ? { tasks: [], formatVersion: 3 } : parseArchive(archiveText, b.config.columns);
            const parsed = { config: b.config, tasks: b.tasks, archive: a.tasks };
            loadedFormatVersion = b.formatVersion;
            loadedArchiveVersion = a.formatVersion;
            currentKanbanContent = boardText;
            currentArchiveText = archiveText;
            persistBase = { config: jsonClone(b.config), tasks: jsonClone(b.tasks), archive: jsonClone(a.tasks), boardText, archiveText };
            const untouched = !expect || stateEquals(currentPageState(), expect);
            if (untouched && (force || !stateEquals(currentPageState(), parsed))) {
                config = b.config; tasks = b.tasks; archivedTasks = a.tasks;
                return true;
            }
            return false;
        }

        // Re-read both files into the base without touching what is on screen (used right after a load).
        async function snapshotFromDisk() {
            const disk = await readProjectFiles();
            adoptTexts(disk.board, disk.archive);
            updateOrderingMenu();
        }

        function refreshUi() {
            updateAutocomplete();
            const view = document.getElementById('kanbanView');
            const scroll = view.scrollTop;
            renderKanban();
            view.scrollTop = scroll;
            updateOrderingMenu();
            if (document.getElementById('archiveModal').classList.contains('active')) renderArchiveList(document.getElementById('archiveSearch').value);
        }

        // ---- saving ----
        function autoSave() {
            persistChain = persistChain.then(persistNow, persistNow);
            return persistChain;
        }

        async function persistNow() {
            if (!kanbanFileHandle || !persistBase) return false;
            persistBusy = true;
            try {
                const { ops, unsupported } = diffToOps(persistBase, currentPageState());
                if (!ops.length && !unsupported.length) return true;
                return (await commit(ops, { unsupported })).ok;
            } catch (error) {
                console.error('Save failed:', error);
                showNotification(t('notif.saveFailed'), 'error');
                return false;
            } finally {
                persistBusy = false;
            }
        }

        // Apply ops to the files as they are now and write the result. `explicit` ops (a drag and drop)
        // are not a diff of the page state, so when they cannot be applied nothing is rewritten.
        // Returns { ok, changed }.
        async function commit(ops, { unsupported = [], explicit = false } = {}) {
            for (let attempt = 0; attempt < 4; attempt++) {
                const snapshot = jsonClone(currentPageState());
                const disk = await readProjectFiles();
                const external = disk.board !== persistBase.boardText || disk.archive !== persistBase.archiveText;
                let out = null, failure = null;
                if (!unsupported.length) {
                    try { out = applyOps({ board: disk.board, archive: disk.archive }, ops); }
                    catch (e) { failure = e; console.warn('Ops not applicable:', e && e.code, e && e.message); }
                }
                if (out) {
                    const again = await readProjectFiles(); // did anything move while we worked?
                    if (again.board !== disk.board || again.archive !== disk.archive) continue;
                    for (const f of out.files) await writeProjectFile(f.name, f.text);
                    const replaced = adoptTexts(out.board, out.archive, { expect: snapshot });
                    await refreshMtimes();
                    if (replaced) refreshUi();
                    return { ok: true, changed: out.files.length > 0 };
                }
                if (explicit) {
                    showNotification(t('notif.saveFailed'), 'error');
                    await reloadFromDisk({ quiet: true });
                    return { ok: false, changed: false };
                }
                // The page's own state cannot be expressed as ops (or the file is not v3).
                if (!external) return { ok: await writeWholeFiles(), changed: true };
                // And the files changed behind our back: take theirs, say so.
                await reloadFromDisk({ quiet: true });
                showNotification(t('notif.mergeFailed', { reason: failure ? failure.message : (unsupported[0] || '') }), 'error');
                return { ok: false, changed: false };
            }
            showNotification(t('notif.saveFailed'), 'error');
            return { ok: false, changed: false };
        }

        // Old behavior, kept as the fallback: rewrite the files from the page's state (also what the one-time
        // migration uses). Only called when the files have not changed since the base.
        async function writeWholeBoard() {
            const text = generateMarkdown();
            await writeProjectFile('kanban.md', text);
            currentKanbanContent = text;
            return text;
        }
        async function writeWholeArchive() {
            const text = generateArchive(archivedTasks, archiveStrings());
            await writeProjectFile('archive.md', text);
            return text;
        }
        async function writeWholeFiles() {
            const snapshot = jsonClone(currentPageState());
            const archiveText = (archivedTasks.length || archiveFileHandle) ? await writeWholeArchive() : currentArchiveText;
            const boardText = await writeWholeBoard();
            adoptTexts(boardText, archiveText, { expect: snapshot });
            await refreshMtimes();
            return true;
        }

        // ---- picking up changes made outside ----
        async function reloadFromDisk({ quiet = false } = {}) {
            await persistChain;
            const snapshot = jsonClone(currentPageState());
            const disk = await readProjectFiles();
            if (!stateEquals(currentPageState(), snapshot)) return false; // an edit landed meanwhile: its save will merge
            const before = tasks.slice();
            adoptTexts(disk.board, disk.archive, { expect: snapshot, force: true });
            refreshUi();

            // An open edit form whose task changed underneath: ask, never overwrite silently.
            const form = document.getElementById('newTaskModal');
            if (isEditMode && form.classList.contains('active')) {
                const id = document.getElementById('taskEditId').value;
                const was = before.find((x) => x.id === id), now = tasks.find((x) => x.id === id);
                if (!now) { showNotification(t('notif.taskRemovedElsewhere', { id }), 'error'); closeTaskModal(); }
                else if (was && !deepEqual(was, now) && confirm(t('confirm.taskChangedElsewhere', { id }))) openTaskModal(now);
            }
            // An open read-only detail view: refresh it.
            const detail = document.getElementById('taskModal');
            if (detail.classList.contains('active') && currentDetailTask) {
                const fresh = tasks.find((x) => x.id === currentDetailTask.id) || archivedTasks.find((x) => x.id === currentDetailTask.id);
                if (fresh) showTaskDetail(fresh); else closeModal();
            }
            if (!quiet) showNotification(t('notif.reloaded'), 'success');
            return true;
        }

        async function pollOnce() {
            if (document.visibilityState !== 'visible' || !kanbanFileHandle || !persistBase || persistBusy || pollBusy) return;
            pollBusy = true;
            try {
                const bf = await kanbanFileHandle.getFile();
                let archiveMtime = null;
                try {
                    if (!archiveFileHandle) archiveFileHandle = await directoryHandle.getFileHandle('archive.md');
                    archiveMtime = (await archiveFileHandle.getFile()).lastModified;
                } catch (e) { archiveFileHandle = null; }
                if (bf.lastModified === lastSeenMtime.board && archiveMtime === lastSeenMtime.archive) return;
                const disk = await readProjectFiles();
                if (disk.board === persistBase.boardText && disk.archive === persistBase.archiveText) return; // touched, not changed
                await reloadFromDisk();
            } catch (e) {
                console.warn('Change check skipped:', e && e.message);
            } finally {
                pollBusy = false;
            }
        }
        setInterval(pollOnce, 2000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollOnce(); });
