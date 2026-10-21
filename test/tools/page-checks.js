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
  async function fresh() {
    const files = { 'kanban.md': await H.fixture('demo.kanban'), 'archive.md': await H.fixture('demo.archive') };
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

  window.confirm = realConfirm;
  return JSON.stringify({ passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), all: results.map((r) => `${r.ok ? 'ok ' : 'FAIL'} ${r.name}`) }, null, 1);
})()
