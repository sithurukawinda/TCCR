# CMP Backend — Project Summary

**Course Management Portal** (`slp-backend`)  
**Organisation:** Future CX Lanka (Pvt) Ltd  
**Version:** 1.0.0

---

## Overview

A production-ready REST API backend for managing online courses. Students register and await admin approval, admins create and publish courses, students enroll and track progress, files are attached to subjects, and every action is audited. Built as a microservice monorepo on Node.js + TypeScript + Firebase.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 |
| Language | TypeScript 5 |
| Framework | Express 4 |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| File Storage | Firebase Cloud Storage |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Email | SendGrid |
| Logging | Pino |
| Validation | Zod |
| Testing | Jest + Supertest |
| Tracing | OpenTelemetry |
| Containers | Docker + Docker Compose |
| Orchestration | Kubernetes + HPA |
| CI/CD | GitHub Actions |

---

## Architecture — 10 Microservices

```
Client
  │
  ▼
Gateway :3000           ← single entry point, rate limiting, CORS, proxy
  │
  ├── Auth Service         :3001
  ├── User Service         :3002
  ├── Course Service       :3003
  ├── Enrollment Service   :3004
  ├── Progress Service     :3005
  ├── Storage Service      :3006
  ├── Notification Service :3007
  ├── Audit Service        :3008
  └── Outbox Worker        (no port — background polling every 5s)
```

Each service follows **Clean Architecture** with a strict one-way dependency chain:

```
http/  →  application/  →  domain/  →  infrastructure/
```

No service reads another service's Firestore collection directly — all cross-service calls go through internal HTTP using a shared secret key (`X-Internal-Service-Key`).

---

## Service Breakdown

### 1. Gateway — `:3000`
Single entry point for all 53 public API endpoints. Strips the `/api/v1` prefix before forwarding to downstream services. Blocks all `/api/v1/internal/*` paths — internal routes are never reachable from outside.

- Helmet security headers
- CORS allowlist
- UUID request ID propagation (`X-Request-Id`)
- Rate limits: 200 req/min globally · 10 req/min on `/auth/*`

### 2. Auth Service — `:3001`
Handles user registration and session management. Login is handled client-side by Firebase — there is no `/auth/login` endpoint.

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | Creates Firebase Auth user + Firestore user doc + outbox event + enrollment registration |
| `POST /auth/logout` | Revokes Firebase refresh tokens |
| `POST /auth/password-reset` | Sends reset email (never reveals if email exists) |
| `POST /auth/track-failure` | Tracks failed logins; locks account after 10 attempts in 15 min |

### 3. User Service — `:3002`
User profile management and admin account lifecycle.

- Students: get/update own profile, change password
- Admins: list/view users, suspend/reactivate student accounts
- Super Admins: create/manage/delete admin accounts
- Internal: email uniqueness check, account approval, list admin UIDs

### 4. Course Service — `:3003`
Full course lifecycle management with a hierarchical content structure.

```
Course → Semesters → Subjects
```

**Course state machine:**
```
DRAFT → publish() → PUBLISHED → archive() → ARCHIVED
         ← unpublish() ←
```

- `publish()` requires ≥1 semester and every semester has ≥1 subject
- `GET /courses` is public — students see only PUBLISHED, admins see all states
- YouTube video ID validation (11-char `[A-Za-z0-9_-]`) on subjects
- Soft deletes on courses, semesters, and subjects (30-day recoverable)

### 5. Enrollment Service — `:3004`
Manages two separate domain flows:

**Registration** — one-time account approval:
```
pending → approve() → approved
        → reject()  → rejected
```

**Enrollment** — per-course access after account approval:
```
pending → approve()  → approved → withdraw() → withdrawn
        → reject()   → rejected
```

- Bulk approve registrations (up to 100 at once)
- Configurable cooloff period after rejection
- Verifies course is PUBLISHED before allowing enrollment

### 6. Progress Service — `:3005`
Tracks student learning progress per subject and per course.

- `POST /progress/subjects/:id/complete` is **idempotent** — safe to call multiple times
- `completedAt` is immutable once set
- Course progress percentage: `Math.round(completed/total * 1000) / 10` → 1 decimal (e.g. 66.7%)
- Tracks `lastAccessedAt` separately from completion

### 7. Storage Service — `:3006`
Secure file attachment management for course subjects.

- Accepts PDF, DOC, DOCX only — max 25 MB
- Returns 15-minute signed download URLs (no direct public file access)
- Students can only download if enrolled in the course
- Verifies subject exists before accepting upload

### 8. Notification Service — `:3007`
Multi-channel notification delivery. Purely event-driven — never called directly by other services.

- **In-app:** stored in Firestore `notifications` collection
- **Email:** SendGrid with 3-retry exponential backoff (1s → 2s → 4s), never throws
- **Push:** Firebase FCM, best-effort, never throws

### 9. Audit Service — `:3008`
Append-only audit trail. No updates, no deletes — ever.

- Purely event-driven, receives all events from the outbox worker
- Only `super_admin` can query the audit log
- Firestore security rules deny all client-side writes

### 10. Outbox Worker — (no port)
Background process that guarantees domain events are never lost.

- Polls `outbox` Firestore collection every 5 seconds
- Max 5 delivery attempts per event; failed events stay as `status: "failed"`
- `Promise.allSettled` — one failure never blocks other events
- Dispatches 12 event types to notification-service and audit-service

---

## Event Routing Table

