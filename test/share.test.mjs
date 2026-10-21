// Sharing a task outside the board: readable text, and a Markdown block that a board can read back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { taskToPlainText, taskToMarkdown } from '../core/share.js';
import { parseBoard } from '../core/board.js';

const COLS = [{ id: 'todo', name: '📝 To Do' }, { id: 'doing', name: '🚀 In Progress' }];
const task = (o = {}) => ({
  id: 'TASK-014', title: 'Rate limiting for the API', status: 'doing', order: 3000, priority: 'High', category: 'Backend',
  assignees: ['@bob', '@alice'], tags: ['#api', '#security'], created: '2026-10-03', started: '', due: '2026-11-01', completed: '',
  description: 'Protect the endpoints.\nStart with per-key limits.', subtasks: [{ completed: true, text: 'Choose limits' }, { completed: false, text: 'Add middleware' }],
  notes: 'Waiting on infra.\nSee the dashboard.', extra: '', ...o,
});

test('plain text: a readable summary with the column name, subtasks and notes', () => {
  const t = taskToPlainText(task(), COLS);
  assert.equal(t, [
    'Rate limiting for the API',
    'High · Backend · 🚀 In Progress · Due 2026-11-01 · Assigned @bob, @alice',
    '#api #security',
    '',
    'Protect the endpoints.',
    'Start with per-key limits.',
    '',
    'Subtasks (1/2):',
    '[x] Choose limits',
    '[ ] Add middleware',
    '',
    'Notes:',
    'Waiting on infra.',
    'See the dashboard.',
    '',
  ].join('\n'));
});

test('what the sender leaves out is really left out', () => {
  const text = taskToPlainText(task(), COLS, { notes: false, assignees: false });
  assert.ok(!text.includes('Notes') && !text.includes('infra') && !text.includes('@bob') && !text.includes('Assigned'));
  const md = taskToMarkdown(task({ extra: '**Links**:\n- https://private.example' }), { notes: false, assignees: false });
  assert.ok(!md.includes('Waiting on infra') && !md.includes('@bob') && !md.includes('private.example') && !md.includes('Assigned'));
});

test('empty parts are omitted; an unknown column falls back to its id', () => {
  const bare = taskToPlainText(task({ priority: '', category: '', assignees: [], tags: [], due: '', description: '', subtasks: [], notes: '', status: 'gone' }), COLS);
  assert.equal(bare, 'Rate limiting for the API\ngone\n');
});

test('markdown is the board format, without the board-specific order key, and reads back', () => {
  const md = taskToMarkdown(task());
  assert.ok(!md.includes('**Order**'));
  assert.match(md, /^### TASK-014 \| Rate limiting for the API\n\*\*Status\*\*: doing\n\*\*Priority\*\*: High\n/);
  // (the status is a column id, so it only means something on a board that has that column: import must map it)
  const board = `# B\n\n<!-- Format: v3 -->\n\n## ⚙️ Configuration\n\n**Columns**: To Do (todo) | In Progress (doing)\n\n---\n\n## Tasks\n\n${md}`;
  const back = parseBoard(board).tasks[0];
  const expected = task({ order: null });
  assert.deepEqual(back, expected);
});

test('line endings are normalized so a CRLF board shares cleanly', () => {
  const t = task({ description: 'a\r\nb', notes: 'n1\r\nn2' });
  assert.ok(!taskToPlainText(t, COLS).includes('\r'));
  assert.ok(!taskToMarkdown(t).includes('\r'));
});
