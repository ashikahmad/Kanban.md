        // Shared dropdown behaviour. Markup contract:
        //   .dd                      root (gets .open while expanded)
        //     button.dd-trigger      toggles the menu
        //     .dd-menu               holds the options
        // Single-select (.dd-field): a hidden <input id="…"> holds the value and fires `change`;
        //   fill it with ddSetOptions(id, …) / ddSetValue(id, …); options are .dd-opt[data-value].
        // Multi-select (filters): any focusable rows (labels with checkboxes) inside .dd-menu.
        // One delegated set of listeners below handles opening, closing, outside click and the keyboard.

        function ddRoot(id) { return document.getElementById(id).closest('.dd'); }

        function ddOptionEls(root) {
            return [...root.querySelectorAll('.dd-menu .dd-opt, .dd-menu input[type="checkbox"]')];
        }

        function ddOpen(root) {
            ddCloseAll(root);
            root.classList.add('open');
            root.querySelector('.dd-trigger').setAttribute('aria-expanded', 'true');
            root.dispatchEvent(new CustomEvent('ddopen', { bubbles: true }));
        }

        function ddClose(root) {
            root.classList.remove('open');
            root.querySelector('.dd-trigger').setAttribute('aria-expanded', 'false');
        }

        function ddCloseAll(except) {
            document.querySelectorAll('.dd.open').forEach(d => { if (d !== except) ddClose(d); });
        }

        function ddFocusStart(root) {
            const opts = ddOptionEls(root);
            (opts.find(o => o.getAttribute('aria-selected') === 'true') || opts[0])?.focus();
        }

        function ddEscape(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        // options: [{ value, label, html? }]  (html, when given, replaces the escaped label in the menu and trigger)
        function ddSetOptions(id, options) {
            const root = ddRoot(id);
            root._ddOptions = options;
            root.querySelector('.dd-menu').innerHTML = options.map(o =>
                `<div class="dd-opt" role="option" tabindex="-1" data-value="${ddEscape(o.value)}">${o.html || `<span>${ddEscape(o.label)}</span>`}</div>`
            ).join('');
            ddSetValue(id, document.getElementById(id).value, true);
        }

        // Selects `value` (falls back to the first option if unknown). Fires `change` unless silent.
        function ddSetValue(id, value, silent) {
            const input = document.getElementById(id);
            const root = ddRoot(id);
            const options = root._ddOptions || [];
            const opt = options.find(o => o.value === value) || options[0];
            const next = opt ? opt.value : '';
            const changed = input.value !== next;
            input.value = next;
            root.querySelector('.dd-trigger').innerHTML = opt ? (opt.html || `<span>${ddEscape(opt.label)}</span>`) : '';
            root.querySelectorAll('.dd-menu .dd-opt').forEach(el =>
                el.setAttribute('aria-selected', String(el.dataset.value === next)));
            if (changed && !silent) input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function ddPick(optEl) {
            const root = optEl.closest('.dd');
            const input = root.querySelector('input[type="hidden"]');
            ddSetValue(input.id, optEl.dataset.value);
            ddClose(root);
            root.querySelector('.dd-trigger').focus();
        }

        // Capture phase so these run even where an ancestor stops click propagation (modals, popovers).
        document.addEventListener('click', (e) => {
            const trigger = e.target.closest('.dd-trigger');
            if (trigger) {
                e.stopPropagation();
                const root = trigger.closest('.dd');
                if (root.classList.contains('open')) ddClose(root);
                else { ddOpen(root); if (root.classList.contains('dd-field')) ddFocusStart(root); }
                return;
            }
            const opt = e.target.closest('.dd-field .dd-opt');
            if (opt) { e.stopPropagation(); ddPick(opt); }
        }, true);

        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.dd')) ddCloseAll();
        }, true);

        document.addEventListener('keydown', (e) => {
            const root = e.target.closest('.dd');
            if (!root) return;
            const open = root.classList.contains('open');
            const trigger = root.querySelector('.dd-trigger');
            const opts = ddOptionEls(root);
            const i = opts.indexOf(document.activeElement);
            if (e.key === 'Escape' && open) {
                e.stopPropagation();
                ddClose(root);
                trigger.focus();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!open && i < 0) { ddOpen(root); ddFocusStart(root); return; }
                const step = e.key === 'ArrowDown' ? 1 : -1;
                opts[Math.min(Math.max(i + step, 0), opts.length - 1)]?.focus();
            } else if ((e.key === 'Enter' || e.key === ' ') && open && root.classList.contains('dd-field') && i >= 0) {
                e.preventDefault();
                ddPick(opts[i]);
            } else if (e.key === 'Tab' && open && root.classList.contains('dd-field')) {
                ddClose(root);
            }
        }, true);
