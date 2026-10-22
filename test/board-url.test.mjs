// Opening a board from a web address: which URL is fetched, the board's other files, and what counts as a board.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBoardUrl, boardFileUrl, looksLikeBoard } from '../core/board-url.js';
import { createDefaultBoardContent } from '../core/board.js';

const PAGE = 'https://ashikahmad.github.io/Kanban.md/app/?board=../board/kanban.md';

test('a relative address resolves against the page and is same-origin', () => {
  assert.deepEqual(resolveBoardUrl('../board/kanban.md', PAGE), {
    href: 'https://ashikahmad.github.io/Kanban.md/board/kanban.md',
    origin: 'https://ashikahmad.github.io',
    sameOrigin: true,
    label: 'ashikahmad.github.io/Kanban.md/board/kanban.md',
  });
});

test('another site is not same-origin', () => {
  const r = resolveBoardUrl('https://raw.githubusercontent.com/o/r/main/kanban.md', PAGE);
  assert.equal(r.sameOrigin, false);
  assert.equal(r.origin, 'https://raw.githubusercontent.com');
});

test('a github.com blob link becomes the raw file', () => {
  const r = resolveBoardUrl('https://github.com/ashikahmad/Kanban.md/blob/master/board/kanban.md', PAGE);
  assert.equal(r.href, 'https://raw.githubusercontent.com/ashikahmad/Kanban.md/master/board/kanban.md');
  assert.equal(r.sameOrigin, false);
});

test('a folder address means its kanban.md; the fragment is dropped', () => {
  assert.equal(resolveBoardUrl('../demo/', PAGE).href, 'https://ashikahmad.github.io/Kanban.md/demo/kanban.md');
  assert.equal(resolveBoardUrl('https://example.com', PAGE).href, 'https://example.com/kanban.md');
  assert.equal(resolveBoardUrl('../board/kanban.md#x', PAGE).href, 'https://ashikahmad.github.io/Kanban.md/board/kanban.md');
});

test('only http(s) addresses are accepted', () => {
  for (const bad of ['', '   ', null, undefined, 'javascript:alert(1)', 'data:text/plain,x', 'file:///etc/kanban.md', 'http://[bad']) {
    assert.equal(resolveBoardUrl(bad, PAGE), null, String(bad));
  }
  // A page opened from disk: relative addresses resolve to file:, which is refused.
  assert.equal(resolveBoardUrl('board/kanban.md', 'file:///home/me/kanbanmd.html'), null);
  assert.equal(resolveBoardUrl('https://example.com/kanban.md', 'file:///home/me/kanbanmd.html').sameOrigin, false);
});

test('the board\'s other files sit next to kanban.md, and only plain file names are allowed', () => {
  const board = 'https://example.com/team/board/kanban.md';
  assert.equal(boardFileUrl(board, 'archive.md'), 'https://example.com/team/board/archive.md');
  assert.equal(boardFileUrl(board, 'backlog.md'), 'https://example.com/team/board/backlog.md');
  for (const bad of ['../secret.md', '/etc/x.md', 'https://evil.example/x.md', '//evil.example/x.md', 'sub/x.md', '.hidden.md', 'x.txt', '']) {
    assert.equal(boardFileUrl(board, bad), null, bad);
  }
});

test('a board is recognised; an HTML page or other Markdown is not', () => {
  assert.ok(looksLikeBoard(createDefaultBoardContent()));
  assert.ok(looksLikeBoard('# Board\n\n### TASK-001 | A task\n**Status**: todo\n'));
  assert.ok(!looksLikeBoard('<!doctype html><html><body>Not found</body></html>'));
  assert.ok(!looksLikeBoard('# README\n\nSome **Columns**: text in a sentence.\n'));
  assert.ok(!looksLikeBoard(''));
});
