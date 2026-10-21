// Rendering a task for sharing outside the board: plain text for people (chat, mail), and a trimmed
// Markdown block (the file format itself) that a board can import. Pure. What is included is the
// sender's choice: notes and assignees can be left out.
import { generateTaskBlock } from './board.js';

const lf = (s) => String(s).replace(/\r\n/g, '\n');

// Readable anywhere: no Markdown syntax needed to make sense of it.
export function taskToPlainText(task, columns = [], { notes = true, assignees = true } = {}) {
    const column = columns.find((c) => c.id === task.status);
    const meta = [
        task.priority,
        task.category,
        column ? column.name : task.status,
        task.due && `Due ${task.due}`,
        assignees && task.assignees.length && `Assigned ${task.assignees.join(', ')}`,
    ].filter(Boolean).join(' · ');
    const out = [task.title];
    if (meta) out.push(meta);
    if (task.tags.length) out.push(task.tags.join(' '));
    if (task.description) out.push('', lf(task.description));
    if (task.subtasks.length) {
        const done = task.subtasks.filter((s) => s.completed).length;
        out.push('', `Subtasks (${done}/${task.subtasks.length}):`, ...task.subtasks.map((s) => `${s.completed ? '[x]' : '[ ]'} ${s.text}`));
    }
    if (notes && task.notes) out.push('', 'Notes:', lf(task.notes));
    return out.join('\n') + '\n';
}

// The task as a board block (format v3), with the board-specific parts dropped: no manual order key.
export function taskToMarkdown(task, { notes = true, assignees = true } = {}) {
    return lf(generateTaskBlock({
        ...task,
        assignees: assignees ? task.assignees : [],
        notes: notes ? task.notes : '',
        extra: notes ? task.extra : '',
        order: null,
    })).trimEnd() + '\n';
}
