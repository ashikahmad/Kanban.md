// Opening a board from a web address (the page's `?board=<url>`): which URL to fetch, whether it is on the
// page's own site, where the board's other files are, and whether a fetched text is a board at all. Pure:
// the fetching is the page's web source.

// `param` is the ?board= value, `pageHref` the page's own address (relative values resolve against it).
// Returns { href, origin, sameOrigin, label } or null when it is not an http(s) address.
// - A github.com "blob" link (the page that shows a file) becomes the raw file on raw.githubusercontent.com.
// - A folder address (ending in "/") means the kanban.md in it.
export function resolveBoardUrl(param, pageHref) {
    const text = String(param ?? '').trim();
    if (!text) return null;
    let url;
    try { url = new URL(text, pageHref); } catch (e) { return null; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const blob = url.hostname === 'github.com' && /^\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(url.pathname);
    if (blob) url = new URL(`https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`);
    if (url.pathname.endsWith('/')) url.pathname += 'kanban.md';
    url.hash = '';
    let pageOrigin = null;
    try { pageOrigin = new URL(pageHref).origin; } catch (e) { /* no page address: never same-origin */ }
    return { href: url.href, origin: url.origin, sameOrigin: url.origin === pageOrigin, label: url.host + url.pathname };
}

// The address of another file of the board (archive.md, the backlog file), next to kanban.md. Only plain
// file names are allowed, so a board cannot point the page at another folder or site. null = not allowed.
export function boardFileUrl(boardHref, name) {
    if (!/^\w[\w.-]*\.md$/.test(String(name)) || name.includes('..')) return null;
    return new URL(name, boardHref).href;
}

// Whether a fetched text is a Kanban.md board (and not, say, an HTML page or some other Markdown file).
export function looksLikeBoard(text) {
    const s = String(text ?? '');
    return /<!-- Config: Last Task ID: \d+ -->/.test(s) || /^\*\*Columns\*\*:/m.test(s) || /^###\s+TASK-\d+\s*\|/m.test(s);
}
