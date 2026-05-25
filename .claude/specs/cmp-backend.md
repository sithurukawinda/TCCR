# Spec: CMP Backend — Course Management Portal

**Slug:** cmp-backend  
**Service(s):** gateway, auth-service, user-service, course-service, enrollment-service, progress-service, storage-service, notification-service, audit-service, outbox-worker  
**Status:** Release Baseline  
**Date:** 2026-05-07  
**Organisation:** Future CX Lanka (Pvt) Ltd  
**Version:** 1.0.0

---

## Problem

Future CX Lanka needs a backend platform that lets students discover and enroll in courses, track their learning progress, and receive notifications — while giving admins full control over course content, student registration approvals, and enrollment management. All actions taken by admins must be auditable by super admins. The platform must scale horizontally, remain fault-tolerant, and never block a student's API response because of a failed notification or email.

---

## Actors & Roles

| Role | Who | What they can do |
|------|-----|-----------------|
| **Public** | Unauthenticated visitors | Browse published course catalog, register as student, trigger password reset |
| **student** | Registered and approved students | Own profile, course catalog, own enrollments, learning content, progress tracking, own notifications |
| **admin** | Staff created by Super Admin | Everything students can do + course management, registration/enrollment queue management, student account management |
| **super_admin** | Platform owner | Everything admins can do + admin account management, full audit log access |

> `super_admin` inherits all `admin` permissions.

---

## Acceptance Criteria

### 1. Authentication (auth-service)

1. A visitor can register as a student by providing `firstName`, `lastName`, `email`, and `password` (min 10 chars, must include uppercase, lowercase, number, and special character). The account is created in `PENDING_APPROVAL` state. The student cannot log in until an admin approves the account.
2. Email must be unique across the platform. Registration with a duplicate email returns `409 EMAIL_EXISTS`.
3. Login is handled entirely by the Firebase client SDK. The server never accepts username/password — it only verifies Firebase ID tokens on each request.
4. All authenticated routes reject requests with missing, expired, or revoked tokens with `401`.
5. A logged-in user can log out; the server revokes the Firebase refresh token so that existing tokens are immediately rejected on all devices.
6. A user can request a password reset email via `POST /auth/password-reset`. The server calls Firebase's `sendPasswordResetEmail`.
7. After 10 failed login attempts within a 15-minute window, the account is disabled automatically. The account can only be re-enabled by an admin.
8. Firebase ID tokens expire after 1 hour. The client SDK refreshes them automatically. The server always calls `verifyIdToken(token, checkRevoked=true)`.

### 2. User Profiles (user-service)

1. Any authenticated user can view their own profile via `GET /me` — returns `uid`, `email`, `firstName`, `lastName`, `role`, `status`, `profilePhotoUrl`, `createdAt`, `updatedAt`.
2. Any authenticated user can update their own `firstName`, `lastName`, and `profilePhotoUrl` via `PATCH /me`.
3. Any authenticated user can change their own password via `POST /me/change-password` — requires `currentPassword` and `newPassword`.
4. Admins can list all users (paginated, filterable by `status` and `role`) via `GET /users`.
5. Admins can view any user's profile via `GET /users/:uid`.
6. Admins can suspend a student account via `POST /users/:uid/suspend`. A suspended student's Firebase account is disabled.
7. Admins can reactivate a suspended student via `POST /users/:uid/reactivate`.

### 3. Admin Management (user-service — super_admin only)

1. Super Admin can list all admin accounts (paginated) via `GET /super-admin/admins`.
2. Super Admin can create an admin account via `POST /super-admin/admins` — requires `firstName`, `lastName`, `email`, `initialPassword`. The new account gets the `admin` Firebase custom claim and `APPROVED` status immediately (no registration queue).
3. Super Admin can view any admin's profile via `GET /super-admin/admins/:uid`.
4. Super Admin can suspend an admin via `POST /super-admin/admins/:uid/suspend`.
5. Super Admin can reactivate a suspended admin via `POST /super-admin/admins/:uid/reactivate`.
6. Super Admin can delete an admin via `DELETE /super-admin/admins/:uid` — soft-delete; account is recoverable within 30 days.

### 4. Course Management (course-service)

