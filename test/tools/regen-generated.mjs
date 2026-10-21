// Rewrites the *generated-output* goldens (test/golden/*.out.md, default.kanban.md) from core/board.js.
// Run this only when the output format is changed ON PURPOSE, then review `git diff test/golden`.
// (The parse goldens, *.json, come from the legacy code and must not change; see capture-golden.mjs.)
import { readFileSync, writeFileSync } from 'node:fs';
import { parseBoard, parseArchive, generateBoard, generateArchive, createDefaultBoardContent } from '../../core/board.js';

const pairs = JSON.parse(readFileSync('test/pairs.json', 'utf8'));
const read = (n) => readFileSync(`test/fixtures/${n}.md`, 'utf8');
const strings = { title: '[markdown.archiveTitle]', desc: '[markdown.archiveDesc]', section: '[markdown.archiveSection]' };
for (const name of pairs.boards) writeFileSync(`test/golden/${name}.board.out.md`, generateBoard(parseBoard(read(`${name}.kanban`))));
for (const [archive, board] of Object.entries(pairs.archives)) {
  const { tasks } = parseArchive(read(`${archive}.archive`), parseBoard(read(`${board}.kanban`)).config.columns);
  writeFileSync(`test/golden/${archive}.archive.out.md`, generateArchive(tasks, strings));
}
writeFileSync('test/golden/default.kanban.md', createDefaultBoardContent());
console.log('generated goldens rewritten');
