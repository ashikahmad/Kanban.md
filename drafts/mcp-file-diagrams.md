# Diagrams: shared core, surgical edits, MCP

Companion to [mcp-file-plan.md](mcp-file-plan.md). Each diagram is a fenced `mermaid` block, so any Markdown viewer with Mermaid support renders it.

## Architecture

Who touches the board, the thin adapters, the shared core and the files. Referenced from section 4 of the plan.

```mermaid
flowchart TB
    subgraph clients["Who touches the board"]
        human["Human<br/>kanbanmd.html"]
        agent["AI agent<br/>Claude Code, Desktop, ..."]
        shell["Scripts, CI, git hooks"]
    end

    subgraph adapters["Thin adapters"]
        page["Page adapter<br/>diffs UI state into ops<br/>File System Access API"]
        mcp["MCP server<br/>stdio, tools and resources"]
        cli["CLI: kanbanmd"]
    end

    subgraph core["core/ : pure, no DOM, no I/O"]
        read["read<br/>parse with source spans"]
        validate["validate<br/>against board config"]
        ops["ops<br/>createTask, moveTask, setFields,<br/>toggleSubtask, appendNote,<br/>archive, restore, setConfig"]
        patch["patch<br/>ops to minimal text edits"]
        verify["verify<br/>re-parse patched text,<br/>must equal expected state"]
        read --> validate --> ops --> patch --> verify
    end

    subgraph io["I/O ports"]
        fsio["Node fs port<br/>atomic temp + rename, CAS on hash"]
        fsa["FS Access port<br/>createWritable"]
    end

    files[("kanban.md<br/>archive.md<br/>in git")]
    log[(".kanban-activity.jsonl")]

    human --> page
    agent --> mcp
    shell --> cli
    page --> core
    mcp --> core
    cli --> core
    page --> fsa
    mcp --> fsio
    cli --> fsio
    fsa --> files
    fsio --> files
    fsio --> log
    files -. "page polls lastModified" .-> page
```

## Write protocol

One agent write end to end, including the conflict and retry paths, and the page picking up the change. Referenced from section 6.

```mermaid
sequenceDiagram
    autonumber
    participant A as Agent (MCP or CLI)
    participant C as core
    participant F as kanban.md
    participant P as Page

    A->>C: move_task(TASK-014, done, ifMatch=etag)
    C->>F: read latest bytes, hash H1
    C->>C: parse, locate TASK-014, check etag
    alt etag differs
        C-->>A: conflict (current etag, current task)
    else etag matches
        C->>C: validate, build patch (1 line)
        C->>C: verify (re-parse, untouched bytes equal)
        C->>F: re-read hash, must still equal H1
        alt file changed meanwhile
            C->>C: retry from step 2, bounded
        else unchanged
            C->>F: write temp file, fsync, rename over target
            C-->>A: ok, id, rev, changed fields
        end
    end
    Note over P,F: Page polls lastModified (~2 s, only while visible)
    P->>F: sees change, re-parse and re-render
    P->>P: if that card is open in the form, offer reload or keep mine
```

## Phase order

Dependencies between the build phases. Referenced from section 10.

```mermaid
flowchart LR
    p1["1. Core extraction<br/>no behavior change"] --> p2["2. Surgical patch layer<br/>+ verify, via CLI first"]
    p2 --> p3["3. Read tools<br/>CLI and MCP, measure tokens"]
    p2 --> p4["4. Page on the core<br/>diff to ops, polling, conflict prompt"]
    p3 --> p5["5. Write tools<br/>CLI and MCP, dry_run, activity log"]
    p4 --> p5
    p5 --> p6["6. Docs, skill, activity UI"]
```