1. Admins can create a course in `DRAFT` state via `POST /courses` with `title`, `description`, and optional `coverImageUrl`.
2. Admins can update course metadata (`title`, `description`, `coverImageUrl`) via `PATCH /courses/:id`.
3. Admins can publish a `DRAFT` course via `POST /courses/:id/publish`. A course can only be published if it has at least one semester and every semester has at least one subject. Publishing with no semesters returns `422 NO_SEMESTERS`; publishing with an empty semester returns `422 EMPTY_SEMESTER`.
4. Admins can unpublish a `PUBLISHED` course back to `DRAFT` via `POST /courses/:id/unpublish`.
5. Admins can archive a `PUBLISHED` course via `POST /courses/:id/archive`. Archived courses are not visible to students.
6. Admins can soft-delete a course via `DELETE /courses/:id`. The course is recoverable within 30 days via the `deletedAt` timestamp.
7. Students and public visitors can browse the published course catalog via `GET /courses`. Only `PUBLISHED` courses with no `deletedAt` are returned to students.
8. Accessing a `DRAFT` course as a student returns `404`.
9. Course lifecycle follows a strict state machine: `DRAFT → PUBLISHED → ARCHIVED`. `PUBLISHED → DRAFT` via unpublish. No other transitions are valid.

### 5. Semester & Subject Management (course-service)

1. Admins can add a semester to a course via `POST /courses/:id/semesters` with `title` and optional `description`.
2. Admins can update a semester's metadata via `PATCH /semesters/:id`.
3. Admins can soft-delete a semester via `DELETE /semesters/:id`.
4. Admins can add a subject to a semester via `POST /semesters/:id/subjects` with `title`, `description`, optional `youtubeVideoId` (11-char validated), and optional `attachmentIds`.
5. Admins can update a subject via `PATCH /subjects/:id`.
6. Admins can soft-delete a subject via `DELETE /subjects/:id`.
7. YouTube video IDs must be exactly 11 characters (alphanumeric + `-_`). Invalid IDs return `400 INVALID_YOUTUBE_ID`.

### 6. File Attachments (storage-service)

1. Admins can upload a file attachment to a subject via `POST /subjects/:id/attachments` using `multipart/form-data`. Accepted types: PDF, DOC, DOCX. Maximum file size: 25 MB.
2. Files of unsupported MIME type return `415 UNSUPPORTED_MEDIA_TYPE`. Files exceeding 25 MB return `413`.
3. Enrolled students and admins can generate a short-lived signed download URL via `GET /attachments/:id/download-url`. The URL expires in 15 minutes.
4. Admins can remove an attachment via `DELETE /attachments/:id`.

### 7. Student Registration Queue (enrollment-service)

1. When a student registers, they enter the registration queue with `PENDING` status. An admin must approve or reject the registration before the student can enroll in courses.
2. Admins can view all pending registrations (paginated, filterable by `status`) via `GET /admin/registrations`.
3. Admins can approve a registration via `POST /admin/registrations/:id/approve`. On approval, the student's account status becomes `APPROVED` (User Service is notified via internal HTTP).
4. Admins can reject a registration via `POST /admin/registrations/:id/reject` with an optional `reason`. On rejection, the student's account status becomes `REJECTED`.
5. Admins can bulk-approve multiple registrations via `POST /admin/registrations/bulk-approve` with an array of IDs. Uses `Promise.allSettled` — partial success is allowed. Response includes `approved[]` and `failed[]` arrays.

### 8. Course Enrollment (enrollment-service)

1. An approved student can request enrollment in a published course via `POST /courses/:id/enroll`. A student can only have one `PENDING` enrollment per course at a time; a second request returns `409 ENROLLMENT_PENDING`.
2. Admins can view all pending enrollment requests via `GET /admin/enrollments`.
3. Admins can approve an enrollment via `POST /admin/enrollments/:id/approve`. Enrollment status becomes `APPROVED`.
4. Admins can reject an enrollment via `POST /admin/enrollments/:id/reject` with an optional `reason`. A rejected student cannot re-enroll for `ENROLLMENT_REJECTION_COOLOFF_HOURS` (default 24 hours). Re-enrollment during cool-off returns `422 COOLOFF_ACTIVE`.
5. An approved student can withdraw from a course via `POST /enrollments/:id/withdraw`. Enrollment status becomes `WITHDRAWN`. Progress data is NOT automatically reset on withdrawal.
6. Students can view all their own enrollments via `GET /me/enrollments`.

### 9. Progress Tracking (progress-service)

