        // ===== Share a task =====
        // Share one task without sharing the board: a preview of exactly what leaves, as plain text (for chat
        // or mail) or as a Markdown block (the file format, importable into another board). Copy it, or hand it
        // to the system share sheet where the browser has one. Nothing is sent anywhere by the app itself.
        let shareState = { task: null, format: 'text', view: 'rendered', notes: true, assignees: true };

        function buildShareText() {
            const { task, format, notes, assignees } = shareState;
            if (!task) return '';
            return format === 'markdown'
                ? taskToMarkdown(task, { notes, assignees })
                : taskToPlainText(task, config.columns, { notes, assignees });
        }

        // The task block as a reader would want it: title as a heading, the one-per-line fields as a compact
        // label/value list, then the description, subtasks and notes through the app's own Markdown renderer.
        function renderShareMarkdown(text) {
            const lines = text.replace(/\n---\s*$/, '').split('\n');
            const head = /^### (.+?) \| (.*)$/.exec(lines[0] || '');
            let i = head ? 1 : 0, fields = '';
            for (; i < lines.length; i++) {
                const m = /^\*\*([^*:]+)\*\*: (.*)$/.exec(lines[i]);
                if (!m) break;
                fields += `<dt>${escapeHtml(m[1])}</dt><dd>${escapeHtml(m[2])}</dd>`;
            }
            return (head ? `<h3 class="share-h"><span>${escapeHtml(head[1])}</span> ${escapeHtml(head[2])}</h3>` : '')
                + (fields ? `<dl class="share-fields">${fields}</dl>` : '')
                + markdownToHtml(lines.slice(i).join('\n').trim()).replace(/\[ \]/g, '\u2610').replace(/\[[xX]\]/g, '\u2611');
        }

        function openShareDialog() {
            if (!currentDetailTask) return;
            shareState = { task: currentDetailTask, format: shareState.format, view: shareState.view, notes: true, assignees: true };
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
            const { task, format, view, notes, assignees } = shareState;
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
            const text = buildShareText();
            const box = document.getElementById('sharePreview');
            const rendered = document.getElementById('shareRendered');
            const showRendered = format === 'markdown' && view === 'rendered';
            box.value = text;
            box.style.display = showRendered ? 'none' : '';
            rendered.style.display = showRendered ? '' : 'none';
            if (showRendered) rendered.innerHTML = renderShareMarkdown(text);
            document.getElementById('shareView').style.display = format === 'markdown' ? '' : 'none';
            for (const [id, on] of [['shareViewRendered', view === 'rendered'], ['shareViewRaw', view === 'raw']]) {
                const b = document.getElementById(id);
                b.classList.toggle('btn-primary', on);
                b.classList.toggle('btn-secondary', !on);
                b.setAttribute('aria-pressed', on);
            }
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
                const box = document.createElement('textarea'); // the preview may be hidden (rendered view)
                box.value = text; document.body.appendChild(box);
                box.select();
                let ok = false;
                try { ok = document.execCommand('copy'); } catch (err) { /* ignore */ }
                box.remove();
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
