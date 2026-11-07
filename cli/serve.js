// kanbanmd serve: a local HTTP service that serves the page (kanbanmd.html) and a tiny file API for one
// project folder, so any browser (Firefox, Safari, Chrome) can edit the real files. Zero dependencies.
//
// Access: the server listens on 127.0.0.1 only. `/?t=<token>` (the URL it prints) sets an HttpOnly,
// SameSite=Strict session cookie and redirects to `/`. Every request must carry the right Host, a matching
// Origin when the browser sends one, and (for the API) the session cookie; writes also need the X-Kanbanmd
// header, which no other site can add without a CORS preflight that this server never approves.
// Only kanban.md, archive.md, the board's backlog file and the v1 backup files can be read or written.
import http from 'node:http';
import { promises as fs } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { join, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { backlogFileNameOf } from '../core/backlog-spec.js';

export const DEFAULT_PORT = 4777;
const MAX_BODY = 5 * 1024 * 1024;

function sameToken(a, b) {
    const x = Buffer.from(String(a)), y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
}

function cookieOf(req, name) {
    for (const part of String(req.headers.cookie || '').split(';')) {
        const i = part.indexOf('=');
        if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
    }
    return null;
}

const etagOf = (st) => `"${Math.round(st.mtimeMs)}-${st.size}"`;

// Start the service. `html` is the page's text. Resolves to { url, port, token, close }.
// `port: 0` picks a free port; a busy named port falls through to the next ones.
export async function startServer({ dir, html, port = DEFAULT_PORT, token = randomBytes(24).toString('base64url') }) {
    const sessions = new Set();
    // The label the page shows: the last two parts of the path ("Kanban.md/board"), since a folder name alone
    // (board, docs) says little. The full path is its tooltip.
    const name = dir.split(sep).filter(Boolean).slice(-2).join('/') || dir;
    let boundPort = 0;
    const cookieName = () => `kanbanmd_${boundPort}`;
    const page = () => {
        const inject = `<script>window.KANBANMD_SERVICE=${JSON.stringify({ api: '/api', name, path: dir }).replace(/</g, '\\u003c')};</script>`;
        const i = html.indexOf('<script');
        return i < 0 ? html + inject : html.slice(0, i) + inject + html.slice(i);
    };

    const send = (res, status, body, headers = {}) => {
        res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'text/plain; charset=utf-8', ...headers });
        res.end(body);
    };

    // Which file names the API accepts.
    async function allowedName(n) {
        if (n === 'kanban.md' || n === 'archive.md') return true;
        if (/^(kanban|archive)\.v\d+-backup\.md$/.test(n)) return true;
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/.test(n)) return false;
        try { return n === backlogFileNameOf(await fs.readFile(join(dir, 'kanban.md'), 'utf8')); }
        catch { return false; }
    }

    async function readBody(req) {
        const chunks = []; let size = 0;
        for await (const c of req) {
            size += c.length;
            if (size > MAX_BODY) { const e = new Error('too large'); e.status = 413; throw e; }
            chunks.push(c);
        }
        return Buffer.concat(chunks).toString('utf8');
    }

    async function api(req, res, url) {
        const m = /^\/api\/file\/([^/]+)$/.exec(url.pathname);
        if (!m) return send(res, 404, 'Not found');
        let n;
        try { n = decodeURIComponent(m[1]); } catch { return send(res, 400, 'Bad name'); }
        if (!(await allowedName(n))) return send(res, 404, 'Not found');
        const path = join(dir, n);
        if (req.method === 'GET' || req.method === 'HEAD') {
            let st;
            try { st = await fs.stat(path); } catch { return send(res, 404, 'Not found'); }
            const headers = { ETag: etagOf(st), 'Content-Type': 'text/markdown; charset=utf-8' };
            if (req.method === 'HEAD') return send(res, 200, '', headers);
            return send(res, 200, await fs.readFile(path), headers);
        }
        if (req.method === 'PUT') {
            const text = await readBody(req);
            const want = req.headers['if-match'];
            if (want) {
                let cur = null;
                try { cur = etagOf(await fs.stat(path)); } catch { /* no file */ }
                if (cur !== want) return send(res, 412, 'The file changed');
            }
            const tmp = join(dir, `.${n}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
            try { await fs.writeFile(tmp, text); await fs.rename(tmp, path); }
            catch (e) { await fs.rm(tmp, { force: true }); throw e; }
            return send(res, 200, '', { ETag: etagOf(await fs.stat(path)) });
        }
        return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD, PUT' });
    }

    const server = http.createServer(async (req, res) => {
        try {
            // Host and Origin: refuse anything that is not this server addressed as itself.
            const host = String(req.headers.host || '').toLowerCase();
            const hosts = [`127.0.0.1:${boundPort}`, `localhost:${boundPort}`];
            if (!hosts.includes(host)) return send(res, 403, 'Wrong host');
            const origin = req.headers.origin;
            if (origin && !hosts.some((h) => origin === `http://${h}`)) return send(res, 403, 'Wrong origin');

            const url = new URL(req.url, `http://${host}`);
            const sid = cookieOf(req, cookieName());
            const authed = !!sid && sessions.has(sid);

            if (url.pathname === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
                const t = url.searchParams.get('t');
                if (t !== null) {
                    if (!sameToken(t, token)) return send(res, 401, 'This link is not valid. Use the address printed by kanbanmd serve.');
                    const id = randomBytes(24).toString('base64url');
                    sessions.add(id);
                    return send(res, 302, '', { Location: '/', 'Set-Cookie': `${cookieName()}=${id}; HttpOnly; SameSite=Strict; Path=/` });
                }
                if (!authed) return send(res, 401, 'Open the address that kanbanmd serve printed in the terminal (it carries the access key).');
                return send(res, 200, req.method === 'HEAD' ? '' : page(), { 'Content-Type': 'text/html; charset=utf-8' });
            }
            if (url.pathname.startsWith('/api/')) {
                if (!authed) return send(res, 401, 'Not signed in');
                if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-kanbanmd'] !== '1') return send(res, 403, 'Missing header');
                return await api(req, res, url);
            }
            return send(res, 404, 'Not found');
        } catch (e) {
            send(res, e.status || 500, e.status ? e.message : 'Server error');
        }
    });

    const tries = port === 0 ? 1 : 20;
    for (let i = 0; i < tries; i++) {
        const p = port === 0 ? 0 : port + i;
        try {
            await new Promise((ok, fail) => { server.once('error', fail); server.listen(p, '127.0.0.1', () => { server.off('error', fail); ok(); }); });
            break;
        } catch (e) {
            if (e.code !== 'EADDRINUSE' || i === tries - 1) throw e;
        }
    }
    boundPort = server.address().port;
    return {
        port: boundPort, token, sessions,
        url: `http://127.0.0.1:${boundPort}/?t=${token}`,
        close: () => new Promise((ok) => { server.close(ok); server.closeAllConnections?.(); }),
    };
}

// Open a URL in the default browser (best effort).
export function openBrowser(url) {
    const [cmd, args] = process.platform === 'darwin' ? ['open', [url]]
        : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
    try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* the URL is printed anyway */ }
}
