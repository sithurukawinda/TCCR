# TCCR — Database Schema Reference

> **Database:** Google Cloud Firestore (NoSQL)
> **Project:** TCCR / CMP — Future CX Lanka (Pvt) Ltd
> **Generated:** 2026-05-27
> **Version:** V2 (includes all V1 + V2 collections)

---

## Table of Contents

1. [users](#1-users)
2. [loginAttempts](#2-loginattempts)
3. [emailVerificationOtps](#3-emailverificationotps)
4. [passwordResetOtps](#4-passwordresetotps)
5. [courses](#5-courses)
6. [semesters (sub-collection)](#6-coursesidsemesters)
7. [subjects (sub-collection)](#7-coursesidsemestersidsubjects)
8. [lessons](#8-lessons)
9. [batches (sub-collection, V2)](#9-coursesidbatches-v2)
10. [registrations](#10-registrations)
11. [enrollments](#11-enrollments)
12. [role_requests (V2)](#12-role_requests-v2)
13. [progress](#13-progress)
14. [notifications](#14-notifications)
15. [attachments](#15-attachments)
16. [audit_log](#16-audit_log)
17. [outbox](#17-outbox)
18. [cell_groups (V2)](#18-cell_groups-v2)
19. [join_requests (sub-collection, V2)](#19-cell_groupsidjoin_requests-v2)
20. [cell_reports (sub-collection, V2)](#20-cell_groupsidcell_reports-v2)
21. [analytics_snapshots (V2)](#21-analytics_snapshots-v2)
22. [Composite Indexes](#22-composite-indexes)
23. [Enum Reference](#23-enum-reference)

---

## 1. `users`

| Property | | |
|----------|-|-|
| **Service** | user-service | |
| **Document ID** | Firebase Auth UID | |
| **Soft Delete** | `deletedAt` field | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `uid` | `string` | ✅ | — | Firebase Auth UID (primary key) |
| `email` | `string` | ✅ | — | Unique across entire system |
| `firstName` | `string` | ✅ | — | |
| `lastName` | `string` | ✅ | — | |
| `role` | `UserRole` | ✅ | `'member'` | V1 scalar — kept for backwards compat only |
| `roles` | `UserRole[]` | ✅ | `['member']` | V2 mutable array used for all authorization |
| `status` | `UserStatus` | ✅ | `'approved'` | Account status |
| `profilePhotoUrl` | `string \| null` | ➖ | `null` | Firebase Storage download URL |
| `phoneNumber` | `string \| null` | ➖ | `null` | |
| `preferredLanguage` | `'en' \| 'si' \| 'ta'` | ➖ | `'en'` | UI language preference |
| `fcmTokens` | `string[]` | ➖ | `[]` | Device push notification tokens |
| `notificationPreferences` | `NotificationPreferences` | ➖ | `{email:true, push:true}` | Per-channel opt-in |
| `providers` | `string[]` | ➖ | `[]` | Sign-in providers e.g. `['password','google.com']` |
| `createdAt` | `string` | ✅ | — | ISO 8601 timestamp |
| `updatedAt` | `string` | ✅ | — | ISO 8601 timestamp |
| `deletedAt` | `string \| null` | ➖ | `null` | Soft-delete marker; `null` = active |

**Nested type — `NotificationPreferences`:**

| Field | Type | Description |
|-------|------|-------------|
| `email` | `boolean` | Email notification opt-in |
| `push` | `boolean` | Push notification opt-in |

---

## 2. `loginAttempts`

| Property | | |
|----------|-|-|
| **Service** | auth-service | |
| **Document ID** | Email address (unique natural key) | |
| **Soft Delete** | None | |

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `email` | `string` | ✅ | Primary key — email address |
| `attempts` | `number` | ✅ | Failed sign-in count within window |
| `windowStart` | `string` | ✅ | ISO 8601 — start of 15-minute lockout window |

> **Lock rule:** After **10 failures** in any 15-minute window the account is locked.  
> Locks clear automatically once the window expires — no admin action required.

---

## 3. `emailVerificationOtps`

| Property | | |
|----------|-|-|
| **Service** | auth-service | |
| **Document ID** | Email address | |
| **Soft Delete** | None — document deleted on success or expiry | |

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `email` | `string` | ✅ | Primary key |
| `uid` | `string` | ✅ | Associated Firebase Auth UID |
| `otp` | `string` | ✅ | 6-digit one-time password |
| `expiresAt` | `string` | ✅ | ISO 8601 — 15-minute TTL |
| `attempts` | `number` | ✅ | Failed verification attempts (max 5) |

> Used by `POST /auth/verify-email`. Consumed (deleted) on first successful verification.

---

## 4. `passwordResetOtps`

| Property | | |
|----------|-|-|
| **Service** | auth-service | |
| **Document ID** | Email address | |
| **Soft Delete** | None — document deleted on success or expiry | |

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `email` | `string` | ✅ | Primary key |
| `otp` | `string` | ✅ | 6-digit one-time password |
| `expiresAt` | `string` | ✅ | ISO 8601 — 15-minute TTL |
| `attempts` | `number` | ✅ | Failed attempts (max 5; record deleted after limit) |

> **Flow:** Step 1 — `POST /auth/password-reset` creates this doc and emails OTP.  
> Step 2 — `POST /auth/password-reset/verify` validates OTP, triggers Firebase password-reset email, then deletes this doc.

---

## 5. `courses`

| Property | | |
|----------|-|-|
| **Service** | course-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | `deletedAt` (30-day recovery window) | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key (auto UUID) |
| `title` | `string` | ✅ | — | Course title |
| `description` | `string` | ✅ | `""` | Max 500 characters |
| `coverImageUrl` | `string \| null` | ➖ | `null` | Firebase Storage URL |
| `state` | `CourseState` | ✅ | `'draft'` | State machine field |
| `createdBy` | `string` | ✅ | — | UID of creator |
| `semesterCount` | `number` | ✅ | `0` | Denormalized — maintained by use cases |
| `publishedAt` | `string \| null` | ➖ | `null` | ISO 8601 — set on `publish()` |
| `deletedAt` | `string \| null` | ➖ | `null` | Soft-delete timestamp |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `updatedAt` | `string` | ✅ | — | ISO 8601 |

**State machine:**
```
DRAFT ──publish()──→ PUBLISHED ──archive()──→ ARCHIVED
  ↑                      │                        │
  └────unpublish()────────┘         restore()──→ DRAFT
```
> `publish()` requires: ≥ 1 semester AND every semester has ≥ 1 subject.

---

## 6. `courses/{id}/semesters`

| Property | | |
|----------|-|-|
| **Service** | course-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | `deletedAt` (30-day recovery) | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `courseId` | `string` | ✅ | — | Parent course UID (foreign key) |
| `title` | `string` | ✅ | — | Semester title |
| `subjectCount` | `number` | ✅ | `0` | Denormalized — maintained by use cases |
| `order` | `number` | ✅ | — | Display order (gaps allowed after deletion) |
| `openDate` | `string \| null` | ➖ | `null` | ISO 8601 — controls accessibility |
| `endDate` | `string \| null` | ➖ | `null` | ISO 8601 |
| `status` | `'active' \| 'disabled'` | ➖ | `'active'` | `disabled` by semester sweep job past `endDate` |
| `deletedAt` | `string \| null` | ➖ | `null` | Soft-delete timestamp |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `updatedAt` | `string` | ✅ | — | ISO 8601 |

---

## 7. `courses/{id}/semesters/{id}/subjects`

| Property | | |
|----------|-|-|
| **Service** | course-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | `deletedAt` (30-day recovery) | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `semesterId` | `string` | ✅ | — | Parent semester UID |
| `courseId` | `string` | ✅ | — | Grandparent course UID |
| `title` | `string` | ✅ | — | Subject title |
| `order` | `number` | ✅ | — | Display order (gaps allowed after deletion) |
| `deletedAt` | `string \| null` | ➖ | `null` | Soft-delete timestamp |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `updatedAt` | `string` | ✅ | — | ISO 8601 |

---

## 8. `lessons`

| Property | | |
|----------|-|-|
| **Service** | course-service | |
| **Document ID** | Auto UUID | |
| **Collection type** | Flat (not nested under subject) | |
| **Soft Delete** | `deletedAt` (30-day recovery) | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `subjectId` | `string` | ✅ | — | Parent subject UID |
| `semesterId` | `string` | ✅ | — | Parent semester UID |
| `courseId` | `string` | ✅ | — | Parent course UID |
| `title` | `string` | ✅ | — | Lesson title |
| `description` | `string` | ✅ | `""` | Max 2000 characters |
| `youtubeVideoId` | `string \| null` | ➖ | `null` | Extracted 11-char ID (parsed from full URL at validation) |
| `attachmentIds` | `string[]` | ✅ | `[]` | Array of `attachments` document IDs |
| `order` | `number` | ✅ | — | Display order (gaps allowed) |
| `deletedAt` | `string \| null` | ➖ | `null` | Soft-delete timestamp |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `updatedAt` | `string` | ✅ | — | ISO 8601 |

> **YouTube URL formats accepted:** `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/embed/ID`.  
> Raw 11-char IDs are rejected — always pass the full URL.

---

## 9. `courses/{id}/batches` *(V2)*

| Property | | |
|----------|-|-|
| **Service** | course-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `courseId` | `string` | ✅ | — | Parent course UID |
| `name` | `string` | ✅ | — | Batch name / label |
| `scheduledOpenAt` | `string \| null` | ➖ | `null` | ISO 8601 — auto-opens if this is in the past at creation |
| `scheduledCloseAt` | `string \| null` | ➖ | `null` | ISO 8601 — immutable once batch leaves `DRAFT` |
| `status` | `BatchStatus` | ✅ | `'draft'` | State machine field |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `updatedAt` | `string` | ✅ | — | ISO 8601 |

**State machine:**
```
DRAFT ──open()──→ OPEN ──close()──→ CLOSED
```
> Date fields (`scheduledOpenAt`, `scheduledCloseAt`) cannot be changed once a batch leaves `DRAFT`.

---

## 10. `registrations`

| Property | | |
|----------|-|-|
| **Service** | enrollment-service | |
| **Document ID** | `studentUid` (Firebase Auth UID) | |
| **Soft Delete** | None | |
| **Note** | V1 legacy — new V2 users bypass this collection entirely | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | = `studentUid` |
| `studentUid` | `string` | ✅ | — | Firebase Auth UID |
| `email` | `string` | ✅ | — | |
| `firstName` | `string` | ✅ | — | |
| `lastName` | `string` | ✅ | — | |
| `state` | `RegistrationState` | ✅ | `'pending'` | State machine field |
| `reason` | `string \| null` | ➖ | `null` | Rejection reason |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `updatedAt` | `string` | ✅ | — | ISO 8601 |

**State machine:**
```
PENDING ──approve()──→ APPROVED
        ──reject()───→ REJECTED
```

---

## 11. `enrollments`

| Property | | |
|----------|-|-|
| **Service** | enrollment-service | |
| **Document ID** | `{studentUid}_{courseId}` (composite — prevents duplicates) | |
| **Soft Delete** | None | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Composite primary key |
| `studentUid` | `string` | ✅ | — | Firebase Auth UID |
| `courseId` | `string` | ✅ | — | Course UUID |
| `state` | `EnrollmentState` | ✅ | `'pending'` | State machine field |
| `reason` | `string \| null` | ➖ | `null` | Rejection reason |
| `note` | `string \| null` | ➖ | `null` | Optional admin note on approval |
| `rejectedAt` | `string \| null` | ➖ | `null` | ISO 8601 |
| `approvedAt` | `string \| null` | ➖ | `null` | ISO 8601 |
| `withdrawnAt` | `string \| null` | ➖ | `null` | ISO 8601 |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `updatedAt` | `string` | ✅ | — | ISO 8601 |

**State machine:**
```
PENDING ──approve()──→ APPROVED ──withdraw()──→ WITHDRAWN
        ──reject()───→ REJECTED
        ──withdraw()─→ WITHDRAWN
```
> Rejection cooloff: `ENROLLMENT_REJECTION_COOLOFF_HOURS` — re-enrollment within the window returns `409 ENROLLMENT_REJECTED_COOLOFF`.

---

## 12. `role_requests` *(V2)*

| Property | | |
|----------|-|-|
| **Service** | enrollment-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `requesterUid` | `string` | ✅ | — | Firebase Auth UID of requester |
| `requestedRole` | `string` | ✅ | — | Target role being requested |
| `status` | `RoleRequestStatus` | ✅ | `'pending'` | State machine field |
| `qualificationStoragePath` | `string \| null` | ➖ | `null` | Firebase Storage path for uploaded PDF |
| `decidedByUid` | `string \| null` | ➖ | `null` | UID of admin who approved/rejected |
| `decisionNote` | `string \| null` | ➖ | `null` | Optional admin note |
| `decidedAt` | `string \| null` | ➖ | `null` | ISO 8601 |
| `createdAt` | `string` | ✅ | — | ISO 8601 |

**State machine:**
```
PENDING ──approve()──→ APPROVED  (triggers role grant on user + role.granted event)
        ──reject()───→ REJECTED
```
> Qualification file: PDF only, max 10 MB, uploaded via `multipart/form-data` with field name `qualificationFile`.

---

## 13. `progress`

| Property | | |
|----------|-|-|
| **Service** | progress-service | |
| **Document ID** | `{studentUid}_{subjectId}` (composite — prevents duplicates) | |
| **Soft Delete** | None | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Composite primary key |
| `studentUid` | `string` | ✅ | — | Firebase Auth UID |
| `subjectId` | `string` | ✅ | — | Subject UUID |
| `courseId` | `string` | ✅ | — | Course UUID |
| `semesterId` | `string` | ✅ | — | Semester UUID |
| `state` | `ProgressState` | ✅ | `'not_started'` | State machine field |
| `completedAt` | `string \| null` | ➖ | `null` | ISO 8601 — **immutable once set** |
| `lastAccessedAt` | `string \| null` | ➖ | `null` | ISO 8601 — updated on every access |

**State machine:**
```
NOT_STARTED → IN_PROGRESS → COMPLETED
```
> **Idempotent** — `MarkSubjectCompleteUseCase` returns existing record unchanged if already `completed`.  
> **Completion %** = `Math.round((completedCount / totalSubjects) * 1000) / 10` (one decimal place, e.g. `66.7%`).

---

## 14. `notifications`

| Property | | |
|----------|-|-|
| **Service** | notification-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `userUid` | `string` | ✅ | — | Recipient's Firebase Auth UID |
| `type` | `string` | ✅ | — | Event type e.g. `'enrollment.approved'` |
| `title` | `string` | ✅ | — | Short display title |
| `body` | `string` | ✅ | — | Full message body |
| `read` | `boolean` | ✅ | `false` | Read/unread flag |
| `createdAt` | `string` | ✅ | — | ISO 8601 |

> Written **only** by outbox-worker event handlers — never by the user directly.  
> Push notifications are best-effort — failure logs a warning and is silently swallowed.  
> Email notifications retry 3× with exponential backoff (1s → 2s → 4s).

---

## 15. `attachments`

| Property | | |
|----------|-|-|
| **Service** | storage-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None | |

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | ✅ | Primary key |
| `subjectId` | `string` | ✅ | Parent subject UUID |
| `courseId` | `string` | ✅ | Parent course UUID |
| `filename` | `string` | ✅ | Original uploaded filename |
| `mimeType` | `string` | ✅ | MIME type e.g. `'application/pdf'` |
| `sizeBytes` | `number` | ✅ | File size in bytes (max 26,214,400 = 25 MB) |
| `storagePath` | `string` | ✅ | Firebase Storage path |
| `createdAt` | `string` | ✅ | ISO 8601 |

> Download is via a **15-minute signed URL** — never via direct public URL.  
> Students must hold an `approved` enrollment for the parent course to download.  
> Accepted MIME types: PDF, DOC, DOCX (attachments); PNG, JPEG (subject images, max 10 MB).

---

## 16. `audit_log`

| Property | | |
|----------|-|-|
| **Service** | audit-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None — **append-only, immutable** | |

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | ✅ | Primary key |
| `actorUid` | `string \| null` | ➖ | UID of user who performed the action |
| `actorEmail` | `string \| null` | ➖ | Email of actor |
| `action` | `string` | ✅ | Action identifier e.g. `'user.created'` |
| `category` | `string \| null` | ➖ | Grouping category |
| `ip` | `string \| null` | ➖ | Client IP address |
| `targetType` | `string \| null` | ➖ | Entity type affected e.g. `'user'`, `'course'` |
| `targetId` | `string \| null` | ➖ | ID of the affected entity |
| `payload` | `unknown` | ✅ | Event-specific data object (varies by action) |
| `requestId` | `string` | ✅ | `X-Request-Id` header for log correlation |
| `createdAt` | `string` | ✅ | ISO 8601 |

> **No updates or deletes ever.** Every entry is permanent.  
> Written **only** by audit-service event handlers via the outbox.  
> `audit.action` is a generic escape hatch for operations without a dedicated domain event.

---

## 17. `outbox`

| Property | | |
|----------|-|-|
| **Service** | All services write; outbox-worker reads | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `eventType` | `string` | ✅ | — | Domain event type e.g. `'user.registered'` |
| `payload` | `unknown` | ✅ | — | Event-specific data |
| `requestId` | `string` | ✅ | — | `X-Request-Id` propagated from originating request |
| `status` | `OutboxStatus` | ✅ | `'pending'` | Lifecycle status |
| `attempts` | `number` | ✅ | `0` | Dispatch attempt count (max 5) |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `processedAt` | `string \| null` | ➖ | `null` | ISO 8601 — set only when `status = 'delivered'` |
| `error` | `string \| null` | ➖ | `null` | Last error message when `status = 'failed'` |

**Status lifecycle:**
```
pending → processing → delivered
                    ↘ (up to 5 retries, then) → failed
```
> Written **atomically** in the same `WriteBatch` as the primary document write — events are never lost.  
> Worker polls every 5 seconds; batch size 20 per poll; `Promise.allSettled` so one failure does not block others.

---

## 18. `cell_groups` *(V2)*

| Property | | |
|----------|-|-|
| **Service** | cell-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None (`state: 'archived'` instead) | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `name` | `string` | ✅ | — | Cell group name |
| `type` | `CellType` | ✅ | — | Cell category |
| `area` | `string` | ✅ | — | Geographic area / region |
| `leaderUid` | `string` | ✅ | — | Primary cell leader UID |
| `g12LeaderUid` | `string` | ✅ | — | G12 leader UID (supervisor) |
| `members` | `string[]` | ✅ | `[]` | Array of member UIDs |
| `memberCount` | `number` | ✅ | `0` | Denormalized — maintained by use cases |
| `reportCount` | `number` | ✅ | `0` | Denormalized — incremented on each filed report |
| `state` | `CellState` | ✅ | `'active'` | Active or archived |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `updatedAt` | `string` | ✅ | — | ISO 8601 |

> `DELETE /cells/:id` is a **hard delete** (irreversible).  
> Archived cells cannot be deleted.  
> `POST /cells/:id/transfer-ownership` — `admin` / `super_admin` only; admin may transfer leader and/or G12 role independently.

---

## 19. `cell_groups/{id}/join_requests` *(V2)*

| Property | | |
|----------|-|-|
| **Service** | cell-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `cellId` | `string` | ✅ | — | Parent cell group UID |
| `requesterUid` | `string` | ✅ | — | UID of member requesting to join |
| `message` | `string \| null` | ➖ | `null` | Optional message from requester |
| `status` | `JoinRequestStatus` | ✅ | `'pending'` | State machine field |
| `decidedByUid` | `string \| null` | ➖ | `null` | UID of approver/rejector |
| `decisionNote` | `string \| null` | ➖ | `null` | Optional decision note |
| `createdAt` | `string` | ✅ | — | ISO 8601 |
| `decidedAt` | `string \| null` | ➖ | `null` | ISO 8601 |

**State machine:**
```
PENDING ──approve()──→ APPROVED  (member added to cell_groups.members[])
        ──reject()───→ REJECTED
```

---

## 20. `cell_groups/{id}/cell_reports` *(V2)*

| Property | | |
|----------|-|-|
| **Service** | cell-service | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None (`voided` flag instead) | |

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `id` | `string` | ✅ | — | Primary key |
| `cellId` | `string` | ✅ | — | Parent cell group UID |
| `filledByUid` | `string` | ✅ | — | UID of report filer |
| `clientReqId` | `string` | ✅ | — | Idempotency key — **immutable after creation** |
| `date` | `string` | ✅ | — | Meeting date (ISO 8601) |
| `didMeet` | `boolean` | ✅ | — | Whether the meeting occurred |
| `noMeetReason` | `string \| null` | ➖ | `null` | Required if `didMeet = false` |
| `leaderPresent` | `boolean` | ✅ | — | Whether the cell leader was present |
| `conductedByIfAbsent` | `string \| null` | ➖ | `null` | UID of person who conducted if leader absent |
| `location` | `string` | ✅ | — | Meeting location |
| `timeStarted` | `string` | ✅ | — | ISO 8601 |
| `timeEnded` | `string` | ✅ | — | ISO 8601 |
| `language` | `'si' \| 'ta' \| 'en'` | ✅ | — | Language of the meeting |
| `subjectDiscussed` | `'sunday_sermon' \| 'other'` | ✅ | — | Subject type |
| `otherSubjectReason` | `string \| null` | ➖ | `null` | Required if `subjectDiscussed = 'other'` |
| `cellType` | `CellType` | ✅ | — | Snapshot of cell type at time of report |
| `g12LeaderUid` | `string` | ✅ | — | G12 leader UID |
| `immediateG12LeaderText` | `string \| null` | ➖ | `null` | G12 leader display name |
| `attendance` | `AttendanceEntry[]` | ✅ | `[]` | Attendance records — see nested type below |
| `contactedAbsentees` | `'yes' \| 'no' \| 'future'` | ✅ | — | Whether absentees were followed up |
| `absenteeNotes` | `string \| null` | ➖ | `null` | Notes on absent members |
| `additionalVisitors` | `number` | ✅ | `0` | Count of non-member visitors |
| `childrenCount` | `number` | ✅ | `0` | Count of children present |
| `satisfactionRate` | `number` | ✅ | — | Meeting satisfaction score (scale 1–6) |
| `photoUrls` | `string[]` | ✅ | `[]` | Firebase Storage URLs (up to 10 photos) |
| `additionalInfo` | `string \| null` | ➖ | `null` | General notes; also used to store void reason |
| `voided` | `boolean` | ✅ | `false` | Voided reports are **fully immutable** |
| `createdAt` | `string` | ✅ | — | ISO 8601 |

**Nested type — `AttendanceEntry`:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `userUid` | `string \| undefined` | ➖ | UID if member is registered in system |
| `name` | `string` | ✅ | Display name |
| `status` | `'present' \| 'absent'` | ✅ | Attendance status |
| `isNew` | `boolean` | ✅ | First-time attendee flag |

> **Edit rules:** 24-hour edit window from `createdAt`. Only original filer or `super_admin` may edit.  
> `clientReqId` is **immutable** — cannot be changed on edit.  
> **Authorization:** only owning leader, G12 leader, or `super_admin` may file a report — plain `admin` is excluded.

---

## 21. `analytics_snapshots` *(V2)*

| Property | | |
|----------|-|-|
| **Service** | analytics-service (reads) / scheduled-jobs (writes) | |
| **Document ID** | Auto UUID | |
| **Soft Delete** | None | |

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | ✅ | Primary key |
| `scope` | `string` | ✅ | `'leader:{uid}'` / `'g12:{uid}'` / `'org'` |
| `periodKey` | `string` | ✅ | ISO week format `'YYYY-WNN'` (Monday-start) |
| `metrics` | `SnapshotMetrics` | ✅ | Pre-aggregated metrics — see below |
| `computedAt` | `string` | ✅ | ISO 8601 — when the snapshot was computed |

**Nested type — `SnapshotMetrics`:**

| Field | Type | Description |
|-------|------|-------------|
| `cellCount` | `number` | Total cells in scope |
| `activeCells` | `number` | Cells with ≥ 1 report in the period |
| `reportCount` | `number` | Total reports filed in the period |
| `attendance.present` | `number` | Total present across all meetings |
| `attendance.absent` | `number` | Total absent |
| `attendance.visitors` | `number` | Total additional visitors |
| `attendance.children` | `number` | Total children |
| `attendance.newAttendees` | `number` | Total first-time attendees |
| `meetingTypeBreakdown.g12` | `number` | Count of G12-type meetings |
| `meetingTypeBreakdown.care` | `number` | Count of Care-type meetings |
| `meetingTypeBreakdown.children` | `number` | Count of Children-type meetings |
| `meetingTypeBreakdown.outreach` | `number` | Count of Outreach-type meetings |
| `memberGrowth` | `number` | Net new members added in period |
| `participationRate` | `number` | % of members who attended at least once |
| `averageSatisfaction` | `number` | Average satisfaction score (1–6 scale) |
| `participationByLeader` | `Array<{leaderUid, present, absent}>` | Per-leader attendance breakdown |

> Written by `snapshotJob` in scheduled-jobs (weekly, Monday UTC midnight by default).  
> Job uses ISO week key `YYYY-WNN` deduplication — safe to restart mid-week.

---

## 22. Composite Indexes

All 43 indexes deployed to Firestore via `firestore.indexes.json`:

| # | Collection | Fields | Order |
|---|-----------|--------|-------|
| 1 | `users` | `deletedAt`, `createdAt` | ASC, DESC |
| 2 | `users` | `deletedAt`, `firstName` | ASC, ASC |
| 3 | `users` | `deletedAt`, `status`, `firstName` | ASC, ASC, ASC |
| 4 | `users` | `deletedAt`, `role`, `createdAt` | ASC, ASC, DESC |
| 5 | `users` | `deletedAt`, `role`, `firstName` | ASC, ASC, ASC |
| 6 | `users` | `deletedAt`, `role`, `status`, `firstName` | ASC, ASC, ASC, ASC |
| 7 | `users` | `deletedAt`, `status`, `createdAt` | ASC, ASC, DESC |
| 8 | `users` | `deletedAt`, `role`, `status`, `createdAt` | ASC, ASC, ASC, DESC |
| 9 | `courses` | `state`, `deletedAt`, `publishedAt` | ASC, ASC, DESC |
| 10 | `courses` | `deletedAt`, `createdAt` | ASC, DESC |
| 11 | `courses` | `deletedAt`, `title` | ASC, ASC |
| 12 | `courses` | `deletedAt`, `state`, `title` | ASC, ASC, ASC |
| 13 | `courses` | `deletedAt`, `state`, `createdAt` | ASC, ASC, DESC |
| 14 | `semesters` | `courseId`, `deletedAt`, `order` | ASC, ASC, ASC |
| 15 | `subjects` | `semesterId`, `deletedAt`, `order` | ASC, ASC, ASC |
| 16 | `subjects` | `courseId`, `deletedAt` | ASC, ASC |
| 17 | `lessons` | `subjectId`, `deletedAt`, `order` | ASC, ASC, ASC |
| 18 | `registrations` | `state`, `createdAt` | ASC, ASC |
| 19 | `enrollments` | `studentUid`, `createdAt` | ASC, DESC |
| 20 | `enrollments` | `studentUid`, `state`, `createdAt` | ASC, ASC, DESC |
| 21 | `enrollments` | `state`, `createdAt` | ASC, ASC |
| 22 | `enrollments` | `state`, `courseId`, `createdAt` | ASC, ASC, ASC |
| 23 | `progress` | `studentUid`, `courseId`, `state` | ASC, ASC, ASC |
| 24 | `progress` | `courseId`, `studentUid` | ASC, ASC |
| 25 | `notifications` | `userUid`, `createdAt` | ASC, DESC |
| 26 | `notifications` | `userUid`, `read`, `createdAt` | ASC, ASC, DESC |
| 27 | `audit_log` | `actorUid`, `createdAt` | ASC, DESC |
| 28 | `audit_log` | `action`, `createdAt` | ASC, DESC |
| 29 | `audit_log` | `category`, `createdAt` | ASC, DESC |
| 30 | `outbox` | `status`, `createdAt` | ASC, ASC |
| 31 | `batches` | `courseId`, `createdAt` | ASC, ASC |
| 32 | `role_requests` | `status`, `createdAt` | ASC, DESC |
| 33 | `role_requests` | `requesterUid`, `createdAt` | ASC, DESC |
| 34 | `analytics_snapshots` | `scope`, `periodKey` | ASC, ASC |
| 35 | `analytics_snapshots` | `scope`, `periodKey` | ASC, DESC |
| 36 | `cell_groups` | `state`, `createdAt` | ASC, DESC |
| 37 | `cell_groups` | `type`, `createdAt` | ASC, DESC |
| 38 | `cell_groups` | `area`, `createdAt` | ASC, DESC |
| 39 | `cell_groups` | `leaderUid`, `createdAt` | ASC, DESC |
| 40 | `cell_groups` | `state`, `type`, `area`, `leaderUid`, `createdAt` | ASC, ASC, ASC, ASC, DESC |
| 41 | `join_requests` *(collection group)* | `status`, `createdAt` | ASC, DESC |
| 42 | `join_requests` *(collection group)* | `requestedBy`, `createdAt` | ASC, DESC |
| 43 | `cell_reports` *(collection group)* | `voided`, `date` | ASC, DESC |

> Indexes 41–43 use **collection group** scope — they query across all sub-collections with that name.  
> Deploy with: `node scripts/deploy-indexes-env.js`

---

## 23. Enum Reference

### `UserRole`
```
'member' | 'student' | 'leader' | 'g12' | 'admin' | 'super_admin'
```

### `UserStatus`
```
'pending_approval' | 'approved' | 'rejected' | 'suspended'
```

### `CourseState`
```
'draft' | 'published' | 'archived'
```

### `BatchStatus`
```
'draft' | 'open' | 'closed'
```

### `RegistrationState`
```
'pending' | 'approved' | 'rejected'
```

### `EnrollmentState`
```
'pending' | 'approved' | 'rejected' | 'withdrawn'
```

### `RoleRequestStatus`
```
'pending' | 'approved' | 'rejected'
```

### `ProgressState`
```
'not_started' | 'in_progress' | 'completed'
```

### `OutboxStatus`
```
'pending' | 'processing' | 'delivered' | 'failed'
```

### `CellType`
```
'g12' | 'care' | 'children' | 'outreach'
```

### `CellState`
```
'active' | 'archived'
```

### `JoinRequestStatus`
```
'pending' | 'approved' | 'rejected'
```

### `SemesterStatus`
```
'active' | 'disabled'
```

### `PreferredLanguage`
```
'en' | 'si' | 'ta'
```

---

*This document reflects the live codebase as of 2026-05-27.  
Re-generate after adding new collections, fields, or composite indexes.*
