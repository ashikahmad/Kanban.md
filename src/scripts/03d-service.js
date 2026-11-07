        // ===== The board served by `kanbanmd serve` =====
        // The service puts window.KANBANMD_SERVICE = { api, name } in the page it serves; starting the page that
        // way is the user's consent, so there is nothing to confirm. The board opens like a folder (editable).

        async function openServiceBoard(info) {
            useSource(serviceSource(info));
            await loadKanbanFile();
            showBoardView(true);
            await updateProjectSelector();
        }

        // Menu "Back to served board": return to it after looking at another folder or a web board. If kanbanmd
        // was stopped (or restarted with a new key) say so and stay where we are, instead of opening an empty board.
        async function backToServiceBoard() {
            if (!window.KANBANMD_SERVICE) return;
            const state = await probeService();
            if (state !== 'ok') { showNotification(t(state === 'expired' ? 'status.expired' : 'status.stopped'), 'error'); return; }
            return openServiceBoard(window.KANBANMD_SERVICE);
        }