1. A student can mark a subject as complete via `POST /progress/subjects/:id/complete`. This operation is **idempotent** — calling it a second time returns the existing record unchanged and does not update `completedAt`.
2. `completedAt` is immutable once set. It must never be overwritten on subsequent calls.
3. A student can update the last-accessed pointer on a subject via `POST /progress/subjects/:id/access`. This updates `lastAccessedAt` and supports the "resume where you left off" feature.
4. A student can view their course-level progress aggregate via `GET /me/progress/courses/:courseId`. The response includes: `completedCount`, `pendingCount`, `totalSubjects`, `completionPercent` (1 decimal place), and `lastAccessedSubjectId`.
5. `completionPercent` is computed as `(completedCount / totalSubjects) * 100` rounded to 1 decimal place. Returns `0` when `totalSubjects` is 0.
6. A student can view progress for a single subject via `GET /me/progress/subjects/:subjectId`.
7. Admins can view aggregated progress for all students in a course via `GET /admin/progress/courses/:courseId`.
8. Admins can reset all progress for a (student, course) pair via the internal endpoint `POST /internal/progress/reset`. This action is audited.

### 10. Notifications (notification-service)

1. In-app notifications are the authoritative notification channel. Email and push are supplementary.
2. Students receive notifications for: registration approved/rejected, enrollment approved/rejected.
3. Admins receive notifications when: a new student registers (pending approval), a new enrollment request is submitted.
4. Email is sent with up to 3 retry attempts using exponential backoff (1 s, 2 s, 4 s). Permanent email failure is logged but does not block the API response or notification creation.
5. Push notifications (FCM) are best-effort — a failed push is logged as a warning and never retried.
6. A user can list their own notifications (paginated) via `GET /me/notifications`.
7. A user can mark a single notification as read via `POST /me/notifications/:id/read`.
8. A user can mark all notifications as read via `POST /me/notifications/read-all`.

### 11. Audit Log (audit-service — super_admin only)

1. All significant admin and super-admin actions are recorded in the `audit_log` collection. Records are append-only and immutable — updates and deletes are denied at the Firestore Security Rules level.
2. Each audit record contains: `actorUid`, `action`, `targetType`, `targetId`, `payload`, `requestId`, `createdAt`.
3. Super Admin can query the audit log via `GET /audit-log` with filters: `actorUid`, `action`, `targetType`, `targetId`, date range (`from`, `to`).
4. Audit log entries are written asynchronously via the outbox worker — the API response is never delayed by audit writes.

### 12. Event-Driven Side Effects (outbox-worker)

1. Domain events are written atomically to the `outbox` Firestore collection in the same write batch as the primary business data. Events are never lost even if a downstream service is temporarily unavailable.
2. The outbox worker polls the `outbox` collection every 5 seconds (configurable via `OUTBOX_POLL_INTERVAL_SECONDS`) and dispatches pending events to notification-service and audit-service via internal HTTP.
3. Each event is attempted up to 5 times. After 5 failures the event status is set to `failed` for manual investigation.
4. Event processing is idempotent — duplicate dispatches for the same `outbox` document ID must not cause duplicate notifications or audit entries.

### 13. Health & Observability

1. Every service exposes `GET /healthz` (liveness — process is alive) and `GET /readyz` (readiness — Firestore is reachable). These probes are used by Kubernetes HPA.
2. All services emit structured JSON logs via Pino. Logs include `service`, `version`, `env`, `requestId`, `method`, `url`. Tokens and passwords are automatically redacted.
3. All services emit distributed traces via OpenTelemetry to Google Cloud Trace.
4. Prometheus metrics are emitted per service: `http_requests_total`, `http_request_duration_seconds`, `firestore_reads_total`, `domain_events_published_total`.

---

## New Endpoints

All endpoints are prefixed with `/api/v1` via the API Gateway at `:3000`.

### Auth Service (:3001)

| Method | Path | Role | Status |
|--------|------|------|--------|
| POST | `/auth/register` | public | 201 |
| POST | `/auth/logout` | any authenticated | 204 |
| POST | `/auth/password-reset` | public | 204 |

### User Service (:3002)

| Method | Path | Role | Status |
|--------|------|------|--------|
| GET | `/me` | any | 200 |
| PATCH | `/me` | any | 200 |
| POST | `/me/change-password` | any | 204 |
| GET | `/users` | admin | 200 |
| GET | `/users/:uid` | admin | 200 |
| POST | `/users/:uid/suspend` | admin | 200 |
| POST | `/users/:uid/reactivate` | admin | 200 |
| GET | `/super-admin/admins` | super_admin | 200 |
| POST | `/super-admin/admins` | super_admin | 201 |
| GET | `/super-admin/admins/:uid` | super_admin | 200 |
| POST | `/super-admin/admins/:uid/suspend` | super_admin | 200 |
| POST | `/super-admin/admins/:uid/reactivate` | super_admin | 200 |
| DELETE | `/super-admin/admins/:uid` | super_admin | 204 |

