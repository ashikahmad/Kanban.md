# Payments Service: Sprint 14

<!-- Config: Last Task ID: 008 -->
<!-- Format: v3 -->

## ⚙️ Configuration

**Columns**: 📋 Planned (planned) | 🚀 In Progress (in-progress) | 👀 In Review (review) | ✅ Done (done)

**Categories**: Backend, API, Infra, Tests, Docs

**Users**: @maya (Maya Lopez), @sam (Sam Idowu), @lena (Lena Weiss)

**Priorities**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

**Tags**: #bug #feature #refactor #security #tech-debt #perf

---

## Tasks

### TASK-001 | Idempotency keys for charge requests
**Status**: in-progress  
**Priority**: High  
**Category**: API  
**Assigned**: @maya  
**Created**: 2026-10-28  
**Started**: 2026-11-03  
**Due**: 2026-11-12  
**Tags**: #feature  

A retried POST /charges must not charge twice. Store the key with the response for 24 hours.

**Subtasks**:
- [x] Add idempotency_keys table
- [x] Return the stored response on a repeat
- [ ] Expire keys after 24 hours
- [ ] Document the Idempotency-Key header

**Notes**:
Decision: keys live in Postgres, not Redis, so a request and its key commit together. Revisit if the table passes 50M rows.

### TASK-002 | Charge endpoint times out under load
**Status**: review  
**Priority**: Critical  
**Category**: Backend  
**Assigned**: @sam  
**Created**: 2026-11-02  
**Started**: 2026-11-03  
**Due**: 2026-11-09  
**Tags**: #bug #perf  

p99 above 8 s at 200 requests per second. The connection pool is exhausted by slow fraud checks.

**Subtasks**:
- [x] Reproduce with the load script
- [x] Move the fraud check out of the request path
- [x] Add a pool saturation metric
- [ ] Reviewer: confirm the fallback when the queue is down

**Notes**:
Root cause: the fraud check held a connection while waiting on a third party. It now runs after the charge is recorded.

### TASK-003 | Webhook signature verification
**Status**: review  
**Priority**: High  
**Category**: Backend  
**Assigned**: @lena  
**Created**: 2026-10-30  
**Started**: 2026-11-04  
**Tags**: #security  

Reject webhooks whose HMAC does not match, and ones older than five minutes.

**Subtasks**:
- [x] Verify the signature
- [x] Reject stale timestamps
- [ ] Add tests for tampered bodies

### TASK-004 | Partial refunds
**Status**: planned  
**Priority**: High  
**Category**: API  
**Assigned**: @maya  
**Created**: 2026-11-01  
**Due**: 2026-11-19  
**Tags**: #feature  
**Blocked by**: TASK-001  

Refund part of a charge, several times, up to the captured amount. Builds on idempotency keys so a retried refund is safe.

### TASK-005 | Move list endpoints to cursor pagination
**Status**: planned  
**Priority**: Medium  
**Category**: API  
**Assigned**: @sam  
**Created**: 2026-10-29  
**Tags**: #refactor  

Offset pagination gets slow past page 500. Keep the old parameters working for one release.

### TASK-006 | Cut CI time below ten minutes
**Status**: planned  
**Priority**: Low  
**Category**: Infra  
**Created**: 2026-10-20  
**Tags**: #tech-debt  

Integration tests run serially. Shard them and cache the dependency install.

### TASK-007 | Fix rounding of currencies with three decimals
**Status**: done  
**Priority**: High  
**Category**: Backend  
**Assigned**: @lena  
**Created**: 2026-10-21  
**Started**: 2026-10-22  
**Finished**: 2026-10-24  
**Tags**: #bug  

KWD and BHD amounts were rounded to two decimals.

**Notes**:
**Result**:
Amounts are stored in minor units with a per-currency exponent. Tests cover every ISO 4217 exponent. See docs/money.md.

