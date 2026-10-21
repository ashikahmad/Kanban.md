// Regenerates test/golden/* from the LEGACY page scripts (the pre-extraction code), run in a
// Node vm with the globals they expect. The golden files are the oracle that core/board.js must
// reproduce byte for byte.   usage: node test/tools/capture-golden.mjs [git-ref]   (default c4f0046)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const ref = process.argv[2] || 'c4f0046';
const legacy = (f) => execFileSync('git', ['show', `${ref}:src/scripts/${f}`], { encoding: 'utf8' });
const pairs = JSON.parse(readFileSync('test/pairs.json', 'utf8'));
const read = (n) => readFileSync(`test/fixtures/${n}.md`, 'utf8');

// saveArchive lives in 10-archive.js next to DOM wiring, so lift just that function.
const archiveSrc = legacy('10-archive.js');
const saveArchiveSrc = archiveSrc.slice(
  archiveSrc.indexOf('async function saveArchive'),
  archiveSrc.indexOf('function archiveCurrentTask'));

function makeOracle() {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {} }, t: (k) => `[${k}]` });
  vm.runInContext(legacy('01-state.js'), ctx);
  vm.runInContext(legacy('04-io.js'), ctx);
  vm.runInContext(legacy('11-generate.js'), ctx);
  vm.runInContext(saveArchiveSrc, ctx);
  vm.runInContext('var __out = null; archiveFileHandle = { createWritable: async () => ({ write: async (s) => { __out = s; }, close: async () => {} }) };', ctx);
  return ctx;
}
const json = (v) => JSON.stringify(v, null, 2) + '\n';

for (const name of pairs.boards) {
  const o = makeOracle();
  o.__in = read(`${name}.kanban`);
  vm.runInContext('parseMarkdown(__in)', o);
  const parsed = JSON.parse(vm.runInContext('JSON.stringify({ config, tasks, formatV2: loadedFormatV2 })', o));
  const out = vm.runInContext('generateMarkdown()', o);
  writeFileSync(`test/golden/${name}.board.json`, json(parsed));
  writeFileSync(`test/golden/${name}.board.out.md`, out);
}

for (const [archive, board] of Object.entries(pairs.archives)) {
  const o = makeOracle();
  o.__board = read(`${board}.kanban`);
  o.__in = read(`${archive}.archive`);
  vm.runInContext('parseMarkdown(__board)', o); // sets the config the archive parse validates against
  vm.runInContext("loadedArchiveV2 = /<!--\\s*Format:\\s*v2\\s*-->/i.test(__in); archivedTasks = parseTaskBlocks(__in, 'archived', true);", o);
  const parsed = JSON.parse(vm.runInContext('JSON.stringify({ tasks: archivedTasks, formatV2: loadedArchiveV2 })', o));
  vm.runInContext('__out = null', o);
  await vm.runInContext('saveArchive()', o);
  writeFileSync(`test/golden/${archive}.archive.json`, json(parsed));
  writeFileSync(`test/golden/${archive}.archive.out.md`, o.__out);
}

// Default new-board content (pure in the legacy code).
const o = makeOracle();
writeFileSync('test/golden/default.kanban.md', vm.runInContext('createDefaultKanbanContent()', o));
console.log(`golden captured from ${ref}`);
