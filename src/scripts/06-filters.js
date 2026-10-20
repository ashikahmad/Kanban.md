        async function autoSave() {
            if (!kanbanFileHandle) return false;
            try {
                const newContent = generateMarkdown();
                const writable = await kanbanFileHandle.createWritable();
                await writable.write(newContent);
                await writable.close();
                currentKanbanContent = newContent;
                console.log('Auto-saved');
                return true;
            } catch (error) {
                console.error('Auto-save failed:', error);
                return false;
            }
        }

        // Helper function to normalize user identifier (extract @username from @username (Display Name))
        function normalizeUserId(userString) {
            if (!userString) return '';
            // Extract @username before the space or parenthesis
            const match = userString.match(/^(@[^\s(]+)/);
            return match ? match[1] : userString;
        }

        // Helper function to get full user format from user ID
        function getUserFullFormat(userId) {
            // Resolve "@user (Name)" from the runtime union (config + active + archived tasks),
            // not just config.users: a user that lives only on a task must still show its full
            // name in filter badges now that config no longer absorbs task-derived users.
            const match = extractUniqueValues().users.find(u => normalizeUserId(u) === userId);
            return match || userId;
        }

        // Extract unique values for autocomplete (including historical archived data)
        function extractUniqueValues() {
            // Start with values from config (always keep these)
            const categories = new Set(config.categories || []);
            const userMap = new Map(); // Map from normalized ID to full format
            const tags = new Set(config.tags || []);

            // First, add config users (these have the full format with display names)
            (config.users || []).forEach(u => {
                const normalizedId = normalizeUserId(u);
                if (!userMap.has(normalizedId)) {
                    userMap.set(normalizedId, u);
                }
            });

            // Extract from active tasks
            tasks.forEach(t => {
                if (t.category) categories.add(t.category);
                t.assignees.forEach(u => {
                    const normalizedId = normalizeUserId(u);
                    // Only add if not already in map (prefer config version)
                    if (!userMap.has(normalizedId)) {
                        userMap.set(normalizedId, u);
                    }
                });
                t.tags.forEach(tag => tags.add(tag.replace('#', '')));
            });

            // Extract from archived tasks (historical data)
            archivedTasks.forEach(t => {
                if (t.category) categories.add(t.category);
                t.assignees.forEach(u => {
                    const normalizedId = normalizeUserId(u);
                    if (!userMap.has(normalizedId)) {
                        userMap.set(normalizedId, u);
                    }
                });
                t.tags.forEach(tag => tags.add(tag.replace('#', '')));
            });

            return { categories: [...categories], users: [...userMap.values()], tags: [...tags] };
        }

        // Update autocomplete datalists and filter selects
        function updateAutocomplete() {
            const { categories, users, tags } = extractUniqueValues();

            // Update form datalists (keep full format for proper storage). Escape values: they can
            // come from a shared kanban.md, and an <option value> is an HTML attribute → XSS sink.
            document.getElementById('categoriesList').innerHTML = categories.map(c => `<option value="${escapeHtml(c)}">`).join('');
            document.getElementById('usersList').innerHTML = users.map(u => `<option value="${escapeHtml(u)}">`).join('');
            document.getElementById('tagsList').innerHTML = tags.map(t => `<option value="${escapeHtml(t)}">`).join('');

            buildFilterMenus();
        }

        // Filter functions
        // Filter menus: one checklist per filter type, so several values per type can be active at once
        function filterOptions(type) {
            const { categories, users, tags } = extractUniqueValues();
            if (type === 'tag') return tags.map(v => ({ value: v, label: v }));
            if (type === 'category') return categories.map(v => ({ value: v, label: v }));
            if (type === 'user') return users.map(u => ({ value: normalizeUserId(u), label: u }));
            return (config.priorities || []).map(p => ({ value: clean(p), label: displayPriority(p) }));
        }

        function buildFilterMenus() {
            ['tag', 'category', 'user', 'priority'].forEach(type => {
                const menu = document.getElementById('fmenu-' + type);
                if (!menu) return;
                const opts = filterOptions(type);
                menu.innerHTML = opts.length === 0
                    ? `<div class="fempty">${t('empty.noTasks')}</div>`
                    : opts.map(o => `<label class="fopt"><input type="checkbox" data-type="${type}" data-value="${escapeHtml(o.value)}" onchange="setFilterValue(this.dataset.type, this.dataset.value, this.checked)"><span>${escapeHtml(o.label)}</span></label>`).join('');
            });
            syncFilterUi();
        }

        function setFilterValue(type, value, on) {
            const idx = activeFilters.findIndex(f => f.type === type && f.value === value);
            if (on && idx < 0) activeFilters.push({ type, value });
            if (!on && idx >= 0) activeFilters.splice(idx, 1);
            renderFilters();
            renderKanban();
        }

        // Reflect activeFilters in the checklists, the per-filter counts, the Filters badge and "Clear all"
        function syncFilterUi() {
            document.querySelectorAll('.fmenu input[type="checkbox"]').forEach(cb => {
                cb.checked = activeFilters.some(f => f.type === cb.dataset.type && f.value === cb.dataset.value);
            });
            document.querySelectorAll('.fdrop').forEach(d => {
                const n = activeFilters.filter(f => f.type === d.dataset.type).length;
                d.querySelector('.fcount').textContent = n || '';
                d.classList.toggle('active', n > 0);
            });
            const count = document.getElementById('filterCount');
            if (count) {
                count.textContent = activeFilters.length;
                count.style.display = activeFilters.length ? '' : 'none';
            }
        }

        function removeFilter(idx) {
            activeFilters.splice(idx, 1);
            renderFilters();
            renderKanban();
        }

        function clearFilters() {
            activeFilters = [];
            renderFilters();
            renderKanban();
        }

        // Global search functions
        function applyGlobalSearch() {
            const input = document.getElementById('globalSearchInput');
            const clearBtn = document.getElementById('clearGlobalSearch');
            globalSearchTerm = input.value.trim();

            // Show/hide clear button
            clearBtn.style.display = globalSearchTerm ? 'block' : 'none';

            // Re-render kanban with search filter
            renderKanban();
        }

        function clearGlobalSearch() {
            const input = document.getElementById('globalSearchInput');
            const clearBtn = document.getElementById('clearGlobalSearch');
            input.value = '';
            globalSearchTerm = '';
            clearBtn.style.display = 'none';
            renderKanban();
        }

        function renderFilters() {
            const container = document.getElementById('activeFilters');

            const clearAll = activeFilters.length
                ? `<button class="chip-clear" onclick="clearFilters()">${escapeHtml(t('filters.clearAll'))}</button>`
                : '';
            container.innerHTML = clearAll + activeFilters.map((f, idx) => {
                // Determine display value based on filter type
                let displayValue = f.value;

                // For priority filters, display with prefix/emoji from config
                if (f.type === 'priority' && config.priorities) {
                    const priority = config.priorities.find(p => clean(p) === f.value);
                    if (priority) {
                        displayValue = priority;
                    }
                }

                // For user filters, display with full format from config
                if (f.type === 'user') {
                    displayValue = getUserFullFormat(f.value);
                }

                return `<span class="chip" data-type="${f.type}">${escapeHtml(displayPriority(displayValue))}<button onclick="removeFilter(${idx})" title="${t('tooltip.delete')}" aria-label="${t('tooltip.delete')}">&times;</button></span>`;
            }).join('');

            syncFilterUi();
        }

        function matchesFilters(task) {
            // Check active filters (tags, category, user, priority)
            // Values of the same filter type are alternatives (OR); different types must all match (AND)
            if (activeFilters.length > 0) {
                const types = [...new Set(activeFilters.map(f => f.type))];
                const matchesActiveFilters = types.every(type =>
                    activeFilters.filter(f => f.type === type).some(filter => {
                        if (type === 'tag') {
                            return task.tags.includes(filter.value) || task.tags.includes('#' + filter.value);
                        } else if (type === 'category') {
                            return task.category === filter.value;
                        } else if (type === 'user') {
                            // Normalize both the filter value and task assignees for comparison
                            return task.assignees.some(assignee => normalizeUserId(assignee) === filter.value);
                        } else if (type === 'priority') {
                            return task.priority === filter.value;
                        }
                        return false;
                    })
                );
                if (!matchesActiveFilters) return false;
            }

            // Check global search term (searches in title, description, and notes)
            if (globalSearchTerm) {
                const searchLower = globalSearchTerm.toLowerCase();
                const matchesSearch =
                    (task.title && task.title.toLowerCase().includes(searchLower)) ||
                    (task.description && task.description.toLowerCase().includes(searchLower)) ||
                    (task.notes && task.notes.toLowerCase().includes(searchLower));
                if (!matchesSearch) return false;
            }

            return true;
        }

        // Click to add filter
        function clickToFilter(type, value) {
            if (!activeFilters.find(f => f.type === type && f.value === value)) {
                activeFilters.push({ type, value });
                renderFilters();
                renderKanban();
            }
        }

        // Column management
