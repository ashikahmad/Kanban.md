// Where a project's board lives. A project keeps it in `board/` (kanban.md, archive.md, backlog.md together, away
// from everything else); older projects keep kanban.md in the project folder or in `docs/`. Tools, `serve` and the
// CLI all find it the same way, so none of them needs a --dir in the usual case.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const BOARD_FOLDER = 'board';
const CANDIDATES = [BOARD_FOLDER, '.', 'docs'];

// The first of board/, ., docs/ under `base` that holds a kanban.md; null when none does.
export function findBoardDir(base) {
    for (const rel of CANDIDATES) if (existsSync(join(base, rel, 'kanban.md'))) return resolve(base, rel);
    return null;
}

// --dir / KANBANMD_DIR when given (the folder itself when it holds kanban.md, else looked through like a project
// folder), otherwise the working directory looked through. With no board anywhere it falls back to the folder asked
// for, so the error names a place the user chose.
export function resolveBoardDir(explicit, cwd = process.cwd()) {
    if (explicit) {
        const dir = resolve(cwd, explicit);
        return existsSync(join(dir, 'kanban.md')) ? dir : findBoardDir(dir) || dir;
    }
    return findBoardDir(cwd) || resolve(cwd);
}
