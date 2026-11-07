        // ===== Data sources =====
        // A data source is where a board's files come from. The page reads and writes them only through
        // `source`, never through a folder handle, so loading, saving and watching work the same for every
        // kind of source. Every source has:
        //   kind, key (names the board in localStorage keys), label (shown to the user), writable
        //   read(name)    -> { text, version } or null when the file does not exist
        //   version(name) -> a token that changes when the file does, or null when it does not exist
        //   write(name, text)   (writable sources only)
        // folderSource() is a project folder (read and write); webSource() is a board on the web (read-only).

        // The project folder, through the File System Access API.
        function folderSource(dirHandle) {
            const file = async (name) => {
                try { return await (await dirHandle.getFileHandle(name)).getFile(); }
                catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
            };
            return {
                kind: 'folder', key: dirHandle.name, label: dirHandle.name, writable: true, handle: dirHandle,
                async read(name) {
                    const f = await file(name);
                    return f ? { text: await f.text(), version: f.lastModified } : null;
                },
                async version(name) {
                    const f = await file(name);
                    return f ? f.lastModified : null;
                },
                async write(name, text) {
                    const writable = await (await dirHandle.getFileHandle(name, { create: true })).createWritable();
                    await writable.write(text);
                    await writable.close();
                },
            };
        }

        // A board on the web (`?board=<url>`), always read-only. `place` is resolveBoardUrl()'s result. Each file
        // is fetched once and kept: there is no reload or polling yet, so a file's version never changes.
        const WEB_MAX_BYTES = 5 * 1024 * 1024;
        function webSource(place) {
            const fetched = {};
            const get = (name) => fetched[name] || (fetched[name] = fetchBoardFile(place, name));
            return {
                kind: 'web', key: place.href, label: place.label, href: place.href, writable: false,
                async read(name) {
                    const text = await get(name);
                    return text === null ? null : { text, version: 1 };
                },
                async version(name) { return (await get(name)) === null ? null : 1; },
                async write() { throw new Error('This board is read-only'); },
            };
        }

        // The project folder, through `kanbanmd serve` (cli/serve.js): the page was served by it, so the files
        // are reached on the page's own origin with its session cookie. Works in any browser. `connected`
        // turns false when a request cannot reach the service (it was stopped) and true again when one does.
        function serviceSource(info) {
            const src = {
                kind: 'service', key: info.path || info.name, label: info.name, path: info.path || info.name, writable: true,
                async call(name, init) {
                    let res;
                    try {
                        res = await fetch(`${info.api}/file/${encodeURIComponent(name)}`, {
                            cache: 'no-store', credentials: 'same-origin',
                            ...init, headers: { 'X-Kanbanmd': '1', ...((init && init.headers) || {}) },
                        });
                    } catch (e) { setServiceState('stopped'); throw e; }
                    setServiceState(serviceStateOf(res.status));
                    return res;
                },
                async read(name) {
                    const res = await src.call(name);
                    if (res.status === 404) return null;
                    if (!res.ok) throw new Error(`kanbanmd answered ${res.status}`);
                    return { text: await res.text(), version: res.headers.get('ETag') };
                },
                async version(name) {
                    const res = await src.call(name, { method: 'HEAD' });
                    if (res.status === 404) return null;
                    if (!res.ok) throw new Error(`kanbanmd answered ${res.status}`);
                    return res.headers.get('ETag');
                },
                async write(name, text) {
                    const res = await src.call(name, { method: 'PUT', headers: { 'Content-Type': 'text/markdown; charset=utf-8' }, body: text });
                    if (!res.ok) throw new Error(`kanbanmd answered ${res.status}`);
                },
            };
            return src;
        }

        // A folder picked with <input webkitdirectory> (browsers without the File System Access API: Firefox,
        // Safari). `files` is the input's FileList. Only the folder's own .md files are kept. They are a snapshot
        // and cannot be written back, so the board is read-only; picking the folder again refreshes it.
        function pickedSource(files) {
            const kept = {};
            let folder = '';
            for (const f of files) {
                const parts = (f.webkitRelativePath || '').split('/');
                if (!folder && parts.length > 1) folder = parts[0];
                if (parts.length === 2 && /\.md$/i.test(parts[1])) kept[parts[1]] = f;
            }
            return {
                kind: 'picked', key: folder, label: folder, writable: false, files: kept,
                async read(name) {
                    const f = kept[name];
                    if (!f) return null;
                    if (f.size > WEB_MAX_BYTES) throw webError('tooLarge');
                    return { text: await f.text(), version: 1 };
                },
                async version(name) { return kept[name] ? 1 : null; },
                async write() { throw new Error('This board is read-only'); },
            };
        }

        // Why a web board could not be opened: `webCode` names the 'web.error.*' message.
        function webError(code, status) {
            const e = new Error(code);
            e.webCode = code; e.status = status;
            return e;
        }

        // kanban.md must arrive; the other files are optional, so for them any failure reads as "no file".
        // No cookies or referrer are sent.
        async function fetchBoardFile(place, name) {
            const main = name === 'kanban.md';
            const href = main ? place.href : boardFileUrl(place.href, name);
            if (!href) return null;
            try {
                let res;
                try { res = await fetch(href, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache' }); }
                catch (e) { throw webError('network'); } // offline, or the site does not let other pages read it (CORS)
                if (res.status === 404 || res.status === 410) return null;
                if (!res.ok) throw webError('http', res.status);
                if (Number(res.headers.get('content-length')) > WEB_MAX_BYTES) throw webError('tooLarge');
                const text = await res.text();
                if (text.length > WEB_MAX_BYTES) throw webError('tooLarge');
                if (/text\/html/i.test(res.headers.get('content-type') || '') && !looksLikeBoard(text)) throw webError('notBoard');
                return text;
            } catch (e) {
                if (main) throw e;
                console.warn(`Skipped ${name} from the web:`, e.message);
                return null;
            }
        }

        // Switch to another source (or none). The save base is dropped first, so nothing in flight can apply
        // the previous board's changes to the new source; loadKanbanFile() sets a new one.
        let sourceOpenedAt = 0;
        function useSource(next) {
            persistBase = null;
            source = next;
            sourceOpenedAt = Date.now(); // a read-only board is a snapshot: the status bar says when it was read
            applySourceUi();
        }

        // The board can be looked at but not changed.
        function readOnly() { return !!(source && !source.writable); }

        // The open folder's handle, or null when the board does not come from a folder.
        function folderHandle() { return source && source.kind === 'folder' ? source.handle : null; }

        // A board is open and has a saved base (what the menus and bars wait for).
        function boardLoaded() { return !!(source && persistBase); }
