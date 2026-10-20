        // Toolbar popovers: Filters panel and the "more" menu
        function closeMenus() {
            ['filterPanel', 'moreMenu', 'themeMenu'].forEach(id => document.getElementById(id).classList.remove('open'));
            ['filterToggleBtn', 'moreMenuBtn', 'themeMenuBtn'].forEach(id => document.getElementById(id).setAttribute('aria-expanded', 'false'));
            closeFdrops();
        }

        function closeFdrops(except) {
            document.querySelectorAll('.fdrop.open').forEach(d => {
                if (d !== except) { d.classList.remove('open'); d.querySelector('.fbtn').setAttribute('aria-expanded', 'false'); }
            });
        }

        // A filter dropdown. In the collapsed (narrow) layout the lists are always visible inside the Filters panel.
        function toggleFdrop(event, type) {
            event.stopPropagation();
            const drop = document.querySelector('.fdrop[data-type="' + type + '"]');
            const wasOpen = drop.classList.contains('open');
            ['moreMenu', 'themeMenu'].forEach(id => document.getElementById(id).classList.remove('open'));
            closeFdrops();
            if (!wasOpen) { drop.classList.add('open'); drop.querySelector('.fbtn').setAttribute('aria-expanded', 'true'); }
        }

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
        function toggleMoreMenu(event) { togglePopover('moreMenu', 'moreMenuBtn', event); }
        function toggleThemeMenu(event) { togglePopover('themeMenu', 'themeMenuBtn', event); }

        document.addEventListener('click', closeMenus);
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            closeMenus();
            // Esc and a click on the backdrop close the read-only dialogs (not the edit form, so typing is never lost)
            if (document.getElementById('taskModal').classList.contains('active')) closeModal();
            else if (document.getElementById('columnsModal').classList.contains('active')) closeColumnsModal();
            else if (document.getElementById('archiveModal').classList.contains('active')) closeArchiveModal();
        });
        document.addEventListener('mousedown', (e) => {
            if (e.target.id === 'taskModal') closeModal();
            else if (e.target.id === 'columnsModal') closeColumnsModal();
            else if (e.target.id === 'archiveModal') closeArchiveModal();
        });
