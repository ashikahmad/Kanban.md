        async function loadKanbanFile() {
            try {
                kanbanFileHandle = await directoryHandle.getFileHandle('kanban.md');
                const file = await kanbanFileHandle.getFile();
                currentKanbanContent = await file.text();

                console.log('File loaded, size:', currentKanbanContent.length);
                parseMarkdown(currentKanbanContent);
                await loadArchive(); // Load archive for historical autocomplete data
                updateAutocomplete();
                renderKanban();
                // Auto-migrate a legacy (V1) kanban.md to V2 on disk: nothing is lost and future
                // AI reads/edits stay cheap. One-time — V2 files carry the format marker.
                // Guard against silent data loss: only migrate when the parse was TOTAL — every
                // "### TASK-" header in the file produced exactly one parsed task. Count ALL task
                // headers (including malformed ones like "### TASK-ABC" or "### TASK-1" without a
                // "| title"): those are NOT parsed, so counting only well-formed headers would let
                // a file with a malformed block pass the guard and lose it on rewrite.
                const blockCount = (currentKanbanContent.match(/^###\s+TASK-/gm) || []).length;
                // Also require every parsed id to be UNIQUE and to cover all headers: this rejects a
                // pathological slug collision where one task is parsed twice while another is missed
                // (counts stay equal but the rewrite would drop the missed task). Provably 1:1.
                const uniqueParsed = new Set(tasks.map(t => t.id)).size;
                if (!loadedFormatV2 && tasks.length === blockCount && uniqueParsed === blockCount) {
                    // Only overwrite once the original is safely backed up — a failed backup must
                    // abort the migration, never leave the file rewritten without a recovery copy.
                    if (await backupOriginal('kanban.md', currentKanbanContent) && await autoSave()) {
                        console.log('Migrated kanban.md from V1 (sections) to V2 (status field)');
                    } else {
                        console.warn('Skipped V1→V2 migration: backup or save failed. File left unchanged.');
                    }
                } else if (!loadedFormatV2) {
                    console.warn(`Skipped V1→V2 migration: incomplete parse (${tasks.length}/${blockCount} task blocks). File left unchanged.`);
                }
            } catch (error) {
                // Only create default files if the file truly doesn't exist
                if (error.name === 'NotFoundError') {
                    showNotification(t('notif.initializingFolder'), 'success');
                    console.log('kanban.md not found, creating default files...');

                    try {
                        // Create kanban.md
                        currentKanbanContent = createDefaultBoardContent();
                        kanbanFileHandle = await directoryHandle.getFileHandle('kanban.md', { create: true });
                        const writable = await kanbanFileHandle.createWritable();
                        await writable.write(currentKanbanContent);
                        await writable.close();

                        // Create archive.md
                        const archiveContent = createDefaultArchiveContent(archiveStrings());
                        const archiveFileHandle = await directoryHandle.getFileHandle('archive.md', { create: true });
                        const archiveWritable = await archiveFileHandle.createWritable();
                        await archiveWritable.write(archiveContent);
                        await archiveWritable.close();

                        showNotification(t('notif.filesInitialized'), 'success');

                        parseMarkdown(currentKanbanContent);
                        updateAutocomplete();
                        renderKanban();
                    } catch (createError) {
                        showNotification(t('notif.filesError'), 'error');
                        console.error(createError);
                    }
                } else {
                    // Different error (permissions, read error, etc.) - show error and don't overwrite
                    showNotification(t('notif.loadError') || 'Erreur lors du chargement du fichier', 'error');
                    console.error('Error loading kanban.md:', error);
                }
            }
        }

        // One-time backup of a file's original content before a destructive V1→V2 migration,
        // so the conversion can always be undone. Returns true when a usable backup exists
        // (freshly written OR already present), false on failure — callers MUST abort the
        // migration on false rather than overwrite the original with no recovery copy.
        async function backupOriginal(name, content) {
            try {
                const backupName = name.replace(/\.md$/, '.v1-backup.md');
                try { await directoryHandle.getFileHandle(backupName); return true; } catch (e) { /* none yet → create */ }
                const fh = await directoryHandle.getFileHandle(backupName, { create: true });
                const w = await fh.createWritable();
                await w.write(content);
                await w.close();
                console.log('Backup written:', backupName);
                return true;
            } catch (e) {
                console.warn('Backup failed — migration aborted to keep the original intact:', e);
                return false;
            }
        }

        // Parse kanban.md into the page globals. The parsing itself lives in core/board.js
        // (inlined into this page by build.mjs) so the CLI / MCP server share it.
        function parseMarkdown(content) {
            const parsed = parseBoard(content);
            config = parsed.config;
            tasks = parsed.tasks;
            loadedFormatV2 = parsed.formatV2;
            console.log(`Parsed ${tasks.length} tasks:`, tasks.map(t => `${t.id} (${t.status})`).join(', '));
        }

        // Enhanced markdown to HTML converter for notes
        // Escape user-controlled text/attribute values before inserting into innerHTML (XSS hardening)
