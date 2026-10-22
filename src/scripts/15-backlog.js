        // ===== Backlog file panel =====
        // With a backlog file (optional: the "**Backlog file**:" config line), the backlog column's tasks live in
        // backlog.md and the column on the board is a stub. This panel lists them, lets you promote one to a
        // column, archive it, or open it. A task's status decides its file, so every action is an ordinary
        // status change; see drafts/mcp-file-plan.md (12b, steps 8-9).
        function backlogColumnId() {
            const bc = resolveBacklogFile(config);
            return bc ? bc.column : null;
        }

        function backlogTasksNow() {
            const col = backlogColumnId();
            return col ? orderedTasks(tasks).filter((x) => x.status === col) : [];
        }

        function openBacklogModal() {
            if (!backlogColumnId()) return;
            document.getElementById('backlogSearch').value = '';
            renderBacklogList();
            document.getElementById('backlogModal').classList.add('active');
        }

        function closeBacklogModal() {
            document.getElementById('backlogModal').classList.remove('active');
        }

        function renderBacklogList(term = '') {
            const list = document.getElementById('backlogList');
            const col = backlogColumnId();
            if (!list || !col) return;
            const all = backlogTasksNow();
            document.getElementById('backlogModalTitle').textContent = `${t('backlog.title')} (${all.length})`;
            const q = term.trim().toLowerCase();
            const rows = q ? all.filter((x) => [x.id, x.title, x.description, x.category, ...x.tags].join(' ').toLowerCase().includes(q)) : all;
            if (!rows.length) { list.innerHTML = `<div class="empty-state">${escapeHtml(t('backlog.empty'))}</div>`; return; }
            const editable = !readOnly();
            const targets = editable ? config.columns.filter((c) => c.id !== col) : [];
            list.innerHTML = rows.map((task) => `
                <div class="archive-item${hkState.staleIds.has(task.id) ? ' hk-stale' : ''}" style="cursor: pointer;" data-id="${escapeHtml(task.id)}">
                    <div class="top">
                        <div>
                            <span class="task-id">${escapeHtml(task.id)}</span>
                            <strong style="margin-left: var(--s-2);">${escapeHtml(task.title)}</strong>
                        </div>
                        <div style="display: flex; gap: var(--s-2); flex-wrap: wrap; justify-content: flex-end;">
                            ${targets.map((c) => `<button data-action="promote" data-status="${escapeHtml(c.id)}" class="btn btn-secondary btn-sm" title="${escapeHtml(t('backlog.moveTo', { name: c.name }))}">&rarr; ${escapeHtml(c.name)}</button>`).join('')}
                            ${editable ? `<button data-action="archive" class="btn btn-secondary btn-sm">${escapeHtml(t('backlog.archive'))}</button>` : ''}
                        </div>
                    </div>
                    ${task.description ? `<div class="desc">${markdownToHtml(task.description)}</div>` : ''}
                    <div class="task-meta">
                        ${task.priority ? `<span class="badge">${priorityHtml(task.priority)}</span>` : ''}
                        ${task.category ? `<span class="badge">${escapeHtml(task.category)}</span>` : ''}
                        ${task.tags.map((g) => `<span class="tag">${escapeHtml(g)}</span>`).join('')}
                        ${hkState.staleIds.has(task.id) ? `<span class="badge">${escapeHtml(t('backlog.old'))}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }

        // One delegated handler: ids come from data-id, never concatenated into inline JS.
        async function onBacklogListClick(e) {
            const item = e.target.closest('.archive-item');
            if (!item) return;
            const id = item.dataset.id;
            const button = e.target.closest('[data-action]');
            const action = button && button.dataset.action;
            if (action === 'promote') {
                const moved = await moveTask(id, button.dataset.status, null, { askOrder: false });
                if (moved) showNotification(t('notif.taskMoved'), 'success');
            } else if (action === 'archive') {
                const task = tasks.find((x) => x.id === id);
                if (!task || !confirm(t('confirm.archiveTask', { title: task.title }))) return;
                await runOrderOp({ type: 'archiveTask', id }, 'notif.taskArchived');
            } else {
                const task = tasks.find((x) => x.id === id);
                if (task) showTaskDetail(task);
            }
        }

        // Turn the backlog file on (its column's tasks move into it) or off (they come home).
        async function toggleBacklogFile() {
            if (readOnly()) return; // a board from the web is never changed
            const current = resolveBacklogFile(config);
            if (current) {
                if (!confirm(t('backlog.confirmOff', { count: backlogTasksNow().length, file: current.file }))) return;
                await runOrderOp({ type: 'setBacklogFile', enabled: false }, 'backlog.offDone');
                return;
            }
            let column = (resolveBacklogFile({ columns: config.columns, backlogFile: { file: 'backlog.md' } }) || {}).column;
            if (!column) {
                column = (prompt(t('backlog.askColumn', { ids: config.columns.map((c) => c.id).join(', ') }), '') || '').trim();
                if (!column) return;
            }
            const count = tasks.filter((x) => x.status === column).length;
            if (!confirm(t('backlog.confirmOn', { count, column }))) return;
            await runOrderOp({ type: 'setBacklogFile', enabled: true, column }, 'backlog.onDone');
        }

        function updateBacklogMenu() {
            const toggle = document.getElementById('backlogToggleBtn');
            const open = document.getElementById('backlogOpenBtn');
            if (!toggle || !open) return;
            const loaded = boardLoaded();
            const on = loaded && !!backlogColumnId();
            toggle.style.display = loaded && !readOnly() ? 'inline-flex' : 'none';
            open.style.display = on ? 'inline-flex' : 'none';
            toggle.querySelector('.mi-label').textContent = t(on ? 'backlog.menuOn' : 'backlog.menuOff');
            open.querySelector('.mi-label').textContent = t('backlog.openMenu');
        }

        document.getElementById('backlogSearch').addEventListener('input', (e) => renderBacklogList(e.target.value));
