        async function loadKanbanFile() {
            archiveFileHandle = null; // never keep another project's handle
            persistBase = null;
            try {
                kanbanFileHandle = await directoryHandle.getFileHandle('kanban.md');
                const file = await kanbanFileHandle.getFile();
                currentKanbanContent = await file.text();

                console.log('File loaded, size:', currentKanbanContent.length);
                parseMarkdown(currentKanbanContent);
                await loadArchive(); // Load archive for historical autocomplete data
                updateAutocomplete();
                renderKanban();
                // Auto-migrate an older (V1/V2) kanban.md to the current format (v3) on disk: nothing is lost and future
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
                if (loadedFormatVersion < 3 && tasks.length === blockCount && uniqueParsed === blockCount) {
                    // Only overwrite once the original is safely backed up — a failed backup must
                    // abort the migration, never leave the file rewritten without a recovery copy.
                    const fromVersion = loadedFormatVersion;
                    if (await backupOriginal('kanban.md', currentKanbanContent, fromVersion) && await writeWholeBoard()) {
                        console.log(`Migrated kanban.md from v${fromVersion} to v3 (one metadata field per line)`);
                    } else {
                        console.warn('Skipped migration: backup or save failed. File left unchanged.');
                    }
                } else if (loadedFormatVersion < 3) {
                    console.warn(`Skipped migration: incomplete parse (${tasks.length}/${blockCount} task blocks). File left unchanged.`);
                }
                await snapshotFromDisk(); // the base every later save is a difference against
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
                        archiveFileHandle = null;
                        await snapshotFromDisk();
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

        // One-time backup of a file's original content before a format migration (v1/v2 -> v3),
        // so the conversion can always be undone. Returns true when a usable backup exists
        // (freshly written OR already present), false on failure — callers MUST abort the
        // migration on false rather than overwrite the original with no recovery copy.
        async function backupOriginal(name, content, fromVersion = 1) {
            try {
                const backupName = name.replace(/\.md$/, `.v${fromVersion}-backup.md`);
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
            loadedFormatVersion = parsed.formatVersion;
            console.log(`Parsed ${tasks.length} tasks:`, tasks.map(t => `${t.id} (${t.status})`).join(', '));
        }

        // Enhanced markdown to HTML converter for notes
        // Escape user-controlled text/attribute values before inserting into innerHTML (XSS hardening)
