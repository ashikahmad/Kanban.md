// The agent contract: the one text that tells an AI agent how to work with the board. `kanbanmd guide` prints it,
// the MCP server sends it as its instructions, the skill and the project block written by `kanbanmd init` point to
// it. Pure, no imports. Keep it short: it is paid for in context at the start of every session.
export const PACKAGE_NAME = '@ashikahmad/kanbanmd';

export const AGENT_GUIDE = `Task board (Kanban.md)

Tasks live in the board folder (board/: kanban.md, archive.md, backlog.md). Use the tools, not the files.

Tools: the Kanban MCP tools when connected (get_board, get_task, save_task, move_task, subtask, add_note, ...);
otherwise the CLI: npx -y ${PACKAGE_NAME} <command> (--help lists them).
Do not read or edit the .md files by hand: the tools cost far fewer tokens, validate every change and merge with
the human's edits in the browser. If neither the MCP tools nor the CLI can run, say so; do not edit the files.

Start of a session: get_board_stats, then get_board for in-progress tasks and tasks assigned to you.
Continue those before starting something new; their notes say where work stopped.

For each piece of work:
1. Create the task first (save_task without an id): a clear title, a short description that says what "done"
   means, links to related docs. Split big work into subtasks. Things you notice on the way become new tasks
   (first column or backlog), not extra scope.
2. Move it to in-progress when you start (Started is set for you). Tick subtasks as you go. add_note for
   decisions and, if you stop midway, for where you stopped.
3. When done: add a Result note (what was done, the files, how it was tested; link the doc for anything
   lasting), then move it to done (Finished is set for you).
4. Commit with TASK-NNN in the message and the board change in the same commit (move the task to done before
   committing). Commit only when asked. A forgotten board update can go in a follow-up commit.

Lasting knowledge (specs, decisions, how-tos) belongs in the docs, not in tasks: link the doc from the task and
the task id from the doc.

Never, unless the user asks: archive, delete, sort, reprioritize or change columns. housekeeping --apply archives.
If get_board_stats suggests housekeeping, tell the user.
When changing a task you read earlier, pass its etag as ifMatch. On a conflict the error carries the current
task: apply your change on top of it and retry.
Only the get_* tools exist (read-only server)? Do not edit files: say what you would change.
`;

// The block \`kanbanmd init\` writes into AGENTS.md, CLAUDE.md and the like (between its markers).
export const projectBlock = (pkg = PACKAGE_NAME, folder = 'board') => `## Task board (Kanban.md)
Tasks live in \`${folder === '.' ? 'the project folder' : folder + '/'}\`. Use the Kanban MCP tools (or \`npx -y ${pkg} <command>\`) and never hand-edit the files.
The rules and workflow: \`npx -y ${pkg} guide\` (MCP clients also get them from the server).
Create a task before work, move it as you go, reference TASK-NNN in commits.`;
