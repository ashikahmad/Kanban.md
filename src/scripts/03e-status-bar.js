        // ===== Status bar (the footer) =====
        // Always says where the board comes from and, when the page was served by `kanbanmd serve`, whether that
        // service is still reachable, even while another folder or a web board is open. Left: the open source
        // (and the way back to the served board). Right: when a writable board was last checked against its files.
        let serviceState = 'ok'; // 'ok', 'stopped' (kanbanmd cannot be reached) or 'expired' (its access key is no longer valid)
        let lastSyncAt = 0;

        function serviceStateOf(status) { return status === 401 || status === 403 ? 'expired' : 'ok'; }

        function setServiceState(next) {
            if (next === serviceState) return;
            serviceState = next;
            renderStatusBar();
        }

        // Called after each successful change check (04a-persist.js).
        function markSynced() {
            lastSyncAt = Date.now();
            const el = document.getElementById('statusSync');
            if (el && source && source.writable) el.textContent = t('status.synced', { time: new Date(lastSyncAt).toLocaleTimeString() });
        }

        // While another source is open, nothing else talks to the service, so ask it every few seconds.
        async function probeService() {
            const svc = window.KANBANMD_SERVICE;
            let state;
            try {
                const res = await fetch(`${svc.api}/file/kanban.md`, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin', headers: { 'X-Kanbanmd': '1' } });
                state = serviceStateOf(res.status);
            } catch (e) { state = 'stopped'; }
            setServiceState(state);
            return state;
        }
        async function pingService() {
            if (!window.KANBANMD_SERVICE || document.visibilityState !== 'visible' || (source && source.kind === 'service')) return;
            await probeService();
        }
        setInterval(pingService, 3000);

        const LOCK_ICON = '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';

        function renderStatusBar() {
            const bar = document.getElementById('statusBar');
            if (!bar) return;
            // A served page keeps the bar even with no board open (a web board failed to open): the way back is here.
            const show = !!source || !!window.KANBANMD_SERVICE;
            document.body.classList.toggle('has-status', show);
            bar.style.display = show ? '' : 'none';
            bar.textContent = '';
            if (!show) return;

            const el = (tag, cls, text) => {
                const n = document.createElement(tag);
                if (cls) n.className = cls;
                if (text !== undefined) n.textContent = text;
                return n;
            };
            const dot = (state) => { const d = el('span', `status-dot status-dot--${state}`); d.setAttribute('aria-hidden', 'true'); return d; };
            const svc = window.KANBANMD_SERVICE;
            const stateText = { ok: '', stopped: t('status.stopped'), expired: t('status.expired') };
            const left = el('div', 'status-left');
            left.setAttribute('role', 'status');

            if (!source) {
                // nothing open
            } else if (source.kind === 'service') {
                const seg = el('span', 'status-seg');
                seg.title = source.path;
                if (serviceState === 'ok') seg.append(dot('ok'), el('strong', '', t('status.served')), el('span', 'status-label', source.label));
                else seg.append(dot(serviceState), el('strong', '', stateText[serviceState]));
                left.append(seg);
            } else if (source.writable) {
                if (source.label) { const seg = el('span', 'status-seg'); seg.append(el('span', 'status-label', source.label)); left.append(seg); }
            } else {
                const seg = el('span', 'status-seg');
                const badge = el('strong', 'status-badge');
                badge.innerHTML = LOCK_ICON;
                badge.append(t('web.readOnly'));
                let name;
                if (source.href) {
                    name = el('a', 'status-label', source.label);
                    name.href = source.href; name.target = '_blank'; name.rel = 'noopener noreferrer';
                } else name = el('span', 'status-label', source.label); // a picked folder has no address
                seg.append(badge, name);
                left.append(seg);
            }

            // Away from the served board: its state, and a way back.
            if (svc && !(source && source.kind === 'service')) {
                const chip = el('button', 'btn btn-ghost btn-sm status-chip');
                chip.type = 'button';
                chip.title = svc.path || '';
                chip.append(dot(serviceState), el('span', '', serviceState === 'ok' ? t('header.backToService') : stateText[serviceState]));
                chip.addEventListener('click', backToServiceBoard);
                left.append(chip);
            }

            const sync = el('span', 'status-sync');
            sync.id = 'statusSync';
            if (source && source.writable && lastSyncAt) sync.textContent = t('status.synced', { time: new Date(lastSyncAt).toLocaleTimeString() });
            else if (source && !source.writable && sourceOpenedAt) {
                sync.textContent = t('status.read', { time: new Date(sourceOpenedAt).toLocaleTimeString() });
                sync.title = new Date(sourceOpenedAt).toLocaleString();
            }
            bar.append(left, sync);
        }
