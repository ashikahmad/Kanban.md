import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { startServer } from '../cli/serve.js';

const board = readFileSync(new URL('./fixtures/demo.kanban.md', import.meta.url), 'utf8');
const HTML = '<html><head></head><body><script>var page=1</script></body></html>';

async function setup() {
    const dir = mkdtempSync(join(tmpdir(), 'kbserve-'));
    writeFileSync(join(dir, 'kanban.md'), board);
    writeFileSync(join(dir, 'secret.md'), 'nope');
    const svc = await startServer({ dir, html: HTML, port: 0 });
    const base = `http://127.0.0.1:${svc.port}`;
    // sign in the way the browser does: follow the printed URL, keep the cookie
    const r = await fetch(svc.url, { redirect: 'manual' });
    const cookie = r.headers.get('set-cookie').split(';')[0];
    return { dir, svc, base, cookie, r };
}

test('the printed URL signs in, sets a strict HttpOnly cookie and redirects without the key', async () => {
    const { svc, r, cookie, base } = await setup();
    try {
        assert.equal(r.status, 302);
        assert.equal(r.headers.get('location'), '/');
        assert.match(r.headers.get('set-cookie'), /HttpOnly/);
        assert.match(r.headers.get('set-cookie'), /SameSite=Strict/);
        const page = await fetch(base + '/', { headers: { cookie } });
        const html = await page.text();
        assert.equal(page.status, 200);
        assert.match(html, /window\.KANBANMD_SERVICE=\{"api":"\/api","name":"[^"\/]+\/kbserve-[^"]+","path":"[^"]+kbserve-/, 'two-part name and the full path');
        assert.ok(html.indexOf('KANBANMD_SERVICE') < html.indexOf('var page=1'), 'config is injected before the page script');
    } finally { await svc.close(); }
});

test('without the cookie or with a wrong key nothing is served', async () => {
    const { svc, base } = await setup();
    try {
        assert.equal((await fetch(base + '/')).status, 401);
        assert.equal((await fetch(base + '/?t=wrong')).status, 401);
        assert.equal((await fetch(base + '/api/file/kanban.md')).status, 401);
        assert.equal((await fetch(base + '/api/file/kanban.md', { headers: { cookie: 'kanbanmd_1=forged' } })).status, 401);
    } finally { await svc.close(); }
});

test('reads, versions and writes the board; ETag changes with the content', async () => {
    const { svc, base, cookie, dir } = await setup();
    const h = { cookie, 'x-kanbanmd': '1' };
    try {
        const get = await fetch(base + '/api/file/kanban.md', { headers: h });
        assert.equal(await get.text(), board);
        const e1 = get.headers.get('etag');
        assert.equal((await fetch(base + '/api/file/kanban.md', { method: 'HEAD', headers: h })).headers.get('etag'), e1);
        assert.equal((await fetch(base + '/api/file/archive.md', { headers: h })).status, 404);

        const put = await fetch(base + '/api/file/kanban.md', { method: 'PUT', headers: h, body: board + '\n<!-- x -->\n' });
        assert.equal(put.status, 200);
        assert.notEqual(put.headers.get('etag'), e1);
        assert.equal(readFileSync(join(dir, 'kanban.md'), 'utf8'), board + '\n<!-- x -->\n');
        assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith('.tmp')), [], 'no temp file left behind');

        const created = await fetch(base + '/api/file/archive.md', { method: 'PUT', headers: h, body: '# A\n' });
        assert.equal(created.status, 200);
        assert.ok(existsSync(join(dir, 'archive.md')));
    } finally { await svc.close(); }
});

test('If-Match refuses a write over a changed file', async () => {
    const { svc, base, cookie, dir } = await setup();
    const h = { cookie, 'x-kanbanmd': '1' };
    try {
        const e = (await fetch(base + '/api/file/kanban.md', { headers: h })).headers.get('etag');
        writeFileSync(join(dir, 'kanban.md'), board + 'changed elsewhere, longer\n');
        const stale = await fetch(base + '/api/file/kanban.md', { method: 'PUT', headers: { ...h, 'if-match': e }, body: 'x' });
        assert.equal(stale.status, 412);
        assert.equal(readFileSync(join(dir, 'kanban.md'), 'utf8'), board + 'changed elsewhere, longer\n');
    } finally { await svc.close(); }
});

test('only the board files are reachable', async () => {
    const { svc, base, cookie } = await setup();
    const h = { cookie, 'x-kanbanmd': '1' };
    try {
        for (const n of ['secret.md', '..%2Fpackage.json', '%2e%2e%2fkanban.md', '.kanban.lock', 'kanban.md%00', 'x.txt']) {
            assert.equal((await fetch(`${base}/api/file/${n}`, { headers: h })).status, 404, n);
        }
        assert.equal((await fetch(`${base}/api/file/secret.md`, { method: 'PUT', headers: h, body: 'x' })).status, 404);
        assert.equal((await fetch(`${base}/api/file/kanban.v1-backup.md`, { method: 'PUT', headers: h, body: 'x' })).status, 200);
    } finally { await svc.close(); }
});

test('a write needs the custom header, and the body size is capped', async () => {
    const { svc, base, cookie } = await setup();
    try {
        assert.equal((await fetch(base + '/api/file/kanban.md', { method: 'PUT', headers: { cookie }, body: 'x' })).status, 403);
        const big = await fetch(base + '/api/file/kanban.md', { method: 'PUT', headers: { cookie, 'x-kanbanmd': '1' }, body: 'x'.repeat(5 * 1024 * 1024 + 1) });
        assert.equal(big.status, 413);
    } finally { await svc.close(); }
});

test('a foreign Host (DNS rebinding) or Origin is refused', async () => {
    const { svc, cookie } = await setup();
    const raw = (headers) => new Promise((ok, fail) => {
        http.get({ host: '127.0.0.1', port: svc.port, path: '/api/file/kanban.md', headers: { cookie, ...headers } }, (res) => { res.resume(); ok(res.statusCode); }).on('error', fail);
    });
    try {
        assert.equal(await raw({ host: 'evil.example:' + svc.port }), 403);
        assert.equal(await raw({ origin: 'https://evil.example' }), 403);
        assert.equal(await raw({ origin: `http://127.0.0.1:${svc.port}` }), 200);
        assert.equal(await raw({ host: 'localhost:' + svc.port }), 200);
    } finally { await svc.close(); }
});

test('a busy port falls through to the next free one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kbserve-'));
    const a = await startServer({ dir, html: HTML, port: 0 });
    try {
        const b = await startServer({ dir, html: HTML, port: a.port });
        assert.ok(b.port > a.port);
        await b.close();
    } finally { await a.close(); }
});
