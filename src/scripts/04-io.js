        async function loadKanbanFile() {
            persistBase = null;
            try {
                const board = await source.read('kanban.md');
                if (!board && source.writable) return await createDefaultFiles();
                if (!board) throw new Error('kanban.md not found');
                currentKanbanContent = board.text;

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
                // A read-only source is shown as it is: an older file is read fine, it just stays older.
                if (!source.writable) { /* nothing to migrate */ }
                else if (loadedFormatVersion < 3 && tasks.length === blockCount && uniqueParsed === blockCount) {
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
                // Permissions, a read error, etc.: say so and never overwrite.
                showNotification(t('notif.loadError') || 'Erreur lors du chargement du fichier', 'error');
                console.error('Error loading kanban.md:', error);
            }
        }

        // A folder with no kanban.md: start it with an empty board and archive.
        async function createDefaultFiles() {
            showNotification(t('notif.initializingFolder'), 'success');
            console.log('kanban.md not found, creating default files...');
            try {
                currentKanbanContent = createDefaultBoardContent();
                await source.write('kanban.md', currentKanbanContent);
                await source.write('archive.md', createDefaultArchiveContent(archiveStrings()));

                showNotification(t('notif.filesInitialized'), 'success');

                parseMarkdown(currentKanbanContent);
                updateAutocomplete();
                renderKanban();
                await snapshotFromDisk();
            } catch (createError) {
                showNotification(t('notif.filesError'), 'error');
                console.error(createError);
            }
        }

        // One-time backup of a file's original content before a format migration (v1/v2 -> v3),
        // so the conversion can always be undone. Returns true when a usable backup exists
        // (freshly written OR already present), false on failure — callers MUST abort the
        // migration on false rather than overwrite the original with no recovery copy.
        async function backupOriginal(name, content, fromVersion = 1) {
            try {
                const backupName = name.replace(/\.md$/, `.v${fromVersion}-backup.md`);
                if (await source.version(backupName) !== null) return true; // already there
                await source.write(backupName, content);
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