### Course Service (:3003)

| Method | Path | Role | Status |
|--------|------|------|--------|
| GET | `/courses` | public | 200 |
| GET | `/courses/:id` | public | 200 |
| POST | `/courses` | admin | 201 |
| PATCH | `/courses/:id` | admin | 200 |
| POST | `/courses/:id/publish` | admin | 200 |
| POST | `/courses/:id/unpublish` | admin | 200 |
| POST | `/courses/:id/archive` | admin | 200 |
| DELETE | `/courses/:id` | admin | 204 |
| POST | `/courses/:id/semesters` | admin | 201 |
| PATCH | `/semesters/:id` | admin | 200 |
| DELETE | `/semesters/:id` | admin | 204 |
| POST | `/semesters/:id/subjects` | admin | 201 |
| PATCH | `/subjects/:id` | admin | 200 |
| DELETE | `/subjects/:id` | admin | 204 |

### Storage Service (:3006)

| Method | Path | Role | Status |
|--------|------|------|--------|
| POST | `/subjects/:id/attachments` | admin | 201 |
| GET | `/attachments/:id/download-url` | student (enrolled), admin | 200 |
| DELETE | `/attachments/:id` | admin | 204 |

### Enrollment Service (:3004)

| Method | Path | Role | Status |
|--------|------|------|--------|
| POST | `/courses/:id/enroll` | student | 201 |
| GET | `/me/enrollments` | student | 200 |
| POST | `/enrollments/:id/withdraw` | student | 200 |
| GET | `/admin/registrations` | admin | 200 |
| POST | `/admin/registrations/:id/approve` | admin | 200 |
| POST | `/admin/registrations/:id/reject` | admin | 200 |
| POST | `/admin/registrations/bulk-approve` | admin | 200 |
| GET | `/admin/enrollments` | admin | 200 |
| POST | `/admin/enrollments/:id/approve` | admin | 200 |
| POST | `/admin/enrollments/:id/reject` | admin | 200 |

### Progress Service (:3005)

| Method | Path | Role | Status |
|--------|------|------|--------|
| POST | `/progress/subjects/:id/complete` | student | 200 |
| POST | `/progress/subjects/:id/access` | student | 200 |
| GET | `/me/progress/courses/:courseId` | student | 200 |
| GET | `/me/progress/subjects/:subjectId` | student | 200 |
| GET | `/admin/progress/courses/:courseId` | admin | 200 |

### Notification Service (:3007)

| Method | Path | Role | Status |
|--------|------|------|--------|
| GET | `/me/notifications` | any | 200 |
| POST | `/me/notifications/:id/read` | any | 200 |
| POST | `/me/notifications/read-all` | any | 204 |

### Audit Service (:3008)

| Method | Path | Role | Status |
|--------|------|------|--------|
| GET | `/audit-log` | super_admin | 200 |

---

## Domain Events

| Event | Published By | Consumed By |
|-------|-------------|-------------|
| `user.registered` | auth-service | user-service, notification-service, audit-service |
| `registration.approved` | enrollment-service | user-service, notification-service, audit-service |
| `registration.rejected` | enrollment-service | user-service, notification-service, audit-service |
| `enrollment.pending` | enrollment-service | notification-service, audit-service |
| `enrollment.approved` | enrollment-service | notification-service, audit-service |
| `enrollment.rejected` | enrollment-service | notification-service, audit-service |
| `course.published` | course-service | notification-service, audit-service |
| `progress.subjectCompleted` | progress-service | audit-service |
| `admin.created` | user-service | audit-service |
| `admin.suspended` | user-service | notification-service, audit-service |
| `audit.action` | any service | audit-service |

All events are routed through the transactional outbox pattern — written atomically with business data, dispatched by outbox-worker every 5 seconds.

---

## Firestore Changes

### Collections

