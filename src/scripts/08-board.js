        function renderKanban() {
            const board = document.getElementById('kanbanBoard');
            board.innerHTML = '';
            refreshHousekeepingState(); // before the cards are built: stale ones are marked as they are created

            console.log('Rendering kanban with', tasks.length, 'tasks');

            // Nothing loaded yet (e.g. language switched on the welcome screen): skip rendering
            if (!config.columns || config.columns.length === 0) {
                return;
            }

            // Debug info
            const debugInfo = document.getElementById('debugInfo');
            debugInfo.textContent = `Loaded ${tasks.length} tasks\nColumns: ${config.columns.map(c => c.name).join(', ')}`;
            // debugInfo.style.display = 'block'; // Uncomment to show debug info

            const backlogCol = backlogColumnId();
            const editable = !readOnly();
            config.columns.forEach(column => {
                const isBacklogStub = column.id === backlogCol; // its cards live in the backlog file and have their own panel
                const columnTasks = orderedTasks(tasks).filter(t => t.status === column.id && matchesFilters(t));
                const shownCount = isBacklogStub ? tasks.filter(t => t.status === column.id).length : columnTasks.length;
                console.log(`Column ${column.id}: ${columnTasks.length} tasks`);

                const columnEl = document.createElement('div');
                columnEl.className = isBacklogStub ? 'kanban-column is-rail is-backlog' : 'kanban-column';
                columnEl.dataset.columnId = column.id;

                // The backlog rail keeps the column's own icon upright in the title row; only the words turn in the rail.
                const split = isBacklogStub ? splitColumnIcon(column.name) : null;
                const titleHtml = split && split.icon
                    ? `<span class="rail-title-icon">${escapeHtml(split.icon)}</span><span class="rail-title-words"> ${escapeHtml(split.words)} <span class="column-count">${shownCount}</span></span>`
                    : `${escapeHtml(column.name)}
                            <span class="column-count">${shownCount}</span>`;

                columnEl.innerHTML = `
                    <div class="column-header">
                        <div class="column-title">
                            ${titleHtml}
                        </div>
                        <div class="column-tools">
                            ${editable ? `<button class="column-add-btn" aria-label="${escapeHtml(t('taskForm.newTask'))}"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg></button>` : ''}
                        </div>
                    </div>
                    <div class="task-list" ondrop="drop(event)" ondragover="allowDrop(event)">
                        ${!isBacklogStub && columnTasks.length === 0 ? `<div class="empty-state">${t('empty.noTasks')}</div>` : ''}
                    </div>
                `;

                const taskList = columnEl.querySelector('.task-list');

                // Bind the per-column "+" handler in JS (no inline onclick) so the
                // column id is passed as a value, never concatenated into HTML.
                const addBtn = columnEl.querySelector('.column-add-btn');
                if (addBtn) {
                    addBtn.title = t('taskForm.newTask');
                    addBtn.addEventListener('click', () => openTaskModal(null, column.id));
                }

                if (isBacklogStub) {
                    taskList.appendChild(buildRailStub({
                        name: split.words || column.name, count: shownCount,
                        note: t('backlog.stub', { file: resolveBacklogFile(config).file }),
                        openLabel: t('backlog.open'), onOpen: openBacklogModal
                    }));
                    openRailOnTap(columnEl, openBacklogModal);
                    // Dragging a card over the rail opens it, as hover would (a drag suppresses :hover in some browsers).
                    // dragenter/dragleave fire for every child too, so count them instead of trusting relatedTarget.
                    let depth = 0;
                    columnEl.addEventListener('dragenter', () => { depth++; columnEl.classList.add('is-open'); });
                    columnEl.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) columnEl.classList.remove('is-open'); });
                    columnEl.addEventListener('drop', () => { depth = 0; columnEl.classList.remove('is-open'); });
                } else {
                    columnTasks.forEach(task => {
                        const taskEl = createTaskElement(task);
                        taskList.appendChild(taskEl);
                    });
                }

                board.appendChild(columnEl);
            });
            appendArchiveRail(board);
            updateHousekeepingBar();
        }

        // A column name's leading emoji (flags and skin tones included; (c), (R) and TM are text) and the words after it.
        function splitColumnIcon(name) {
            const m = !/^[\u00A9\u00AE\u2122]/.test(name)
                && /^((?:\p{Regional_Indicator}{2}|[\p{Emoji_Presentation}\p{Extended_Pictographic}])[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\p{Emoji_Presentation}\p{Extended_Pictographic}]*)\s*(.*)$/u.exec(name);
            return m ? { icon: m[1], words: m[2] } : { icon: '', words: name };
        }

        // The quiet content of a rail column. At rest only the rail button (count and vertical name) shows; on hover or focus
        // the column widens and the stub (count, where it is kept, an open button) takes over. The rail button stays in the
        // tab order when the stub is showing (visually hidden), so keyboard focus is never dropped by the widening.
        // The whole rail is a tap target, not just its label: on a phone nothing hints that only the top is live. Buttons keep
        // their own handlers (the rail button, the column's +), so they are left alone here.
        function openRailOnTap(columnEl, onOpen) {
            columnEl.addEventListener('click', (e) => { if (!e.target.closest('button')) onOpen(); });
        }

        function buildRailStub({ name, count, note, openLabel, onOpen }) {
            const stub = document.createElement('div');
            stub.className = 'rail-stub';
            const rail = document.createElement('button');
            rail.type = 'button'; rail.className = 'rail-button';
            rail.setAttribute('aria-label', `${name}: ${openLabel}`);
            const railCount = document.createElement('span');
            railCount.className = 'rail-count'; railCount.textContent = String(count);
            const railName = document.createElement('span');
            railName.className = 'rail-name'; railName.textContent = name;
            rail.append(railCount, railName);
            rail.addEventListener('click', onOpen);
            const body = document.createElement('div');
            body.className = 'rail-stub-body';
            const big = document.createElement('div');
            big.className = 'rail-stub-count'; big.textContent = String(count);
            const noteEl = document.createElement('div');
            noteEl.className = 'rail-stub-note'; noteEl.textContent = note;
            const hint = document.createElement('div');
            hint.className = 'rail-stub-hint'; hint.textContent = t('rail.hint'); // the whole rail opens it: no button needed
            body.append(big, noteEl, hint);
            stub.append(rail, body);
            return stub;
        }

        // The archive as a last, thin column when there is something in it. It only opens the archive panel: cards are not
        // dropped on it (use the card's Archive action).
        function appendArchiveRail(board) {
            if (!archivedTasks.length) return;
            const name = t('header.archives');
            const columnEl = document.createElement('div');
            columnEl.className = 'kanban-column is-rail is-archive';
            columnEl.innerHTML = `
                <div class="column-header">
                    <div class="column-title">
                        <span class="rail-title-icon">\u{1F5C3}\uFE0F</span><span class="rail-title-words"> ${escapeHtml(name)} <span class="column-count">${archivedTasks.length}</span></span>
                    </div>
                </div>
                <div class="task-list"></div>`;
            columnEl.querySelector('.task-list').appendChild(buildRailStub({
                name, count: archivedTasks.length, note: t('archive.stub'), openLabel: t('archive.open'), onOpen: openArchiveModal
            }));
            openRailOnTap(columnEl, openArchiveModal);
            // Last column: widening pushes it past the right edge, so scroll just enough to show it once it has grown.
            const reveal = () => setTimeout(() => {
                const view = document.getElementById('kanbanView');
                const over = columnEl.getBoundingClientRect().right - view.getBoundingClientRect().right;
                if (over > 0) view.scrollBy({ left: over + 8, behavior: 'smooth' });
            }, 200);
            columnEl.addEventListener('mouseenter', reveal);
            columnEl.addEventListener('focusin', reveal);
            board.appendChild(columnEl);
        }

        // Deadline visibility: classify a task by its **Due** date so the card can surface it.
        // Returns 'overdue' (due date is before today), 'soon' (due within the next 2 days,
        // today included), or null. A task with a Finished date (task.completed) is never flagged
        // — it's done. Dates are compared at LOCAL midnight (parsed field-by-field, not via
        // new Date("YYYY-MM-DD") which is UTC) to avoid a timezone off-by-one near midnight.
        function dueStatus(task) {
            if (!task.due || task.completed) return null;
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(task.due.trim());
            if (!m) return null;
            const due = new Date(+m[1], +m[2] - 1, +m[3]);
            // Reject impossible calendar dates: JS rolls "2026-02-31" over to 2026-03-03, which
            // isNaN never catches — verify the constructed date matches the parsed fields.
            if (due.getFullYear() !== +m[1] || due.getMonth() !== +m[2] - 1 || due.getDate() !== +m[3]) return null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const days = Math.round((due - today) / 86400000);
            if (days < 0) return 'overdue';
            if (days <= 2) return 'soon';
            return null;
        }

        // Create task element
        function createTaskElement(task) {
            const taskEl = document.createElement('div');
            taskEl.className = 'task-card';
            if (hkState.staleIds.has(task.id)) { taskEl.classList.add('hk-stale'); taskEl.title = t('hk.staleCard'); }
            const editable = !readOnly();
            taskEl.draggable = editable;
            taskEl.dataset.taskId = task.id;

            // Deadline accent on the card border (red overdue / orange due-soon).
            const due = dueStatus(task);
            if (due) taskEl.classList.add(`task-card--${due}`);


            const doneCount = task.subtasks.filter(s => s.completed).length;
            const subtaskProgress = task.subtasks.length > 0 ?
                `<div class="task-subtasks">
                    <div class="subtask-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(doneCount / task.subtasks.length * 100)}%"></div>
                        </div>
                        <span>${doneCount}/${task.subtasks.length}</span>
                    </div>
                </div>` : '';

            const dueLabel = task.due
                ? `<span class="badge badge-due${due ? ` badge-due--${due}` : ''}" title="${escapeHtml(t(due === 'overdue' ? 'tooltip.overdue' : (due === 'soon' ? 'tooltip.dueSoon' : 'meta.due')))}">${escapeHtml(task.due)}</span>`
                : '';

            taskEl.innerHTML = `
                <div class="task-header">
                    ${task.priority ? `${priorityIcon(task.priority, `data-filter="priority" data-filter-value="${escapeHtml(task.priority)}" title="${escapeHtml(priorityLabel(task.priority))}" role="img" aria-label="${escapeHtml(priorityLabel(task.priority))}"`)}` : ''}
                    <span class="task-id">${escapeHtml(task.id)}</span>
                    ${editable ? `<button class="task-edit-btn" data-edit-task="1" title="${escapeHtml(t('taskDetail.edit'))}" aria-label="${escapeHtml(t('taskDetail.edit'))}"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 2.5l3 3L5 14H2v-3z"/></svg></button>` : ''}
                </div>
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${task.description ? `<div class="task-description">${markdownToHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    ${dueLabel}
                    ${task.category ? `<span class="badge" data-filter="category" data-filter-value="${escapeHtml(task.category)}" title="${t('tooltip.filterByCategory')}">${escapeHtml(task.category)}</span>` : ''}
                    ${task.assignees.map(a => {
                        const normalizedId = normalizeUserId(a);
                        return `<span class="badge" data-filter="user" data-filter-value="${escapeHtml(normalizedId)}" title="${t('tooltip.filterByUser')}">${escapeHtml(a)}</span>`;
                    }).join('')}
                    ${task.tags.map(tag => `<span class="tag" data-filter="tag" data-filter-value="${escapeHtml(tag)}" title="${t('tooltip.filterByTag')}">${escapeHtml(tag)}</span>`).join('')}
                </div>
                ${subtaskProgress}
            `;

            // Bind handlers in JS (values passed via closure / dataset, never concatenated into HTML → no XSS)
            const editBtn = taskEl.querySelector('[data-edit-task]');
            if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); openTaskModal(task); });
            taskEl.querySelectorAll('[data-filter]').forEach(el => {
                el.addEventListener('click', (e) => { e.stopPropagation(); clickToFilter(el.dataset.filter, el.dataset.filterValue); });
            });

            if (editable) taskEl.addEventListener('dragstart', drag);
            taskEl.addEventListener('click', () => showTaskDetail(task));
            if (editable) attachTouchDrag(taskEl);

            return taskEl;
        }

        // Drag & Drop
        function allowDrop(event) {
            event.preventDefault();
        }

        function drag(event) {
            event.dataTransfer.setData('taskId', event.target.dataset.taskId);
            event.target.classList.add('dragging');
        }

        // Id of the card the dragged task should be inserted BEFORE, given a vertical
        // drop position (classic reorder pattern). Returns null to append at the end.
        function getDropBeforeId(taskListEl, y, excludeId = null) {
            const cards = [...taskListEl.querySelectorAll('.task-card:not(.dragging)')];
            for (const card of cards) {
                if (card.dataset.taskId === excludeId) continue;
                const rect = card.getBoundingClientRect();
                if (y < rect.top + rect.height / 2) return card.dataset.taskId;
            }
            return null;
        }

        // Move a task: set its status and, when a position is given, place it before `beforeTaskId` (or
        // at the end of the column). This is an explicit op applied to the file as it is now (see
        // 04a-persist.js); with manual ordering on it writes an Order key instead of relocating a block.
        // Resolves true if the files changed.
        async function moveTask(taskId, newStatus, beforeTaskId = null, { askOrder = true } = {}) {
            if (readOnly()) return false;
            await autoSave(); // flush pending edits first
            const task = tasks.find(t => t.id === taskId);
            if (!task) return false;
            const status = newStatus || task.status;
            const op = beforeTaskId
                ? { type: 'moveTask', id: taskId, status, before: beforeTaskId }
                : { type: 'moveTask', id: taskId, status, atEnd: true };
            // Would this change anything? (A drop where the card already is must not ask or write.)
            const disk = await readProjectFiles();
            try { if (!applyOps({ board: disk.board, archive: disk.archive, backlog: disk.backlog }, [op]).files.length) return false; }
            catch (e) { /* the commit below reports it */ }
            const ops = [op];
            // First manual drop on a board with no Order keys: ask once whether to remember the order.
            // (Not for a drop into the backlog column, where positions do not exist, nor when the caller says it is not a reorder.)
            if (askOrder && status !== backlogColumnId() && !orderingActive() && resolveOrderChoice() === 'on') ops.unshift({ type: 'sortTasks', mode: 'positions' });
            const result = await commit(ops, { explicit: true });
            return result.ok && result.changed;
        }

        function drop(event) {
            event.preventDefault();
            if (readOnly()) return;
            const taskId = event.dataTransfer.getData('taskId');

            // Find the target column's task list
            let dropTarget = event.target;
            while (dropTarget && !dropTarget.classList.contains('task-list')) {
                dropTarget = dropTarget.parentElement;
            }
            if (!dropTarget || !dropTarget.classList.contains('task-list')) return;

            const newStatus = dropTarget.closest('.kanban-column').dataset.columnId;
            // Compute the drop position (which card to insert before) excluding the dragged card
            const beforeId = getDropBeforeId(dropTarget, event.clientY, taskId);
            const draggedEl = document.querySelector(`[data-task-id="${taskId}"]`);
            if (draggedEl) draggedEl.classList.remove('dragging');

            // moveTask handles both cross-column moves and within-column reordering
            moveTask(taskId, newStatus, beforeId).then((moved) => {
                if (moved) showNotification(t('notif.taskMoved'), 'success');
            });
        }

        // ===== Touch drag & drop (mobile) — HTML5 DnD does not fire on touch devices (issue #12) =====
        let touchDrag = null;

        function attachTouchDrag(taskEl) {
            taskEl.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                const tch = e.touches[0];
                touchDrag = {
                    taskId: taskEl.dataset.taskId,
                    el: taskEl,
                    startX: tch.clientX,
                    startY: tch.clientY,
                    active: false,
                    // Long-press to start dragging (otherwise the touch is a scroll/tap)
                    timer: setTimeout(() => {
                        if (touchDrag) {
                            touchDrag.active = true;
                            taskEl.classList.add('dragging');
                            if (navigator.vibrate) navigator.vibrate(10);
                        }
                    }, 250)
                };
            }, { passive: true });

            taskEl.addEventListener('touchmove', (e) => {
                if (!touchDrag) return;
                const tch = e.touches[0];
                if (!touchDrag.active) {
                    // Moved before the long-press fired → treat as scroll, cancel the pending drag
                    if (Math.abs(tch.clientX - touchDrag.startX) > 10 || Math.abs(tch.clientY - touchDrag.startY) > 10) {
                        clearTimeout(touchDrag.timer);
                        touchDrag = null;
                    }
                    return;
                }
                e.preventDefault(); // block page scroll while dragging
                const under = document.elementFromPoint(tch.clientX, tch.clientY);
                const col = under && under.closest('.kanban-column');
                document.querySelectorAll('.kanban-column').forEach(c => c.classList.toggle('drop-target', c === col));
            }, { passive: false });

            const endHandler = (e) => {
                if (!touchDrag) return;
                clearTimeout(touchDrag.timer);
                if (touchDrag.active) {
                    e.preventDefault(); // suppress the synthetic click that follows a drag
                    touchDrag.el.classList.remove('dragging');
                    const tch = e.changedTouches[0];
                    const under = document.elementFromPoint(tch.clientX, tch.clientY);
                    const col = under && under.closest('.kanban-column');
                    document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drop-target'));
                    if (col) {
                        const newStatus = col.dataset.columnId;
                        const taskList = col.querySelector('.task-list');
                        const beforeId = getDropBeforeId(taskList, tch.clientY, touchDrag.taskId);
                        moveTask(touchDrag.taskId, newStatus, beforeId).then((moved) => {
                            if (moved) showNotification(t('notif.taskMoved'), 'success');
                        });
                    }
                }
                touchDrag = null;
            };
            taskEl.addEventListener('touchend', endHandler, { passive: false });
            taskEl.addEventListener('touchcancel', endHandler, { passive: false });
        }

        // Show task detail
