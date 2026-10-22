# Development

## Build and test

The app is built from `src/` into one self-contained file, `kanbanmd.html`.

```bash
npm install          # once: build tools only, the output has no dependencies
npm run build        # minified kanbanmd.html
npm run build:dev    # readable kanbanmd.html while you work
npm test             # unit, property and end-to-end tests
npm run mcp:install  # installs the MCP SDK (enables the MCP server and its tests)
npm run measure      # token cost of reads and writes, raw file vs tools
```

Edit the sources in `src/` and rebuild. Do not edit `kanbanmd.html` directly: it is generated.

## How the code is laid out

| Folder | What it holds |
|---|---|
| `core/` | The pure board logic: parse, generate, validated minimal-patch operations, reads, migration, housekeeping, the backlog file, sharing. No I/O. |
| `io/` | The Node file layer: atomic writes and locking. |
| `cli/` | The `kanbanmd` command. |
| `mcp/` | The MCP server and its tool definitions. |
| `src/` | The page: `index.html`, `scripts/`, `styles/`. The build bundles `core/` into it with esbuild, so the page, the CLI and the MCP server always agree on the format. |
| `test/` | Tests and fixtures. `test/tools/page-harness.js` and `page-checks.js` check the page in a browser against a fake in-memory folder (see the header of each file). |
| `docs/` | These guides, the screenshots in `images/`, and the demo board in `demo/`. |
| `drafts/` | Design records: decisions, measurements and a log of how the CLI and MCP work was built. |
| `board/` | This project's own public board. See below. |

Useful starting points in `src/`:

- `styles/00-variables.css` holds the design tokens: spacing, radius, type scale and the light and dark colour ladders. Change a colour or a size there.
- Surfaces are layered `--c-page` < `--c-column` < `--c-card` < `--c-pop`, so a new component only has to pick the right level.
- `scripts/13-toolbar.js` has the menus and popovers, `scripts/06-filters.js` the filter logic, `scripts/04a-persist.js` how the page saves and watches the files, and `scripts/02-i18n.js` the translations.

## How we run this project

The project's own work is tracked on a Kanban.md board, in [`board/`](../board/kanban.md): what is done, what is in progress, what is planned, and ideas we are considering. You can read it right on GitHub, [view it read-only in the hosted app](https://ashikahmad.github.io/Kanban.md/app/?board=../board/kanban.md), or open the `board/` folder in the app.

- **Issues and the board have different jobs.** Use GitHub issues to report bugs and request things. The board is where maintainers record direction; a good idea from an issue can be promoted into it.
- **Look for `#good-first-issue` and `#need-help`** tags if you want to contribute.
- **Board edits are ordinary commits.** They can go in the same pull request as the work they describe.

## Contributing

1. Check existing issues, or open one: for a bug, include steps to reproduce, browser and version, and a screenshot if useful; for a feature, describe the use before building it.
2. Fork the repository and create a branch (`git checkout -b feature/my-feature`).
3. Change the sources in `src/` (or `core/`, `cli/`, `mcp/`) and add tests where you can. Run `npm test`.
4. Rebuild with `npm run build`, and try the app in Chrome or Edge.
5. Commit, push, and open a pull request.

Guidelines: readable, commented code; keep it fast with 1,000+ tasks; follow ARIA practices; update the docs when behaviour changes.

## Related reading

- [About this fork](about-this-fork.md): where the project comes from and how it differs from the original.
- `drafts/mcp-file-plan.md`: the design record for the shared core, the CLI and the MCP server, including known limits and deliberate non-goals.
