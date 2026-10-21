        async function loadArchive() {
            console.log('🗃️ === LOADING ARCHIVE ===');
            try {
                archiveFileHandle = await directoryHandle.getFileHandle('archive.md');
                console.log('✓ Archive file handle obtained');
                const file = await archiveFileHandle.getFile();
                console.log('✓ Archive file loaded, size:', file.size, 'bytes');
                const content = await file.text();
                console.log('✓ Archive content read, length:', content.length, 'characters');
                console.log('Archive content preview:', content.substring(0, 500));

                // Parse every "### TASK-" block in archive.md, regardless of the section
                // heading's language (archive is a flat list — this also fixes the German
                // "## ✅ Archiv" vs hardcoded "✅ Archives" mismatch). honorStatusField=true so
                // an archived task keeps the original column it was in (stored in **Status**),
                // making restore exact; old archives with no **Status** fall back to 'archived'.
                const parsedArchive = parseArchive(content, config.columns);
                loadedArchiveVersion = parsedArchive.formatVersion;
                archivedTasks = parsedArchive.tasks;

                console.log('✓ Archive parsed. Total archived tasks:', archivedTasks.length);

                // Auto-migrate a older archive.md to the current (v3) shape (format marker + **Status**
                // per task). Same TOTAL-parse guard as kanban.md: only rewrite when every
                // "### TASK-" header parsed to exactly one unique task — a malformed/unparsed
                // archive block must abstain, not be dropped on saveArchive(). Its OWN try/catch:
                // a failed write must NOT reach the outer catch (which resets archivedTasks = []).
                const archiveBlockCount = (content.match(/^###\s+TASK-/gm) || []).length;
                const archiveUnique = new Set(archivedTasks.map(t => t.id)).size;
                if (loadedArchiveVersion < 3 && archivedTasks.length > 0
                        && archivedTasks.length === archiveBlockCount && archiveUnique === archiveBlockCount) {
                    try {
                        // Same rule as kanban.md: never overwrite without a confirmed backup.
                        if (await backupOriginal('archive.md', content, loadedArchiveVersion)) {
                            await saveArchive();
                            console.log('Migrated archive.md to v3 format');
                        } else {
                            console.warn('Skipped archive.md migration: backup failed. File left unchanged.');
                        }
                    } catch (e) {
                        console.error('Archive migration write failed (kept in memory):', e);
                    }
                } else if (loadedArchiveVersion < 3 && archivedTasks.length > 0) {
                    console.warn(`Skipped archive.md migration: incomplete parse (${archivedTasks.length}/${archiveBlockCount} blocks). File left unchanged.`);
                }
            } catch (error) {
                console.error('❌ archive.md not found or error:', error);
                archivedTasks = [];
            }
        }

        async function saveArchive() {
            if (!archiveFileHandle) {
                archiveFileHandle = await directoryHandle.getFileHandle('archive.md', { create: true });
            }

            const md = generateArchive(archivedTasks, archiveStrings());

            const writable = await archiveFileHandle.createWritable();
            await writable.write(md);
            await writable.close();
        }

        function archiveCurrentTask() {
            if (!currentDetailTask) return;
            if (confirm(t('confirm.archiveTask', {title: currentDetailTask.title}))) {
                // Remove from active tasks
                const idx = tasks.findIndex(t => t.id === currentDetailTask.id);
                if (idx >= 0) {
                    const task = tasks.splice(idx, 1)[0];
                    archivedTasks.push(task);
                    saveArchive();
                    autoSave();
                    updateAutocomplete(); // Keep historical values in autocomplete
                    renderKanban();
                    closeModal();
                    showNotification(t('notif.taskArchived'), 'success');
                }
            }
        }

        function deleteCurrentTask() {
            if (!currentDetailTask) return;
            deleteTask(currentDetailTask.id, false);
        }

        function deleteTask(taskId, fromArchive = false) {
            const taskList = fromArchive ? archivedTasks : tasks;
            const task = taskList.find(t => t.id === taskId);

            if (!task) return;

            const confirmMessage = fromArchive
                ? t('confirm.deleteTask', {title: task.title})
                : t('confirm.deleteTaskFromArchive', {title: task.title});

            if (confirm(confirmMessage)) {
                const idx = taskList.findIndex(t => t.id === taskId);
                if (idx >= 0) {
                    taskList.splice(idx, 1);

                    // Save both files
                    if (fromArchive) {
                        saveArchive();
                    } else {
                        autoSave();
                    }

                    // Update UI
                    if (fromArchive) {
                        renderArchiveList(document.getElementById('archiveSearch').value);
                    } else {
                        renderKanban();
                        closeModal();
                    }

                    showNotification(t('notif.taskDeleted'), 'success');
                }
            }
        }

        async function openArchiveModal() {
            console.log('\n📂 === OPENING ARCHIVE MODAL ===');
            await loadArchive();
            renderArchiveList();
            document.getElementById('archiveModal').classList.add('active');
            console.log('✓ Archive modal opened');
        }

        function closeArchiveModal() {
            document.getElementById('archiveModal').classList.remove('active');
        }

        function renderArchiveList(searchTerm = '') {
            console.log('\n🎨 === RENDERING ARCHIVE LIST ===');
            console.log('Search term:', searchTerm || '(none)');
            console.log('Total archived tasks:', archivedTasks.length);

            const list = document.getElementById('archiveList');
            if (!list) {
                console.error('❌ archiveList element not found!');
                return;
            }

            const filtered = searchTerm ?
                archivedTasks.filter(t =>
                    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    t.category.toLowerCase().includes(searchTerm.toLowerCase())
                ) : archivedTasks;

            console.log('Filtered tasks:', filtered.length);

            if (filtered.length === 0) {
                console.log('⚠️ No tasks to display - showing empty message');
                list.innerHTML = `<div class="empty-state">${t('archives.empty')}</div>`;
                return;
            }

            console.log('✓ Rendering', filtered.length, 'tasks');

            list.innerHTML = filtered.map(task => `
                <div class="archive-item" style="cursor: pointer;" data-id="${escapeHtml(task.id)}">
                    <div class="top">
                        <div>
                            <span class="task-id">${escapeHtml(task.id)}</span>
                            <strong style="margin-left: var(--s-2);">${escapeHtml(task.title)}</strong>
                        </div>
                        <div style="display: flex; gap: var(--s-2);">
                            <button data-action="delete" class="btn btn-danger btn-sm" title="${t('tooltip.delete')}" aria-label="${t('tooltip.delete')}"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.5 8.5h5l.5-8.5"/></svg></button>
                            <button data-action="restore" class="btn btn-secondary btn-sm">${t('action.restore')}</button>
                        </div>
                    </div>
                    ${task.description ? `<div class="desc">${markdownToHtml(task.description)}</div>` : ''}
                    <div class="task-meta">
                        ${task.priority ? `<span class="badge">${priorityHtml(task.priority)}</span>` : ''}
                        ${task.category ? `<span class="badge">${escapeHtml(task.category)}</span>` : ''}
                        ${task.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                    </div>
                </div>
            `).join('');
        }

        // One delegated handler: ids are read from data-id, never concatenated into inline JS.
        function onArchiveListClick(e) {
            const item = e.target.closest('.archive-item');
            if (!item) return;
            const id = item.dataset.id;
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'delete') deleteTask(id, true);
            else if (action === 'restore') unarchiveTask(id);
            else showTaskDetail(archivedTasks.find(t => t.id === id));
        }

        function unarchiveTask(taskId) {
            const idx = archivedTasks.findIndex(t => t.id === taskId);
            if (idx >= 0) {
                const task = archivedTasks.splice(idx, 1)[0];
                // Keep original column status
                // If the column no longer exists, use first column as fallback
                if (!config.columns.find(col => col.id === task.status)) {
                    task.status = config.columns[0]?.id || 'todo';
                }
                tasks.push(task);
                saveArchive();
                autoSave();
                updateAutocomplete(); // Update autocomplete after restoring
                renderKanban();
                renderArchiveList(document.getElementById('archiveSearch').value);
                showNotification(t('notif.taskRestored'), 'success');
            }
        }

        // Archive search
        document.getElementById('archiveSearch').addEventListener('input', (e) => {
            renderArchiveList(e.target.value);
        });

        // Event listeners
        document.getElementById('newTaskBtn').addEventListener('click', () => openTaskModal());
        document.getElementById('archiveBtn').addEventListener('click', openArchiveModal);
        document.getElementById('manageColsBtn').addEventListener('click', openColumnsModal);

        // Generate Markdown from tasks - SIMPLIFIED!
