# Spec: Project Requirements

**Slug:** requirements  
**Scope:** Entire project — all services  
**Status:** Release Baseline  
**Date:** 2026-05-07  
**Organisation:** Future CX Lanka (Pvt) Ltd  
**Version:** 1.0.0

---

## 1. Functional Requirements

### FR-AUTH — Authentication

| ID | Requirement |
|----|-------------|
| FR-AUTH-001 | A visitor can register a student account with `firstName`, `lastName`, `email`, and `password`. Account is created in `PENDING_APPROVAL` state. |
| FR-AUTH-002 | Email must be unique across the platform. Duplicate email on registration returns `409 EMAIL_EXISTS`. |
| FR-AUTH-003 | Password must be minimum 10 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character. |
| FR-AUTH-004 | All authenticated routes verify the Firebase ID token with `checkRevoked=true` on every request. |
| FR-AUTH-005 | Firebase ID tokens expire after 1 hour. The client SDK refreshes them automatically — the server has no refresh endpoint. |
| FR-AUTH-006 | A logged-in user can log out by revoking their Firebase refresh tokens. Existing tokens are immediately rejected on all devices. |
| FR-AUTH-007 | Role-based access is enforced on every route via `authorize()` middleware with Firebase custom claims (`student`, `admin`, `super_admin`). |
| FR-AUTH-008 | After 10 failed login attempts within a 15-minute window, the account is automatically disabled. Reset only by an admin. |
| FR-AUTH-009 | A user can request a password reset email via `POST /auth/password-reset`. Firebase sends the email. |
| FR-AUTH-010 | Token revocation is checked on every request (`checkRevoked=true`). Revoked tokens return `401 TOKEN_REVOKED`. |

### FR-SADM — Super Admin

| ID | Requirement |
|----|-------------|
| FR-SADM-001 | Super Admin can create an admin account with `firstName`, `lastName`, `email`, `initialPassword`. Account is immediately `APPROVED`. |
| FR-SADM-002 | Super Admin can list all admin accounts (paginated, filterable). |
| FR-SADM-003 | Super Admin can suspend an admin — Firebase account disabled, refresh tokens revoked. |
| FR-SADM-004 | Super Admin can reactivate a suspended admin. |
| FR-SADM-005 | Super Admin can delete an admin — soft-delete with `deletedAt`, recoverable within 30 days. |
| FR-SADM-007 | Super Admin can query the audit log filtered by `actorUid`, `action`, `targetType`, `targetId`, and date range. |

### FR-ADM — Admin

| ID | Requirement |
|----|-------------|
| FR-ADM-002 | Admins can view a dashboard with platform statistics (user counts, pending registrations, course counts). |
| FR-ADM-007 | Admins can approve a student registration from the registration queue. |
| FR-ADM-008 | Admins can approve a student enrollment request from the enrollment queue. |
| FR-ADM-009 | Admins can list all users (paginated, filterable by `status` and `role`). |
| FR-ADM-011 | Admins can bulk-approve multiple student registrations in a single request using `Promise.allSettled`. Partial success is allowed. |

### FR-STU — Student

| ID | Requirement |
|----|-------------|
| FR-STU-001 | A student registration creates the account in `PENDING_APPROVAL` state. The student cannot enroll until approved. |
| FR-STU-005 | Students see only `PUBLISHED` courses in the catalog. `DRAFT` and `ARCHIVED` courses are hidden. |
| FR-STU-006 | Accessing a `DRAFT` course as a student returns `404 COURSE_NOT_FOUND`. |
| FR-STU-007 | An approved student can request enrollment in a published course. |
| FR-STU-011 | A student can mark a subject as complete. The operation is idempotent — `completedAt` never changes once set. |
| FR-STU-013 | Progress can be marked complete automatically (`source: 'auto'`) when a threshold is reached. |

### FR-CRS — Course Management

