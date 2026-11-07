        // ===== Folders in browsers without the File System Access API (Firefox, Safari) =====
        // The folder is chosen with <input webkitdirectory>, read once and shown read-only (see pickedSource()).
        // Errors show on the start screen like those of a web board (webNotice).

        // Browsers without folder editing call reading a folder an "upload". Say what really happens before their
        // dialog appears, once; "Continue" is a click, so the browser still allows the folder dialog to open.
        const PICK_NOTE_KEY = 'kanbanmd.pickNoteSeen';
        function pickNoteSeen() { try { return localStorage.getItem(PICK_NOTE_KEY) === '1'; } catch (e) { return false; } }

        function pickFolderFiles() {
            if (pickNoteSeen()) { document.getElementById('pickFolderInput').click(); return; }
            document.getElementById('pickNoteModal').classList.add('active');
            document.getElementById('pickNoteContinue').focus();
        }
        function closePickNote() { document.getElementById('pickNoteModal').classList.remove('active'); }
        function continuePickNote() {
            try { localStorage.setItem(PICK_NOTE_KEY, '1'); } catch (e) { /* asked again next time */ }
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
            set('pickNoteTitle', 'picked.noteTitle'); set('pickNoteContinue', 'picked.noteContinue'); set('pickNoteCancel', 'web.cancel');
            document.getElementById('pickNoteText').innerHTML = markdownToHtml(t('picked.noteText')); // **bold**, like the task details (escapes HTML)
            set('serveHelpTitle', 'serveHelp.title'); set('serveHelpIntro', 'serveHelp.intro'); set('serveHelpStep1', 'serveHelp.step1');
            set('serveHelpStep2', 'serveHelp.step2'); set('serveHelpStep3', 'serveHelp.step3'); set('serveHelpClose', 'serveHelp.close');
            set('serveHelpCopy', 'serveHelp.copy');
        }

        async function openPickedFolder(files) {
            const src = pickedSource(files);
            try {
                if (!src.label) throw webError('noBoard');
                const board = await src.read('kanban.md');
                if (!board) throw webError('noBoard');
                if (!looksLikeBoard(board.text)) throw webError('notBoard');
            } catch (e) {
                if (!e.webCode) console.warn('Could not open the folder:', e);
                showWebNotice({ kind: 'error', code: e.webCode || 'network', place: null });
                return false;
            }
            webNotice = null;
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
            else showWebNotice({ kind: 'error', code: 'noBoard', place: null }); // an empty folder: say so, not nothing
        });
