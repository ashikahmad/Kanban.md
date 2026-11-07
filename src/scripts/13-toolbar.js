        // Toolbar popovers: Filters panel and the "more" menu
        function closeMenus() {
            ['filterPanel', 'moreMenu', 'themeMenu'].forEach(id => document.getElementById(id).classList.remove('open'));
            ['filterToggleBtn', 'moreMenuBtn', 'themeMenuBtn'].forEach(id => document.getElementById(id).setAttribute('aria-expanded', 'false'));
            ddCloseAll();
        }

        // Opening a filter dropdown closes the header popovers
        document.addEventListener('ddopen', (e) => {
            if (e.target.closest('.fdrop')) ['moreMenu', 'themeMenu'].forEach(id => document.getElementById(id).classList.remove('open'));
        });

        function togglePopover(panelId, btnId, event) {
            event.stopPropagation();
            const panel = document.getElementById(panelId);
            const wasOpen = panel.classList.contains('open');
            closeMenus();
            if (!wasOpen) {
                panel.classList.add('open');
                document.getElementById(btnId).setAttribute('aria-expanded', 'true');
            }
        }

        function toggleFilterPanel(event) { togglePopover('filterPanel', 'filterToggleBtn', event); }
        // Hide separators that have no visible item before them or after them (the groups come and go with the board).
        function tidyMenuSeparators() {
            const items = [...document.getElementById('moreMenu').children];
            let seenItem = false, pending = null;
            for (const el of items) {
                if (el.classList.contains('menu-sep')) { el.style.display = 'none'; if (seenItem) pending = el; continue; }
                if (el.style.display === 'none') continue;
                if (pending) { pending.style.display = ''; pending = null; }
                seenItem = true;
            }
        }
        function toggleMoreMenu(event) { tidyMenuSeparators(); togglePopover('moreMenu', 'moreMenuBtn', event); }
        function toggleThemeMenu(event) { togglePopover('themeMenu', 'themeMenuBtn', event); }

        document.addEventListener('click', (e) => { if (!e.target.closest('.dd-menu')) closeMenus(); });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            closeMenus();
            // Esc and a click on the backdrop close the read-only dialogs (not the edit form, so typing is never lost)
            if (document.getElementById('shareModal').classList.contains('active')) closeShareDialog();
            else if (document.getElementById('taskModal').classList.contains('active')) closeModal();
            else if (document.getElementById('columnsModal').classList.contains('active')) closeColumnsModal();
            else if (document.getElementById('serveHelpModal').classList.contains('active')) closeServeHelp();
            else if (document.getElementById('pickNoteModal').classList.contains('active')) closePickNote();
            else if (document.getElementById('archiveModal').classList.contains('active')) closeArchiveModal();
            else if (document.getElementById('backlogModal').classList.contains('active')) closeBacklogModal();
        });
        document.addEventListener('mousedown', (e) => {
            if (e.target.id === 'shareModal') closeShareDialog();
            else if (e.target.id === 'taskModal') closeModal();
            else if (e.target.id === 'columnsModal') closeColumnsModal();
            else if (e.target.id === 'archiveModal') closeArchiveModal();
            else if (e.target.id === 'backlogModal') closeBacklogModal();
        });

        // Flag the board as scrolled so the sticky column titles can show a hairline under them
        (function() {
            const view = document.getElementById('kanbanView');
            view.addEventListener('scroll', () => view.classList.toggle('is-scrolled', view.scrollTop > 0), { passive: true });
        })();
