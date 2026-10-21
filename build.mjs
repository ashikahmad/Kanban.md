// Build: concatenate src/ partials into a single self-contained kanbanmd.html.
// No runtime dependencies are produced — the output is one standalone HTML file.
//   npm run build       -> minified kanbanmd.html
//   npm run build:dev   -> readable (unminified) kanbanmd.html
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { minify } from 'html-minifier-terser';
import { buildSync } from 'esbuild';

const dev = process.argv.includes('--dev');

// Concatenate every file of a given extension in a directory, sorted by name
// (file names are numbered, e.g. 00-...,01-..., to control order).
function concatDir(dir, ext) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => `/* ===== ${f} ===== */\n${readFileSync(join(dir, f), 'utf8').trim()}`)
    .join('\n\n');
}

const css = concatDir('src/styles', '.css');
// The core (core/*.js) is ES modules so Node (CLI, MCP server, tests) imports it directly. For the
// page it is bundled into one namespace (esbuild, dev dependency only; the output stays a single
// dependency-free HTML file), and only the names listed here are bound as page globals: the page
// already owns names such as dueStatus, so binding everything would collide.
const PAGE_CORE_EXPORTS = [
  'parseBoard', 'parseArchive', 'generateBoard', 'generateArchive', 'generateTaskBlock', 'normalizeConfig',
  'createDefaultBoardContent', 'createDefaultArchiveContent', 'orderedTasks',
  'diffToOps', 'applyOps', 'deepEqual',
];
// Reachable as KanbanCore.<name> (for the test harness) but not bound as globals.
const NAMESPACE_ONLY = ['diffStats'];
const coreModule = await import('./core/index.js');
for (const name of PAGE_CORE_EXPORTS) {
  if (!(name in coreModule)) throw new Error(`build: core does not export "${name}"`);
}
// The entry is generated from the list above, so only what the page binds (and what that needs) is
// bundled: the read-side queries, for instance, never reach the page.
const bundled = buildSync({
  stdin: { contents: `export { ${[...PAGE_CORE_EXPORTS, ...NAMESPACE_ONLY].join(', ')} } from './core/index.js';`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, format: 'iife', globalName: 'KanbanCore', target: 'es2020', write: false, legalComments: 'none',
}).outputFiles[0].text;
const core = `/* ===== core (bundled) ===== */\n${bundled.trim()}\nconst { ${PAGE_CORE_EXPORTS.join(', ')} } = KanbanCore;`;
const js = `${core}\n\n${concatDir('src/scripts', '.js')}`;

// Function replacers so $ / ${...} inside css/js are inserted literally.
let html = readFileSync('src/index.html', 'utf8')
  .replace('/* build:css */', () => css)
  .replace('/* build:js */', () => js);

if (!dev) {
  html = await minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: false,
    removeComments: true,
    minifyCSS: true,
    // Classic script (not a module): keep top-level names so inline on* handlers
    // and cross-file global calls keep working.
    minifyJS: {
      compress: true,
      mangle: { toplevel: false },
      format: { comments: false },
    },
  });
}

writeFileSync('kanbanmd.html', html);
console.log(`Built kanbanmd.html (${dev ? 'dev/readable' : 'minified'}) — ${(html.length / 1024).toFixed(1)} KB`);
