        function showTaskDetail(task) {
            currentDetailTask = task;
            const actions = document.getElementById('taskModalActions');
            const modal = document.getElementById('taskModal');
            const modalBody = document.getElementById('modalBody');
            const archiveModal = document.getElementById('archiveModal');

            let actionsHtml = '';

            // If coming from the archiveModal, hide: archive, edit, and delete buttons
            wasArchiveModalActive = archiveModal.classList.contains('active');
            const shareBtn = `<button class="btn btn-secondary" onclick="openShareDialog()">${t('share.button')}</button>`;
            const editable = !readOnly() && !wasArchiveModalActive;
            if (wasArchiveModalActive) archiveModal.classList.remove('active');
            if (!editable) {
                actionsHtml = `<div class="push"></div>${shareBtn}`; // an archived task, or a board from the web: sharing is still fine
            }
            else {
                actionsHtml = `<div class="push">
                        <button class="btn btn-danger" onclick="deleteCurrentTask()">${t('taskDetail.delete')}</button>
                        <button class="btn btn-secondary" onclick="archiveCurrentTask()">${t('taskDetail.archive')}</button>
                    </div>
                    ${shareBtn}
                    <button class="btn btn-primary" onclick="editCurrentTask()">${t('taskDetail.edit')}</button>`;
            }

            actions.innerHTML = actionsHtml;

            // Get status name
            const statusColumn = config.columns.find(col => col.id === task.status);
            const statusName = statusColumn ? statusColumn.name : task.status;

            modalBody.innerHTML = `
                <div class="detail">
                    <div>
                        <div class="detail-id">${escapeHtml(task.id)}</div>
                        <h3>${escapeHtml(task.title)}</h3>
                    </div>

                    <dl class="detail-meta">
                        ${task.priority ? `<div><dt>${t('meta.priority')}</dt><dd>${priorityHtml(task.priority)}</dd></div>` : ''}
                        ${true ? `<div><dt>${t('meta.status')}</dt><dd>${escapeHtml(statusName)}</dd></div>` : ''}
                        ${task.category ? `<div><dt>${t('meta.category')}</dt><dd>${escapeHtml(task.category)}</dd></div>` : ''}
                        ${task.assignees.length > 0 ? `<div><dt>${t('meta.assigned')}</dt><dd>${escapeHtml(task.assignees.join(', '))}</dd></div>` : ''}
                        ${task.created ? `<div><dt>${t('meta.created')}</dt><dd>${task.created}</dd></div>` : ''}
                        ${task.started ? `<div><dt>${t('meta.started')}</dt><dd>${task.started}</dd></div>` : ''}
                        ${task.due ? `<div><dt>${t('meta.due')}</dt><dd>${task.due}</dd></div>` : ''}
                        ${task.completed ? `<div><dt>${t('meta.completed')}</dt><dd>${task.completed}</dd></div>` : ''}
                    </dl>

                    ${task.tags.length > 0 ? `
                        <div>
                            <div class="detail-label">${t('meta.tags')}</div>
                            <div class="detail-tags">${task.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
                        </div>
                    ` : ''}

                    ${task.description ? `
                        <div>
                            <div class="detail-label">${t('meta.description')}</div>
                            <div class="detail-text">${markdownToHtml(task.description)}</div>
                        </div>
                    ` : ''}

                    ${editable || task.subtasks.length ? `<div>
                        <div class="detail-label">${t('meta.subtasks', {completed: task.subtasks.filter(st => st.completed).length, total: task.subtasks.length})}</div>
                        <ul id="subtasksList" class="subtask-list">
                            ${task.subtasks.map((st, idx) => {
                                const escapedText = st.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                return `
                                <li class="subtask-item${st.completed ? ' done' : ''}">
                                    <input type="checkbox" ${st.completed ? 'checked' : ''} ${editable ? `onchange="toggleSubtask('${task.id}', ${idx})"` : 'disabled'}>
                                    <span ${editable ? `ondblclick="editSubtask('${task.id}', ${idx})" title="${t('tooltip.doubleClickEdit')}"` : ''}>${escapedText}</span>
                                    ${editable ? `<button class="del" onclick="deleteSubtask('${task.id}', ${idx})" title="${t('tooltip.delete')}" aria-label="${t('tooltip.delete')}"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.5 8.5h5l.5-8.5"/></svg></button>` : ''}
                                </li>
                                `;
                            }).join('')}
                        </ul>
                        ${editable ? `
                        <div class="subtask-add">
                            <input type="text" id="newSubtaskInput" placeholder="${t('subtask.newPlaceholder')}" onkeypress="if(event.key==='Enter') addSubtask('${task.id}')">
                            <button onclick="addSubtask('${task.id}')" class="btn btn-secondary">${t('taskForm.subtaskAdd')}</button>
                        </div>
                        ` : ''}
                    </div>` : ''}

                    ${task.notes ? `
                        <div>
                            <div class="detail-label">${t('meta.notes')}</div>
                            <div class="detail-notes">${markdownToHtml(task.notes)}</div>
                        </div>
                    ` : ''}
                </div>
            `;

            modal.classList.add('active');
        }

        function closeModal() {
            document.getElementById('taskModal').classList.remove('active');
            if (wasArchiveModalActive) {
                document.getElementById('archiveModal').classList.add('active');
                wasArchiveModalActive = false; // Reset for next time
            }
        }

        function editCurrentTask() {
            if (readOnly()) return; // a board from the web is never changed
            if (currentDetailTask) {
                closeModal();
                openTaskModal(currentDetailTask);
            }
        }

        // Subtask management
        function toggleSubtask(taskId, subtaskIdx) {
            if (readOnly()) return;
            const task = tasks.find(t => t.id === taskId);
            if (task && task.subtasks[subtaskIdx]) {
                task.subtasks[subtaskIdx].completed = !task.subtasks[subtaskIdx].completed;
                currentDetailTask = task; // Update reference
                showTaskDetail(task); // Refresh display
                renderKanban(); // Update card progress
                autoSave();
            }
        }

        function deleteSubtask(taskId, subtaskIdx) {
            if (readOnly()) return;
            const task = tasks.find(t => t.id === taskId);
            if (task && confirm(t('confirm.deleteSubtask'))) {
                task.subtasks.splice(subtaskIdx, 1);
                currentDetailTask = task;
                showTaskDetail(task);
                renderKanban();
                autoSave();
            }
        }

        function addSubtask(taskId) {
            if (readOnly()) return;
            const input = document.getElementById('newSubtaskInput');
            const text = input.value.trim();
            if (!text) return;

            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.subtasks.push({ completed: false, text });
                currentDetailTask = task;
                input.value = '';
                showTaskDetail(task);
                renderKanban();
                autoSave();
            }
        }

        function editSubtask(taskId, subtaskIdx) {
            if (readOnly()) return;
            const task = tasks.find(t => t.id === taskId);
            if (!task || !task.subtasks[subtaskIdx]) return;

            const newText = prompt(t('prompt.editSubtask'), task.subtasks[subtaskIdx].text);
            if (newText !== null && newText.trim()) {
                task.subtasks[subtaskIdx].text = newText.trim();
                currentDetailTask = task;
                showTaskDetail(task);
                renderKanban();
                autoSave();
            }
        }

        // Handle task form submission (create or edit)
        document.getElementById('newTaskForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            // Get form values
            const title = document.getElementById('taskTitle').value.trim();
            const status = document.getElementById('taskStatus').value;
            const priority = document.getElementById('taskPriority').value;
            const category = document.getElementById('taskCategory').value.trim();
            const assignee = document.getElementById('taskAssignee').value.trim();
            const created = document.getElementById('taskCreated').value;
            const started = document.getElementById('taskStarted').value;
            const due = document.getElementById('taskDue').value;
            const completed = document.getElementById('taskCompleted').value;
            const tagsInput = document.getElementById('taskTags').value.trim();
            const description = document.getElementById('taskDescription').value.trim();
            const notes = document.getElementById('taskNotes').value.trim();

            // Parse tags and assignees
            const tags = tagsInput ? tagsInput.split(/\s+/).filter(t => t.startsWith('#') || t).map(t => t.startsWith('#') ? t : '#' + t) : [];
            const assignees = assignee ? assignee.split(',').map(a => a.trim()) : [];

            if (isEditMode) {
                // Edit existing task
                const taskId = document.getElementById('taskEditId').value;
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                    task.title = title;
                    task.status = status;
                    task.priority = priority;
                    task.category = category;
                    task.assignees = assignees;
                    task.tags = tags;
                    task.created = created;
                    task.started = started;
                    task.due = due;
                    task.completed = completed;
                    task.description = description;
                    task.subtasks = formSubtasks;
                    task.notes = notes;
                    showNotification(t('notif.taskEdited', {id: taskId}), 'success');
                }
            } else {
                // Create new task
                // lastTaskId may be missing/stale (e.g. hand-written boards): never reuse an existing id.
                const maxUsed = [...tasks, ...archivedTasks].reduce((m, x) => Math.max(m, parseInt((x.id.match(/(\d+)$/) || [])[1]) || 0), 0);
                config.lastTaskId = Math.max(config.lastTaskId, maxUsed) + 1;
                const newTaskId = 'TASK-' + String(config.lastTaskId).padStart(3, '0');
                tasks.push({
                    id: newTaskId,
                    title,
                    status,
                    priority,
                    category,
                    assignees,
                    tags,
                    created: created || new Date().toISOString().split('T')[0],
                    started: started || '',
                    due,
                    completed: completed || '',
                    description,
                    subtasks: formSubtasks,
                    notes
                });
                showNotification(t('notif.taskCreated', {id: newTaskId}), 'success');
            }

            closeTaskModal();
            renderKanban();
            autoSave();
        });

        // Archive functions
