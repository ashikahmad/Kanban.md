// Browser-side harness for checking the page against a fake in-memory project folder.
// Load it inside the page served from the repo root (e.g. python3 -m http.server):
//   (0, eval)(await (await fetch('/test/tools/page-harness.js')).text())
// then use window.H. The fake folder implements just the File System Access methods the page uses
// (getFileHandle / getFile / createWritable) with modification times, so polling and write order
// can be observed, and `H.external()` plays another writer (an agent, the CLI).
window.H = (() => {
  const get = async (p) => (await fetch(p)).text();
  let clock = 1000;
  function makeDir(files) {
    const mtime = {}, log = [];
    for (const n of Object.keys(files)) mtime[n] = clock++;
    const handle = {
      name: 'fake',
      getFileHandle: async (name, opts) => {
        if (!(name in files)) {
          if (opts && opts.create) { files[name] = ''; mtime[name] = clock++; }
          else { const e = new Error('not found'); e.name = 'NotFoundError'; throw e; }
        }
        return {
          getFile: async () => ({ size: files[name].length, lastModified: mtime[name], text: async () => files[name] }),
          createWritable: async () => { let buf = ''; return { write: async (s) => { buf += s; }, close: async () => { files[name] = buf; mtime[name] = clock++; log.push(name); } }; },
        };
      },
    };
    return { handle, mtime, log };
  }
  const show = () => {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('kanbanView').style.display = 'block';
    document.getElementById('filterBar').style.display = 'block';
  };
  return {
    get, makeDir, show,
    // Open a project the way the page does after the user picks a folder.
    async open(files) {
      const dir = makeDir(files);
      directoryHandle = dir.handle; kanbanFileHandle = null; archiveFileHandle = null;
      await loadKanbanFile();
      show();
      return { files, ...dir };
    },
    // Another writer changes a file behind the page's back.
    external(proj, name, text) { proj.files[name] = text; proj.mtime[name] = clock++; },
    async fixture(name) { return get(`/test/fixtures/${name}.md`); },
  };
})();
