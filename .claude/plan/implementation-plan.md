# CMP Backend — Implementation Plan

**Project:** Course Management Portal (`slp-backend`)  
**Organisation:** Future CX Lanka (Pvt) Ltd  
**Version:** 1.0.0  
**Date:** 2026-05-07

---

## Overview

This plan defines the order of implementation, dependencies between services, milestones, and the definition of done for each phase. Follow phases in sequence — later phases depend on earlier ones.

---

## Dependency Order

```
Phase 0 (Project Setup)
    ↓
Phase 1 (Shared Packages)  ← all services depend on this
    ↓
Phase 2 (API Gateway)
    ↓
Phase 3 (Auth Service)
Phase 4 (User Service)     ← Auth depends on User (email check)
    ↓
Phase 5 (Course Service)
    ↓
Phase 6 (Enrollment Service)   ← depends on User + Course
Phase 7 (Progress Service)     ← depends on Course
Phase 8 (Storage Service)      ← depends on Course
    ↓
Phase 9  (Notification Service)  ← depends on domain events
Phase 10 (Audit Service)         ← depends on domain events
    ↓
Phase 11 (Outbox Worker)   ← depends on Notification + Audit
    ↓
Phase 12 (Indexes + Rules)
Phase 13 (CI/CD Pipeline)
```

---

## Phase 0 — Project Setup

**Goal:** Monorepo scaffold is ready for all packages to be added.

**Tasks:**
1. Initialise npm workspaces monorepo with root `package.json`
2. Create shared `tsconfig.base.json`, `.eslintrc.json`, `.prettierrc`, `jest.config.ts`
3. Create `docker-compose.yml` with all service stubs
4. Create `.env.example` with all required keys
5. Create `.gitignore`
6. Initialise Firebase project — enable Firestore (Native), Auth (email/password), Storage
7. Configure Firebase emulators (`firebase.json`, `firestore.rules`)

**Definition of Done:**
- `npm install` succeeds from root
- `npx firebase emulators:start --only firestore,auth,storage` starts without errors
- `docker-compose up --build` starts (services may fail to connect — that is expected at this stage)

---

## Phase 1 — Shared Packages

**Goal:** All shared packages are built and importable by any service.

**Build order within this phase:**
```
@shared/firebase
@shared/logger
@shared/errors
    ↓
@shared/auth-middleware   ← needs errors + firebase
@shared/events            ← needs firebase
@shared/internal-http-client
@shared/response
@shared/health            ← needs firebase
@shared/tracing
```

**Tasks:**
1. `@shared/firebase` — `initFirebaseAdmin()` (idempotent, reads env vars)
2. `@shared/logger` — Pino logger, `httpLogger`, redaction config
3. `@shared/errors` — `AppError`, `createHttpError()`, `fromZodError()`, `errorHandler`
4. `@shared/auth-middleware` — `authenticate()`, `authorize()`, `mustBeOwnerOrAdmin()`, `AuthenticatedRequest`
5. `@shared/events` — `DomainEvent` type, `OutboxEventPublisher`
6. `@shared/internal-http-client` — `createInternalClient()` with timeout, retry, request ID propagation
7. `@shared/response` — `sendSuccess()`, `sendPaginated()`
8. `@shared/health` — `/healthz` + `/readyz` router
9. `@shared/tracing` — `initTracing(serviceName)` OpenTelemetry init

**Definition of Done:**
- All packages compile with `tsc --noEmit`
- `authenticate()` correctly verifies and rejects tokens in unit tests
- `errorHandler` sanitises 5xx and never returns stack traces

---

## Phase 2 — API Gateway

**Goal:** Single entry point routes all traffic to downstream services.

**Tasks:**
1. Express app with middleware stack: Helmet → CORS → Request ID → Pino HTTP → Rate Limiter → Proxy
2. General rate limiter (200 req/min per IP)
3. Auth rate limiter (10 req/min per IP on `/auth/*`)
4. CORS allowlist from `ALLOWED_ORIGINS` env var
5. Reverse proxy routes to all 8 services
6. `Dockerfile` + `package.json`