| Event | Handlers |
|-------|---------|
| `user.registered` | notify (admins), audit |
| `registration.approved` | user-service (approve account), notify, audit |
| `registration.rejected` | notify, audit |
| `enrollment.pending` | notify (admins), audit |
| `enrollment.approved` | notify, audit |
| `enrollment.rejected` | notify, audit |
| `enrollment.withdrawn` | audit |
| `course.published` | notify, audit |
| `progress.subjectCompleted` | audit |
| `admin.created` | audit |
| `admin.suspended` | notify, audit |
| `audit.action` | audit |

---

## API — 53 Public Endpoints

| Group | Count | Roles |
|-------|-------|-------|
| Auth | 4 | public |
| My Profile (`/me`) | 3 | any authenticated |
| Users (`/users`) | 4 | admin |
| Super Admin (`/super-admin`) | 6 | super_admin |
| Courses | 8 | public read / admin write |
| Semesters | 3 | admin |
| Subjects | 3 | admin |
| Registrations | 4 | admin |
| Enrollments | 6 | student + admin |
| Progress | 5 | student + admin |
| Attachments | 3 | admin upload·delete / student download |
| Notifications | 3 | any authenticated |
| Audit Log | 1 | super_admin |
| **Total** | **53** | |

All 53 endpoints verified passing via `node scripts/smoke-test.js`.

---

## Data Model — Firestore Collections

| Collection | Owning Service | Document ID |
|-----------|---------------|-------------|
| `users` | user-service | Firebase Auth UID |
| `loginAttempts` | auth-service | email address |
| `courses` | course-service | auto UUID |
| `courses/{id}/semesters` | course-service | auto UUID |
| `courses/{id}/semesters/{id}/subjects` | course-service | auto UUID |
| `registrations` | enrollment-service | studentUid |
| `enrollments` | enrollment-service | `${studentUid}_${courseId}` |
| `progress` | progress-service | `${studentUid}_${subjectId}` |
| `notifications` | notification-service | auto UUID |
| `audit_log` | audit-service | auto UUID (immutable) |
| `outbox` | all services (write) / worker (read) | auto UUID |

---

## Internal Service Communication

| Caller | Callee | Purpose |
|--------|--------|---------|
| auth-service | user-service | Email uniqueness check |
| auth-service | enrollment-service | Create registration record |
| enrollment-service | user-service | Update account status |
| enrollment-service | course-service | Verify course is PUBLISHED |
| progress-service | course-service | Get total subject count |
| storage-service | course-service | Verify subject exists |
| outbox-worker | user-service | Approve account on registration.approved |

---

## Security

- All authenticated routes: `authenticate()` → `verifyIdToken(checkRevoked=true)` → `authorize(...roles)`
- `super_admin` inherits all `admin` permissions
- Internal routes protected by `X-Internal-Service-Key` — blocked at gateway, never reachable externally
- Account lockout: 10 failed logins in 15 minutes → Firebase account disabled
- Firestore rules: `audit_log` and `outbox` deny all client writes; storage denies all direct client access
- Signed URLs for file downloads (15-minute expiry, Admin SDK only)
- Sensitive fields auto-redacted from all logs: `authorization`, `password`, `token`, `idToken`

---

## User Roles

| Role | Permissions |
|------|------------|
| `student` | Register · enroll in courses · track progress · download attachments · manage own notifications |
| `admin` | All student permissions + approve/reject accounts and enrollments · manage courses · upload files · view all users |
| `super_admin` | All admin permissions + create/delete admin accounts · view full audit log |

---

## Local Development

**Prerequisites:** Node.js 20+, Firebase CLI, Java (for emulators)

```bash
# Install dependencies
npm install

# Start everything — emulators + seed users + all 10 services
npm run dev:all

# Verify all 53 endpoints
node scripts/smoke-test.js

# Unit tests
npm run test

# Type-check + lint
npm run type-check && npm run lint
```

**Local URLs:**

| URL | What |
|-----|------|
| `http://localhost:3000` | API Gateway |
| `http://localhost:4000` | Firebase Emulator UI |

**Seed accounts (created automatically on startup):**

| Role | Email | Password | Status |
|------|-------|----------|--------|
| super_admin | `superadmin@cmp.com` | `SuperAdmin@123` | approved |
| admin | `admin@cmp.com` | `Admin@12345` | approved |
| student | `student1@cmp.com` | `Student1@123` | pending_approval |
| student | `student2@cmp.com` | `Student2@123` | approved |

**Postman:** Import `postman/CMP_Backend.postman_collection.json` + `postman/CMP_Local.postman_environment.json`

---

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Monorepo setup | ✅ Complete |
| 1 | Shared packages (9 packages) | ✅ Complete |
| 2 | API Gateway | ✅ Complete |
| 3 | Auth Service | ✅ Complete |
| 4 | User Service | ✅ Complete |
| 5 | Course Service | ✅ Complete |
| 6 | Enrollment Service | ✅ Complete |
| 7 | Progress Service | ✅ Complete |
| 8 | Storage Service | ✅ Complete |
| 9 | Notification Service | ✅ Complete |
| 10 | Audit Service | ✅ Complete |
| 11 | Outbox Worker | ✅ Complete |
| 12 | Firestore Indexes | ✅ Complete (deploy to prod pending) |
| 13 | CI/CD + Kubernetes | ✅ Complete |

---

## Remaining Before Production

1. Create a real Firebase project — enable Firestore, Authentication, and Storage
2. Generate a service account key and store as environment variables (never as a file)
3. Deploy Firestore indexes and security rules: `npx firebase deploy --only firestore`
4. Configure production environment variables in Kubernetes secrets
5. Deploy to Kubernetes cluster using manifests in `k8s/`

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*
