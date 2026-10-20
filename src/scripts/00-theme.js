        // Theme: 'auto' follows the system, 'light' and 'dark' are explicit. Only an explicit choice is stored.
        const THEME_ICONS = {
            auto: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11" /><path d="M8 2.5a5.5 5.5 0 0 0 0 11z" fill="currentColor"/></svg>',
            light: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/></svg>',
            dark: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/></svg>'
        };
        const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        let themeMode = (function() {
            try { const v = localStorage.getItem('theme'); return v === 'light' || v === 'dark' ? v : 'auto'; }
            catch (e) { return 'auto'; }
        })();

        function resolveTheme() {
            return themeMode === 'auto' ? (themeQuery.matches ? 'dark' : 'light') : themeMode;
        }

        function updateThemeUi() {
            const btn = document.getElementById('themeMenuBtn');
            if (!btn) return;
            btn.innerHTML = THEME_ICONS[themeMode];
            btn.title = t('menu.theme');
            btn.setAttribute('aria-label', t('menu.theme'));
            const names = { auto: t('menu.themeAuto'), light: t('menu.themeLight'), dark: t('menu.themeDark') };
            document.querySelectorAll('[data-theme-mode]').forEach(el => {
                const mode = el.dataset.themeMode;
                el.querySelector('.lbl').textContent = names[mode];
                el.querySelector('.check').textContent = mode === themeMode ? '\u2713' : '';
                el.setAttribute('aria-checked', mode === themeMode ? 'true' : 'false');
            });
        }

        function setThemeMode(mode) {
            themeMode = mode;
            try {
                if (mode === 'auto') localStorage.removeItem('theme');
                else localStorage.setItem('theme', mode);
            } catch (e) { /* storage unavailable: keep the choice for this session only */ }
            document.documentElement.setAttribute('data-theme', resolveTheme());
            updateThemeUi();
            if (typeof closeMenus === 'function') closeMenus();
        }

        themeQuery.addEventListener('change', () => {
            if (themeMode === 'auto') { document.documentElement.setAttribute('data-theme', resolveTheme()); }
        });
        document.documentElement.setAttribute('data-theme', resolveTheme());
