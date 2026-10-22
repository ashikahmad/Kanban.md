// Build the GitHub Pages site into site/ (run `npm run build` first; it needs kanbanmd.html).
//   npm run build:site  -> site/ (landing page, the app, the project board, the demo board, screenshots)
// Serve it with `python3 -m http.server` inside site/. Every link is relative, so the site works at any base path.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';

const REPO = 'https://github.com/ashikahmad/Kanban.md';
const OUT = 'site';

if (!existsSync('kanbanmd.html')) throw new Error('build:site: kanbanmd.html is missing; run `npm run build` first');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/app`, { recursive: true });

writeFileSync(`${OUT}/index.html`, readFileSync('site-src/index.html', 'utf8').replaceAll('@REPO@', REPO));
cpSync('kanbanmd.html', `${OUT}/app/index.html`);
for (const f of ['kanban.md', 'archive.md']) {
  cpSync(`board/${f}`, `${OUT}/board/${f}`);
  cpSync(`docs/demo/${f}`, `${OUT}/demo/${f}`);
}
cpSync('docs/images/app-overview-dark.jpg', `${OUT}/images/app-overview-dark.jpg`);
writeFileSync(`${OUT}/.nojekyll`, '');
console.log(`Built ${OUT}/ (landing page, app, board, demo)`);
