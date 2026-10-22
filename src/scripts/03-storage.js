        async function openDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                };
            });
        }

        async function saveDirectoryHandle(handle, customName = null) {
            try {
                const db = await openDB();
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                // Get existing projects
                const getRequest = store.get(PROJECTS_KEY);
                const projects = await new Promise((resolve, reject) => {
                    getRequest.onsuccess = () => resolve(getRequest.result || []);
                    getRequest.onerror = () => reject(getRequest.error);
                });

                // Get project name (directory name)
                const projectName = handle.name;

                // Check if project already exists
                const existingIndex = projects.findIndex(p => p.name === projectName);
                const isNewProject = existingIndex < 0;

                // Ask for custom name for new projects if not provided
                let finalCustomName = customName;
                if (isNewProject && !customName) {
                    finalCustomName = prompt(t('prompt.projectName', {name: projectName})) || '';
                }

                const projectData = {
                    handle: handle,
                    name: projectName,
                    customName: finalCustomName || (existingIndex >= 0 ? projects[existingIndex].customName : ''),
                    lastAccessed: Date.now()
                };

                if (existingIndex >= 0) {
                    // Update existing project (keep custom name if not changing)
                    projectData.customName = customName !== null ? customName : projects[existingIndex].customName;
                    projects[existingIndex] = projectData;
                } else {
                    // Add new project at the beginning
                    projects.unshift(projectData);
                }

                // Keep only MAX_RECENT_PROJECTS
                const recentProjects = projects.slice(0, MAX_RECENT_PROJECTS);

                // Save updated list
                store.put(recentProjects, PROJECTS_KEY);

                await new Promise((resolve, reject) => {
                    transaction.oncomplete = resolve;
                    transaction.onerror = () => reject(transaction.error);
                });

                console.log('Project saved to recent list:', projectData.customName || projectName);
                updateProjectSelector();
            } catch (error) {
                console.error('Failed to save directory handle:', error);
            }
        }

        async function loadRecentProjects() {
            try {
                const db = await openDB();
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(PROJECTS_KEY);

                return new Promise((resolve, reject) => {
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Failed to load recent projects:', error);
                return [];
            }
        }

        async function loadDirectoryHandle() {
            try {
                const projects = await loadRecentProjects();
                // Return the most recent project (first in list)
                return projects.length > 0 ? projects[0].handle : null;
            } catch (error) {
                console.error('Failed to load directory handle:', error);
                return null;
            }
        }

        async function verifyPermission(handle) {
            const options = { mode: 'readwrite' };
            if ((await handle.queryPermission(options)) === 'granted') {
                return true;
            }
            if ((await handle.requestPermission(options)) === 'granted') {
                return true;
            }
            return false;
        }

        // Update project selector dropdown
        async function updateProjectSelector() {
            if (typeof updateOrderingMenu === 'function') updateOrderingMenu();
            if (typeof updateHousekeepingBar === 'function') updateHousekeepingBar();
            const projects = await loadRecentProjects();
            const selectorBox = document.getElementById('projectDd');
            const renameBtn = document.getElementById('renameProjectBtn');
            const deleteBtn = document.getElementById('deleteProjectBtn');

            if (projects.length > 0) {
                selectorBox.style.display = 'block';

                // Only mark as selected if kanban is actually loaded
                const isKanbanLoaded = document.getElementById('kanbanView').style.display !== 'none';
                const currentProject = (isKanbanLoaded && folderHandle()) ? folderHandle().name : '';

                // Show/hide rename and delete buttons (they act on the open folder)
                if (isKanbanLoaded && folderHandle()) {
                    renameBtn.style.display = 'inline-flex';
                    deleteBtn.style.display = 'inline-flex';
                } else {
                    renameBtn.style.display = 'none';
                    deleteBtn.style.display = 'none';
                }

                // Add empty option if no project is loaded (a web board is not one of them)
                const options = [];
                if (!currentProject) options.push({ value: '', label: t('projects.select') });
                let selectedValue = '';
                projects.forEach((p, idx) => {
                    const date = new Date(p.lastAccessed).toLocaleDateString('fr-FR');
                    const displayName = p.customName || p.name;
                    const details = p.customName ? ` (📁 ${p.name})` : '';
                    if (isKanbanLoaded && p.name === currentProject) selectedValue = String(idx);
                    options.push({ value: String(idx), label: `${displayName}${details} - ${date}` });
                });
                ddSetOptions('projectSelector', options);
                ddSetValue('projectSelector', selectedValue, true);
            } else {
                selectorBox.style.display = 'none';
                renameBtn.style.display = 'none';
                deleteBtn.style.display = 'none';
            }
        }

        // Switch to a different project
        async function switchProject(projectIndex) {
            try {
                const projects = await loadRecentProjects();
                if (projectIndex >= 0 && projectIndex < projects.length) {
                    const project = projects[projectIndex];

                    // Verify permission
                    if (await verifyPermission(project.handle)) {
                        useSource(folderSource(project.handle));

                        // Update last accessed time and save
                        await saveDirectoryHandle(project.handle);

                        // Load the project
                        await loadKanbanFile();

                        document.getElementById('welcomeScreen').style.display = 'none';
                        document.getElementById('kanbanView').style.display = 'block';
                        document.getElementById('filterBar').style.display = 'block';
                        document.getElementById('newTaskBtn').style.display = 'inline-flex';
                        document.getElementById('archiveBtn').style.display = 'inline-flex';
                        document.getElementById('manageColsBtn').style.display = 'inline-flex';

                        // Update project selector now that kanban is visible
                        await updateProjectSelector();

                        showNotification(t('notif.projectLoaded', {name: project.customName || project.name}), 'success');
                    } else {
                        showNotification(t('notif.permissionDenied'), 'error');
                    }
                }
            } catch (error) {
                console.error('Error switching project:', error);
                showNotification(t('notif.projectError'), 'error');
            }
        }

        // Rename current project
        async function renameCurrentProject() {
            const folder = folderHandle();
            if (!folder) return;

            try {
                const projects = await loadRecentProjects();
                const currentProject = projects.find(p => p.name === folder.name);

                if (currentProject) {
                    const currentName = currentProject.customName || currentProject.name;
                    const newName = prompt(t('prompt.renameProject'), currentName);

                    if (newName !== null && newName.trim() !== currentName) {
                        await saveDirectoryHandle(folder, newName.trim());
                        showNotification(t('notif.projectRenamed'), 'success');
                    }
                }
            } catch (error) {
                console.error('Error renaming project:', error);
                showNotification(t('notif.renameError'), 'error');
            }
        }

        // Delete current project from recent list
        async function deleteCurrentProject() {
            const folder = folderHandle();
            if (!folder) return;

            try {
                const projects = await loadRecentProjects();
                const currentProject = projects.find(p => p.name === folder.name);

                if (currentProject) {
                    const displayName = currentProject.customName || currentProject.name;

                    if (confirm(t('confirm.deleteProject', {name: displayName}))) {
                        // Remove from projects list
                        const updatedProjects = projects.filter(p => p.name !== folder.name);

                        // Save updated list to IndexedDB
                        const db = await openDB();
                        const transaction = db.transaction(STORE_NAME, 'readwrite');
                        const store = transaction.objectStore(STORE_NAME);
                        store.put(updatedProjects, PROJECTS_KEY);

                        await new Promise((resolve, reject) => {
                            transaction.oncomplete = resolve;
                            transaction.onerror = () => reject(transaction.error);
                        });

                        // Clear current project and show welcome screen
                        useSource(null);
                        tasks = [];

                        document.getElementById('kanbanView').style.display = 'none';
                        document.getElementById('filterBar').style.display = 'none';
                        document.getElementById('newTaskBtn').style.display = 'none';
                        document.getElementById('archiveBtn').style.display = 'none';
                        document.getElementById('manageColsBtn').style.display = 'none';
                        document.getElementById('welcomeScreen').style.display = 'block';

                        await updateProjectSelector();
                        showNotification(t('notif.projectDeleted'), 'success');
                    }
                }
            } catch (error) {
                console.error('Error deleting project:', error);
                showNotification(t('notif.renameError'), 'error');
            }
        }

        // Try to restore previous directory on page load
        async function tryRestorePreviousDirectory() {
            const savedHandle = await loadDirectoryHandle();
            console.log('Attempting to restore previous directory:', savedHandle ? savedHandle.name : 'none');

            if (savedHandle) {
                try {
                    // Verify we still have permission
                    console.log('Verifying permissions...');
                    if (await verifyPermission(savedHandle)) {
                        console.log('Permission granted, loading kanban file...');
                        useSource(folderSource(savedHandle));
                        await loadKanbanFile();

                        document.getElementById('welcomeScreen').style.display = 'none';
                        document.getElementById('kanbanView').style.display = 'block';
                        document.getElementById('filterBar').style.display = 'block';
                        document.getElementById('newTaskBtn').style.display = 'inline-flex';
                        document.getElementById('archiveBtn').style.display = 'inline-flex';
                        document.getElementById('manageColsBtn').style.display = 'inline-flex';

                        showNotification(t('notif.projectRestored'), 'success');
                        await updateProjectSelector(); // Show project selector
                        console.log('Project restored successfully');
                        return true;
                    } else {
                        console.log('Permission denied or cancelled');
                    }
                } catch (error) {
                    console.error('Could not restore previous directory:', error);
                }
            }
            // Even if no project is loaded, update selector to show recent projects
            await updateProjectSelector();
            return false;
        }

        // Initialize on page load
        window.addEventListener('DOMContentLoaded', async () => {
            const param = boardParam();
            if (param !== null) await openBoardParam(param); // a board from the web (03b-web-board.js)
            else await tryRestorePreviousDirectory();

            // Add event listener for project selector
            document.getElementById('projectSelector').addEventListener('change', async (e) => {
                const projectIndex = parseInt(e.target.value);
                if (!isNaN(projectIndex)) {
                    await switchProject(projectIndex);
                }
            });
        });

        // Select folder
        document.getElementById('selectFolderBtn').addEventListener('click', async () => {
            try {
                // Start in last used directory if available
                const options = {};
                if (folderHandle()) {
                    options.startIn = folderHandle();
                }

                const picked = await window.showDirectoryPicker(options);
                useSource(folderSource(picked));
                await saveDirectoryHandle(picked); // Save for next time
                await loadKanbanFile();

                document.getElementById('welcomeScreen').style.display = 'none';
                document.getElementById('kanbanView').style.display = 'block';
                document.getElementById('filterBar').style.display = 'block';
                document.getElementById('newTaskBtn').style.display = 'inline-flex';
                document.getElementById('archiveBtn').style.display = 'inline-flex';
                document.getElementById('manageColsBtn').style.display = 'inline-flex';

                // Update project selector now that kanban is visible
                await updateProjectSelector();

                showNotification(t('notif.folderLoaded'), 'success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    showNotification(t('notif.folderError'), 'error');
                    console.error(error);
                }
            }
        });

        // Load kanban.md file
