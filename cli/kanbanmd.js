#!/usr/bin/env node
// kanbanmd: command line front end for the board core. Every command prints one JSON document.
//   kanbanmd [--dir DIR] [--dry-run] [--actor NAME] <command> [args]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseBoard, parseArchive } from '../core/board.js';
import { BoardError } from '../core/text.js';
import { TASK_FIELDS } from '../core/ops.js';
import { readWorkspace, mutate } from '../io/node-fs.js';

const BOOL = new Set(['dry-run', 'before-null']);
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

  list [--status ID] [--assignee @x] [--tag t]     summaries of board tasks
  show <id>                                        one task in full
  apply <json | ->                                 apply one op as JSON
  create --title T [--status ID] [--priority P] [--category C] [--assignees a,b] [--tags x,y]
         [--due YYYY-MM-DD] [--description D]
  update <id> --<field> <value> ...                fields: ${TASK_FIELDS.join(', ')}
  move <id> <status> [--before ID]
  toggle <id> <index|text>        subtask <id> <text>        note <id> <text>
  archive <id>   restore <id>   delete <id>
  config <categories|users|priorities|tags> a,b,c
  columns <json>                                   [{"name","id"}], optional "reassign" via apply`;

function summary(t) {
    return { id: t.id, title: t.title, status: t.status, priority: t.priority, assignees: t.assignees, due: t.due, tags: t.tags };
}

async function main() {
    const { flags, pos } = parseArgs(process.argv.slice(2));
    const dir = resolve(flags.dir || process.env.KANBANMD_DIR || '.');
    const [cmd, ...a] = pos;
    const opt = { dryRun: !!flags['dry-run'], actor: flags.actor || 'cli' };
    const need = (n, what) => { if (a.length < n) throw new BoardError('usage', `Missing ${what}`, { hint: 'Run kanbanmd --help' }); };

    if (!cmd || cmd === 'help' || flags.help !== undefined) { console.log(HELP); return; }

    if (cmd === 'list' || cmd === 'show') {
        const ws = await readWorkspace(dir);
        const b = parseBoard(ws.board);
        if (cmd === 'list') {
            const rows = b.tasks.filter((t) => (!flags.status || t.status === flags.status) && (!flags.assignee || t.assignees.some((x) => x.startsWith(flags.assignee))) && (!flags.tag || t.tags.includes('#' + flags.tag.replace(/^#/, ''))));
            console.log(JSON.stringify({ ok: true, columns: b.config.columns, tasks: rows.map(summary) }));
        } else {
            need(1, 'task id');
            const all = [...b.tasks.map((t) => ({ ...t, archived: false })), ...(ws.archive ? parseArchive(ws.archive, b.config.columns).tasks.map((t) => ({ ...t, archived: true })) : [])];
            const t = all.find((x) => x.id === a[0]);
            if (!t) throw new BoardError('unknown_task', `No task ${a[0]}`);
            console.log(JSON.stringify({ ok: true, task: t }));
        }
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
        op = { type: 'moveTask', id: a[0], status: a[1], before: flags.before, ifMatch: flags['if-match'] };
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
