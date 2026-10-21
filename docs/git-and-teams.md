# Git and teams

Kanban.md has no server, so sharing a board means sharing its files. Git is the natural way to do that.

## Share the board with your team

Commit `kanban.md` and `archive.md` with the rest of the project. Each person opens the same folder in the app.

```bash
git pull                              # get everyone's updates
# work in the app
git add kanban.md archive.md
git commit -m "Update tasks"
git push
```

Because the app writes minimal patches, a normal day's edits are small, line-level diffs that git merges cleanly. Moving a card changes one line.

### Resolving conflicts

The format is simple Markdown, so conflicts are usually easy to resolve by hand. If you would rather take one side:

```bash
git checkout --theirs kanban.md    # take the remote version
git checkout --ours kanban.md      # keep the local version
```

Then reopen the folder in the app (or wait a couple of seconds for it to notice the change).

## Tie tasks to branches and commits

Task IDs make commits searchable:

```bash
git checkout -b feature/TASK-042-notifications
git commit -m "feat: add WebSocket server (TASK-042 - 1/5)"
git commit -m "feat: add notification API (TASK-042 - 2/5)"
git checkout main && git merge feature/TASK-042-notifications
# move TASK-042 to Done, archive it when you are ready
```

`git log --grep TASK-042` then shows the whole story of a task.

## Ways teams use it

**Software development.** Plan sprints, track bugs (`#bug` plus a priority), and use a Review column with a checklist in the subtasks. Record technical decisions in the task notes before archiving.

**Product and project work.** One task per feature, deadlines on the cards, filter by person. Search the archive for retrospectives.

**Personal use.** A to-do list with subtasks, side projects with notes, or a journal where each task is an entry and the archive is the full log.

**Working with AI agents.** Everyone, human or agent, sees the same files. See [Working with AI agents](ai-agents.md).

## What it is not

Kanban.md is not a hosted service. There are no accounts, permissions, live co-editing or notifications. People who need to see the board at the same moment share it through git (or a synced folder). If you need that kind of service, a hosted tracker is the better fit.
