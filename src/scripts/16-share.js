        // ===== Share a task =====
        // Share one task without sharing the board: a preview of exactly what leaves, as plain text (for chat
        // or mail) or as a Markdown block (the file format, importable into another board). Copy it, or hand it
        // to the system share sheet where the browser has one. Nothing is sent anywhere by the app itself.
        let shareState = { task: null, format: 'text', notes: true, assignees: true };

        function buildShareText() {
            const { task, format, notes, assignees } = shareState;
            if (!task) return '';
            return format === 'markdown'
                ? taskToMarkdown(task, { notes, assignees })
                : taskToPlainText(task, config.columns, { notes, assignees });
        }

        function openShareDialog() {
            if (!currentDetailTask) return;
            shareState = { task: currentDetailTask, format: shareState.format, notes: true, assignees: true };
            document.getElementById('shareModal').classList.add('active');
            refreshShareDialog();
        }

        function closeShareDialog() {
            document.getElementById('shareModal').classList.remove('active');
        }

        function setShareOption(key, value) {
            shareState[key] = value;
            refreshShareDialog();
        }

        function refreshShareDialog() {
            const { task, format, notes, assignees } = shareState;
            if (!task) return;
            document.getElementById('shareModalTitle').textContent = t('share.title');
            document.getElementById('shareHint').textContent = t('share.hint');
            document.getElementById('shareFormatText').classList.toggle('btn-primary', format === 'text');
            document.getElementById('shareFormatText').classList.toggle('btn-secondary', format !== 'text');
            document.getElementById('shareFormatMd').classList.toggle('btn-primary', format === 'markdown');
            document.getElementById('shareFormatMd').classList.toggle('btn-secondary', format !== 'markdown');
            document.getElementById('shareFormatText').textContent = t('share.text');
            document.getElementById('shareFormatMd').textContent = t('share.markdown');
            document.getElementById('shareNotesLabel').textContent = t('share.includeNotes');
            document.getElementById('shareAssigneesLabel').textContent = t('share.includeAssignees');
            document.getElementById('shareNotes').checked = notes;
            document.getElementById('shareAssignees').checked = assignees;
            document.getElementById('shareNotesRow').style.display = task.notes || task.extra ? '' : 'none';
            document.getElementById('shareAssigneesRow').style.display = task.assignees.length ? '' : 'none';
            document.getElementById('sharePreview').value = buildShareText();
            document.getElementById('shareCopyBtn').textContent = t('share.copy');
            const native = document.getElementById('shareNativeBtn');
            native.textContent = t('share.share');
            native.style.display = typeof navigator.share === 'function' ? '' : 'none';
        }

        // Clipboard API where the browser allows it, the old selection trick otherwise.
        async function copyShare() {
            const text = document.getElementById('sharePreview').value;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
                else throw new Error('no clipboard API');
                showNotification(t('share.copied'), 'success');
            } catch (e) {
                const box = document.getElementById('sharePreview');
                box.focus(); box.select();
                let ok = false;
                try { ok = document.execCommand('copy'); } catch (err) { /* ignore */ }
                showNotification(t(ok ? 'share.copied' : 'share.copyFailed'), ok ? 'success' : 'error');
            }
        }

        async function nativeShare() {
            const { task } = shareState;
            try {
                await navigator.share({ title: task.title, text: document.getElementById('sharePreview').value });
            } catch (e) {
                if (e && e.name !== 'AbortError') showNotification(t('share.copyFailed'), 'error'); // AbortError = the user closed the sheet
            }
        }