**Definition of Done:**
- `GET http://localhost:3000/api/v1/healthz` proxied to downstream returns `200`
- `X-Request-Id` header present in all responses
- Auth rate limiter fires `429` after 11 requests/min to `/auth/*`

---

## Phase 3 — Auth Service

**Goal:** Student registration and session management operational.

**Depends on:** Phase 1 (shared), Phase 4 (User Service internal endpoint)

> Build User Service `POST /internal/users/exists` first, then implement Auth Service.

**Tasks:**
1. Service scaffold: `app.ts`, `server.ts`, `config.ts`, `container.ts`
2. `RegisterUseCase` — validate → email check (User Service) → Firebase user → claim → Firestore doc → outbox event
3. `LogoutUseCase` — `revokeRefreshTokens(uid)`
4. `TrackLoginAttemptsUseCase` — `loginAttempts` collection, 10-attempt lockout in 15 min
5. Routes: `POST /auth/register`, `POST /auth/logout`, `POST /auth/password-reset`
6. `Dockerfile`

**Definition of Done:**
- `POST /auth/register` creates Firebase user + Firestore doc with `PENDING_APPROVAL`
- Duplicate email returns `409 EMAIL_EXISTS`
- `POST /auth/logout` causes subsequent requests with same token to return `401 TOKEN_REVOKED`
- 11th registration attempt within 1 minute returns `429`

---

## Phase 4 — User Service

**Goal:** User profiles and admin account management operational.

**Depends on:** Phase 1 (shared)

**Tasks:**
1. Service scaffold
2. `User` entity, `UserRole`, `UserStatus` value objects, `IUserRepository`
3. `FirestoreUserRepository` — `findById`, `findByEmail`, `create`, `update`, `findAll` (paginated)
4. `UpdateProfileUseCase`, `SuspendUserUseCase`, `ReactivateUserUseCase`
5. `CreateAdminUseCase`, `DeleteAdminUseCase`
6. `UserEventPublisher`
7. Internal endpoints: `POST /internal/users/exists`, `POST /internal/users/approve`
8. All profile + user management + admin management routes
9. `Dockerfile`

**Definition of Done:**
- `GET /me` returns correct profile for authenticated user
- `POST /super-admin/admins` creates Firebase Auth account with `admin` claim + Firestore doc
- `POST /users/:uid/suspend` disables Firebase account
- Internal `POST /internal/users/exists` reachable only with correct `X-Internal-Service-Key`

---

## Phase 5 — Course Service

**Goal:** Full course lifecycle (DRAFT → PUBLISHED → ARCHIVED) and content structure operational.

**Depends on:** Phase 1 (shared)

**Tasks:**
1. Service scaffold
2. `Course`, `Semester`, `Subject` entities; value objects (`CourseState`, `YouTubeVideoId`, `Attachment`); repository interfaces
3. `FirestoreCourseRepository`, `FirestoreSemesterRepository`, `FirestoreSubjectRepository`
4. `firestore.indexes.json` — courses composite index
5. All course, semester, subject use cases (create, update, publish, unpublish, archive, soft-delete)
6. `CourseEventPublisher`
7. Internal endpoint: `GET /internal/courses/:id/subject-count`
8. All course + semester + subject routes
9. `Dockerfile`

**Definition of Done:**
- `POST /courses/:id/publish` fails with `422 NO_SEMESTERS` when no semesters exist
- `POST /courses/:id/publish` fails with `422 EMPTY_SEMESTER` when a semester has no subjects
- Students cannot access DRAFT courses (`404`)
- `YouTubeVideoId` rejects IDs that are not exactly 11 valid characters

---

## Phase 6 — Enrollment Service

**Goal:** Registration queue and enrollment queue fully operational.

**Depends on:** Phase 4 (User Service), Phase 5 (Course Service)

**Tasks:**
1. Service scaffold
2. `Enrollment` entity, `EnrollmentState`, `IEnrollmentRepository`
3. `FirestoreEnrollmentRepository` (composite doc ID: `${studentUid}_${courseId}`)
4. `firestore.indexes.json` — enrollments composite index
5. `UserServiceClient`, `CourseServiceClient`
6. All enrollment use cases (create, approve registration, reject registration, bulk approve, approve enrollment, reject enrollment, withdraw)
7. `EnrollmentEventPublisher`
8. All enrollment routes
9. `Dockerfile`

