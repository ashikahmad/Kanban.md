        // ===== Manual card order (optional **Order** keys) =====
        // Off (the default): a card sits where its block is in the file, and dropping one relocates the
        // block. On: each task carries an Order number, a drop writes one number (two lines of diff) and no
        // block moves. The first drop on a board that has no keys asks once; the answer is remembered for
        // the project. See drafts/mcp-file-plan.md, section 5.7.
        function orderingActive() { return tasks.some((x) => x.order !== null && x.order !== undefined); }

        function orderChoiceKey() { return 'kanbanmd.orderChoice.' + (source ? source.key : ''); }
        function getOrderChoice() { try { return localStorage.getItem(orderChoiceKey()); } catch (e) { return null; } }
        function setOrderChoice(v) { try { localStorage.setItem(orderChoiceKey(), v); } catch (e) { /* private mode: asked again next time */ } }

        // 'on' | 'off' for a board that has no keys yet: the remembered answer, else ask once.
        function resolveOrderChoice() {
            const stored = getOrderChoice();
            if (stored === 'on' || stored === 'off') return stored;
            const choice = confirm(t('confirm.rememberOrder')) ? 'on' : 'off';
            setOrderChoice(choice);
            return choice;
        }

        async function runOrderOp(op, message) {
            await autoSave();
            const result = await commit([op], { explicit: true });
            if (result.ok && message) showNotification(t(message), 'success');
            return result.ok;
        }

        async function toggleManualOrder() {
            if (orderingActive()) {
                if (!confirm(t('confirm.orderOff'))) return;
                setOrderChoice('off');
                await runOrderOp({ type: 'sortTasks', mode: 'clear' }, 'notif.orderOff');
            } else {
                setOrderChoice('on');
                await runOrderOp({ type: 'sortTasks', mode: 'positions' }, 'notif.orderOn');
            }
        }

        async function resetOrderById() {
            if (!confirm(t('confirm.resetOrder'))) return;
            await runOrderOp({ type: 'sortTasks', mode: 'ids' }, 'notif.orderReset');
        }

        function updateOrderingMenu() {
            const toggle = document.getElementById('orderToggleBtn');
            const reset = document.getElementById('orderResetBtn');
            if (!toggle || !reset) return;
            const open = boardLoaded();
            toggle.style.display = open ? 'inline-flex' : 'none';
            reset.style.display = open && orderingActive() ? 'inline-flex' : 'none';
            toggle.querySelector('.mi-label').textContent = t(orderingActive() ? 'menu.manualOrderOn' : 'menu.manualOrderOff');
            reset.querySelector('.mi-label').textContent = t('menu.resetOrderById');
            if (typeof updateBacklogMenu === 'function') updateBacklogMenu();
        }
