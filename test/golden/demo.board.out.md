# Orbit Product Board

<!-- Config: Last Task ID: 19 -->
<!-- Format: v2 -->

## ⚙️ Configuration

**Columns**: Backlog (backlog) | In Progress (in-progress) | In Review (review) | Done (done)

**Categories**: Frontend, Backend, Design, DevOps, Docs

**Users**: @alice (Alice Martin), @bob (Bob Ito), @chen (Chen Wei), @dana (Dana Okafor)

**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

**Tags**: #bug #feature #ui #api #perf #security #docs

---

## Tasks

### TASK-001 | Design the onboarding checklist
**Status**: backlog
**Priority**: Medium | **Category**: Design | **Assigned**: @dana
**Created**: 2026-10-02
**Tags**: #ui #feature

Short checklist that guides new workspaces through their first three actions.

**Subtasks**:
- [ ] Sketch three variants
- [ ] Review with the team
- [ ] Hand off to frontend

### TASK-002 | Rate limiting for the public API
**Status**: backlog
**Priority**: High | **Category**: Backend | **Assigned**: @bob
**Created**: 2026-10-03
**Tags**: #api #security

Protect the public endpoints from bursts. Start with per-key limits and a clear 429 response.

**Subtasks**:
- [ ] Choose limits per plan
- [ ] Add middleware
- [ ] Document the headers

### TASK-003 | Weekly summary email
**Status**: backlog
**Priority**: Low | **Category**: Backend | **Assigned**: @alice
**Created**: 2026-10-05
**Tags**: #feature

A digest of what changed in each workspace over the last seven days.

### TASK-004 | Keyboard shortcuts cheat sheet
**Status**: backlog
**Priority**: Low | **Category**: Frontend
**Created**: 2026-10-06
**Tags**: #ui #docs

Press ? to see the available shortcuts.

### TASK-005 | Dark mode for the settings pages
**Status**: backlog
**Priority**: Medium | **Category**: Frontend | **Assigned**: @chen
**Created**: 2026-10-07
**Tags**: #ui

Settings still use hard-coded colours. Move them to the shared tokens.

**Subtasks**:
- [ ] Audit hard-coded colours
- [ ] Replace with tokens

### TASK-006 | Move image uploads to a CDN
**Status**: in-progress
**Priority**: High | **Category**: DevOps | **Assigned**: @bob, @chen
**Created**: 2026-09-28 | **Started**: 2026-10-08 | **Due**: 2026-10-22
**Tags**: #perf

Serve user uploads from the CDN to cut load times in Europe and Asia.

**Subtasks**:
- [x] Create the bucket and policy
- [x] Add signed upload URLs
- [ ] Migrate existing files
- [ ] Switch the app to CDN URLs

**Notes**:
Migration runs in batches of 500 files. Keep the old URLs working for 30 days.

### TASK-007 | Fix flicker when switching workspaces
**Status**: in-progress
**Priority**: Critical | **Category**: Frontend | **Assigned**: @alice
**Created**: 2026-10-09 | **Started**: 2026-10-12 | **Due**: 2026-10-15
**Tags**: #bug #ui

The sidebar redraws twice on every workspace switch. Most visible on slow devices.

**Subtasks**:
- [x] Reproduce on a throttled device
- [ ] Cache the workspace list
- [ ] Add a regression test

### TASK-008 | Search across projects
**Status**: in-progress
**Priority**: High | **Category**: Backend | **Assigned**: @chen
**Created**: 2026-09-30 | **Started**: 2026-10-10
**Tags**: #feature #api

One search box that looks through tasks, files and comments in every project you can access.

**Subtasks**:
- [x] Index tasks
- [x] Index comments
- [ ] Index files
- [ ] Ranking and typo tolerance

### TASK-009 | Redesign the empty states
**Status**: review
**Priority**: Medium | **Category**: Design | **Assigned**: @dana
**Created**: 2026-10-01 | **Started**: 2026-10-06
**Tags**: #ui

Friendlier empty states with a single clear action.

**Subtasks**:
- [x] Dashboard
- [x] Projects
- [x] Notifications
- [ ] Final copy review

### TASK-010 | Add two-factor authentication
**Status**: review
**Priority**: Critical | **Category**: Backend | **Assigned**: @bob, @alice
**Created**: 2026-09-20 | **Started**: 2026-10-01 | **Due**: 2026-10-23
**Tags**: #security #feature

Authenticator app support with recovery codes.

**Subtasks**:
- [x] TOTP enrolment
- [x] Recovery codes
- [x] Admin enforcement setting
- [ ] Security review sign-off

### TASK-011 | Write the migration guide
**Status**: review
**Priority**: Low | **Category**: Docs | **Assigned**: @alice
**Created**: 2026-10-04
**Tags**: #docs

Step-by-step guide for teams moving from the old export format.

**Subtasks**:
- [x] Draft
- [ ] Technical review

### TASK-012 | Upgrade to the latest framework version
**Status**: done
**Priority**: Medium | **Category**: Frontend | **Assigned**: @chen
**Created**: 2026-09-10 | **Started**: 2026-09-12 | **Finished**: 2026-09-30
**Tags**: #perf

Dependency upgrade and removal of deprecated APIs.

**Subtasks**:
- [x] Upgrade packages
- [x] Fix breaking changes
- [x] Run the full test suite

### TASK-013 | Set up error monitoring
**Status**: done
**Priority**: High | **Category**: DevOps | **Assigned**: @bob
**Created**: 2026-09-08 | **Started**: 2026-09-09 | **Finished**: 2026-09-25
**Tags**: #feature

Capture front-end and back-end errors with release tags.

**Subtasks**:
- [x] Install the SDK
- [x] Alert rules
- [x] On-call routing

### TASK-014 | Accessible colour palette
**Status**: done
**Priority**: Medium | **Category**: Design | **Assigned**: @dana
**Created**: 2026-09-05 | **Started**: 2026-09-06 | **Finished**: 2026-09-27
**Tags**: #ui

All text and controls reach WCAG AA contrast in light and dark themes.

**Subtasks**:
- [x] Audit current colours
- [x] New palette
- [x] Check every component

### TASK-015 | Invite teammates by link
**Status**: done
**Priority**: High | **Category**: Backend | **Assigned**: @alice, @chen
**Created**: 2026-09-01 | **Started**: 2026-09-02 | **Finished**: 2026-09-18
**Tags**: #feature

Shareable invite links that expire after seven days.

