        // ===== Read-only board from a URL =====
        // On startup, when no folder project is restored, the page looks for a board to show:
        //   1. ?board=<url>   an explicit kanban.md (http/https only), and
        //   2. kanban.md next to the page, when the page itself is served over http/https.
        // The board (plus a sibling archive.md and its backlog file, when they exist) is fetched, parsed with the
        // same core as a folder project, and shown read-only: no file handle exists, so nothing can be saved.
        // Opening a folder afterwards (loadKanbanFile) leaves read-only mode.
        const REMOTE_HIDDEN_ELEMENTS = ['newTaskBtn', 'archiveBtn', 'manageColsBtn'];

        function remoteBoardUrl() {
            const param = new URLSearchParams(location.search).get('board');
            const explicit = !!param;
            let url;
            try {
                if (explicit) url = new URL(param, location.href);
                else if (/^https?:$/.test(location.protocol)) url = new URL('kanban.md', location.href);
                else return null; // opened from disk: the browser does not let a page read its neighbours
            } catch (e) { return null; }
            return /^https?:$/.test(url.protocol) ? { url, explicit } : null;
        }

        async function fetchText(url, { required }) {
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) return null;
                const text = await res.text();
                if (/^\s*<(!doctype|html)/i.test(text)) return null; // a server that answers every path with its home page
                return text;
            } catch (e) {
                if (required) console.warn('Board fetch failed:', e && e.message);
                return null;
            }
        }

        async function tryOpenRemoteBoard() {
            const target = remoteBoardUrl();
            if (!target) return false;
            const { url, explicit } = target;
            const boardText = await fetchText(url, { required: explicit });
            if (boardText === null) {
                if (explicit) showNotification(t('remote.loadError', { source: url.href }), 'error');
                return false;
            }
            const archiveText = await fetchText(new URL('archive.md', url), { required: false });
            let backlogText = null;
            const backlogName = backlogFileNameOf(boardText);
            if (backlogName) backlogText = await fetchText(new URL(backlogName, url), { required: false });

            readOnlyBoard = true;
            document.body.classList.add('read-only');
            adoptTexts(boardText, archiveText, backlogText, { force: true });
            updateAutocomplete();
            renderKanban();
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('kanbanView').style.display = 'block';
            document.getElementById('filterBar').style.display = 'block';
            REMOTE_HIDDEN_ELEMENTS.forEach((id) => { document.getElementById(id).style.display = 'none'; });
            showReadOnlyBanner(url.href);
            return true;
        }

        function showReadOnlyBanner(source) {
            let bar = document.getElementById('readOnlyBar');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'readOnlyBar';
                bar.className = 'ro-bar';
                bar.setAttribute('role', 'status');
                document.getElementById('kanbanView').before(bar);
            }
            bar.textContent = t('remote.banner', { source });
            bar.style.display = 'block';
        }

        function exitReadOnlyBoard() {
            if (!readOnlyBoard) return;
            readOnlyBoard = false;
            document.body.classList.remove('read-only');
            const bar = document.getElementById('readOnlyBar');
            if (bar) bar.style.display = 'none';
        }
