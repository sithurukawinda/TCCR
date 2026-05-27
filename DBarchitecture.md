# TCCR — Database Architecture

> **Engine:** Google Cloud Firestore (NoSQL Document DB)
> **Pattern:** Per-service collection ownership · Outbox for consistency · No cross-service direct reads
> **Generated:** 2026-05-27

---

## Table of Contents

1. [Overall Architecture Map](#1-overall-architecture-map)
2. [Collection Relationships](#2-collection-relationships)
3. [Document ID Strategy](#3-document-id-strategy)
4. [State Machines](#4-state-machines)
5. [Event Flow (Outbox Pattern)](#5-event-flow-outbox-pattern)
6. [Composite Index Strategy](#6-composite-index-strategy-43-indexes)
7. [Security Rules Architecture](#7-security-rules-architecture)
8. [Request Flow Architecture](#8-request-flow-architecture)
9. [Data Consistency Strategy](#9-data-consistency-strategy)
10. [Full Collection Schema](#10-full-collection-schema)
11. [Quick Stats](#11-quick-stats)

---

## 1. Overall Architecture Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FIRESTORE DATABASE                               │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ auth-service │  │ user-service │  │course-service│                  │
│  │              │  │              │  │              │                  │
│  │loginAttempts │  │    users     │  │   courses    │                  │
│  │emailVerifOtps│  │              │  │  └semesters  │                  │
│  │passwordReset │  │              │  │    └subjects │                  │
│  │    Otps      │  │              │  │  └batches(V2)│                  │
│  └──────────────┘  └──────────────┘  │   lessons    │                  │
│                                       └──────────────┘                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ enrollment   │  │  progress    │  │  storage     │                  │
│  │  -service    │  │  -service    │  │  -service    │                  │
│  │              │  │              │  │              │                  │
│  │registrations │  │   progress   │  │ attachments  │                  │
│  │ enrollments  │  │              │  │              │                  │
│  │role_requests │  │              │  │              │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │notification  │  │    audit     │  │    cell      │  │ analytics  │ │
│  │  -service    │  │  -service    │  │  -service    │  │  -service  │ │
│  │              │  │              │  │  (V2)        │  │   (V2)     │ │
│  │notifications │  │  audit_log   │  │ cell_groups  │  │ analytics  │ │
│  │              │  │              │  │ └join_reqs   │  │ _snapshots │ │
│  │              │  │              │  │ └cell_reports│  │            │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │          outbox  (ALL services write → outbox-worker reads)      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Collection Relationships

```
users ────────────────────────────────────────────────────────────┐
  │ (uid)                                                          │
  ├──→ loginAttempts          (auth: failed sign-ins by email)    │
  ├──→ emailVerificationOtps  (auth: 6-digit OTP by email)        │
  ├──→ passwordResetOtps      (auth: 6-digit OTP by email)        │
  ├──→ registrations          (enrollment: V1 legacy, id=uid)     │
  ├──→ enrollments            (enrollment: id=uid_courseId)        │
  ├──→ role_requests          (enrollment V2: requesterUid)        │
  ├──→ progress               (progress: id=uid_subjectId)         │
  ├──→ notifications          (notification: userUid)              │
  ├──→ cell_groups            (cell: leaderUid / g12LeaderUid)     │
  ├──→ cell_groups/join_reqs  (cell: requesterUid)                 │
  ├──→ cell_groups/cell_rpts  (cell: filledByUid)                  │
  └──→ audit_log              (audit: actorUid)                    │
                                                                   │
courses ───────────────────────────────────────────────────────┐  │
  │ (id)                                                        │  │
  ├──→ courses/semesters      (sub-collection)                  │  │
  │     └──→ semesters/subjects  (sub-sub-collection)           │  │
  │                                                             │  │
  ├──→ courses/batches        (V2 sub-collection)               │  │
  ├──→ lessons                (flat collection, courseId FK)    │  │
  ├──→ enrollments            (courseId FK)                     │  │
  └──→ progress               (courseId FK)            ─────────┘  │
                                                                    │
attachments ──→ lessons        (attachmentIds[] FK)                 │
                                                                    │
outbox ──→ (all events from all services)                           │
  └──→ outbox-worker dispatches to:                                 │
        ├── notification-service  /internal/events                  │
        ├── audit-service         /internal/events                  │
        └── user-service          /internal/users/approve           │
                                  /internal/users/remove-role       │
                                  /internal/users/add-role     ─────┘
```

---

## 3. Document ID Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│  ID Strategy              Collections                           │
├─────────────────────────────────────────────────────────────────┤
│  Firebase Auth UID        users, registrations                  │
│  (same as the user)                                             │
├─────────────────────────────────────────────────────────────────┤
│  Email Address            loginAttempts                         │
│  (natural key)            emailVerificationOtps                 │
│                           passwordResetOtps                     │
├─────────────────────────────────────────────────────────────────┤
│  Composite Key            enrollments  →  {studentUid}_{courseId}│
│  (prevents duplicates)    progress     →  {studentUid}_{subjectId}│
├─────────────────────────────────────────────────────────────────┤
│  Auto UUID                courses, semesters, subjects, lessons  │
│  (random)                 batches, role_requests, notifications  │
│                           attachments, audit_log, outbox        │
│                           cell_groups, join_requests             │
│                           cell_reports, analytics_snapshots     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. State Machines

```
COURSE                              BATCH (V2)
──────                              ──────────
DRAFT ──publish()──→ PUBLISHED      DRAFT ──open()──→ OPEN ──close()──→ CLOSED
  ↑                    │            (auto-opens if scheduledOpenAt is in the past)
  └──restore()──  ARCHIVED ←──archive()


ENROLLMENT                          REGISTRATION (V1 Legacy)
──────────                          ────────────────────────
PENDING ──approve()──→ APPROVED     PENDING ──approve()──→ APPROVED
   │                                   │
   ├──reject()──→ REJECTED              └──reject()──→ REJECTED
   │
   └──withdraw()──→ WITHDRAWN
  (APPROVED also withdrawable)


ROLE REQUEST (V2)                   CELL GROUP (V2)
─────────────────                   ───────────────
PENDING ──approve()──→ APPROVED     ACTIVE ──archive()──→ ARCHIVED
   │                                (archived cells cannot be deleted)
   └──reject()──→ REJECTED


JOIN REQUEST (V2)                   PROGRESS
─────────────────                   ────────
PENDING ──approve()──→ APPROVED     NOT_STARTED → IN_PROGRESS → COMPLETED
   │                                (idempotent — completedAt immutable once set)
   └──reject()──→ REJECTED
```

---

## 5. Event Flow (Outbox Pattern)

```
Service writes primary data + outbox entry in ONE atomic Firestore batch
                     │
                     ▼
              ┌─────────────┐
              │    outbox   │  status: pending
              │  collection │  (Firestore)
              └─────────────┘
                     │  ← polled every 5 seconds by outbox-worker
                     ▼
            ┌──────────────────┐
            │  outbox-worker   │  max 5 retries
            │ EventDispatcher  │  pending → processing → delivered / failed
            └──────────────────┘
                     │
       ┌─────────────┼──────────────┐
       ▼             ▼              ▼
  notify-svc    audit-svc       user-svc
 (in-app +     (append-only    (approve /
  email +       audit_log)      remove-role /
  push)                         add-role)
```

### Event Routing Table

| Event | → notify-svc | → audit-svc | → user-svc | Notes |
|-------|:---:|:---:|:---:|-------|
| `user.registered` | ✅ | ✅ | | Welcome email + in-app to admins |
| `registration.approved` | ✅ | ✅ | ✅ approve | Updates user status |
| `registration.rejected` | ✅ | ✅ | | |
| `enrollment.pending` | ✅ | ✅ | | |
| `enrollment.approved` | ✅ | ✅ | | Rich HTML email with course name |
| `enrollment.rejected` | ✅ | ✅ | | Rejection reason included |
| `enrollment.withdrawn` | | ✅ | | |
| `course.published` | ✅ (drop) | ✅ | | No handler — silently dropped ⚠️ |
| `progress.subjectCompleted` | | ✅ | | |
| `admin.created` | ✅ | ✅ | | 3 branches: promoted / leader+g12 / admin |
| `admin.suspended` | ✅ | ✅ | | |
| `role.granted` | ✅ | ✅ | | In-app + approval email |
| `role.requested` | ─ skip | ─ skip | | **Known gap** — not wired ⚠️ |
| `audit.action` | | ✅ | | Generic audit escape hatch |
| `cell.created` | | ✅ | | |
| `cell.join_requested` | ✅ | ✅ | | Notifies cell leader |
| `cell.join_approved` | ✅ | ✅ | | Notifies requesting member |
| `cell.join_rejected` | ✅ | ✅ | | Notifies requesting member |
| `cell_report.filed` | ✅ | ✅ | | Notifies G12 leader |
| `cell_report.voided` | | ✅ | | |
| `cell.ownership_transferred` | ✅ | ✅ | ✅ remove-role | Auto-demotes previous owner if self-initiated |

> ⚠️ **Known Gaps:** `role.requested` is published but not dispatched. `course.published` reaches notify-svc but has no handler — students are not notified when a course publishes.

---

## 6. Composite Index Strategy (43 Indexes)

| Collection | Index Fields | Purpose |
|------------|-------------|---------|
| `users` | `deletedAt` ASC + `createdAt` DESC | Default user list |
| `users` | `deletedAt` ASC + `firstName` ASC | Name prefix search |
| `users` | `deletedAt` ASC + `status` ASC + `firstName` ASC | Filter by status |
| `users` | `deletedAt` ASC + `role` ASC + `createdAt` DESC | Filter by role |
| `users` | `deletedAt` ASC + `role` ASC + `firstName` ASC | Role + name search |
| `users` | `deletedAt` ASC + `role` ASC + `status` ASC + `firstName` ASC | Full combo filter |
| `users` | `deletedAt` ASC + `status` ASC + `createdAt` DESC | Status sorted list |
| `users` | `deletedAt` ASC + `role` ASC + `status` ASC + `createdAt` DESC | Full combo + date |
| `courses` | `deletedAt` ASC + `createdAt` DESC | Default course list |
| `courses` | `deletedAt` ASC + `title` ASC | Title prefix search |
| `courses` | `deletedAt` ASC + `state` ASC + `createdAt` DESC | State filtered list |
| `courses` | `deletedAt` ASC + `state` ASC + `title` ASC | State + title search |
| `courses` | `state` ASC + `deletedAt` ASC + `publishedAt` DESC | Published date sort |
| `semesters` | `courseId` ASC + `deletedAt` ASC + `order` ASC | Ordered by course |
| `subjects` | `semesterId` ASC + `deletedAt` ASC + `order` ASC | Ordered by semester |
| `subjects` | `courseId` ASC + `deletedAt` ASC | By course |
| `lessons` | `subjectId` ASC + `deletedAt` ASC + `order` ASC | Ordered by subject |
| `registrations` | `state` ASC + `createdAt` ASC | Admin approval queue |
| `enrollments` | `studentUid` ASC + `createdAt` DESC | My enrollments |
| `enrollments` | `studentUid` ASC + `state` ASC + `createdAt` DESC | My filtered enroll |
| `enrollments` | `state` ASC + `createdAt` ASC | Admin queue |
| `enrollments` | `state` ASC + `courseId` ASC + `createdAt` ASC | Per-course queue |
| `role_requests` | `status` ASC + `createdAt` DESC | Admin queue |
| `role_requests` | `requesterUid` ASC + `createdAt` DESC | My requests |
| `progress` | `studentUid` ASC + `courseId` ASC + `state` ASC | Course progress |
| `progress` | `courseId` ASC + `studentUid` ASC | Course analytics |
| `notifications` | `userUid` ASC + `createdAt` DESC | My notifications |
| `notifications` | `userUid` ASC + `read` ASC + `createdAt` DESC | Unread filter |
| `audit_log` | `actorUid` ASC + `createdAt` DESC | Per-user timeline |
| `audit_log` | `action` ASC + `createdAt` DESC | By action type |
| `audit_log` | `category` ASC + `createdAt` DESC | By category |
| `outbox` | `status` ASC + `createdAt` ASC | Worker poll queue |
| `batches` | `courseId` ASC + `createdAt` ASC | Batches by course |
| `analytics_snapshots` | `scope` ASC + `periodKey` ASC | Dashboard (asc) |
| `analytics_snapshots` | `scope` ASC + `periodKey` DESC | Dashboard (desc) |
| `cell_groups` | `state` + `createdAt` DESC | Active/archived list |
| `cell_groups` | `type` + `createdAt` DESC | By cell type |
| `cell_groups` | `area` + `createdAt` DESC | By area |
| `cell_groups` | `leaderUid` + `createdAt` DESC | Leader's cells |
| `cell_groups` | `state` + `type` + `area` + `leaderUid` + `createdAt` | Full combo filter |
| `join_requests` *(coll-group)* | `status` ASC + `createdAt` DESC | Admin queue |
| `join_requests` *(coll-group)* | `requestedBy` ASC + `createdAt` DESC | By requester |
| `cell_reports` *(coll-group)* | `voided` ASC + `date` DESC | Report timeline |

> **Note:** `cell_groups` has 12 composite indexes total covering all filter combinations of `state`, `type`, `area`, and `leaderUid`.

---

## 7. Security Rules Architecture

```
CLIENT ACCESS MATRIX (Firestore Security Rules)
ALL WRITES come exclusively from backend services via Firebase Admin SDK.
Client SDK has ZERO write access to any collection.
──────────────────────────────────────────────────────────────────────
Collection                Read Access               Write Access
──────────────────────────────────────────────────────────────────────
users/{uid}               owner OR admin            ❌ backend only
courses                   published+active OR admin  ❌ backend only
semesters                 admin only                ❌ backend only
subjects                  authenticated             ❌ backend only
lessons                   authenticated             ❌ backend only
attachments               authenticated             ❌ backend only
batches                   authenticated             ❌ backend only
registrations             admin only                ❌ backend only
enrollments               owner OR admin            ❌ backend only
role_requests             requester OR admin        ❌ backend only
progress                  owner OR admin            ❌ backend only
notifications             owner only                ❌ backend only
cell_groups               authenticated             ❌ backend only
join_requests             admin only                ❌ backend only
cell_reports              authenticated             ❌ backend only
analytics_snapshots       leader / g12 / admin      ❌ backend only
loginAttempts             ❌ internal only           ❌ backend only
emailVerificationOtps     ❌ internal only           ❌ backend only
passwordResetOtps         ❌ internal only           ❌ backend only
outbox                    ❌ internal only           ❌ backend only
audit_log                 super_admin only           ❌ backend only
──────────────────────────────────────────────────────────────────────
```

### Helper Functions in `firestore.rules`

| Function | Description |
|----------|-------------|
| `isAuthenticated()` | User is signed in |
| `isAdmin()` | Role is `admin` or `super_admin` |
| `isSuperAdmin()` | Role is `super_admin` only |
| `isOwner(uid)` | Caller's UID matches the target UID |
| `hasRole(role)` | Scalar role claim check (V1) |
| `hasRoleV2(role)` | Scalar + roles-array check (V2) |
| `isLeaderOrAbove()` | `leader`, `g12`, `admin`, or `super_admin` |

---

## 8. Request Flow Architecture

```
CLIENT
  │
  ▼
GATEWAY :3000
  │  ← strips /api/v1 prefix before proxying
  │  ← applies CORS, rate limit (200 req/min general / 10 req/min auth), requestId
  │  ← blocks ALL /internal/* with 404
  │
  ├── /api/v1/auth/*                      → auth-service        :3001
  ├── /api/v1/me/notifications/preferences → user-service        :3002
  ├── /api/v1/me/notifications             → notification-svc    :3007
  ├── /api/v1/me/enrollments              → enrollment-svc      :3004
  ├── /api/v1/me/progress                 → progress-svc        :3005
  ├── /api/v1/me/*                        → user-service        :3002
  ├── /api/v1/users/:uid/audit-log        → audit-svc           :3008
  ├── /api/v1/users/*                     → user-service        :3002
  ├── /api/v1/super-admin/*               → user-service        :3002
  ├── /api/v1/courses/:id/enroll          → enrollment-svc      :3004
  ├── /api/v1/courses/*                   → course-service      :3003
  ├── /api/v1/semesters/*                 → course-service      :3003
  ├── /api/v1/subjects/:id/lessons        → course-service      :3003
  ├── /api/v1/subjects/:id/attachments    → storage-svc         :3006
  ├── /api/v1/subjects/:id/images         → storage-svc         :3006
  ├── /api/v1/subjects/*                  → course-service      :3003
  ├── /api/v1/lessons/*                   → course-service      :3003
  ├── /api/v1/role-requests/*             → enrollment-svc      :3004  (V2)
  ├── /api/v1/batches/*                   → course-service      :3003  (V2)
  ├── /api/v1/enrollments/*               → enrollment-svc      :3004
  ├── /api/v1/admin/registrations/*       → enrollment-svc      :3004
  ├── /api/v1/admin/enrollments/*         → enrollment-svc      :3004
  ├── /api/v1/progress/*                  → progress-svc        :3005
  ├── /api/v1/admin/progress/*            → progress-svc        :3005
  ├── /api/v1/attachments/*               → storage-svc         :3006
  ├── /api/v1/audit-log/*                 → audit-svc           :3008
  ├── /api/v1/cells/*                     → cell-svc            :3009  (V2)
  └── /api/v1/analytics/*                 → analytics-svc       :3011  (V2)

INTERNAL (never exposed through gateway):
  outbox-worker  → polls outbox every 5s                  (no HTTP port)
  scheduled-jobs → batch/semester/snapshot sweeps         (no HTTP port)
```

### Cross-Service Internal HTTP Calls

| Caller | → Callee | Route | Purpose |
|--------|----------|-------|---------|
| auth-service | user-service | `GET /internal/users/by-email` | Email uniqueness on register |
| auth-service | enrollment-service | `POST /internal/registrations` | Create registration (fire-and-forget) |
| enrollment-service | user-service | `PATCH /internal/users/:uid/status` | Update status on approve/reject |
| enrollment-service | course-service | `GET /internal/courses/:id` | Verify course is PUBLISHED |
| enrollment-service | user-service | `POST /internal/users/add-role` | Grant role on role-request approval |
| enrollment-service | user-service | `GET /internal/users/:uid` | Enrich outbox payload (fire-and-forget) |
| progress-service | course-service | `GET /internal/subjects/count` | Total subject count for % calc |
| storage-service | course-service | `GET /internal/subjects/:id` | Verify subject exists before upload |
| user-service | auth-service | `POST /internal/auth/verify-token` | Verify federated token on provider link |
| outbox-worker | user-service | `POST /internal/users/approve` | Approve user on `registration.approved` |
| outbox-worker | user-service | `POST /internal/users/remove-role` | Demote previous owner on ownership transfer |

---

## 9. Data Consistency Strategy

### Atomic Operations (Firestore `WriteBatch`)

| Operation | What's Batched Together |
|-----------|------------------------|
| Any domain event | Primary document write + `outbox` entry |
| Create semester | New semester doc + `course.semesterCount` increment |
| Delete semester | Remove semester doc + `course.semesterCount` decrement |
| Create subject | New subject doc + `semester.subjectCount` increment |
| Delete subject | Remove subject doc + `semester.subjectCount` decrement |
| Cell membership change | Member update + `cell_groups.memberCount` update |

### Soft Deletes vs Hard Deletes

| Collection | Delete Type | Recovery |
|------------|------------|---------|
| `courses` | Soft (`deletedAt`) | ✅ 30-day window |
| `semesters` | Soft (`deletedAt`) | ✅ 30-day window |
| `subjects` | Soft (`deletedAt`) | ✅ 30-day window |
| `lessons` | Soft (`deletedAt`) | ✅ 30-day window |
| `users` (admin accounts) | Soft (`deletedAt`) via `DELETE /super-admin/admins/:uid` | ✅ Recoverable |
| `users` (regular users) | Hard delete via `DELETE /users/:uid` | ❌ Irreversible |
| `cell_groups` | Hard delete via `DELETE /cells/:id` | ❌ Irreversible |
| All others | Hard delete | ❌ Irreversible |

### Idempotency Guarantees

| Collection | Idempotency Mechanism |
|------------|----------------------|
| `enrollments` | Composite doc ID `{studentUid}_{courseId}` — duplicate enroll impossible |
| `progress` | Composite doc ID `{studentUid}_{subjectId}` — `completedAt` immutable once set |
| `cell_reports` | `clientReqId` unique composite index — duplicate report returns existing |
| `fcmTokens` | Firestore `arrayUnion` — duplicate tokens never stored |
| `progress.state` | `MarkSubjectCompleteUseCase` returns existing record if already completed |

### Consistency Levels

| Pattern | Used For | Guarantee |
|---------|----------|-----------|
| Atomic `WriteBatch` | Primary writes + outbox | Strong consistency |
| Outbox + worker | Notifications, audit, role grants | Eventual consistency (≤5s typical) |
| Denormalized counters | semesterCount, subjectCount, memberCount, reportCount | Maintained synchronously by use cases |
| In-process `TtlCache` | Course list (30s), user list (30s), audit list (60s) | Stale reads possible within TTL |

---

## 10. Full Collection Schema

### `users`
**Service:** user-service · **ID:** Firebase Auth UID · **Soft Delete:** `deletedAt`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `uid` | `string` | ✅ | Firebase Auth UID (PK) |
| `email` | `string` | ✅ | Unique across system |
| `firstName` | `string` | ✅ | |
| `lastName` | `string` | ✅ | |
| `role` | `'member' \| 'student' \| 'leader' \| 'g12' \| 'admin' \| 'super_admin'` | ✅ | V1 scalar — kept for backwards compat |
| `roles` | `string[]` | ✅ | V2 mutable array used for authorization |
| `status` | `'pending_approval' \| 'approved' \| 'rejected' \| 'suspended'` | ✅ | |
| `profilePhotoUrl` | `string \| null` | ➖ | Firebase Storage URL |
| `phoneNumber` | `string \| null` | ➖ | |
| `preferredLanguage` | `'en' \| 'si' \| 'ta'` | ➖ | Defaults `'en'` |
| `fcmTokens` | `string[]` | ➖ | Device push tokens |
| `notificationPreferences` | `{ email: boolean; push: boolean }` | ➖ | Defaults both `true` |
| `providers` | `string[]` | ➖ | e.g. `['password', 'google.com']` |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `updatedAt` | `string` | ✅ | ISO 8601 |
| `deletedAt` | `string \| null` | ➖ | `null` = active |

---

### `loginAttempts`
**Service:** auth-service · **ID:** email address

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `email` | `string` | ✅ | PK (unique by email) |
| `attempts` | `number` | ✅ | Failed sign-in count |
| `windowStart` | `string` | ✅ | ISO 8601 — 15-min window start |

> Locks after **10 failures** in 15 minutes. Clears automatically after window expires.

---

### `emailVerificationOtps`
**Service:** auth-service · **ID:** email address

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `email` | `string` | ✅ | PK |
| `uid` | `string` | ✅ | Associated user UID |
| `otp` | `string` | ✅ | 6-digit OTP |
| `expiresAt` | `string` | ✅ | ISO 8601 — 15-min TTL |
| `attempts` | `number` | ✅ | Failed attempts counter (max 5) |

---

### `passwordResetOtps`
**Service:** auth-service · **ID:** email address

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `email` | `string` | ✅ | PK |
| `otp` | `string` | ✅ | 6-digit OTP |
| `expiresAt` | `string` | ✅ | ISO 8601 — 15-min TTL |
| `attempts` | `number` | ✅ | Max 5 attempts |

---

### `courses`
**Service:** course-service · **ID:** auto UUID · **Soft Delete:** `deletedAt`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `title` | `string` | ✅ | |
| `description` | `string` | ✅ | Max 500 chars, default `""` |
| `coverImageUrl` | `string \| null` | ➖ | Firebase Storage URL |
| `state` | `'draft' \| 'published' \| 'archived'` | ✅ | State machine |
| `createdBy` | `string` | ✅ | Creator UID |
| `semesterCount` | `number` | ✅ | Denormalized — maintained by use cases |
| `publishedAt` | `string \| null` | ➖ | ISO 8601 |
| `deletedAt` | `string \| null` | ➖ | |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `updatedAt` | `string` | ✅ | ISO 8601 |

---

### `courses/{id}/semesters`
**Service:** course-service · **ID:** auto UUID · **Soft Delete:** `deletedAt`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `courseId` | `string` | ✅ | Parent course UID |
| `title` | `string` | ✅ | |
| `subjectCount` | `number` | ✅ | Denormalized count |
| `order` | `number` | ✅ | Display order (gaps allowed after deletion) |
| `openDate` | `string \| null` | ➖ | ISO 8601 |
| `endDate` | `string \| null` | ➖ | ISO 8601 |
| `status` | `'active' \| 'disabled'` | ➖ | Defaults `'active'` |
| `deletedAt` | `string \| null` | ➖ | |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `updatedAt` | `string` | ✅ | ISO 8601 |

---

### `courses/{id}/semesters/{id}/subjects`
**Service:** course-service · **ID:** auto UUID · **Soft Delete:** `deletedAt`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `semesterId` | `string` | ✅ | Parent semester UID |
| `courseId` | `string` | ✅ | Grandparent course UID |
| `title` | `string` | ✅ | |
| `order` | `number` | ✅ | Display order (gaps allowed) |
| `deletedAt` | `string \| null` | ➖ | |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `updatedAt` | `string` | ✅ | ISO 8601 |

---

### `lessons` *(flat collection)*
**Service:** course-service · **ID:** auto UUID · **Soft Delete:** `deletedAt`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `subjectId` | `string` | ✅ | |
| `semesterId` | `string` | ✅ | |
| `courseId` | `string` | ✅ | |
| `title` | `string` | ✅ | |
| `description` | `string` | ✅ | Max 2000 chars |
| `youtubeVideoId` | `string \| null` | ➖ | 11-char ID extracted from URL at validation |
| `attachmentIds` | `string[]` | ✅ | Array of attachment UUIDs |
| `order` | `number` | ✅ | Display order |
| `deletedAt` | `string \| null` | ➖ | |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `updatedAt` | `string` | ✅ | ISO 8601 |

---

### `courses/{id}/batches` *(V2)*
**Service:** course-service · **ID:** auto UUID

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `courseId` | `string` | ✅ | Parent course UID |
| `name` | `string` | ✅ | |
| `scheduledOpenAt` | `string \| null` | ➖ | Auto-transitions to OPEN if past at creation |
| `scheduledCloseAt` | `string \| null` | ➖ | Date fields immutable once batch leaves DRAFT |
| `status` | `'draft' \| 'open' \| 'closed'` | ✅ | State machine |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `updatedAt` | `string` | ✅ | ISO 8601 |

---

### `registrations` *(V1 legacy)*
**Service:** enrollment-service · **ID:** studentUid

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | = studentUid |
| `studentUid` | `string` | ✅ | Firebase Auth UID |
| `email` | `string` | ✅ | |
| `firstName` | `string` | ✅ | |
| `lastName` | `string` | ✅ | |
| `state` | `'pending' \| 'approved' \| 'rejected'` | ✅ | State machine |
| `reason` | `string \| null` | ➖ | Rejection reason |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `updatedAt` | `string` | ✅ | ISO 8601 |

> New V2 users **bypass** this collection entirely. `status: 'approved'` is set at registration time.

---

### `enrollments`
**Service:** enrollment-service · **ID:** `{studentUid}_{courseId}`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | Composite PK |
| `studentUid` | `string` | ✅ | |
| `courseId` | `string` | ✅ | |
| `state` | `'pending' \| 'approved' \| 'rejected' \| 'withdrawn'` | ✅ | State machine |
| `reason` | `string \| null` | ➖ | Rejection reason |
| `note` | `string \| null` | ➖ | Optional admin note on approval |
| `rejectedAt` | `string \| null` | ➖ | ISO 8601 |
| `approvedAt` | `string \| null` | ➖ | ISO 8601 |
| `withdrawnAt` | `string \| null` | ➖ | ISO 8601 |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `updatedAt` | `string` | ✅ | ISO 8601 |

---

### `role_requests` *(V2)*
**Service:** enrollment-service · **ID:** auto UUID

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `requesterUid` | `string` | ✅ | Firebase Auth UID |
| `requestedRole` | `string` | ✅ | Target role (e.g. `'student'`) |
| `status` | `'pending' \| 'approved' \| 'rejected'` | ✅ | State machine |
| `qualificationStoragePath` | `string \| null` | ➖ | PDF storage path |
| `decidedByUid` | `string \| null` | ➖ | Approver/rejector UID |
| `decisionNote` | `string \| null` | ➖ | Optional admin note |
| `decidedAt` | `string \| null` | ➖ | ISO 8601 |
| `createdAt` | `string` | ✅ | ISO 8601 |

---

### `progress`
**Service:** progress-service · **ID:** `{studentUid}_{subjectId}`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | Composite PK |
| `studentUid` | `string` | ✅ | |
| `subjectId` | `string` | ✅ | |
| `courseId` | `string` | ✅ | |
| `semesterId` | `string` | ✅ | |
| `state` | `'not_started' \| 'in_progress' \| 'completed'` | ✅ | Idempotent |
| `completedAt` | `string \| null` | ➖ | ISO 8601 — **immutable once set** |
| `lastAccessedAt` | `string \| null` | ➖ | ISO 8601 |

---

### `notifications`
**Service:** notification-service · **ID:** auto UUID

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `userUid` | `string` | ✅ | Recipient UID |
| `type` | `string` | ✅ | e.g. `'enrollment.approved'` |
| `title` | `string` | ✅ | Display title |
| `body` | `string` | ✅ | Message text |
| `read` | `boolean` | ✅ | Read/unread flag |
| `createdAt` | `string` | ✅ | ISO 8601 |

---

### `attachments`
**Service:** storage-service · **ID:** auto UUID

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `subjectId` | `string` | ✅ | |
| `courseId` | `string` | ✅ | |
| `filename` | `string` | ✅ | Original filename |
| `mimeType` | `string` | ✅ | e.g. `'application/pdf'` |
| `sizeBytes` | `number` | ✅ | File size in bytes |
| `storagePath` | `string` | ✅ | Firebase Storage path |
| `createdAt` | `string` | ✅ | ISO 8601 |

---

### `audit_log` *(append-only)*
**Service:** audit-service · **ID:** auto UUID · **Immutable**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `actorUid` | `string \| null` | ➖ | UID of actor |
| `actorEmail` | `string \| null` | ➖ | Email of actor |
| `action` | `string` | ✅ | e.g. `'user.created'` |
| `category` | `string \| null` | ➖ | Grouping label |
| `ip` | `string \| null` | ➖ | Client IP address |
| `targetType` | `string \| null` | ➖ | Entity type affected |
| `targetId` | `string \| null` | ➖ | ID of affected entity |
| `payload` | `unknown` | ✅ | Event-specific data object |
| `requestId` | `string` | ✅ | `X-Request-Id` correlation |
| `createdAt` | `string` | ✅ | ISO 8601 |

> **Immutable** — no updates or deletes ever. Written only by event handlers via the outbox.

---

### `outbox`
**Service:** all services (write) · outbox-worker (read) · **ID:** auto UUID

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `eventType` | `string` | ✅ | e.g. `'user.registered'` |
| `payload` | `unknown` | ✅ | Event-specific data |
| `requestId` | `string` | ✅ | `X-Request-Id` for tracing |
| `status` | `'pending' \| 'processing' \| 'delivered' \| 'failed'` | ✅ | Lifecycle |
| `attempts` | `number` | ✅ | Retry count (max 5) |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `processedAt` | `string \| null` | ➖ | Set only on `'delivered'` |
| `error` | `string \| null` | ➖ | Error message if `'failed'` |

---

### `cell_groups` *(V2)*
**Service:** cell-service · **ID:** auto UUID

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `name` | `string` | ✅ | |
| `type` | `'g12' \| 'care' \| 'children' \| 'outreach'` | ✅ | Cell type |
| `area` | `string` | ✅ | Geographic area |
| `leaderUid` | `string` | ✅ | Primary leader UID |
| `g12LeaderUid` | `string` | ✅ | G12 leader UID |
| `members` | `string[]` | ✅ | Array of member UIDs |
| `memberCount` | `number` | ✅ | Denormalized count |
| `reportCount` | `number` | ✅ | Denormalized count of filed reports |
| `state` | `'active' \| 'archived'` | ✅ | |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `updatedAt` | `string` | ✅ | ISO 8601 |

---

### `cell_groups/{id}/join_requests` *(V2)*
**Service:** cell-service · **ID:** auto UUID

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `cellId` | `string` | ✅ | Parent cell UID |
| `requesterUid` | `string` | ✅ | Member requesting to join |
| `message` | `string \| null` | ➖ | Optional request message |
| `status` | `'pending' \| 'approved' \| 'rejected'` | ✅ | State machine |
| `decidedByUid` | `string \| null` | ➖ | Approver/rejector UID |
| `decisionNote` | `string \| null` | ➖ | Optional decision reason |
| `createdAt` | `string` | ✅ | ISO 8601 |
| `decidedAt` | `string \| null` | ➖ | ISO 8601 |

---

### `cell_groups/{id}/cell_reports` *(V2)*
**Service:** cell-service · **ID:** auto UUID

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `cellId` | `string` | ✅ | Parent cell UID |
| `filledByUid` | `string` | ✅ | Filer UID |
| `clientReqId` | `string` | ✅ | Idempotency key — **immutable** |
| `date` | `string` | ✅ | Meeting date (ISO 8601) |
| `didMeet` | `boolean` | ✅ | Whether meeting occurred |
| `noMeetReason` | `string \| null` | ➖ | Reason if no meeting |
| `leaderPresent` | `boolean` | ✅ | |
| `conductedByIfAbsent` | `string \| null` | ➖ | UID if leader absent |
| `location` | `string` | ✅ | |
| `timeStarted` | `string` | ✅ | ISO 8601 |
| `timeEnded` | `string` | ✅ | ISO 8601 |
| `language` | `'si' \| 'ta' \| 'en'` | ✅ | Report language |
| `subjectDiscussed` | `'sunday_sermon' \| 'other'` | ✅ | |
| `otherSubjectReason` | `string \| null` | ➖ | If `subjectDiscussed = 'other'` |
| `cellType` | `'g12' \| 'care' \| 'children' \| 'outreach'` | ✅ | |
| `g12LeaderUid` | `string` | ✅ | G12 leader UID |
| `immediateG12LeaderText` | `string \| null` | ➖ | G12 leader display name |
| `attendance` | `AttendanceEntry[]` | ✅ | `{ userUid?, name, status, isNew }` |
| `contactedAbsentees` | `'yes' \| 'no' \| 'future'` | ✅ | |
| `absenteeNotes` | `string \| null` | ➖ | |
| `additionalVisitors` | `number` | ✅ | |
| `childrenCount` | `number` | ✅ | |
| `satisfactionRate` | `number` | ✅ | Scale 1–6 |
| `photoUrls` | `string[]` | ✅ | Up to 10 Firebase Storage URLs |
| `additionalInfo` | `string \| null` | ➖ | Notes / void reason |
| `voided` | `boolean` | ✅ | Voided reports are **immutable** |
| `createdAt` | `string` | ✅ | ISO 8601 |

> **Edit rules:** 24-hour edit window from `createdAt`. Only original filer or `super_admin` may edit. Voided = immutable. `clientReqId` is immutable (cannot change on edit).

---

### `analytics_snapshots` *(V2)*
**Service:** analytics-service (read) · scheduled-jobs (write) · **ID:** auto UUID

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `string` | ✅ | PK |
| `scope` | `string` | ✅ | `'leader:{uid}'` / `'g12:{uid}'` / `'org'` |
| `periodKey` | `string` | ✅ | `'YYYY-WNN'` (ISO week, Monday-start) |
| `metrics` | `SnapshotMetrics` | ✅ | Nested object — see below |
| `computedAt` | `string` | ✅ | ISO 8601 |

**`SnapshotMetrics` nested fields:**

| Field | Type | Notes |
|-------|------|-------|
| `cellCount` | `number` | Total cells in scope |
| `activeCells` | `number` | Cells with ≥1 report in period |
| `reportCount` | `number` | Total reports filed |
| `attendance.present` | `number` | |
| `attendance.absent` | `number` | |
| `attendance.visitors` | `number` | |
| `attendance.children` | `number` | |
| `attendance.newAttendees` | `number` | |
| `meetingTypeBreakdown` | `{ g12, care, children, outreach }` | Count per type |
| `memberGrowth` | `number` | Net new members |
| `participationRate` | `number` | % of members who attended |
| `averageSatisfaction` | `number` | Avg satisfaction score (1–6) |
| `participationByLeader` | `Array<{ leaderUid, present, absent }>` | Per-leader breakdown |

---

## 11. Quick Stats

| Metric | Value |
|--------|-------|
| **Total Collections** | 16 (13 top-level + 3 sub-collections) |
| **Composite Indexes** | **43** |
| **State Machines** | 7 |
| **Domain Event Types** | 21 |
| **Services Writing to Firestore** | 10 |
| **Collections with Soft Delete** | 5 |
| **Denormalized Counters** | 4 |
| **Internal-only Collections** | 5 (`outbox`, `loginAttempts`, `emailVerifOtps`, `passwordResetOtps`, `audit_log`) |
| **Cross-service Internal HTTP Routes** | 11 |
| **Client Write Access** | **ZERO** — all writes via Admin SDK only |
| **V1 Collections** | 13 |
| **V2-only Collections** | 3 (`batches`, `role_requests`, `cell_groups`, `analytics_snapshots`) |

---

*This document reflects the live codebase as of 2026-05-27. Re-generate after adding new collections or composite indexes.*