| Collection | Owner | Document ID | Notes |
|-----------|-------|-------------|-------|
| `users` | user-service | Firebase Auth UID | |
| `courses` | course-service | auto UUID | |
| `courses/{id}/semesters` | course-service | auto UUID | Sub-collection |
| `courses/{id}/semesters/{id}/subjects` | course-service | auto UUID | Sub-collection |
| `enrollments` | enrollment-service | `${studentUid}_${courseId}` | |
| `progress` | progress-service | `${studentUid}_${subjectId}` | |
| `notifications` | notification-service | auto UUID | |
| `audit_log` | audit-service | auto UUID | Append-only; client writes denied |
| `outbox` | all services (write) / outbox-worker (read) | auto UUID | |
| `loginAttempts` | auth-service | email address | TTL: 15 min window |

### Composite Indexes Required

| Collection | Fields |
|-----------|--------|
| `courses` | `state` ASC, `publishedAt` DESC, `deletedAt` ASC |
| `enrollments` | `state` ASC, `courseId` ASC, `createdAt` ASC |
| `progress` | `studentUid` ASC, `courseId` ASC, `state` ASC |
| `notifications` | `userUid` ASC, `createdAt` DESC |
| `audit_log` | `actorUid` ASC, `action` ASC, `createdAt` DESC |

---

## Security Constraints

1. **Authentication:** Every non-public route calls `authenticate()` from `@shared/auth-middleware`. Token verification always uses `checkRevoked=true`.
2. **Authorisation:** Every route calls `authorize(...roles)`. `super_admin` inherits all `admin` permissions inside the middleware.
3. **Ownership:** Routes that access user-owned resources (`/me/*`, own enrollments, own progress) use `mustBeOwnerOrAdmin()`.
4. **Input validation:** Every route that accepts params, query, or body validates with a Zod schema before the controller runs. Zod errors produce `400 VALIDATION_ERROR` with field-level `details`.
5. **Rate limiting:** Auth endpoints: 10 req/min per IP. General endpoints: 200 req/min per IP. Enforced at the API Gateway.
6. **Internal routes:** Routes under `/internal/*` verify `X-Internal-Service-Key` header. They do not use Firebase token auth — internal callers are services, not users.
7. **No Firestore cross-service reads:** Services communicate only via internal HTTP or domain events. No service reads another service's Firestore collection.
8. **Audit log immutability:** Firestore Security Rules deny client-side writes, updates, and deletes to `audit_log`. The Audit Service is the only writer via Firebase Admin SDK.
9. **File uploads:** MIME type and file size are validated at the multer middleware layer before any business logic runs.
10. **Error sanitisation:** Stack traces are never returned to clients. 5xx responses return a generic `"An internal error occurred."` message. Full errors are logged server-side only.
11. **Logging redaction:** `Authorization` header, `password`, `token`, and `idToken` fields are automatically redacted from all structured logs.

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-SCL-001 | All services are stateless — no per-request state in process memory |
| NFR-SCL-002 | Horizontal scaling via Kubernetes HPA (min 2 replicas, max 10, CPU trigger at 70%) |
| NFR-SCL-007 | Graceful shutdown: `preStop` hook + 30 s termination grace period |
| NFR-AVL-002 | `/healthz` (liveness) and `/readyz` (Firestore connectivity) probes on every service |
| NFR-AVL-003 | Push and email failures never block the API response |
| NFR-AVL-006 | Global error handler sanitises all 5xx responses — no stack traces to clients |
| NFR-PRF-007 | Cursor-based pagination on all list endpoints (default 20, max 100) |
| NFR-SEC-001 | TLS 1.2+ enforced at load balancer level |
| NFR-SEC-007 | Typed Firestore SDK queries only — no string path interpolation |
| NFR-SEC-008 | Rate limiting enforced at API Gateway |
| NFR-SEC-011 | `audit_log` append-only enforced at Firestore Security Rules level |
| NFR-SEC-012 | Docker images scanned with Trivy in CI — HIGH/CRITICAL CVEs block deployment |

---

## Out of Scope (v1.0)

- OAuth / social login (Google, GitHub) — Firebase password auth only
- Course ratings or reviews
- Student-to-student or student-to-admin messaging
- Video hosting — YouTube embed IDs only; no video upload
- Payment processing or course pricing
- Course certificates on completion
- Multi-language / i18n support
- Mobile push opt-in management UI — FCM token stored but no preference management API in v1
- Real-time updates (WebSockets / SSE) — polling only
- Kafka or Google Pub/Sub — Firestore outbox pattern used for v1 event bus

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*  
*Paired with Backend Blueprint v1.0.0 and API Document v1.0.0*
