        // ===== Data sources =====
        // A data source is where a board's files come from. The page reads and writes them only through
        // `source`, never through a folder handle, so loading, saving and watching work the same for every
        // kind of source. Every source has:
        //   kind, key (names the board in localStorage keys), label (shown to the user), writable
        //   read(name)    -> { text, version } or null when the file does not exist
        //   version(name) -> a token that changes when the file does, or null when it does not exist
        //   write(name, text)   (writable sources only)

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

        // Switch to another source (or none). The save base is dropped first, so nothing in flight can apply
        // the previous board's changes to the new source; loadKanbanFile() sets a new one.
        function useSource(next) {
            persistBase = null;
            source = next;
        }

        // The open folder's handle, or null when the board does not come from a folder.
        function folderHandle() { return source && source.kind === 'folder' ? source.handle : null; }

        // A board is open and has a saved base (what the menus and bars wait for).
        function boardLoaded() { return !!(source && persistBase); }
