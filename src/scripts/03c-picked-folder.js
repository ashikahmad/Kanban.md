        // ===== Folders in browsers without the File System Access API (Firefox, Safari) =====
        // The folder is chosen with <input webkitdirectory>, read once and shown read-only (see pickedSource()).
        // Errors show on the start screen like those of a web board (webNotice).

        // Browsers without folder editing call reading a folder an "upload". Say what really happens before their
        // dialog appears, every time a folder is opened; "Continue" is a click, so the browser still allows the folder dialog to open.

        // The same dialog also explains "refresh" for the folder that is open (mode 'refresh'): a page cannot
        // re-read a picked folder, so the user is asked to choose it again.
        let pickNoteMode = 'first';
        function showPickNote(mode) {
            pickNoteMode = mode;
            applyPickDialogTexts();
            document.getElementById('pickNoteModal').classList.add('active');
            document.getElementById('pickNoteContinue').focus();
        }
        function pickFolderFiles() { showPickNote('first'); }
        function refreshPickedFolder() { showPickNote('refresh'); }
        function closePickNote() { document.getElementById('pickNoteModal').classList.remove('active'); }
        function continuePickNote() {
            closePickNote();
            document.getElementById('pickFolderInput').click();
        }

        // Menu "Edit with kanbanmd": the steps to edit this folder for real (serve it), with the command to copy.
        function openServeHelp() {
            document.getElementById('serveHelpCopy').textContent = t('serveHelp.copy');
            document.getElementById('serveHelpModal').classList.add('active');
            document.getElementById('serveHelpClose').focus();
        }
        function closeServeHelp() { document.getElementById('serveHelpModal').classList.remove('active'); }
        async function copyServeCommand() {
            const cmd = document.getElementById('serveHelpCmd').textContent, btn = document.getElementById('serveHelpCopy');
            try { await navigator.clipboard.writeText(cmd); } catch (e) { return; } // the command is also selectable by hand
            btn.textContent = t('serveHelp.copied');
            setTimeout(() => { btn.textContent = t('serveHelp.copy'); }, 1500);
        }

        // The texts of the two dialogs above (called when the language changes: see updateSourceMenu).
        function applyPickDialogTexts() {
            const set = (id, key) => { document.getElementById(id).textContent = t(key); };
            const refresh = pickNoteMode === 'refresh' && source;
            set('pickNoteTitle', refresh ? 'picked.refreshTitle' : 'picked.noteTitle');
            set('pickNoteContinue', refresh ? 'picked.refreshContinue' : 'picked.noteContinue'); set('pickNoteCancel', 'web.cancel');
            document.getElementById('pickNoteText').innerHTML = markdownToHtml(refresh ? t('picked.refreshText', { name: source.label }) : t('picked.noteText')); // **bold**, like the task details (escapes HTML)
            document.getElementById('pickNoteServe').style.display = refresh ? '' : 'none';
            document.getElementById('pickNoteServeText').innerHTML = markdownToHtml(t('picked.refreshServe')).replace(/^<p[^>]*>|<\/p>$/g, '');
            set('pickNoteServeLink', 'picked.refreshHow');
            set('serveHelpTitle', 'serveHelp.title'); set('serveHelpIntro', 'serveHelp.intro'); set('serveHelpStep1', 'serveHelp.step1');
            set('serveHelpStep2', 'serveHelp.step2'); set('serveHelpStep3', 'serveHelp.step3'); set('serveHelpClose', 'serveHelp.close');
            set('serveHelpCopy', 'serveHelp.copy');
        }

        // A folder that cannot be opened: on the start screen (webNotice), or as a toast when a board is already open
        // (the start screen is hidden then, and the open board stays as it is).
        function pickError(code) {
            if (source) showNotification(t('web.error.' + code, { status: '' }), 'error');
            else showWebNotice({ kind: 'error', code, place: null });
        }

        async function openPickedFolder(files) {
            const src = pickedSource(files);
            const origin = source; // the board open when the folder was chosen
            try {
                if (!src.label) throw webError('noBoard');
                const board = await src.read('kanban.md');
                if (!board) throw webError('noBoard');
                if (!looksLikeBoard(board.text)) throw webError('notBoard');
            } catch (e) {
                if (!e.webCode) console.warn('Could not open the folder:', e);
                pickError(e.webCode || 'network');
                return false;
            }
            webNotice = null;
            if (origin && origin.kind === 'picked' && origin.label === src.label) {
                // The folder that is open, chosen again: a refresh, not a new board.
                try {
                    const changed = await adoptRefreshed(src, origin);
                    if (changed !== null) showNotification(t(changed ? 'status.refreshed' : 'status.upToDate'), 'success');
                } catch (e) { showNotification(t('status.refreshFailed'), 'error'); }
                return true;
            }
            useSource(src);
            await loadKanbanFile();
            showBoardView(false);
            await updateProjectSelector();
            showNotification(t('picked.opened', { name: src.label }), 'success');
            return true;
        }

        document.getElementById('pickFolderInput').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = ''; // picking the same folder again must fire this again
            if (files.length) await openPickedFolder(files);
            else pickError('noBoard'); // an empty folder: say so, not nothing
        });