| ID | Requirement |
|----|-------------|
| FR-CRS-004 | A course can only be published if it has ≥ 1 semester and every semester has ≥ 1 subject. |
| FR-CRS-009 | YouTube video IDs are validated as exactly 11 alphanumeric characters (`[A-Za-z0-9_-]{11}`). |
| FR-CRS-010 | File attachments are restricted to PDF, DOC, DOCX with a maximum size of 25 MB. |
| FR-CRS-012 | Deleted courses, semesters, and subjects are soft-deleted with `deletedAt`. Recoverable within 30 days. |

### FR-ENR — Enrollment

| ID | Requirement |
|----|-------------|
| FR-ENR-001 | Admins can view all pending student registrations filtered by `status`. |
| FR-ENR-002 | Approving a registration notifies the student via in-app notification and email. |
| FR-ENR-004 | A student can have at most one `PENDING` enrollment per course at a time. |
| FR-ENR-008 | A rejected student cannot re-enroll for `ENROLLMENT_REJECTION_COOLOFF_HOURS` (default 24 h). |

### FR-LRN — Learning & Progress

| ID | Requirement |
|----|-------------|
| FR-LRN-001 | Each subject has a progress record per student with `state` (`not_started`, `in_progress`, `completed`), `source`, `completedAt`, and `lastAccessedAt`. |
| FR-LRN-004 | Course progress aggregate is recomputed on every progress event. `completionPercent` is rounded to 1 decimal place. |
| FR-LRN-007 | `lastAccessedAt` is updated when a student accesses a subject — supports "resume where you left off". |
| FR-LRN-008 | Marking a subject complete is idempotent — a second call returns the existing record unchanged. |
| FR-LRN-009 | Admins can reset all progress for a (student, course) pair via an internal endpoint. The action is audited. |

### FR-NOT — Notifications

| ID | Requirement |
|----|-------------|
| FR-NOT-001 | Students can list their own notifications (paginated). |
| FR-NOT-002 | Students receive in-app + email notifications when their registration is approved or rejected. |
| FR-NOT-003 | Students receive in-app + email + optional push notifications when their enrollment is approved or rejected. |
| FR-NOT-006 | Users can mark individual notifications as read or mark all as read. |
| FR-NOT-009 | Email delivery retries up to 3 times with exponential backoff (1 s, 2 s, 4 s). Permanent failure is logged — it never blocks the API response. |

---

## 2. Non-Functional Requirements

### NFR-SEC — Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-001 | TLS 1.2+ enforced at the load balancer. HSTS header included in gateway responses. |
| NFR-SEC-002 | `authenticate()` middleware with `checkRevoked=true` on every authenticated endpoint. |
| NFR-SEC-003 | `authorize()` per route + `mustBeOwnerOrAdmin()` ownership guard on user-owned resources. |
| NFR-SEC-004 | `Authorization` header, `password`, `token`, and `idToken` fields are redacted from all structured logs. |
| NFR-SEC-007 | Typed Firestore SDK queries only. No raw string path interpolation in queries. |
| NFR-SEC-008 | Rate limiting: 10 req/min per IP for auth endpoints; 200 req/min per IP for all others. |
| NFR-SEC-009 | CORS origin allowlist — wildcard (`*`) is never used in production. |
| NFR-SEC-011 | `audit_log` collection is append-only. Firestore Security Rules deny client-side updates and deletes. |
| NFR-SEC-012 | Docker images scanned with Trivy in CI. HIGH or CRITICAL CVEs block deployment. |

### NFR-SCL — Scalability

| ID | Requirement |
|----|-------------|
| NFR-SCL-001 | All services are stateless — no per-request state in process memory. Identity conveyed by Firebase ID token. |
| NFR-SCL-002 | Horizontal autoscaling via Kubernetes HPA: min 2 replicas, max 10, CPU trigger at 70%. |
| NFR-SCL-003 | L7 load balancer terminates TLS and distributes traffic round-robin to healthy pods. |
| NFR-SCL-004 | Firestore composite document IDs avoid hot-spot writes (no monotonic counters on indexed fields). |
| NFR-SCL-006 | Notification and audit writes are decoupled from the API response via the outbox worker. |
| NFR-SCL-007 | Graceful shutdown: `preStop` hook + `terminationGracePeriodSeconds: 30`. |

