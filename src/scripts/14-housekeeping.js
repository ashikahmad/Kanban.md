        // ===== Housekeeping nudge =====
        // A quiet bar under the header when the board has grown past its policy (finished tasks left on the
        // board, an old backlog, too many tasks). It only suggests: the one action is "Archive done", which
        // asks first and archives everything in a single edit. The policy is the optional **Housekeeping**
        // line in kanban.md (defaults apply without it); see drafts/mcp-file-plan.md, section 12b.
        const HK_SNOOZE_MS = 7 * 24 * 3600 * 1000;
        let hkState = { suggestions: [], staleIds: new Set() };

        function hkKey(part) { return 'kanbanmd.hk.' + part + '.' + (directoryHandle ? directoryHandle.name : ''); }
        function hkFingerprint(suggestions) { return suggestions.map((s) => s.kind + ':' + s.count).join('|'); }
        function hkHidden(suggestions) {
            try {
                if (parseInt(localStorage.getItem(hkKey('snooze')) || '0', 10) > Date.now()) return true;
                if (localStorage.getItem(hkKey('dismissed')) === hkFingerprint(suggestions)) return true;
            } catch (e) { /* private mode: always show */ }
            return false;
        }

        // Recompute from the current file text. Called before the board renders (the stale set is read
        // while cards are built) and the bar is drawn after.
        function refreshHousekeepingState() {
            hkState = { suggestions: [], staleIds: new Set() };
            if (!kanbanFileHandle || !persistBase) return;
            try {
                const ws = { board: currentKanbanContent, archive: null };
                hkState.suggestions = getHousekeeping(ws).suggestions;
                hkState.staleIds = new Set(staleBacklogIds(ws));
            } catch (e) { console.warn('Housekeeping check skipped:', e && e.message); }
        }

        function updateHousekeepingBar() {
            const bar = document.getElementById('housekeepingBar');
            const settings = document.getElementById('housekeepingBtn');
            if (!bar) return;
            const open = !!(kanbanFileHandle && persistBase);
            if (settings) {
                settings.style.display = open ? 'inline-flex' : 'none';
                settings.querySelector('.mi-label').textContent = t('hk.menu');
            }
            const sugs = hkState.suggestions;
            if (!open || !sugs.length || hkHidden(sugs)) { bar.style.display = 'none'; bar.textContent = ''; return; }

            bar.textContent = '';
            const msgs = document.createElement('div');
            msgs.className = 'hk-msgs';
            sugs.forEach((s) => {
                const m = document.createElement('span');
                m.textContent = t('hk.' + s.kind, { count: s.count, days: s.afterDays, max: s.max });
                msgs.appendChild(m);
            });
            const actions = document.createElement('div');
            actions.className = 'hk-actions';
            const add = (label, handler, cls) => {
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'btn ' + cls + ' btn-sm'; b.textContent = label;
                b.addEventListener('click', handler);
                actions.appendChild(b);
            };
            const done = sugs.find((s) => s.kind === 'archive_done');
            if (done) add(t('hk.archiveBtn', { count: done.count }), hkArchiveDone, 'btn-primary');
            add(t('hk.snooze'), hkSnooze, 'btn-secondary');
            add(t('hk.dismiss'), hkDismiss, 'btn-secondary');
            bar.appendChild(msgs);
            bar.appendChild(actions);
            bar.style.display = 'flex';
        }

        async function hkArchiveDone() {
            const ids = archiveCandidates({ board: currentKanbanContent, archive: null });
            if (!ids.length) return;
            if (!confirm(t('hk.confirmArchive', { count: ids.length }))) return;
            await autoSave();
            const result = await commit([{ type: 'archiveTasks', ids }], { explicit: true });
            if (result.ok) showNotification(t('hk.archived', { count: ids.length }), 'success');
        }

        function hkSnooze() {
            try { localStorage.setItem(hkKey('snooze'), String(Date.now() + HK_SNOOZE_MS)); } catch (e) { /* ignore */ }
            updateHousekeepingBar();
        }

        // Dismiss hides this exact situation; it comes back if the counts change.
        function hkDismiss() {
            try { localStorage.setItem(hkKey('dismissed'), hkFingerprint(hkState.suggestions)); } catch (e) { /* ignore */ }
            updateHousekeepingBar();
        }

        // Edit the policy as text: "done=done after=30d | backlog=backlog after=90d | max=200", "off", or "reset".
        async function editHousekeepingSettings() {
            const current = formatHousekeepingSpec(config.housekeeping);
            const input = prompt(t('hk.settingsPrompt'), current);
            if (input === null) return;
            const spec = input.trim();
            let op;
            if (spec === '' || spec.toLowerCase() === 'reset') op = { type: 'setHousekeeping', reset: true };
            else if (spec.toLowerCase() === 'off') op = { type: 'setHousekeeping', off: true };
            else { const h = parseHousekeepingSpec(spec) || {}; op = { type: 'setHousekeeping', done: h.done, backlog: h.backlog, max: h.max }; }
            await autoSave();
            const result = await commit([op], { explicit: true });
            if (result.ok) {
                try { localStorage.removeItem(hkKey('snooze')); localStorage.removeItem(hkKey('dismissed')); } catch (e) { /* ignore */ }
                refreshHousekeepingState();
                refreshUi();
                showNotification(t('hk.saved'), 'success');
            }
        }
