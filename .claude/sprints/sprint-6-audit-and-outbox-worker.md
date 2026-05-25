# Sprint 6 — Audit Service + Outbox Worker

**Sprint:** 6 of 7  
**Week:** 6  
**Focus:** Immutable audit logging and reliable event dispatch via transactional outbox  
**Status:** `[~] In Progress`

---

## Goal

By end of Sprint 6, all admin/super-admin actions are recorded in an immutable audit log. Domain events published by all services are reliably dispatched to Notification and Audit services within 5 seconds via the outbox worker, with up to 5 retry attempts.

---

## Services Involved

| Service | Port | Responsibility |
|---------|:----:|----------------|
| `audit-service` | 3008 | Append-only `audit_log` collection; super-admin query endpoint |
| `outbox-worker` | 3009 | Polls `outbox` every 5 s; dispatches events to notification + audit services |

---

## User Stories

| ID | Story | Points |
|----|-------|:------:|
| S6-01 | As a super_admin, I can query the audit log filtered by actor, action, resource, and date range | 3 |
| S6-02 | All admin and super_admin actions are recorded automatically in the audit log | 5 |
| S6-03 | Audit log records are immutable — no client can update or delete them | 3 |
| S6-04 | Domain events published to `outbox` are dispatched within 5 seconds | 5 |
| S6-05 | Failed event dispatch is retried up to 5 times before being marked `failed` | 3 |
| S6-06 | A failed event dispatch does not crash or stop the outbox worker | 3 |
| S6-07 | Events marked `processing` are not re-dispatched on worker restart (double-dispatch prevention) | 3 |

**Total Points:** 25

---

## Tasks

### `packages/audit-service/` (:3008)

#### Domain
- [ ] `IAuditRepository` interface — `append(entry)` only — no update or delete methods

#### Infrastructure
- [ ] `FirestoreAuditRepository`
  - `append(entry)` — `db.collection('audit_log').add(entry)` with `createdAt: FieldValue.serverTimestamp()`
  - No `update()` or `delete()` methods — enforced by interface design
- [ ] `firestore.indexes.json` — `audit_log`: `actorUid` ASC, `action` ASC, `createdAt` DESC

#### Application
- [ ] `AuditEventHandler`
  - Handles `audit.action` events from the outbox worker
  - Calls `auditRepo.append()` with `actorUid`, `action`, `targetType`, `targetId`, `payload`, `requestId`, `createdAt`
  - Handler is idempotent — duplicate dispatches result in duplicate records (acceptable; deduplication not required in v1)

#### Internal Event Receiver
- [ ] `POST /internal/events` — receives `{ eventType, payload, requestId }`; routes `audit.action` to `AuditEventHandler`; authenticated with `X-Internal-Service-Key`

#### HTTP Routes
- [ ] `GET /audit-log` (super_admin)
  - Query params: `actorUid`, `action`, `targetType`, `targetId`, `from` (ISO 8601), `to` (ISO 8601), `limit` (default 20, max 100), `cursor`
  - Cursor-based pagination using `orderBy('createdAt', 'desc')`
- [ ] `Dockerfile`, `package.json`, `tsconfig.json`

#### Firestore Security Rules
- [ ] `audit_log` — reads: `super_admin` only via Firebase Auth claim; writes, updates, deletes: **denied for all clients**
- [ ] Security Rules unit tests using `@firebase/rules-unit-testing`:
  - [ ] Student attempt to write → denied
  - [ ] Admin attempt to write → denied
  - [ ] Super_admin attempt to write → denied (Admin SDK only writes)
  - [ ] Super_admin attempt to update existing doc → denied
  - [ ] Super_admin read → allowed

---

### `packages/outbox-worker/` (:3009)

#### Implementation
- [ ] `worker.ts` — main polling loop using `node-cron`
  - Schedule: `*/5 * * * * *` (every 5 seconds; configurable via `OUTBOX_POLL_INTERVAL_SECONDS`)
  - Query: `where('status','==','pending').orderBy('createdAt','asc').limit(OUTBOX_BATCH_SIZE)`
- [ ] `EventDispatcher` — switch statement over `eventType`; calls correct service endpoint
- [ ] `config.ts` — `OUTBOX_POLL_INTERVAL_SECONDS`, `OUTBOX_BATCH_SIZE`, service URLs, `INTERNAL_SERVICE_KEY`
- [ ] `container.ts` — wire up `EventDispatcher` with all service clients

