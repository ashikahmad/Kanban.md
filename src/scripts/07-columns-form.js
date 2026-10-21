        function openColumnsModal() {
            const modal = document.getElementById('columnsModal');
            const list = document.getElementById('columnsList');
            list.innerHTML = config.columns.map((col, idx) => `
                <div class="row-card">
                    <button onclick="moveColumn(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="btn btn-ghost btn-sm btn-icon" title="${t('action.moveUp')}" aria-label="${t('action.moveUp')}">↑</button>
                    <button onclick="moveColumn(${idx}, 1)" ${idx === config.columns.length - 1 ? 'disabled' : ''} class="btn btn-ghost btn-sm btn-icon" title="${t('action.moveDown')}" aria-label="${t('action.moveDown')}">↓</button>
                    <input type="text" class="grow" value="${escapeHtml(col.name)}" onchange="updateColumn(${idx}, 'name', this.value)">
                    <input type="text" class="col-id" value="${escapeHtml(col.id)}" onchange="updateColumn(${idx}, 'id', this.value)" placeholder="ID">
                    <button onclick="deleteColumn(${idx})" class="btn btn-ghost btn-sm btn-icon" title="${t('tooltip.delete')}" aria-label="${t('tooltip.delete')}"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.5 8.5h5l.5-8.5"/></svg></button>
                </div>
            `).join('');
            modal.classList.add('active');
        }

        function closeColumnsModal() {
            document.getElementById('columnsModal').classList.remove('active');
        }

        function addColumn() {
            const name = prompt(t('prompt.columnName'));
            const id = prompt(t('prompt.columnId'));
            if (name && id) {
                config.columns.push({ name, id });
                openColumnsModal();
                autoSave();
                renderKanban();
            }
        }

        function updateColumn(idx, field, value) {
            value = value.trim();
            const col = config.columns[idx];
            if (field === 'id') {
                // IDs must be non-empty and unique; tasks follow their column to the new id.
                if (!value || config.columns.some((c, i) => i !== idx && c.id === value)) {
                    openColumnsModal();
                    return;
                }
                [...tasks, ...archivedTasks].forEach(task => { if (task.status === col.id) task.status = value; });
            }
            col[field] = value;
            autoSave();
            renderKanban();
        }

        function deleteColumn(idx) {
            if (confirm(t('confirm.deleteColumn'))) {
                config.columns.splice(idx, 1);
                openColumnsModal();
                autoSave();
                renderKanban();
            }
        }

        function moveColumn(idx, direction) {
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= config.columns.length) return;

            // Swap columns
            [config.columns[idx], config.columns[newIdx]] = [config.columns[newIdx], config.columns[idx]];

            openColumnsModal();
            autoSave();
            renderKanban();
        }

        // Task edit/create modal
        function openTaskModal(task = null, defaultColumnId = null) {
            isEditMode = !!task;
            const modal = document.getElementById('newTaskModal');
            const form = document.getElementById('newTaskForm');
            const title = modal.querySelector('h2');
            const submitBtn = document.getElementById('taskFormSubmitBtn');

            title.textContent = isEditMode ? t('taskForm.editTask') : t('taskForm.newTask');
            submitBtn.textContent = isEditMode ? t('taskForm.save') : t('taskForm.create');

            // Populate column and priority dropdowns
            ddSetOptions('taskStatus', config.columns.map(col => ({ value: col.id, label: col.name })));
            ddSetOptions('taskPriority', [
                { value: '', label: t('taskForm.priorityNone'), html: '<span class="prio prio-none"></span><span>' + escapeHtml(t('taskForm.priorityNone')) + '</span>' },
                ...config.priorities.map(p => ({ value: clean(p), label: priorityLabel(p), html: priorityIcon(p, 'aria-hidden="true"') + '<span>' + escapeHtml(priorityLabel(p)) + '</span>' }))
            ]);

            // Update autocomplete
            updateAutocomplete();

            if (!isEditMode) ddSetValue('taskPriority', '', true);

            if (isEditMode) {
                document.getElementById('taskEditId').value = task.id;
                document.getElementById('taskTitle').value = task.title;
                ddSetValue('taskStatus', task.status, true);
                ddSetValue('taskPriority', clean(task.priority || ''), true);
                document.getElementById('taskCategory').value = task.category || '';
                document.getElementById('taskAssignee').value = task.assignees.join(', ');
                document.getElementById('taskCreated').value = task.created || '';
                document.getElementById('taskStarted').value = task.started || '';
                document.getElementById('taskDue').value = task.due || '';
                document.getElementById('taskCompleted').value = task.completed || '';
                document.getElementById('taskTags').value = task.tags.join(' ');
                document.getElementById('taskDescription').value = task.description || '';
                document.getElementById('taskNotes').value = task.notes || '';
                formSubtasks = JSON.parse(JSON.stringify(task.subtasks || []));
            } else {
                form.reset();
                document.getElementById('taskEditId').value = '';
                if (defaultColumnId) {
                    ddSetValue('taskStatus', defaultColumnId, true);
                }
                formSubtasks = [];
            }

            renderFormSubtasks();
            modal.classList.add('active');
        }

        function closeTaskModal() {
            document.getElementById('newTaskModal').classList.remove('active');
            document.getElementById('newTaskForm').reset();
            formSubtasks = [];
            isEditMode = false;
        }

        // Form subtasks management
        function renderFormSubtasks() {
            const list = document.getElementById('formSubtasksList');
            list.innerHTML = formSubtasks.map((st, idx) => `
                <li class="subtask-item${st.completed ? ' done' : ''}">
                    <input type="checkbox" ${st.completed ? 'checked' : ''} onchange="toggleFormSubtask(${idx})">
                    <span>${st.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                    <button type="button" class="del" onclick="deleteFormSubtask(${idx})" title="${t('tooltip.delete')}" aria-label="${t('tooltip.delete')}"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.5 8.5h5l.5-8.5"/></svg></button>
                </li>
            `).join('');
        }

        function addFormSubtask() {
            const input = document.getElementById('formSubtaskInput');
            const text = input.value.trim();
            if (!text) return;
            formSubtasks.push({ completed: false, text });
            input.value = '';
            renderFormSubtasks();
        }

        function toggleFormSubtask(idx) {
            if (formSubtasks[idx]) {
                formSubtasks[idx].completed = !formSubtasks[idx].completed;
                renderFormSubtasks();
            }
        }

        function deleteFormSubtask(idx) {
            formSubtasks.splice(idx, 1);
            renderFormSubtasks();
        }

        // Render Kanban board