### NFR-AVL — Availability

| ID | Requirement |
|----|-------------|
| NFR-AVL-001 | Multi-replica deployments via Kubernetes HPA. Health probes prevent traffic to unhealthy pods. |
| NFR-AVL-002 | Every service exposes `/healthz` (liveness — process alive) and `/readyz` (readiness — Firestore reachable). |
| NFR-AVL-003 | Push and email delivery failures never block or delay the API response. |
| NFR-AVL-004 | Scheduled Firestore exports to Cloud Storage. RPO: 24 hours. RTO: 4 hours. |
| NFR-AVL-006 | Global error handler sanitises all 5xx responses. Stack traces are never sent to clients. |
| NFR-AVL-008 | Structured logs (Pino), distributed traces (OpenTelemetry → Google Cloud Trace), and Prometheus metrics emitted by every service. |

### NFR-PRF — Performance

| ID | Requirement |
|----|-------------|
| NFR-PRF-007 | All list endpoints use cursor-based pagination (default 20, max 100). No offset pagination. |
| NFR-PRF-008 | Stateless pods + HPA enable sustained throughput of ≥ 500 req/s per pod. |
| NFR-PRF-009 | p95 read latency must remain ≤ 600 ms under normal load. Alert fires if exceeded for 5-min rolling window. |

---

## 3. Architectural Constraints

| Constraint | Specification |
|-----------|--------------|
| Runtime | Node.js LTS >= 20.x, TypeScript 5.x |
| Framework | Express.js 4.x per service |
| Database | Google Cloud Firestore (Native mode) via Firebase Admin SDK 12.x |
| Identity | Firebase Authentication — token verification only, no server-side sessions |
| Storage | Firebase Cloud Storage |
| Push | Firebase Cloud Messaging (FCM) |
| API contract | REST + JSON, versioned at `/api/v1`, documented in `API_Document.md` |
| Auth model | Stateless — Firebase ID token on every request |
| Authorisation | Middleware tier owns ALL authorisation. Firestore Security Rules are defence-in-depth only |
| Service isolation | Each service owns its own Firestore collections. No cross-service direct DB reads |
| Event delivery | Transactional outbox pattern (Firestore). No Kafka or Pub/Sub in v1.0 |

---

## 4. SRS Requirement Traceability

| SRS ID | Service | Implementation pointer |
|--------|---------|----------------------|
| FR-AUTH-001 | auth-service | `POST /auth/register` → `RegisterUseCase` |
| FR-AUTH-004 | All services | `authenticate()` shared middleware |
| FR-AUTH-008 | auth-service | `TrackLoginAttemptsUseCase` |
| FR-SADM-001 | user-service | `POST /super-admin/admins` → `CreateAdminUseCase` |
| FR-CRS-004 | course-service | `PublishCourseUseCase` validates semesters + subjects |
| FR-CRS-009 | course-service | `YouTubeVideoId` value object |
| FR-CRS-010 | storage-service | `attachmentValidator` multer middleware |
| FR-CRS-012 | course-service | `softDelete()` repository method |
| FR-ENR-004 | enrollment-service | Duplicate PENDING check in `CreateEnrollmentUseCase` |
| FR-ENR-008 | enrollment-service | `ENROLLMENT_REJECTION_COOLOFF_HOURS` env var |
| FR-LRN-008 | progress-service | `MarkSubjectCompleteUseCase` idempotency guard |
| FR-NOT-009 | notification-service | `NotificationDispatcher` exponential backoff |
| NFR-SEC-011 | audit-service | Firestore Security Rules — append-only `audit_log` |
| NFR-SCL-002 | Kubernetes | HPA per service deployment |

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*  
*Paired with Backend Blueprint v1.0.0 · API Document v1.0.0*