#### Dispatch Flow (per event)
```
1. Mark event status = 'processing'   ← prevents double-dispatch on restart
2. Call target service internal endpoint
3. On success → status = 'delivered', processedAt = now()
4. On failure → attempts++
         if attempts >= 5 → status = 'failed', error = err.message
         else              → status = 'pending'  (will retry next tick)
```

#### Registered Event Types → Target Services

| Event Type | Target Service | Endpoint |
|-----------|---------------|----------|
| `user.registered` | notification-service | `POST /internal/events` |
| `user.registered` | audit-service | `POST /internal/events` |
| `registration.approved` | user-service | `POST /internal/users/approve` |
| `registration.approved` | notification-service | `POST /internal/events` |
| `registration.approved` | audit-service | `POST /internal/events` |
| `registration.rejected` | notification-service | `POST /internal/events` |
| `registration.rejected` | audit-service | `POST /internal/events` |
| `enrollment.pending` | notification-service | `POST /internal/events` |
| `enrollment.pending` | audit-service | `POST /internal/events` |
| `enrollment.approved` | notification-service | `POST /internal/events` |
| `enrollment.approved` | audit-service | `POST /internal/events` |
| `enrollment.rejected` | notification-service | `POST /internal/events` |
| `enrollment.rejected` | audit-service | `POST /internal/events` |
| `course.published` | notification-service | `POST /internal/events` |
| `course.published` | audit-service | `POST /internal/events` |
| `progress.subjectCompleted` | audit-service | `POST /internal/events` |
| `admin.created` | audit-service | `POST /internal/events` |
| `admin.suspended` | notification-service | `POST /internal/events` |
| `admin.suspended` | audit-service | `POST /internal/events` |
| `audit.action` | audit-service | `POST /internal/events` |

- [ ] `Dockerfile`, `package.json`, `tsconfig.json`

---

## Unit Tests

### Audit Service
| Test file | Cases |
|-----------|-------|
| `audit-service/tests/unit/AuditEventHandler.test.ts` | success → `auditRepo.append` called with correct fields; missing actorUid → null (not error) |
| `audit-service/tests/rules/auditLog.rules.test.ts` | student write → denied; admin write → denied; super_admin update → denied |

### Outbox Worker
| Test file | Cases |
|-----------|-------|
| `outbox-worker/tests/unit/EventDispatcher.test.ts` | known event type → calls correct handler; unknown event type → logs warning, does not throw |
| `outbox-worker/tests/unit/retryLogic.test.ts` | success → status=delivered; 1 failure → status=pending, attempts=1; 5 failures → status=failed |
| `outbox-worker/tests/unit/doubleDispatch.test.ts` | event with status=processing is skipped by next poll tick |

---

## Integration Tests

### Audit Service
| Test file | Cases |
|-----------|-------|
| `audit-service/tests/integration/auditLog.test.ts` | GET /audit-log filters by actorUid; filters by date range; pagination works; non-super_admin → 403 |

### Outbox Worker
| Test file | Cases |
|-----------|-------|
| `outbox-worker/tests/integration/dispatch.test.ts` | pending event → dispatched within 5 s → status=delivered; handler returns 500 → retried; after 5 retries → status=failed |

---

## Acceptance Criteria

- [ ] A published domain event reaches `audit_log` within 5 seconds via the outbox worker
- [ ] A client attempt to write to `audit_log` is rejected by Firestore Security Rules
- [ ] A client attempt to update an existing `audit_log` document is rejected
- [ ] `GET /audit-log` requires `super_admin` role — admin returns `403`
- [ ] Outbox event marked `processing` before dispatch — not re-dispatched on worker restart
- [ ] Event that fails dispatch 5 times: `status = 'failed'` — worker does not crash
- [ ] Worker continues processing other pending events after one fails
- [ ] `GET /healthz` returns `200` on audit-service

---

## Sprint Notes

_Use this section during the sprint to record decisions, blockers, and discoveries._

---

*Previous: [Sprint 5 — Storage & Notification Service](sprint-5-storage-and-notification-service.md) | Next: [Sprint 7 — Production & CI/CD](sprint-7-production-and-cicd.md)*