**Definition of Done:**
- Student cannot have two `PENDING` enrollments for the same course (`409 ENROLLMENT_PENDING`)
- Bulk approve returns partial success with `approved[]` + `failed[]`
- Rejected student cannot re-enroll within cooloff period (`422 COOLOFF_ACTIVE`)
- `WithdrawEnrollmentUseCase` does NOT reset progress data

---

## Phase 7 — Progress Service

**Goal:** Subject completion tracking and course progress aggregates operational.

**Depends on:** Phase 5 (Course Service — subject count)

**Tasks:**
1. Service scaffold
2. `SubjectProgress` entity, `CourseProgressAggregate`, `IProgressRepository`
3. `FirestoreProgressRepository` (composite doc ID: `${studentUid}_${subjectId}`, `upsert`)
4. `firestore.indexes.json` — progress composite index
5. `CourseServiceClient` — `getSubjectCount(courseId)`
6. `MarkSubjectCompleteUseCase` (idempotent — `completedAt` immutable once set)
7. `UpdateLastAccessedUseCase`
8. `ComputeCourseProgressUseCase` (1 decimal place, handles 0 subjects)
9. `ResetProgressUseCase`
10. All progress routes + internal reset endpoint
11. `Dockerfile`

**Definition of Done:**
- Calling `POST /progress/subjects/:id/complete` twice returns the same `completedAt` both times
- `completionPercent` is `33.3` when 1 of 3 subjects completed
- `completionPercent` is `0` when `totalSubjects` is 0 (no division by zero)

---

## Phase 8 — Storage Service

**Goal:** File attachment upload and signed URL download operational.

**Depends on:** Phase 5 (Course Service — subject existence check)

**Tasks:**
1. Service scaffold
2. `CloudStorageRepository` (upload to Firebase Storage, generate signed URL, delete)
3. `attachmentValidator` multer middleware (PDF/DOC/DOCX, 25 MB max)
4. `UploadAttachmentUseCase`, `GetDownloadUrlUseCase` (15-min expiry), `DeleteAttachmentUseCase`
5. All attachment routes
6. `Dockerfile`

**Definition of Done:**
- Non-PDF/DOC/DOCX upload returns `415 UNSUPPORTED_MEDIA_TYPE`
- File > 25 MB returns `413`
- Signed URL expires in 15 minutes
- Only enrolled students and admins can get download URLs

---

## Phase 9 — Notification Service

**Goal:** In-app, email, and push notifications delivered for all relevant domain events.

**Depends on:** Phase 1 (shared events), Phase 11 starts after this phase

**Tasks:**
1. Service scaffold
2. `FirestoreNotificationRepository`
3. `firestore.indexes.json` — notifications composite index
4. `EmailClient` (SendGrid)
5. `FcmClient` (FCM push)
6. `NotificationDispatcher` — email 3-retry backoff, push best-effort
7. Event handlers: `RegistrationApprovedHandler`, `RegistrationRejectedHandler`, `EnrollmentPendingHandler`, `EnrollmentApprovedHandler`, `EnrollmentRejectedHandler`, `AdminSuspendedHandler`
8. Notification CRUD routes (`GET`, mark read, mark all read)
9. Internal event receiver endpoint (called by outbox worker)
10. `Dockerfile`

**Definition of Done:**
- Email failure after 3 retries is logged as error but does NOT throw
- Push failure is logged as warn and NOT retried
- In-app notification is persisted even when email fails

---

## Phase 10 — Audit Service

**Goal:** Append-only audit log operational for all admin/super-admin actions.

**Depends on:** Phase 1 (shared events)

**Tasks:**
1. Service scaffold
2. `FirestoreAuditRepository` (`append` method only — no update/delete)
3. `firestore.indexes.json` — audit_log composite index
4. `AuditEventHandler` — handles `audit.action` events
5. `GET /audit-log` endpoint (super_admin, paginated, filtered)
6. Firestore Security Rules — deny client writes/updates/deletes to `audit_log`
7. Security Rules unit tests
8. Internal event receiver endpoint
9. `Dockerfile`

