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
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('kanbanView').style.display = 'block';
            document.getElementById('filterBar').style.display = 'block';
            document.getElementById('archiveBtn').style.display = 'inline-flex';
            return true;
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

        // Body class and banner for the open source. Leaving a web board for a folder also drops ?board= from the
        // address, so a reload opens the folder and not the web board again.
        function applySourceUi() {
            const ro = readOnly();
            document.body.classList.toggle('readonly', ro);
            const bar = document.getElementById('sourceBar');
            if (bar) {
                bar.textContent = '';
                bar.style.display = ro ? '' : 'none';
                if (ro) {
                    const badge = document.createElement('span');
                    badge.className = 'source-badge';
                    badge.textContent = t('web.readOnly');
                    const link = document.createElement('a');
                    link.className = 'source-link';
                    link.href = source.href || '#';
                    link.target = '_blank'; link.rel = 'noopener noreferrer';
                    link.textContent = source.label;
                    bar.append(badge, link);
                    if ('showDirectoryPicker' in window) {
                        const open = document.createElement('button');
                        open.type = 'button'; open.className = 'btn btn-secondary btn-sm';
                        open.textContent = t('web.openFolder');
                        open.addEventListener('click', () => document.getElementById('selectFolderBtn').click());
                        bar.appendChild(open);
                    }
                }
            }
            if (source && source.kind !== 'web' && boardParam() !== null) stripBoardParam();
        }
