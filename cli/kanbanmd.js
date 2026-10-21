#!/usr/bin/env node
// kanbanmd: command line front end for the board core. Every command prints one JSON document.
//   kanbanmd [--dir DIR] [--dry-run] [--actor NAME] <command> [args]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getBoard, getTask, getConfig, listArchive, getStats, summarizeChanges } from '../core/read.js';
import { etagOf } from '../core/text.js';
import { getHousekeeping, archiveCandidates } from '../core/housekeeping.js';
import { parseHousekeepingSpec } from '../core/housekeeping-spec.js';
import { BoardError } from '../core/text.js';
import { TASK_FIELDS } from '../core/ops.js';
import { readWorkspace, readActivity, mutate, migrateProject } from '../io/node-fs.js';

const BOOL = new Set(['dry-run', 'at-end', 'overdue', 'reverse', 'apply', 'enable', 'disable']);
function parseArgs(argv) {
    const flags = {}, pos = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const k = a.slice(2);
            if (BOOL.has(k)) flags[k] = true;
            else flags[k] = argv[++i];
        } else pos.push(a);
    }
    return { flags, pos };
}

const HELP = `kanbanmd [--dir DIR] [--dry-run] [--actor NAME] <command>

  housekeeping [--apply] [--set SPEC|off|reset]   what to archive or review; --apply archives the finished ones in one edit;
                      --set "done=done after=30d | backlog=backlog after=90d | max=200" edits the policy
  migrate                                          rewrite kanban.md / archive.md in the current format (backups kept)
  board [filters]     compact task list in display order.  (alias: list)
  task <id> [--fields a,b]   one task in full, with its etag.  (alias: show)
  config              valid columns, priorities, categories, users, tags
  archived [filters] [--reverse]   archived tasks (to archive one: archive <id>)
  backlog [filters]                tasks in the backlog file;  backlog --enable [--column ID] [--file NAME.md]  /  --disable
                                   moves the backlog column's tasks into (or back out of) their own file
  stats               counts by status / assignee / priority, overdue and due soon
  changes [--since ISO]   edits made through the tools (the page's edits are not logged)
    filters: --status a,b --assignee @x --tag t --priority P --category C --text "words"
             --due-before YYYY-MM-DD --overdue --limit N --offset N --fields title,status,progress   (replaces the default columns; id is always kept)
  apply <json | ->                                 apply one op as JSON
  create --title T [--status ID] [--priority P] [--category C] [--assignees a,b] [--tags x,y]
         [--due YYYY-MM-DD] [--description D]
  update <id> --<field> <value> ...                fields: ${TASK_FIELDS.join(', ')}
  move <id> <status> [--before ID | --at-end]       in place by default; a position relocates the block
  sort --mode blocks|ids|positions|clear [--order asc|desc] [--scope board|archive|both]   (mode is required)
       blocks: reorder file blocks by id.  ids / positions: write Order keys from id order / current order.
       clear: remove all Order keys.
  toggle <id> <index|text>        subtask <id> <text>        note <id> <text>
  archive <id>   restore <id>   delete <id>
  config <categories|users|priorities|tags> a,b,c
  columns <json>                                   [{"name","id"}], optional "reassign" via apply`;

function summary(t) {
    return { id: t.id, title: t.title, status: t.status, ...(t.order != null && { order: t.order }), priority: t.priority, assignees: t.assignees, due: t.due, tags: t.tags };
}

