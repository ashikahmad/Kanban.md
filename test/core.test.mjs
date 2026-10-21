// Golden tests for core/board.js.  Run: npm test
// test/golden/* was captured from the legacy page code (test/tools/capture-golden.mjs), so these
// tests pin the extracted core to the exact behaviour the page had before the extraction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseBoard, parseArchive, generateBoard, generateArchive,
  createDefaultBoardContent, createDefaultArchiveContent, normalizeConfig,
} from '../core/board.js';

const pairs = JSON.parse(readFileSync(new URL('./pairs.json', import.meta.url), 'utf8'));
const read = (dir, name) => readFileSync(new URL(`./${dir}/${name}`, import.meta.url), 'utf8');
const readJson = (dir, name) => JSON.parse(read(dir, name));
// The golden files come from the legacy code, which predates the optional `order` key; an unset
// key (null) is the only difference, so drop it before comparing.
const viaJson = (v) => {
  const j = JSON.parse(JSON.stringify(v));
  delete j.formatVersion; // added after the golden files were captured
  if (j.config && j.config.housekeeping === null) delete j.config.housekeeping; // ditto (optional policy line)
  if (j.config && j.config.backlogFile === null) delete j.config.backlogFile;
  for (const t of j.tasks || []) if (t.order === null) delete t.order;
  return j;
};

// The capture oracle stubbed t() as `[key]`, so the golden archive headings use these.
const archiveStrings = { title: '[markdown.archiveTitle]', desc: '[markdown.archiveDesc]', section: '[markdown.archiveSection]' };

for (const name of pairs.boards) {
  test(`board ${name}: parse matches golden`, () => {
    assert.deepEqual(viaJson(parseBoard(read('fixtures', `${name}.kanban.md`))), readJson('golden', `${name}.board.json`));
  });
  test(`board ${name}: generate is byte-identical to golden`, () => {
    assert.equal(generateBoard(parseBoard(read('fixtures', `${name}.kanban.md`))), read('golden', `${name}.board.out.md`));
  });
  test(`board ${name}: generate(parse(generate(parse(x)))) is a fixed point`, () => {
    const once = generateBoard(parseBoard(read('fixtures', `${name}.kanban.md`)));
    const twice = generateBoard(parseBoard(once));
    assert.equal(twice, once);
  });
}

for (const [archive, board] of Object.entries(pairs.archives)) {
  const columns = () => parseBoard(read('fixtures', `${board}.kanban.md`)).config.columns;
  test(`archive ${archive}: parse matches golden`, () => {
    assert.deepEqual(viaJson(parseArchive(read('fixtures', `${archive}.archive.md`), columns())), readJson('golden', `${archive}.archive.json`));
  });
  test(`archive ${archive}: generate is byte-identical to golden`, () => {
    const { tasks } = parseArchive(read('fixtures', `${archive}.archive.md`), columns());
    assert.equal(generateArchive(tasks, archiveStrings), read('golden', `${archive}.archive.out.md`));
  });
}

test('default board content matches the legacy default', () => {
  assert.equal(createDefaultBoardContent(), read('golden', 'default.kanban.md'));
});

test('default board content parses to a valid, empty v2 board', () => {
  const { config, tasks, formatV2 } = parseBoard(createDefaultBoardContent());
  assert.equal(formatV2, true);
  assert.equal(tasks.length, 0);
  assert.deepEqual(config.columns.map(c => c.id), ['todo', 'in-progress', 'in-review', 'done']);
});

test('default archive content is the three heading lines', () => {
  assert.equal(createDefaultArchiveContent(archiveStrings), `${archiveStrings.title}\n\n${archiveStrings.desc}\n\n${archiveStrings.section}\n\n`);
});

test('normalizeConfig does not mutate its input', () => {
  const input = { categories: ['a', 'a'], users: [], priorities: [], tags: [], columns: [] };
  const snapshot = viaJson(input);
  const out = normalizeConfig(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(out.categories, ['a']);
  assert.equal(out.users[0], '@user (User)');
});

test('legacy (V1) files are detected as not-V2', () => {
  assert.equal(parseBoard(read('fixtures', 'examples-v1.kanban.md')).formatV2, false);
  assert.equal(parseBoard(read('fixtures', 'examples-v2.kanban.md')).formatV2, true);
});