**Definition of Done:**
- Client attempt to write to `audit_log` is denied by Firestore rules
- Client attempt to update an existing `audit_log` document is denied
- `GET /audit-log` returns filtered results with all required query params working

---

## Phase 11 — Outbox Worker

**Goal:** All domain events reliably dispatched to Notification and Audit services.

**Depends on:** Phase 9 (Notification Service), Phase 10 (Audit Service)

**Tasks:**
1. Worker scaffold: `worker.ts`, `config.ts`, `container.ts`
2. `EventDispatcher` — switch on `eventType`, call correct service handler
3. Polling loop every 5 seconds (`node-cron`)
4. Mark event `processing` before dispatch
5. Mark `delivered` on success; increment `attempts`, mark `failed` after 5
6. Register all 11 event types
7. `Dockerfile`

**Definition of Done:**
- Event published to `outbox` is dispatched within 5 seconds
- Failed dispatch after 5 attempts sets `status: 'failed'` — does not crash the worker
- Duplicate `processing` status prevents double-dispatch on worker restart

---

## Phase 12 — Firestore Indexes & Security Rules

**Goal:** All Firestore indexes deployed and security rules enforced in Firebase project.

**Tasks:**
1. Deploy all composite indexes from each service's `firestore.indexes.json`
2. Deploy Firestore Security Rules
3. Deploy Firebase Storage Security Rules
4. Verify indexes are built (Firebase Console → Firestore → Indexes)

**Definition of Done:**
- All 5 composite indexes show `READY` status in Firebase Console
- `audit_log` client write attempt returns permission denied
- Complex queries (e.g., enrollments filtered by `state` + `courseId` ordered by `createdAt`) return results without index errors

---

## Phase 13 — CI/CD Pipeline

**Goal:** Automated quality gate and deployment pipeline operational for all services.

**Tasks:**
1. `.github/workflows/service-ci.yml` — trigger on path change per service
2. Add steps: type-check → lint → unit tests → integration tests → `npm audit` → Docker build → Trivy scan → push image → deploy staging → smoke tests → deploy production (on tag)
3. Store Firebase credentials and `INTERNAL_SERVICE_KEY` in GitHub Secrets
4. Configure Trivy to block on HIGH/CRITICAL CVEs
5. Set up staging environment on Kubernetes
6. Set up production environment on Kubernetes with manual approval gate

**Definition of Done:**
- Push to `main` triggers build, tests pass, image pushed, staging deployed
- Git tag `v1.0.0` triggers production deployment after staging smoke tests pass
- Any failing test or HIGH CVE blocks the pipeline

---

## Milestones

| Milestone | Phases Complete | Target |
|-----------|:--------------:|--------|
| **M1 — Foundation** | 0, 1 | Shared packages built and tested |
| **M2 — Auth Ready** | 2, 3, 4 | Students can register; admins can be created |
| **M3 — Core Platform** | 5, 6, 7, 8 | Courses, enrollment, progress, and file upload working |
| **M4 — Notifications & Audit** | 9, 10, 11 | All async side-effects operational |
| **M5 — Production Ready** | 12, 13 | Indexes deployed, CI/CD live, production deployed |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Firebase emulator behaves differently from production | Medium | Run integration tests against emulator in CI; smoke test on real project after deploy |
| Outbox worker double-dispatches events on restart | High | Mark event `processing` before dispatch; check status before re-processing |
| Firestore composite index not deployed before query runs | High | Deploy indexes in Phase 12 before any production traffic; test queries in emulator first |
| `INTERNAL_SERVICE_KEY` leaked in logs | High | Pino redaction config must cover all log paths; rotate key if exposed |
| Cross-service Firestore reads introduced by mistake | Medium | `/test-security` command audits routes; code review checklist item |
| Email provider (SendGrid) outage | Low | 3-retry backoff absorbs transient failures; permanent failure is logged, not fatal |

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*  
*Paired with tracker.md · Backend Blueprint v1.0.0*
