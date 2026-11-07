        // ===== Refreshing a read-only board =====
        // A web board or a picked folder is a snapshot. The status bar's read-time button reads it again: a web board
        // is fetched anew; a picked folder cannot be (browsers give a page no path to re-read), so it asks the user to
        // choose the folder again. Either way a new source is compared with the open one by its version tokens (see
        // fingerprint), the board is redrawn only when something changed, and a toast says which it was.
        let refreshing = false;

        function setRefreshing(on) {
            refreshing = on;
            renderStatusBar();
        }

        // Make `next` (a freshly read source for the same board) the open one, unless it holds exactly what is open.
        // Returns true when the board changed. Throws when `next` cannot be read: the open board stays as it was.
        async function adoptRefreshed(next) {
            const board = await next.read('kanban.md');
            if (!board) throw webError('notFound');
            if (!looksLikeBoard(board.text)) throw webError('notBoard');
            const now = { board: board.version, archive: await next.version('archive.md'), backlog: await next.version(backlogFileNameOf(board.text)) };
            let before = null;
            try { before = await readVersions(); } catch (e) { /* an old picked file may have changed on disk: count as changed */ }
            if (before && deepEqual(before, now)) {
                sourceOpenedAt = Date.now(); // still looked at just now: the read time moves, the board stays
                renderStatusBar();
                return false;
            }
            const view = document.getElementById('kanbanView'), top = view.scrollTop, left = view.scrollLeft;
            useSource(next);
            await loadKanbanFile();
            showBoardView(false);
            view.scrollTop = top; view.scrollLeft = left;
            return true;
        }

        // The footer's read-time button.
        async function refreshBoard() {
            if (!source || source.writable || refreshing) return;
            if (source.kind === 'picked') { refreshPickedFolder(); return; }
            setRefreshing(true);
            try {
                const changed = await adoptRefreshed(webSource(source.place));
                showNotification(t(changed ? 'status.refreshed' : 'status.upToDate'), 'success');
            } catch (e) {
                console.warn('Could not refresh the board:', e);
                showNotification(t('status.refreshFailed'), 'error');
            } finally { setRefreshing(false); }
        }
