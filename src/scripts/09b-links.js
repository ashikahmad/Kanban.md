        // ===== Task links: "Blocked by" =====
        // One stored relation (core/links.js): a task lists the ids it waits on, "blocks" is derived. Advice only:
        // a blocked card can still be moved anywhere. The backlog file's tasks live in `tasks` too (their status
        // is the backlog column), so one index covers board, backlog and archive.
        let formBlockedBy = [];

        function linkIndex() {
            const col = backlogColumnId();
            return indexTasks({
                board: tasks.filter((x) => x.status !== col),
                backlog: col ? tasks.filter((x) => x.status === col) : [],
                archive: archivedTasks,
            });
        }

        function blockersNow(task, byId = linkIndex()) {
            return blockersOf(task, byId, config.columns);
        }

        const LOCK_SVG = '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 7.5h8v6H4zM5.5 7.5V5.5a2.5 2.5 0 015 0v2"/></svg>';

        // A column name leads with its emoji ("📝 To Do"): split it into { icon, label }. A name without one
        // has no icon. (Keeps ©, ® and ™ as text, and flags and skin tones whole.)
        const COLUMN_ICON_RE = /^((?:\p{Regional_Indicator}{2})|(?:\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u200D\p{Extended_Pictographic})*))\s*/u;
        function columnParts(task) {
            const c = config.columns.find((x) => x.id === task.status);
            const name = c ? c.name : task.status;
            const m = COLUMN_ICON_RE.exec(name);
            return m && !/^[\u00A9\u00AE\u2122]/.test(m[1]) && name.length > m[0].length
                ? { icon: m[1], label: name.slice(m[0].length) } : { icon: '', label: name };
        }

        // Icon and wording for a task in any file: its column's icon, or 🗃️ once archived.
        function linkStateOf(entry) {
            if (entry.where === 'archive') return { icon: '🗃️', label: t('links.archived') };
            return columnParts(entry.task);
        }

        // The badge on a card: a lock and the number of blockers still open (hidden at zero).
        function blockedBadgeHtml(task, byId) {
            if (!task.blockedBy || !task.blockedBy.length) return '';
            if (config.columns.length && task.status === config.columns[config.columns.length - 1].id) return ''; // finished: nothing left to wait for
            const open = blockersNow(task, byId).open;
            if (!open.length) return '';
            const tip = t('links.badge', { count: open.length, list: open.map((e) => `${linkStateOf(e).icon} ${e.task.id} ${e.task.title}`.trim()).join(', ') });
            return `<span class="badge badge-blocked" title="${escapeHtml(tip)}" role="img" aria-label="${escapeHtml(tip)}">${LOCK_SVG}${open.length}</span>`;
        }

        // Plain text "TASK-012" in a description or note becomes a link when that task exists (not inside a link
        // or a stashed code span; `html` is the already escaped output of markdownToHtml).
        function autolinkTaskIds(html) {
            if (!/TASK-\d+/.test(html)) return html;
            const byId = linkIndex();
            let inAnchor = false;
            return html.split(/(<[^>]*>)/).map((part) => {
                if (part.startsWith('<')) {
                    if (/^<a[\s>]/i.test(part)) inAnchor = true;
                    else if (/^<\/a>/i.test(part)) inAnchor = false;
                    return part;
                }
                if (inAnchor) return part;
                return part.replace(/\bTASK-\d+\b/g, (id) => {
                    const hit = byId.get(id);
                    return hit ? `<a href="#" class="task-link" data-task-link="${id}" title="${escapeHtml(hit.task.title)}">${id}</a>` : id;
                });
            }).join('');
        }

        function openLinkedTask(id) {
            const hit = linkIndex().get(id);
            if (!hit) return;
            if (currentDetailTask && currentDetailTask.id !== id) detailStack = [...detailStack, { id: currentDetailTask.id, archived: detailCtx.archived }].slice(-20);
            showTaskDetail(hit.task, { archived: hit.where === 'archive', fromArchivePanel: detailCtx.fromArchivePanel });
        }

        // "Back to TASK-001" above the detail, once a link has been followed.
        function detailBackHtml() {
            if (!detailStack.length) return '';
            const id = detailStack[detailStack.length - 1].id;
            return `<div><button type="button" class="link-action detail-back" data-detail-back>\u2190 ${escapeHtml(t('links.back', { id }))}</button></div>`;
        }

        // Back to the task the last link was followed from. One that has been deleted meanwhile is skipped.
        function detailBack() {
            while (detailStack.length) {
                const { id, archived } = detailStack[detailStack.length - 1];
                detailStack = detailStack.slice(0, -1);
                const task = (archived ? archivedTasks : tasks).find((x) => x.id === id);
                if (task) return showTaskDetail(task, { archived, fromArchivePanel: detailCtx.fromArchivePanel });
            }
            closeModal();
        }

        // One linked id with its state icon. Finished, archived and unknown ones are faded; the hover text has the
        // title and the column.
        function linkChipHtml(id, entry) {
            if (!entry) return `<span class="link-chip link-chip--muted" title="${escapeHtml(t('links.unknown'))}"><span class="link-ic" aria-hidden="true">\u2754</span>${escapeHtml(id)}</span>`;
            const st = linkStateOf(entry);
            const faded = entry.where === 'archive' || isFinished(entry, config.columns);
            const tip = `${entry.task.title} \u00B7 ${st.label}`;
            const icon = st.icon ? `<span class="link-ic" aria-hidden="true">${st.icon}</span>` : '<span class="link-ic link-dot" aria-hidden="true"></span>';
            return `<a href="#" class="link-chip${faded ? ' link-chip--muted' : ''}" data-task-link="${escapeHtml(id)}" title="${escapeHtml(tip)}">${icon}${escapeHtml(id)}</a>`;
        }

        // The "Blocked by" / "Blocks" part of the detail view: just the linked ids.
        function linksSectionHtml(task, editable) {
            const byId = linkIndex();
            const blockers = (task.blockedBy || []).map((id) => ({ id, entry: byId.get(id) }));
            const blocking = blockedByThis(task.id, byId);
            if (!blockers.length && !blocking.length) return '';
            const backlogNotes = editable ? blockers.filter((b) => b.entry && b.entry.where === 'backlog').map((b) =>
                `<div class="link-banner" role="status">${escapeHtml(t('links.backlogNote', { id: b.id }))} <button type="button" class="link-action" data-promote-blocker="${escapeHtml(b.id)}">${escapeHtml(t('links.moveToBoard'))}</button></div>`).join('') : '';
            const cycle = hasCycle(task.id, byId) ? `<div class="link-warn">${escapeHtml(t('links.cycle'))}</div>` : '';
            return `
                ${blockers.length ? `<div><div class="detail-label">${escapeHtml(t('links.blockedBy'))}</div><div class="link-chips">${blockers.map((b) => linkChipHtml(b.id, b.entry)).join('')}</div>${backlogNotes}${cycle}</div>` : ''}
                ${blocking.length ? `<div><div class="detail-label">${escapeHtml(t('links.blocks'))}</div><div class="link-chips">${blocking.map((e) => linkChipHtml(e.task.id, e)).join('')}</div></div>` : ''}`;
        }

        async function promoteBlocker(id) {
            if (readOnly()) return;
            const col = backlogColumnId();
            const target = config.columns.find((c) => c.id !== col);
            if (!target) return;
            const moved = await moveTask(id, target.id, null, { askOrder: false });
            if (moved) {
                showNotification(t('notif.taskMoved'), 'success');
                if (currentDetailTask) showTaskDetail(currentDetailTask, detailCtx);
            }
        }

        // One delegated handler for every link on the page.
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-detail-back]')) { e.preventDefault(); e.stopPropagation(); detailBack(); return; }
            const link = e.target.closest('[data-task-link]');
            if (link) { e.preventDefault(); e.stopPropagation(); openLinkedTask(link.dataset.taskLink); return; }
            const promote = e.target.closest('[data-promote-blocker]');
            if (promote) { e.preventDefault(); e.stopPropagation(); promoteBlocker(promote.dataset.promoteBlocker); }
        }, true); // capture: a link inside a card must not also open the card

        // ---- the "Blocked by" field of the task form: chips plus a search box ----

        function renderBlockedByField() {
            const wrap = document.getElementById('taskBlockedByField');
            if (!wrap) return;
            const byId = linkIndex();
            const selfId = isEditMode ? document.getElementById('taskEditId').value : '';
            const options = [...byId.values()]
                .filter((e) => e.where !== 'archive' && e.task.id !== selfId && !formBlockedBy.includes(e.task.id))
                .sort((a, b) => a.task.id.localeCompare(b.task.id));
            wrap.innerHTML = `
                <label for="taskBlockedBy">${escapeHtml(t('links.blockedBy'))}</label>
                <div class="chips">${formBlockedBy.map((id) => {
                    const e = byId.get(id);
                    return `<span class="chip"><span class="task-id">${escapeHtml(id)}</span>${e ? ` ${escapeHtml(e.task.title)}` : ` ${escapeHtml(t('links.unknown'))}`}<button type="button" data-unblock="${escapeHtml(id)}" aria-label="${escapeHtml(t('tooltip.delete') + ' ' + id)}">&times;</button></span>`;
                }).join('')}</div>
                <input type="text" id="taskBlockedBy" list="blockedByList" placeholder="${escapeHtml(t('links.add'))}" autocomplete="off">
                <datalist id="blockedByList">${options.map((e) => `<option value="${escapeHtml(e.task.id)}">${escapeHtml(e.task.title)}</option>`).join('')}</datalist>
                <small>${escapeHtml(t('links.help'))}</small>`;
            const input = document.getElementById('taskBlockedBy');
            const add = () => {
                const id = (parseTaskIds(input.value)[0]) || '';
                if (id && !formBlockedBy.includes(id) && options.some((e) => e.task.id === id)) { formBlockedBy.push(id); renderBlockedByField(); document.getElementById('taskBlockedBy').focus(); }
            };
            input.addEventListener('change', add);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
            wrap.querySelectorAll('[data-unblock]').forEach((b) => b.addEventListener('click', () => {
                formBlockedBy = formBlockedBy.filter((x) => x !== b.dataset.unblock);
                renderBlockedByField();
            }));
        }
