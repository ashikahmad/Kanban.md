// Behavioural checks of the page's persistence, run in the browser against the fake project folder:
//   (0, eval)(await (await fetch('/test/tools/page-harness.js')).text());
//   (0, eval)(await (await fetch('/test/tools/page-checks.js')).text());  // returns the results
// Each check builds a fresh project, drives the page's own functions, and inspects the "disk".
(async () => {
  const results = [];
  const check = async (name, fn) => {
    try { const detail = await fn(); results.push({ name, ok: true, ...(detail ? { detail } : {}) }); }
    catch (e) { results.push({ name, ok: false, error: String(e && e.message || e) }); }
  };
  const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'not equal'}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); };
  const ok = (v, msg) => { if (!v) throw new Error(msg || 'assertion failed'); };
  const lines = (s) => s.split('\n');
  const changedLines = (a, b) => { const d = KanbanCore.diffStats(a, b); return { removed: d.removed, added: d.added }; };
  async function fresh(transform = (x) => x) {
    for (const k of ['orderChoice', 'hk.snooze', 'hk.dismissed']) localStorage.removeItem(`kanbanmd.${k}.fake`); // no remembered answers
    const files = { 'kanban.md': transform(await H.fixture('demo.kanban')), 'archive.md': await H.fixture('demo.archive') };
    const proj = await H.open(files);          // the page migrates the v2 demo to v3 on load
    proj.log.length = 0;
    return proj;
  }
  const settle = () => new Promise((r) => setTimeout(r, 30));
  const realConfirm = window.confirm;

  await check('load migrates and snapshots; no spurious save', async () => {
    const proj = await fresh();
    ok(/Format: v3/.test(proj.files['kanban.md']), 'board is v3');
    await autoSave();
    eq(proj.log, [], 'nothing written when nothing changed');
  });

  await check('a one-card edit writes a one-card diff', async () => {
    const proj = await fresh();
    const before = proj.files['kanban.md'];
    tasks[2].title = 'Retitled by the page'; tasks[2].due = '2027-01-01';
    await autoSave();
    const d = changedLines(before, proj.files['kanban.md']);
    ok(d.removed <= 1 && d.added <= 2, `diff ${JSON.stringify(d)}`);
    eq(proj.log, ['kanban.md'], 'only the board was written');
    ok(/Retitled by the page/.test(proj.files['kanban.md']));
  });

  await check('an outside edit is picked up and rendered', async () => {
    const proj = await fresh();
    const text = proj.files['kanban.md'].replace('Rate limiting for the public API', 'Edited by an agent');
    H.external(proj, 'kanban.md', text);
    await pollOnce();
    eq(tasks.find((t) => t.id === 'TASK-002').title, 'Edited by an agent');
    ok(document.body.innerText.includes('Edited by an agent'), 'rendered');
    await pollOnce(); eq(proj.log, [], 'the page did not write while only reading');
  });

  await check('my edit and an outside edit to different tasks both survive', async () => {
    const proj = await fresh();
    // the agent edits TASK-002 on disk; the page (not yet polled) edits TASK-005 and saves
    H.external(proj, 'kanban.md', proj.files['kanban.md'].replace('Rate limiting for the public API', 'Agent title'));
    tasks.find((t) => t.id === 'TASK-005').title = 'Page title';
    await autoSave();
    const disk = proj.files['kanban.md'];
    ok(disk.includes('Agent title') && disk.includes('Page title'), 'both on disk');
    eq(tasks.find((t) => t.id === 'TASK-002').title, 'Agent title', 'memory took the merged result');
    eq(tasks.find((t) => t.id === 'TASK-005').title, 'Page title');
  });

  await check('a new task whose id an agent took meanwhile gets the next free id, and the page follows', async () => {
    const proj = await fresh();
    const agentTask = '\n### TASK-020 | Agent task\n**Status**: backlog\n**Created**: 2026-10-21\n';
    H.external(proj, 'kanban.md', proj.files['kanban.md'].replace(/Last Task ID: \d+/, 'Last Task ID: 20').trimEnd() + '\n' + agentTask);
    config.lastTaskId = 19; // the page has not seen it yet
    tasks.push({ ...JSON.parse(JSON.stringify(tasks[0])), id: 'TASK-020', title: 'Page task', subtasks: [], notes: '' });
    config.lastTaskId = 20;
    await autoSave();
    const ids = tasks.map((t) => t.id);
    ok(ids.includes('TASK-020') && ids.includes('TASK-021'), `ids ${ids.slice(-3)}`);
    eq(tasks.find((t) => t.title === 'Page task').id, 'TASK-021');
    eq(tasks.find((t) => t.title === 'Agent task').id, 'TASK-020');
  });

  await check('drag and drop is an explicit move: small diff, and it survives an outside edit', async () => {
    const proj = await fresh();
    const before = proj.files['kanban.md'];
    H.external(proj, 'kanban.md', before.replace('Rate limiting for the public API', 'Agent title'));
    const moved = await moveTask('TASK-001', 'in-progress', 'TASK-007');
    ok(moved, 'moved');
    const ids = tasks.map((t) => t.id);
    ok(ids.indexOf('TASK-001') === ids.indexOf('TASK-007') - 1, 'placed before the anchor');
    ok(proj.files['kanban.md'].includes('Agent title'), 'outside edit kept');
    eq(tasks.find((t) => t.id === 'TASK-001').status, 'in-progress');
  });

  await check('archive writes the archive first; restore brings the task back', async () => {
    const proj = await fresh();
    const t = tasks.find((x) => x.id === 'TASK-003');
    tasks.splice(tasks.indexOf(t), 1); archivedTasks.push(t);
    await autoSave();
    eq(proj.log.slice(0, 2), ['archive.md', 'kanban.md'], 'archive first');
    ok(proj.files['archive.md'].includes('### TASK-003'), 'in archive'); ok(!proj.files['kanban.md'].includes('### TASK-003'), 'not on board');
    proj.log.length = 0;
    const a = archivedTasks.find((x) => x.id === 'TASK-003');
    archivedTasks.splice(archivedTasks.indexOf(a), 1); tasks.push(a);
    await autoSave();
    ok(proj.files['kanban.md'].includes('### TASK-003') && !proj.files['archive.md'].includes('### TASK-003'), 'restored');
  });

  await check('an edit made while a save is in flight is not lost', async () => {
    const proj = await fresh();
    tasks[0].title = 'First edit';
    const saving = autoSave();                  // starts, awaits file I/O
    tasks[1].title = 'Second edit';             // lands while the first save is running
    const saving2 = autoSave();
    await saving; await saving2;
    ok(proj.files['kanban.md'].includes('First edit') && proj.files['kanban.md'].includes('Second edit'), 'both saved');
    eq(tasks[0].title, 'First edit'); eq(tasks[1].title, 'Second edit');
  });

  await check('a column rename, re-id and delete are saved as minimal edits', async () => {
    const proj = await fresh();
    const before = proj.files['kanban.md'];
    config.columns[1].name = 'Doing now';
    await autoSave();
    const d = changedLines(before, proj.files['kanban.md']);
    ok(d.removed <= 1 && d.added <= 1, `rename diff ${JSON.stringify(d)}`);
    const old = config.columns[1].id; config.columns[1].id = 'wip';
    for (const x of [...tasks, ...archivedTasks]) if (x.status === old) x.status = 'wip';
    await autoSave();
    ok(proj.files['kanban.md'].includes('**Status**: wip') && !proj.files['kanban.md'].includes(`**Status**: ${old}\n`), 're-id applied');
  });

  await check('a file that is not v3 (written by something else) is rewritten, not corrupted', async () => {
    const proj = await fresh();
    H.external(proj, 'kanban.md', await H.fixture('demo.kanban')); // a v2 writer
    await pollOnce();                            // page adopts it
    ok(!/Format: v3/.test(proj.files['kanban.md']), 'file is v2 on disk');
    tasks[0].title = 'Edit on top of v2';
    await autoSave();
    ok(/Format: v3/.test(proj.files['kanban.md']) && proj.files['kanban.md'].includes('Edit on top of v2'), 'rewritten as v3 with the edit');
  });

  await check('a change the ops cannot express falls back to a whole-file write when the file is unchanged', async () => {
    const proj = await fresh();
    tasks[0].extra = '**Links**:\n- https://example.com';
    await autoSave();
    ok(proj.files['kanban.md'].includes('https://example.com'), 'written');
  });

  await check('an open edit form is not overwritten silently when its task changes outside', async () => {
    const proj = await fresh();
    openTaskModal(tasks.find((t) => t.id === 'TASK-002'));
    document.getElementById('taskTitle').value = 'Typed by me';
    let asked = 0; window.confirm = () => { asked++; return false; };      // keep what I typed
    H.external(proj, 'kanban.md', proj.files['kanban.md'].replace('Rate limiting for the public API', 'Agent title'));
    await pollOnce();
    eq(asked, 1, 'asked once');
    eq(document.getElementById('taskTitle').value, 'Typed by me', 'form kept');
    window.confirm = () => { asked++; return true; };                       // load the new values
    H.external(proj, 'kanban.md', proj.files['kanban.md'].replace('Agent title', 'Agent title two'));
    await pollOnce();
    eq(document.getElementById('taskTitle').value, 'Agent title two', 'form reloaded');
    closeTaskModal(); window.confirm = realConfirm;
  });

  await check('archiving in a project with no archive.md creates it, marked v3', async () => {
    const files = { 'kanban.md': await H.fixture('demo.kanban') };
    const proj = await H.open(files);
    proj.log.length = 0;
    const t = tasks.find((x) => x.id === 'TASK-003');
    tasks.splice(tasks.indexOf(t), 1); archivedTasks.push(t);
    await autoSave();
    ok(proj.files['archive.md'] && /Format: v3/.test(proj.files['archive.md']) && proj.files['archive.md'].includes('### TASK-003'), 'archive created');
    eq(archivedTasks.map((x) => x.id), ['TASK-003']);
  });

  await check('the real form submit (create, then edit) goes through the same path', async () => {
    const proj = await fresh();
    const before = proj.files['kanban.md'];
    openTaskModal(null, 'backlog');
    document.getElementById('taskTitle').value = 'Created from the form';
    document.getElementById('newTaskForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await settle(); await autoSave();
    ok(proj.files['kanban.md'].includes('### TASK-020 | Created from the form'), 'created on disk');
    ok(document.body.innerText.includes('Created from the form'), 'shown');
    const d = changedLines(before, proj.files['kanban.md']);
    ok(d.removed === 1 && d.added >= 5, `append-only diff ${JSON.stringify(d)}`); // Last Task ID line + the new block
    openTaskModal(tasks.find((t) => t.title === 'Created from the form'));
    document.getElementById('taskTitle').value = 'Edited from the form';
    document.getElementById('newTaskForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await settle(); await autoSave();
    ok(proj.files['kanban.md'].includes('TASK-020 | Edited from the form'), 'edit saved');
  });

  // ---- manual order ----
  const columnIds = (colId) => [...document.querySelectorAll(`.kanban-column[data-column-id="${colId}"] .task-card`)].map((c) => c.dataset.taskId);
  const keyLines = (text) => (text.match(/^\*\*Order\*\*:/gm) || []).length;
  const resetChoice = () => localStorage.removeItem('kanbanmd.orderChoice.fake');

  await check('first drop asks once; "no" relocates the block and is remembered', async () => {
    const proj = await fresh(); resetChoice();
    let asked = 0; window.confirm = () => { asked++; return false; };
    ok(await moveTask('TASK-001', 'in-progress', 'TASK-007'), 'moved');
    eq(asked, 1, 'asked once');
    eq(keyLines(proj.files['kanban.md']), 0, 'no keys written');
    const ids = tasks.map((t) => t.id); ok(ids.indexOf('TASK-001') === ids.indexOf('TASK-007') - 1, 'block relocated before the anchor');
    ok(await moveTask('TASK-002', 'in-progress', null), 'second drop moved');
    eq(asked, 1, 'not asked again');
    eq(localStorage.getItem('kanbanmd.orderChoice.fake'), 'off');
    window.confirm = realConfirm;
  });

  await check('first drop asks once; "yes" turns manual order on, then a drop is a two-line diff', async () => {
    const proj = await fresh(); resetChoice();
    let asked = 0; window.confirm = () => { asked++; return true; };
    const order = tasks.map((t) => t.id);
    ok(await moveTask('TASK-001', 'in-progress', 'TASK-007'), 'moved');
    eq(asked, 1);
    eq(keyLines(proj.files['kanban.md']), tasks.length, 'every task has a key');
    eq(tasks.map((t) => t.id), order, 'no block moved');
    ok(orderingActive(), 'active');
    const col = columnIds('in-progress'); ok(col.indexOf('TASK-001') === col.indexOf('TASK-007') - 1, `rendered before the anchor: ${col}`);
    const before = proj.files['kanban.md'];
    ok(await moveTask('TASK-002', 'in-progress', 'TASK-001'), 'second drop');
    eq(asked, 1, 'not asked again');
    const d = changedLines(before, proj.files['kanban.md']); ok(d.removed <= 2 && d.added <= 2, `two-line diff ${JSON.stringify(d)}`);
    const col2 = columnIds('in-progress'); ok(col2.indexOf('TASK-002') === col2.indexOf('TASK-001') - 1, 'rendered in key order');
    window.confirm = realConfirm;
  });

  await check('a drop where the card already is neither asks nor writes', async () => {
    const proj = await fresh(); resetChoice();
    let asked = 0; window.confirm = () => { asked++; return true; };
    const col = columnIds('in-progress');
    const moved = await moveTask(col[col.length - 1], 'in-progress', null);
    eq(moved, false); eq(asked, 0); eq(proj.log, [], 'nothing written');
    window.confirm = realConfirm;
  });

  await check('menu: switch on, reset by id, switch off', async () => {
    const proj = await fresh(); resetChoice();
    window.confirm = () => true;
    await toggleManualOrder();
    ok(orderingActive() && keyLines(proj.files['kanban.md']) === tasks.length, 'on');
    ok(document.getElementById('orderToggleBtn').querySelector('.mi-label').textContent.includes('on'), 'label says on');
    ok(document.getElementById('orderResetBtn').style.display !== 'none', 'reset item visible');
    await moveTask('TASK-015', 'backlog', 'TASK-001');
    await resetOrderById();
    const shown = orderedTasks(tasks).map((t) => t.id); eq(shown, [...shown].sort(), 'id order');
    await toggleManualOrder();
    ok(!orderingActive() && keyLines(proj.files['kanban.md']) === 0, 'off, keys removed');
    eq(localStorage.getItem('kanbanmd.orderChoice.fake'), 'off');
    ok(document.getElementById('orderResetBtn').style.display === 'none', 'reset item hidden');
    window.confirm = realConfirm;
  });

  await check('an outside change of keys re-renders the new order', async () => {
    const proj = await fresh(); resetChoice();
    window.confirm = () => true; await toggleManualOrder(); window.confirm = realConfirm;
    const col = columnIds('backlog'); const first = col[0], last = col[col.length - 1];
    let text = proj.files['kanban.md'];
    // an agent gives the first card of the column the highest key
    text = text.replace(new RegExp(`(### ${first} \\|[^\\n]*\\n\\*\\*Status\\*\\*: [^\\n]*\\n\\*\\*Order\\*\\*: )\\d+`), '$1999999');
    H.external(proj, 'kanban.md', text);
    await pollOnce();
    const after = columnIds('backlog'); eq(after[after.length - 1], first, 'moved to the end'); ok(after[0] !== first);
  });

  // ---- housekeeping ----
  const oldDone = (t) => t.replace(/\*\*Finished\*\*: \d{4}-\d{2}-\d{2}/g, '**Finished**: 2020-01-01');
  const recent = (t) => { const d = new Date(); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return t.replace(/\*\*Finished\*\*: \d{4}-\d{2}-\d{2}/g, `**Finished**: ${iso}`); };
  const bar = () => document.getElementById('housekeepingBar');
  const barVisible = () => bar().style.display !== 'none' && bar().textContent.trim() !== '';
  const buttons = () => [...bar().querySelectorAll('button')].map((b) => b.textContent);

  await check('housekeeping: finished tasks left on the board show a bar with the count and three actions', async () => {
    await fresh(oldDone);
    ok(barVisible(), 'bar visible');
    ok(/4 done task\(s\) finished 30\+ days ago/.test(bar().textContent), bar().textContent);
    eq(buttons(), ['Archive done (4)', 'Snooze 7 days', 'Dismiss']);
  });

  await check('housekeeping: nothing over a threshold, no bar', async () => {
    await fresh(recent);
    ok(!barVisible(), 'hidden');
  });

  await check('housekeeping: "Archive done" asks, then archives all of them in one edit', async () => {
    const proj = await fresh(oldDone);
    proj.log.length = 0;
    let asked = 0; window.confirm = () => { asked++; return true; };
    const before = archivedTasks.length;
    [...bar().querySelectorAll('button')].find((b) => b.textContent.startsWith('Archive done')).click();
    await new Promise((r) => setTimeout(r, 200)); await autoSave();
    eq(asked, 1);
    eq(archivedTasks.length, before + 4, 'four more in the archive');
    ok(!tasks.some((t) => t.status === 'done'), 'none left in done');
    eq(proj.log, ['archive.md', 'kanban.md'], 'one write per file, archive first');
    ok(!barVisible(), 'bar gone');
    window.confirm = realConfirm;
  });

  await check('housekeeping: cancelling the confirm archives nothing', async () => {
    const proj = await fresh(oldDone); proj.log.length = 0;
    window.confirm = () => false;
    [...bar().querySelectorAll('button')].find((b) => b.textContent.startsWith('Archive done')).click();
    await new Promise((r) => setTimeout(r, 100));
    eq(proj.log, []); ok(barVisible(), 'still shown'); window.confirm = realConfirm;
  });

  await check('housekeeping: snooze hides it, dismiss hides it until the numbers change', async () => {
    const proj = await fresh(oldDone);
    [...bar().querySelectorAll('button')].find((b) => b.textContent === 'Snooze 7 days').click();
    ok(!barVisible(), 'snoozed'); renderKanban(); ok(!barVisible(), 'still snoozed after a re-render');
    localStorage.removeItem('kanbanmd.hk.snooze.fake'); renderKanban(); ok(barVisible(), 'back once the snooze is gone');
    [...bar().querySelectorAll('button')].find((b) => b.textContent === 'Dismiss').click();
    ok(!barVisible(), 'dismissed'); renderKanban(); ok(!barVisible(), 'stays dismissed');
    // another old finished task appears (an agent finishes one): the counts differ, so it returns
    const text = proj.files['kanban.md'].replace(/(### TASK-001 \|[^\n]*\n\*\*Status\*\*: )backlog/, '$1done').replace(/(### TASK-001 \|[^\n]*\n\*\*Status\*\*: done *\n)/, '$1**Finished**: 2020-01-01\n');
    H.external(proj, 'kanban.md', text); await pollOnce();
    ok(barVisible(), 'returned because the situation changed');
    ok(/5 done task/.test(bar().textContent), bar().textContent);
  });

  await check('housekeeping: old backlog tasks are outlined and counted', async () => {
    await fresh((t) => t.replace(/(### TASK-001 \|[\s\S]*?\*\*Created\*\*: )\d{4}-\d{2}-\d{2}/, '$12020-01-01'));
    ok(barVisible() && /1 backlog task\(s\) older than 90 days/.test(bar().textContent), bar().textContent);
    const card = document.querySelector('.task-card[data-task-id="TASK-001"]');
    ok(card && card.classList.contains('hk-stale'), 'card outlined');
    ok(!document.querySelector('.task-card[data-task-id="TASK-002"]').classList.contains('hk-stale'), 'others are not');
  });

  await check('housekeeping: the policy can be edited from the menu (custom, off, reset)', async () => {
    const proj = await fresh(recent);
    const realPrompt = window.prompt;
    window.prompt = () => 'max=3'; await editHousekeepingSettings();
    ok(proj.files['kanban.md'].includes('**Housekeeping**: max=3'), 'line written');
    ok(barVisible() && /\d+ tasks on the board \(limit 3\)/.test(bar().textContent), bar().textContent);
    window.prompt = () => 'off'; await editHousekeepingSettings();
    ok(proj.files['kanban.md'].includes('**Housekeeping**: off') && !barVisible(), 'off');
    window.prompt = () => 'reset'; await editHousekeepingSettings();
    ok(!proj.files['kanban.md'].includes('Housekeeping'), 'line removed');
    window.prompt = () => null; const before = proj.files['kanban.md']; await editHousekeepingSettings(); eq(proj.files['kanban.md'], before, 'cancel changes nothing');
    window.prompt = realPrompt;
  });

  // ---- backlog file ----
  const withBacklog = async () => { const proj = await fresh(); proj.log.length = 0; await runOrderOp({ type: 'setBacklogFile', enabled: true, column: 'backlog' }, null); return proj; };
  const colCards = (id) => document.querySelectorAll(`.kanban-column[data-column-id="${id}"] .task-card`).length;
  const stubCount = () => { const e = document.querySelector('.kanban-column[data-column-id="backlog"] .backlog-stub-count'); return e && e.textContent; };
  const panelRows = () => [...document.querySelectorAll('#backlogList .archive-item')].map((r) => r.dataset.id);
  const clickIn = (id, action, status) => document.querySelector(`#backlogList .archive-item[data-id="${id}"] [data-action="${action}"]${status ? `[data-status="${status}"]` : ''}`).click();
  const settleUi = () => new Promise((r) => setTimeout(r, 120));

  await check('backlog: enabling moves its tasks into backlog.md; the column becomes a stub with the real count', async () => {
    const proj = await fresh(); proj.log.length = 0;
    await runOrderOp({ type: 'setBacklogFile', enabled: true, column: 'backlog' }, null);
    ok(proj.files['backlog.md'] && /### TASK-001/.test(proj.files['backlog.md']), 'file created with the tasks');
    ok(!/### TASK-001/.test(proj.files['kanban.md']) && /Backlog file\*\*: backlog\.md \(backlog\)/.test(proj.files['kanban.md']), 'board file lost them and has the config line');
    eq(proj.log, ['backlog.md', 'kanban.md'], 'the new file is written first');
    eq(colCards('backlog'), 0, 'no cards in the stub column'); eq(stubCount(), '5', 'stub shows the real count');
    eq(document.querySelector('.kanban-column[data-column-id="backlog"] .column-count').textContent, '5');
    ok(colCards('in-progress') > 0, 'other columns are normal');
  });

  await check('backlog: the panel lists, searches, and promotes a task without asking about ordering', async () => {
    const proj = await withBacklog();
    let asked = 0; window.confirm = () => { asked++; return true; };
    openBacklogModal();
    eq(panelRows().length, 5); ok(document.getElementById('backlogModalTitle').textContent.includes('(5)'), 'title carries the count');
    document.getElementById('backlogSearch').value = 'onboarding'; document.getElementById('backlogSearch').dispatchEvent(new Event('input'));
    eq(panelRows(), ['TASK-001']);
    document.getElementById('backlogSearch').value = ''; document.getElementById('backlogSearch').dispatchEvent(new Event('input'));
    proj.log.length = 0;
    clickIn('TASK-001', 'promote', 'in-progress'); await settleUi();
    eq(asked, 0, 'no ordering prompt for a promotion');
    eq(proj.log, ['kanban.md', 'backlog.md'], 'the board is written first when a task comes home');
    ok(/### TASK-001/.test(proj.files['kanban.md']) && !/### TASK-001/.test(proj.files['backlog.md']), 'moved between files');
    eq(tasks.find((t) => t.id === 'TASK-001').status, 'in-progress');
    ok(columnCards('in-progress') >= 1 && document.querySelector('.task-card[data-task-id="TASK-001"]'), 'card is on the board');
    eq(panelRows().length, 4, 'panel refreshed'); eq(stubCount(), '4');
    closeBacklogModal(); window.confirm = realConfirm;
    function columnCards(id) { return colCards(id); }
  });

  await check('backlog: dropping a card on the stub moves it into the file', async () => {
    const proj = await withBacklog(); proj.log.length = 0;
    ok(await moveTask('TASK-006', 'backlog', null), 'moved');
    eq(proj.log, ['backlog.md', 'kanban.md']);
    ok(/### TASK-006/.test(proj.files['backlog.md']) && !/### TASK-006/.test(proj.files['kanban.md']));
    eq(stubCount(), '6'); eq(document.querySelector('.task-card[data-task-id="TASK-006"]'), null, 'no card for it on the board');
  });

  await check('backlog: a task created in the backlog column goes to the file; editing one writes only the file', async () => {
    const proj = await withBacklog();
    openTaskModal(null, 'backlog');
    document.getElementById('taskTitle').value = 'Parked idea';
    document.getElementById('newTaskForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await settleUi(); await autoSave();
    ok(/### TASK-020 \| Parked idea/.test(proj.files['backlog.md']) && !/Parked idea/.test(proj.files['kanban.md']), 'created in the backlog file');
    eq(stubCount(), '6');
    proj.log.length = 0;
    openTaskModal(tasks.find((t) => t.id === 'TASK-003'));
    document.getElementById('taskTitle').value = 'Edited in the backlog';
    document.getElementById('newTaskForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await settleUi(); await autoSave();
    eq(proj.log, ['backlog.md'], 'only the backlog file was written');
    ok(/Edited in the backlog/.test(proj.files['backlog.md']));
  });

  await check('backlog: an edit on the board does not touch the backlog file', async () => {
    const proj = await withBacklog(); proj.log.length = 0;
    tasks.find((t) => t.id === 'TASK-006').title = 'Board only';
    await autoSave();
    eq(proj.log, ['kanban.md']);
  });

  await check('backlog: archive from the panel (after asking)', async () => {
    const proj = await withBacklog(); proj.log.length = 0;
    window.confirm = () => true; openBacklogModal();
    clickIn('TASK-003', 'archive'); await settleUi();
    ok(/### TASK-003/.test(proj.files['archive.md']) && !/### TASK-003/.test(proj.files['backlog.md']), 'archived out of the file');
    eq(proj.log, ['archive.md', 'backlog.md']);
    eq(panelRows().length, 4); closeBacklogModal(); window.confirm = realConfirm;
  });

  await check('backlog: an outside edit to backlog.md is picked up and shown', async () => {
    const proj = await withBacklog();
    openBacklogModal();
    H.external(proj, 'backlog.md', proj.files['backlog.md'].replace('Design the onboarding checklist', 'Retitled by an agent'));
    await pollOnce();
    eq(tasks.find((t) => t.id === 'TASK-001').title, 'Retitled by an agent');
    ok(document.getElementById('backlogList').textContent.includes('Retitled by an agent'), 'panel shows it');
    closeBacklogModal();
  });

  await check('backlog: switching it off from the menu brings every task home; on again from the menu works', async () => {
    const proj = await withBacklog();
    window.confirm = () => true;
    await toggleBacklogFile();
    ok(!/Backlog file/.test(proj.files['kanban.md']) && /### TASK-001/.test(proj.files['kanban.md']), 'tasks back in kanban.md, line removed');
    eq(colCards('backlog'), 5, 'cards are back'); eq(document.querySelector('.backlog-stub'), null);
    ok(document.getElementById('backlogToggleBtn').querySelector('.mi-label').textContent.includes('off'));
    await toggleBacklogFile();
    ok(/Backlog file\*\*: backlog\.md/.test(proj.files['kanban.md']) && /### TASK-001/.test(proj.files['backlog.md']), 'on again');
    ok(document.getElementById('backlogOpenBtn').style.display !== 'none', 'open item visible');
    window.confirm = realConfirm;
  });

  await check('backlog: past 100 tasks the bar offers to split it off; accepting does', async () => {
    const base = parseBoard(await H.fixture('demo.kanban'));
    const many = Array.from({ length: 101 }, (_, i) => ({ ...JSON.parse(JSON.stringify(base.tasks[0])), id: 'TASK-' + String(i + 1).padStart(3, '0'), status: 'backlog', created: '2026-10-20', subtasks: [], notes: '' }));
    const text = generateBoard({ config: { ...base.config, lastTaskId: 101 }, tasks: many });
    for (const k of ['hk.snooze', 'hk.dismissed']) localStorage.removeItem(`kanbanmd.${k}.fake`);
    const proj = await H.open({ 'kanban.md': text });
    ok(barVisible() && /101 tasks in the backlog \(limit 100\)/.test(bar().textContent), bar().textContent);
    ok(buttons().includes('Move backlog to its own file'), buttons().join(' | '));
    window.confirm = () => true;
    [...bar().querySelectorAll('button')].find((b) => b.textContent === 'Move backlog to its own file').click();
    await new Promise((r) => setTimeout(r, 250));
    ok(/101/.test(String((proj.files['backlog.md'].match(/^### TASK-/gm) || []).length)) , 'all 101 are in backlog.md');
    ok(!barVisible() || !/backlog \(limit/.test(bar().textContent), 'nudge is gone once it is on');
    window.confirm = realConfirm;
  });

  // ---- share ----
  const preview = () => document.getElementById('sharePreview').value;
  const shareOpen = () => document.getElementById('shareModal').classList.contains('active');
  const withClipboard = (fn) => { const had = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); const box = { text: null };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (x) => { box.text = x; } } });
    return fn(box).finally(() => { if (had) Object.defineProperty(navigator, 'clipboard', had); else delete navigator.clipboard; }); };

  await check('share: the detail view has a Share button; the dialog previews exactly what would be sent', async () => {
    await fresh();
    const task = tasks.find((t) => t.id === 'TASK-002');
    task.notes = 'Private note for the team.'; showTaskDetail(task);
    ok([...document.querySelectorAll('#taskModalActions button')].some((b) => b.textContent === 'Share'), 'button present');
    openShareDialog();
    ok(shareOpen(), 'dialog open');
    ok(preview().startsWith('Rate limiting for the public API\n'), preview().split('\n')[0]);
    ok(/Subtasks \(0\/3\):\n\[ \] Choose limits per plan/.test(preview()), 'subtasks listed');
    ok(preview().includes('Private note for the team.') && preview().includes('Assigned @bob'), 'notes and assignees by default');
    document.getElementById('shareNotes').click(); document.getElementById('shareAssignees').click();
    ok(!preview().includes('Private note') && !preview().includes('@bob'), 'toggled off, gone from the preview');
    closeShareDialog(); closeModal();
  });

  await check('share: Markdown is the board format, without the order key', async () => {
    await fresh();
    window.confirm = () => true; await toggleManualOrder(); window.confirm = realConfirm; // every task now has an Order line on disk
    const task = tasks.find((t) => t.id === 'TASK-002'); showTaskDetail(task); openShareDialog();
    setShareOption('format', 'markdown');
    ok(/^### TASK-002 \| Rate limiting for the public API\n\*\*Status\*\*: backlog  \n\*\*Priority\*\*: High  \n/.test(preview()), preview().slice(0, 120));
    ok(!preview().includes('**Order**'), 'no order key');
    closeShareDialog(); closeModal();
  });

  await check('share: Markdown shows raw by default with a rendered toggle; plain text has no toggle', async () => {
    await fresh();
    const task = tasks.find((t) => t.id === 'TASK-002'); showTaskDetail(task); openShareDialog();
    const vis = (id) => document.getElementById(id).style.display !== 'none';
    setShareOption('format', 'text'); ok(!vis('shareView') && vis('sharePreview') && !vis('shareRendered'), 'text: raw only');
    setShareOption('format', 'markdown'); ok(vis('sharePreview'), 'raw by default'); setShareOption('view', 'rendered');
    ok(vis('shareView') && vis('shareRendered') && !vis('sharePreview'), 'rendered shown');
    ok(!document.getElementById('shareRendered').textContent.includes('**Status**'), 'markup rendered');
    eq(document.getElementById('sharePreview').value, preview()); ok(preview().startsWith('### TASK-002'), 'raw value kept for Copy');
    setShareOption('view', 'raw'); ok(vis('sharePreview') && !vis('shareRendered'), 'raw shown');
    closeShareDialog(); closeModal();
  });

  await check('share: Copy puts the previewed text on the clipboard', async () => {
    await fresh();
    await withClipboard(async (box) => {
      showTaskDetail(tasks.find((t) => t.id === 'TASK-003')); openShareDialog(); setShareOption('format', 'text'); // the dialog remembers the last format
      await copyShare();
      eq(box.text, preview()); ok(box.text.startsWith('Weekly summary email'), 'the shared text');
      ok(/Copied/.test(document.getElementById('notificationText').textContent), 'confirmation shown');
    });
    closeShareDialog(); closeModal();
  });

  await check('share: the system share sheet is offered only where the browser has one, and gets the same text', async () => {
    await fresh();
    const had = Object.getOwnPropertyDescriptor(navigator, 'share');
    showTaskDetail(tasks.find((t) => t.id === 'TASK-003'));
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); openShareDialog();
    eq(document.getElementById('shareNativeBtn').style.display, 'none', 'hidden without navigator.share');
    let got = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { got = d; } }); refreshShareDialog();
    ok(document.getElementById('shareNativeBtn').style.display !== 'none', 'shown with navigator.share');
    await nativeShare();
    eq(got.title, 'Weekly summary email'); eq(got.text, preview());
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { const e = new Error('closed'); e.name = 'AbortError'; throw e; } });
    await nativeShare(); ok(!/Could not copy/.test(document.getElementById('notificationText').textContent), 'closing the sheet is not an error');
    if (had) Object.defineProperty(navigator, 'share', had); else delete navigator.share;
    closeShareDialog(); closeModal();
  });

  await check('share: Esc closes the dialog first, then the detail view; archived tasks can be shared too', async () => {
    await fresh();
    showTaskDetail(tasks[0]); openShareDialog();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ok(!shareOpen() && document.getElementById('taskModal').classList.contains('active'), 'only the dialog closed');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ok(!document.getElementById('taskModal').classList.contains('active'), 'then the detail');
    await openArchiveModal(); document.querySelector('#archiveList .archive-item').click();
    ok([...document.querySelectorAll('#taskModalActions button')].map((b) => b.textContent).join() === 'Share', 'archived view offers just Share');
    closeModal(); closeArchiveModal();
  });

  await check('folder source: a missing file reads as null, a write creates it, its version changes', async () => {
    const dir = H.makeDir({ 'kanban.md': 'x' });
    const src = folderSource(dir.handle);
    eq(await src.read('nope.md'), null, 'missing read'); eq(await src.version('nope.md'), null, 'missing version');
    const v1 = await src.version('kanban.md');
    await src.write('kanban.md', 'y'); await src.write('new.md', 'z');
    eq((await src.read('kanban.md')).text, 'y'); eq((await src.read('new.md')).text, 'z');
    ok((await src.version('kanban.md')) !== v1, 'version changed');
    ok(src.writable && src.kind === 'folder' && folderSource(dir.handle).key === 'fake', 'folder source fields');
  });

  // Any object with the source fields works: the page never reaches past `source` to a folder.
  function memorySource(files) {
    let n = 0; const ver = {};
    for (const k of Object.keys(files)) ver[k] = ++n;
    return {
      files, kind: 'memory', key: 'mem', label: 'mem', writable: true,
      async read(name) { return name in files ? { text: files[name], version: ver[name] } : null; },
      async version(name) { return name in files ? ver[name] : null; },
      async write(name, text) { files[name] = text; ver[name] = ++n; },
      external(name, text) { files[name] = text; ver[name] = ++n; },
    };
  }

  await check('data source: a source with no folder behind it loads, saves and picks up outside edits', async () => {
    const src = memorySource({ 'kanban.md': await H.fixture('demo.kanban'), 'archive.md': await H.fixture('demo.archive') });
    useSource(src); await loadKanbanFile(); H.show();
    ok(/Format: v3/.test(src.files['kanban.md']), 'migrated through the source');
    ok('kanban.v2-backup.md' in src.files, 'backup written through the source');
    eq(folderHandle(), null, 'no folder');
    tasks.find((t) => t.id === 'TASK-002').title = 'Saved through a memory source';
    await autoSave();
    ok(src.files['kanban.md'].includes('Saved through a memory source'), 'saved');
    src.external('kanban.md', src.files['kanban.md'].replace('Saved through a memory source', 'Changed outside'));
    await pollOnce();
    eq(tasks.find((t) => t.id === 'TASK-002').title, 'Changed outside', 'picked up');
  });

  await check('data source: a source with no kanban.md is started with an empty board and archive', async () => {
    const src = memorySource({});
    useSource(src); await loadKanbanFile();
    ok('kanban.md' in src.files && 'archive.md' in src.files, 'both files created');
    ok(boardLoaded(), 'loaded'); eq(tasks.length, 0);
  });

  // ---- boards from the web (?board=<url>) ----
  // fakeWeb() stands in for the network: keys are address endings, values the file text or { status, body, type },
  // or an Error to throw (what fetch does when offline or blocked by CORS). Anything else is a 404 page.
  const realFetch = window.fetch;
  function fakeWeb(files) {
    const log = [];
    window.fetch = async (url, init) => {
      log.push({ url: String(url), init });
      const key = Object.keys(files).find((k) => String(url).endsWith(k));
      const f = key && files[key];
      if (f instanceof Error) throw f;
      if (!f) return new Response('<html>Not found</html>', { status: 404, headers: { 'content-type': 'text/html' } });
      const o = typeof f === 'string' ? { body: f } : f;
      return new Response(o.body, { status: o.status || 200, headers: { 'content-type': o.type || 'text/markdown' } });
    };
    return log;
  }
  function freshStart(search = '') {
    window.fetch = realFetch; webNotice = null; useSource(null);
    history.replaceState(null, '', location.pathname + search);
    document.getElementById('welcomeScreen').style.display = 'block';
    document.getElementById('kanbanView').style.display = 'none';
    renderWelcomeScreen();
  }
  const welcomeText = () => document.getElementById('welcomeScreen').innerText;
  const shown = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';

  await check('web board: a same-origin address opens at once, read-only, with no edit controls', async () => {
    freshStart('?board=/docs/demo/kanban.md');
    await openBoardParam(boardParam());
    ok(readOnly() && source.kind === 'web', 'web source');
    ok(tasks.length > 5 && archivedTasks.length > 0, `board ${tasks.length} and archive ${archivedTasks.length} loaded`);
    ok(document.body.classList.contains('readonly'), 'body.readonly');
    ok(shown('sourceBar') && document.getElementById('sourceBar').innerText.includes('/docs/demo/kanban.md'), 'banner with the address');
    ok(shown('kanbanView') && !shown('welcomeScreen'), 'board shown');
    eq(document.querySelectorAll('.column-add-btn, .task-edit-btn').length, 0, 'no add or edit buttons');
    ok([...document.querySelectorAll('.task-card')].every((c) => !c.draggable), 'cards cannot be dragged');
    for (const id of ['newTaskBtn', 'manageColsBtn', 'orderToggleBtn', 'housekeepingBtn', 'backlogToggleBtn', 'renameProjectBtn', 'deleteProjectBtn', 'housekeepingBar']) ok(!shown(id), `${id} hidden`);
    ok(shown('archiveBtn'), 'the archive can still be viewed');
    const withSubtasks = tasks.find((x) => x.subtasks.length);
    showTaskDetail(withSubtasks);
    eq([...document.querySelectorAll('#taskModalActions button')].map((b) => b.textContent.trim()), ['Share'], 'detail offers just Share');
    ok([...document.querySelectorAll('#subtasksList input')].every((i) => i.disabled), 'subtask boxes disabled');
    eq(document.querySelectorAll('#subtasksList .del, #newSubtaskInput').length, 0, 'no subtask delete or add');
    closeModal();
    showTaskDetail(tasks.find((x) => !x.subtasks.length));
    eq(document.querySelectorAll('#subtasksList').length, 0, 'no subtasks section when there are none');
    closeModal();
    ok(document.querySelector('#sourceBar .source-badge svg'), 'banner badge has the lock icon');
    await openArchiveModal();
    eq(document.querySelectorAll('#archiveList [data-action]').length, 0, 'archive: no restore or delete');
    closeArchiveModal();
  });

  await check('web board: nothing is written, and the edit functions change nothing', async () => {
    freshStart();
    const log = fakeWeb({ '/kanban.md': await H.get('/docs/demo/kanban.md'), '/archive.md': await H.get('/docs/demo/archive.md') });
    const projectsBefore = (await loadRecentProjects()).length;
    await openBoardParam('/x/kanban.md');
    let writes = 0; source.write = async () => { writes++; };
    const before = JSON.stringify({ tasks, archivedTasks, config });
    const t0 = tasks.find((x) => x.subtasks.length);
    toggleSubtask(t0.id, 0); deleteSubtask(t0.id, 0); editCurrentTask();
    deleteTask(tasks[0].id); unarchiveTask(archivedTasks[0].id); currentDetailTask = tasks[1]; archiveCurrentTask(); deleteCurrentTask();
    openTaskModal(); ok(!document.getElementById('newTaskModal').classList.contains('active'), 'no edit form');
    openColumnsModal(); ok(!document.getElementById('columnsModal').classList.contains('active'), 'no columns dialog');
    eq(await moveTask(tasks[0].id, config.columns[1].id), false, 'move refused');
    eq(await runOrderOp({ type: 'sortTasks', mode: 'ids' }), false, 'order op refused');
    tasks[0].title = 'changed in memory'; eq(await autoSave(), false, 'save refused'); tasks[0].title = JSON.parse(before).tasks[0].title;
    eq(JSON.stringify({ tasks, archivedTasks, config }), before, 'state unchanged');
    eq(writes, 0, 'no writes'); ok(log.every((r) => !r.init || !r.init.method || r.init.method === 'GET'), 'only GET requests');
    eq((await loadRecentProjects()).length, projectsBefore, 'not added to recent projects');
    await pollOnce(); eq(log.filter((r) => r.url.endsWith('/kanban.md')).length, 1, 'each file is fetched once; no polling');
  });

  await check('web board: another site asks first, fetching nothing; Cancel forgets the address', async () => {
    freshStart('?board=https://example.com/team/kanban.md');
    const log = fakeWeb({});
    await openBoardParam(boardParam());
    eq(webNotice && webNotice.kind, 'confirm'); eq(log.length, 0, 'nothing fetched before asking');
    ok(welcomeText().includes('example.com'), 'the ask names the site');
    await cancelWebBoard();
    eq(boardParam(), null, '?board= removed'); eq(log.length, 0, 'still nothing fetched'); eq(webNotice, null);
  });

  await check('web board: "Open board" fetches without cookies or referrer and shows it read-only', async () => {
    freshStart('?board=https://example.com/team/');
    const log = fakeWeb({ '/team/kanban.md': await H.get('/docs/demo/kanban.md') }); // no archive.md: optional
    await openBoardParam(boardParam());
    await confirmWebBoard(); await settle();
    ok(readOnly(), 'opened'); eq(archivedTasks.length, 0, 'missing archive is fine');
    eq(log[0].url, 'https://example.com/team/kanban.md', 'folder address means its kanban.md');
    ok(log.every((r) => r.init.credentials === 'omit' && r.init.referrerPolicy === 'no-referrer'), 'no cookies, no referrer');
    ok(log.some((r) => r.url === 'https://example.com/team/archive.md'), 'archive looked for next to it');
  });

  await check('web board: each failure says why, and nothing opens', async () => {
    const cases = [
      ['notFound', {}],
      ['network', { '/kanban.md': new TypeError('Failed to fetch') }],
      ['http', { '/kanban.md': { status: 500, body: 'oops' } }, '500'],
      ['notBoard', { '/kanban.md': { body: '<!doctype html><html>Sign in</html>', type: 'text/html' } }],
      ['notBoard', { '/kanban.md': '# My notes\n\nNot a board.\n' }],
      ['tooLarge', { '/kanban.md': 'x'.repeat(5 * 1024 * 1024 + 1) }],
    ];
    for (const [code, files, extra] of cases) {
      freshStart(); fakeWeb(files);
      await openBoardParam('/x/kanban.md');
      eq(webNotice && webNotice.code, code, `case ${code}`);
      ok(!source && !readOnly(), `${code}: nothing open`);
      ok(welcomeText().includes(t('web.error.' + code, { status: extra || '' })), `${code}: message shown`);
    }
    freshStart(); const log = fakeWeb({});
    await openBoardParam('javascript:alert(1)');
    eq(webNotice.code, 'invalid'); eq(log.length, 0, 'invalid address: nothing fetched');
  });

  await check('web board: a github.com file page is fetched from raw.githubusercontent.com', async () => {
    freshStart();
    fakeWeb({});
    await openBoardParam('https://github.com/o/r/blob/main/board/kanban.md');
    eq(webNotice.place.href, 'https://raw.githubusercontent.com/o/r/main/board/kanban.md');
    eq(webNotice.kind, 'confirm');
  });

  await check('web board: the ask, an error and the banner follow a language switch', async () => {
    freshStart('?board=https://example.com/kanban.md');
    await openBoardParam(boardParam());
    setLanguage('fr'); ok(welcomeText().includes(t('web.confirmTitle')) && /tableau/.test(welcomeText()), 'ask in French');
    setLanguage('en');
    freshStart('?board=/docs/demo/kanban.md'); await openBoardParam(boardParam());
    setLanguage('fr'); ok(document.getElementById('sourceBar').innerText.includes('Lecture seule'), 'banner in French');
    eq(document.querySelector('#homeLink .mi-label').textContent, 'Site de Kanban.md', 'menu website link in French');
    eq(document.querySelectorAll('#taskModalActions button').length, 0, 'no edit buttons from the language refresh');
    setLanguage('en');
  });

  await check('web board: opening a folder afterwards is editable again and drops ?board=', async () => {
    freshStart('?board=/docs/demo/kanban.md');
    await openBoardParam(boardParam());
    ok(readOnly());
    await fresh();
    ok(!readOnly() && !document.body.classList.contains('readonly'), 'editable');
    ok(!shown('sourceBar'), 'banner gone'); eq(boardParam(), null, '?board= dropped');
    ok(document.querySelectorAll('.column-add-btn').length > 0 && [...document.querySelectorAll('.task-card')].every((c) => c.draggable), 'edit controls back');
  });

  await check('board text cannot inject HTML through a code block label; links open safely', async () => {
    const html = markdownToHtml('```<img src=x onerror=alert(1)>\ncode\n```\n[site](https://example.com)');
    ok(!/<img/i.test(html), 'label escaped');
    ok(/rel="noopener noreferrer"/.test(html), 'link rel');
    ok(!/href="javascript/i.test(markdownToHtml('[x](javascript:alert(1))')), 'javascript: links blocked');
  });
  window.fetch = realFetch; freshStart();

  window.confirm = realConfirm;
  return JSON.stringify({ passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), all: results.map((r) => `${r.ok ? 'ok ' : 'FAIL'} ${r.name}`) }, null, 1);
})()
