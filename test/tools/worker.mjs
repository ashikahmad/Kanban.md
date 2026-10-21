// Test helper: one concurrent writer. usage: node worker.mjs <dir> <name> <creates>
// Creates tasks and edits different existing tasks, retrying when the board is busy.
import { mutate } from '../../io/node-fs.js';
import { readWorkspace } from '../../io/node-fs.js';
import { parseBoard } from '../../core/board.js';

const [dir, name, n] = process.argv.slice(2);
let created = 0, busy = 0;
for (let i = 0; i < Number(n); i++) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await mutate(dir, { type: 'createTask', task: { title: `${name} #${i}`, tags: [name] } }, { actor: name });
      created++;
      break;
    } catch (e) {
      if (e.code === 'busy') { busy++; continue; }
      throw e;
    }
  }
  // also touch an existing task, a different one per worker so only the file-level race matters
  const { board } = await readWorkspace(dir);
  const tasks = parseBoard(board).tasks.filter((t) => !t.title.includes('#'));
  const target = tasks[(name.charCodeAt(0) + i) % tasks.length];
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await mutate(dir, { type: 'appendNote', id: target.id, text: `${name} note ${i}` }, { actor: name }); break; }
    catch (e) { if (e.code === 'busy') { busy++; continue; } throw e; }
  }
}
console.log(JSON.stringify({ created, busy }));
