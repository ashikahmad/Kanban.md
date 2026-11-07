        // ===== Boards from the web (?board=<url>) =====
        // A board on the page's own site opens at once. One on another site asks first, since opening it makes
        // the browser contact that site. Either way it is read-only: no edit controls, and nothing is saved.
        // The ask and any error show on the start screen (webNotice), so they survive a language switch.
        let webNotice = null; // { kind: 'confirm' | 'error', place, code?, status? }

        function boardParam() { return new URLSearchParams(location.search).get('board'); }

        function stripBoardParam() {
            const url = new URL(location.href);
            url.searchParams.delete('board');
            history.replaceState(null, '', url.href);
        }

        // Called on page load when the address has ?board=.
        async function openBoardParam(param) {
            const place = resolveBoardUrl(param, location.href);
            if (!place) showWebNotice({ kind: 'error', code: 'invalid', place: null });
            else if (place.sameOrigin) await openWebBoard(place);
            else showWebNotice({ kind: 'confirm', place });
            await updateProjectSelector();
        }

        // Burger menu / start screen: ask for an address, then load the page with ?board= so it opens the way a
        // shared link does (another site still asks first). Back returns to the previous board.
        function openBoardFromUrl() {
            const current = source && source.kind === 'web' ? source.href : '';
            const text = prompt(t('prompt.boardUrl'), current);
            if (text === null || !text.trim()) return;
            const place = resolveBoardUrl(text, location.href);
            if (!place) { alert(t('web.error.invalid')); return; }
            const url = new URL(location.href);
            url.search = '';
            url.searchParams.set('board', place.href);
            location.assign(url.href);
        }

        async function openWebBoard(place) {
            const src = webSource(place);
            try {
                const board = await src.read('kanban.md');
                if (!board) throw webError('notFound');
                if (!looksLikeBoard(board.text)) throw webError('notBoard');
            } catch (e) {
                console.warn('Could not open the board:', e);
                showWebNotice({ kind: 'error', code: e.webCode || 'network', status: e.status, place });
                return false;
            }
            webNotice = null;
            useSource(src);
            await loadKanbanFile();
            showBoardView(false);
            return true;
        }

        // The board view once a source has opened. Read-only sources get no New task or column buttons.
        function showBoardView(editable) {
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('kanbanView').style.display = 'block';
            document.getElementById('filterBar').style.display = 'block';
            document.getElementById('archiveBtn').style.display = 'inline-flex';
            if (editable) {
                document.getElementById('newTaskBtn').style.display = 'inline-flex';
                document.getElementById('manageColsBtn').style.display = 'inline-flex';
            }
        }

        function confirmWebBoard() {
            if (!webNotice || webNotice.kind !== 'confirm') return; // already opening (a double click)
            const { place } = webNotice;
            webNotice = null;
            return openWebBoard(place);
        }

        // "Cancel": forget the address and start the way the page normally does.
        async function cancelWebBoard() {
            webNotice = null;
            stripBoardParam();
            renderWelcomeScreen();
            await tryRestorePreviousDirectory();
        }

        function showWebNotice(notice) {
            webNotice = notice;
            renderWelcomeScreen();
        }

        // The ask or the error, as the top of the start screen (see renderWelcomeScreen).
        function webNoticeHtml() {
            if (!webNotice) return '';
            const { kind, place, code, status } = webNotice;
            const where = place
                ? `<p class="web-notice-url"><a href="${escapeHtml(place.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(place.label)}</a></p>`
                : '';
            if (kind === 'confirm') {
                return `<div class="welcome-card web-notice">
                    <h3>${escapeHtml(t('web.confirmTitle'))}</h3>
                    <p>${escapeHtml(t('web.confirmText', { host: new URL(place.href).host }))}</p>
                    ${where}
                    <div class="web-notice-actions">
                        <button class="btn btn-secondary" onclick="cancelWebBoard()">${escapeHtml(t('web.cancel'))}</button>
                        <button class="btn btn-primary" onclick="confirmWebBoard()">${escapeHtml(t('web.confirmOpen'))}</button>
                    </div>
                </div>`;
            }
            return `<div class="welcome-card web-notice web-notice--error" role="alert">
                <h3>${escapeHtml(t('web.errorTitle'))}</h3>
                <p>${escapeHtml(t('web.error.' + code, { status: status || '' }))}</p>
                ${where}
            </div>`;
        }

        // The "open" group of the menu follows the source. Browsers without the File System Access API can only
        // take a read-only snapshot, which the label says. On a page served by `kanbanmd serve`, picking a folder
        // leaves the served one, so the label says "another" and a "Back to" item returns to it.
        function updateSourceMenu() {
            const svc = window.KANBANMD_SERVICE;
            const canEdit = 'showDirectoryPicker' in window;
            const folder = document.querySelector('#selectFolderBtn .mi-label');
            if (folder) folder.textContent = t(!canEdit ? 'header.folderReadOnly' : svc ? 'header.folderAnother' : 'header.folder');
            for (const id of ['pickedRefreshBtn', 'pickedEditBtn']) document.getElementById(id).style.display = source && source.kind === 'picked' ? '' : 'none';
            document.querySelector('#pickedRefreshBtn .mi-label').textContent = t('header.refreshFolder');
            document.getElementById('pickedRefreshBtn').title = t('picked.againHint');
            document.querySelector('#pickedEditBtn .mi-label').textContent = t('picked.edit');
            document.getElementById('pickedEditBtn').title = t('picked.editHint');
            applyPickDialogTexts();
            const back = document.getElementById('serviceBackBtn');
            if (back) {
                back.style.display = svc && !(source && source.kind === 'service') ? '' : 'none';
                back.querySelector('.mi-label').textContent = t('header.backToService');
                back.title = (svc && svc.path) || '';
            }
        }

        // Body class, menu and status bar (03e-status-bar.js) for the open source. Leaving a web board for a folder
        // also drops ?board= from the address, so a reload opens the folder and not the web board again.
        function applySourceUi() {
            updateSourceMenu();
            document.body.classList.toggle('readonly', readOnly());
            renderStatusBar();
            if (source && source.kind !== 'web' && boardParam() !== null) stripBoardParam();
        }
