# Docs Site Rebuild

<!-- Config: Last Task ID: 007 -->
<!-- Format: v3 -->

## ⚙️ Configuration

**Columns**: 📋 To Do (todo) | 🚀 In Progress (in-progress) | 👀 In Review (review) | ✅ Done (done)

**Categories**: Content, Tooling, Design

**Users**: @ana (Ana Ruiz), @claude (Claude, AI agent)

**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

**Tags**: #docs #build #a11y #needs-human

---

## Tasks

### TASK-001 | Add search to the docs site
**Status**: in-progress  
**Priority**: High  
**Category**: Tooling  
**Assigned**: @claude  
**Created**: 2026-11-05  
**Started**: 2026-11-06  
**Tags**: #build  

Client-side search over all pages. Done means: an index is built at deploy time, results show title and snippet, and the page works without JavaScript for browsing.
Spec: docs/decisions/search.md

**Subtasks**:
- [x] Choose an index format (see decision doc)
- [x] Build the index in the deploy script
- [ ] Search box and results list
- [ ] Keyboard navigation

**Notes**:
2026-11-06: stopped after the index step. The deploy script is in tools/build-docs.mjs; the next step is the results list in src/search.js. Tests pass at this point.

### TASK-002 | Fix the contrast problems in the dark theme
**Status**: review  
**Priority**: Medium  
**Category**: Design  
**Assigned**: @claude  
**Created**: 2026-11-04  
**Started**: 2026-11-04  
**Tags**: #a11y  

Links and code blocks fall below 4.5:1 in dark mode.

**Subtasks**:
- [x] List the failing pairs
- [x] Adjust the tokens
- [x] Re-run the contrast check

**Notes**:
**Result**:
Three tokens changed in styles/tokens.css. All pairs now pass 4.5:1. Checked with tools/contrast.mjs. Needs a human look at the code block colours.

### TASK-003 | Rewrite the API overview page
**Status**: todo  
**Priority**: Medium  
**Category**: Content  
**Assigned**: @ana  
**Created**: 2026-11-05  
**Due**: 2026-11-14  
**Tags**: #docs  

The page still describes v1. Interview notes are in the shared folder.

### TASK-004 | Decide the licence for the code samples
**Status**: todo  
**Priority**: Low  
**Category**: Content  
**Created**: 2026-11-06  
**Tags**: #needs-human  

Legal question: an agent should not decide this. Ask Ana.

### TASK-005 | Redirect the old URLs
**Status**: todo  
**Priority**: High  
**Category**: Tooling  
**Assigned**: @claude  
**Created**: 2026-11-06  
**Tags**: #build  
**Blocked by**: TASK-001  

The route list is generated, so wait for the search work to land.

### TASK-006 | Fix broken internal links
**Status**: done  
**Priority**: High  
**Category**: Tooling  
**Assigned**: @claude  
**Created**: 2026-11-02  
**Started**: 2026-11-02  
**Finished**: 2026-11-03  
**Tags**: #docs #build  

The link checker reported 41 broken links after the restructure.

**Notes**:
**Result**:
38 links fixed, 3 removed because the pages are gone. Added tools/check-links.mjs to the deploy. Commit: "Fix internal links after restructure (TASK-006)", which also moved this task to done.