async function main() {
    const { flags, pos } = parseArgs(process.argv.slice(2));
    const dir = resolve(flags.dir || process.env.KANBANMD_DIR || '.');
    const [cmd, ...a] = pos;
    const opt = { dryRun: !!flags['dry-run'], actor: flags.actor || 'cli' };
    const need = (n, what) => { if (a.length < n) throw new BoardError('usage', `Missing ${what}`, { hint: 'Run kanbanmd --help' }); };

    if (!cmd || cmd === 'help' || flags.help !== undefined) { console.log(HELP); return; }

    if (cmd === 'backlog' && (flags.enable || flags.disable)) {
        const op = flags.disable ? { type: 'setBacklogFile', enabled: false } : { type: 'setBacklogFile', enabled: true, column: flags.column, file: flags.file };
        console.log(JSON.stringify({ ok: true, ...(await mutate(dir, op, opt)) }));
        return;
    }

    if (cmd === 'housekeeping') {
        if (flags.set !== undefined) {
            const spec = String(flags.set).trim();
            const h = parseHousekeepingSpec(spec) || {};
            const op = spec === 'reset' ? { type: 'setHousekeeping', reset: true }
                : spec.toLowerCase() === 'off' ? { type: 'setHousekeeping', off: true }
                : { type: 'setHousekeeping', done: h.done, backlog: h.backlog, max: h.max };
            console.log(JSON.stringify({ ok: true, ...(await mutate(dir, op, opt)) }));
            return;
        }
        const ws = await readWorkspace(dir);
        if (flags.apply) {
            const ids = archiveCandidates(ws);
            if (!ids.length) { console.log(JSON.stringify({ ok: true, archived: 0, note: 'nothing to archive' })); return; }
            console.log(JSON.stringify({ ok: true, archived: ids.length, ...(await mutate(dir, { type: 'archiveTasks', ids }, opt)) }));
            return;
        }
        console.log(JSON.stringify({ ok: true, ...getHousekeeping(ws) }));
        return;
    }

    if (cmd === 'migrate') {
        console.log(JSON.stringify({ ok: true, ...(await migrateProject(dir, { dryRun: opt.dryRun, actor: opt.actor })) }));
        return;
    }

    const READS = ['board', 'list', 'task', 'show', 'config', 'archived', 'backlog', 'stats', 'changes'];
    if (READS.includes(cmd)) {
        const ws = await readWorkspace(dir);
        const q = { status: flags.status, assignee: flags.assignee, tag: flags.tag, priority: flags.priority, category: flags.category,
            text: flags.text, dueBefore: flags['due-before'], overdue: flags.overdue, limit: flags.limit, offset: flags.offset,
            fields: flags.fields, reverse: flags.reverse };
        let out;
        if (cmd === 'board' || cmd === 'list') out = getBoard(ws, q);
        else if (cmd === 'task' || cmd === 'show') { need(1, 'task id'); out = { task: getTask(ws, a[0], q) }; }
        else if (cmd === 'config') out = getConfig(ws);
        else if (cmd === 'archived') out = listArchive(ws, q);
        else if (cmd === 'backlog') out = getBoard(ws, { ...q, backlog: true });
        else if (cmd === 'stats') out = getStats(ws);
        else out = summarizeChanges(await readActivity(dir), { since: flags.since, rev: etagOf(ws.board) });
        console.log(JSON.stringify({ ok: true, ...out }));
        return;
    }

    let op;
    if (cmd === 'apply') {
        need(1, 'a JSON op, or "-" for stdin');
        op = JSON.parse(a[0] === '-' ? readFileSync(0, 'utf8') : a[0]);
    } else if (cmd === 'create') {
        const task = {};
        for (const f of TASK_FIELDS) if (flags[f] !== undefined) task[f] = flags[f];
        if (task.subtasks) task.subtasks = JSON.parse(task.subtasks);
        op = { type: 'createTask', task };
    } else if (cmd === 'update') {
        need(1, 'task id');
        const set = {};
        for (const f of TASK_FIELDS) if (flags[f] !== undefined) set[f] = f === 'subtasks' ? JSON.parse(flags[f]) : flags[f];
        op = { type: 'updateTask', id: a[0], set, ifMatch: flags['if-match'] };
    } else if (cmd === 'move') {
        need(2, 'task id and status');
        op = { type: 'moveTask', id: a[0], status: a[1], before: flags.before, atEnd: flags['at-end'], ifMatch: flags['if-match'] };
    } else if (cmd === 'sort') {
        op = { type: 'sortTasks', mode: flags.mode, scope: flags.scope, order: flags.order };
    } else if (cmd === 'toggle') {
        need(2, 'task id and subtask index or text');
        op = /^\d+$/.test(a[1]) ? { type: 'toggleSubtask', id: a[0], index: +a[1] } : { type: 'toggleSubtask', id: a[0], text: a[1] };
    } else if (cmd === 'subtask') { need(2, 'task id and text'); op = { type: 'addSubtask', id: a[0], text: a.slice(1).join(' ') }; }
    else if (cmd === 'note') { need(2, 'task id and text'); op = { type: 'appendNote', id: a[0], text: a.slice(1).join(' ') }; }
    else if (cmd === 'archive') { need(1, 'task id'); op = { type: 'archiveTask', id: a[0] }; }
    else if (cmd === 'restore') { need(1, 'task id'); op = { type: 'restoreTask', id: a[0] }; }
    else if (cmd === 'delete') { need(1, 'task id'); op = { type: 'deleteTask', id: a[0] }; }
    else if (cmd === 'config') { need(2, 'list name and comma separated values'); op = { type: 'setConfigList', name: a[0], values: a[1].split(',') }; }
    else if (cmd === 'columns') { need(1, 'a JSON array of { name, id }'); op = { type: 'setColumns', columns: JSON.parse(a[0]) }; }
    else throw new BoardError('usage', `Unknown command "${cmd}"`, { hint: 'Run kanbanmd --help' });

    const out = await mutate(dir, op, opt);
    console.log(JSON.stringify({ ok: true, ...out }));
}

main().catch((e) => {
    const err = e instanceof BoardError ? e.toJSON() : { code: 'internal', message: e.message };
    console.log(JSON.stringify({ ok: false, error: err }));
    process.exitCode = 1;
});
