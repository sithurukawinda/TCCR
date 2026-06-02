# TCCR — API Reference Document
## The Christian Center Rathmalana · `tccr-backend`
### REST API · Version 2.44.0 · Base URL: `https://cms.api.bethelnet.au/api/v1`

**Version:** 2.44.0
**Date:** 31 May 2026
**Organisation:** Future CX Lanka (Pvt) Ltd
**Status:** Release Baseline
**Supersedes:** Version 2.39.0 (29 May 2026)
**Change in 2.44.0:** Completeness pass — added response JSON examples, field reference tables, and error codes to all previously sparse endpoints across §4 (users), §6–9 (courses/batches/semesters/subjects/lessons), §12 (progress), §13–14 (cells/reports), §15 (analytics), §16 (notifications), §17 (audit), §18 (super-admin). Every endpoint now has a full JSON response example, a field reference table for non-trivial objects, and documented error codes.
**Change in 2.43.0:** §3.11 `GET /me/courses/:courseId` — corrected response shape: root key `courseId` → `id`; added `title` and `state` at root; replaced `batchId` string with full `batch` object (`id`, `name`, `intakeStart`, `intakeEnd`); added `subjectCount` to semester fields; added `createdAt`, `updatedAt` to subjects. Field reference table updated. §15.6 `GET /analytics/:chart/export` — corrected `Content-Disposition` filename from generic `analytics-export.csv` to `analytics-{chart}-export.csv`.
**Change in 2.42.0:** §6.2 `GET /courses/:id` — corrected `semesters[]` JSON example: removed `openDate`, `endDate`, `status` (these live under `batches[].semesters[]` only); added `subjectCount`, `createdAt`, `updatedAt` (present in SemesterView); added `createdAt`, `updatedAt` to `subjects[]` example. §2.1 `POST /auth/register` — added missing `422 DISPOSABLE_EMAIL` and `422 EMAIL_DOMAIN_UNREACHABLE` error responses. §11.2 `POST /enrollments` — added missing `404 COURSE_NOT_FOUND` and `409 ENROLLMENT_PENDING` error responses. §6.5 `POST /courses/:id/publish` — added missing `404 COURSE_NOT_FOUND`. §6.4, §7.4, §8.3, §9.7 — added request body field tables (were missing entirely).
**Change in 2.41.0:** §2.4, §2.8, §2.9, §2.13, §3.3, §3.8, §4.3, §16.3 — corrected 8 action endpoints from `204 No Content` to `200 OK` with `{ message }` body, matching the CLAUDE.md status-code policy (action endpoints return 200, only DELETE and email-enumeration guards return 204). §6.5/6.6/6.7 — corrected `status:` field to `state:` in course lifecycle responses (§6.8 was already correct). §11.4 — removed `userId`, `batchId`, `search` query params (not implemented; only `courseId`, `state`, `limit`, `cursor` accepted). §12.5 — removed `batchId`, `limit`, `cursor` params and paginated-response claim (controller returns a flat array, no pagination).
**Change in 2.40.0:** §4.2 `GET /users/:uid` — corrected auth roles from `admin, super_admin` to `leader, g12, admin` matching the actual route guard; scoped-access note preserved. §14.2 `POST /cells/:id/reports` — corrected 11 meeting fields from Required=Yes to Required=No with default values; the Zod schema applies defaults rather than enforcing conditional requirements when `didMeet=true`.
**Change in 2.39.0:** §6.9 `DELETE /courses/:id` — corrected description from soft-delete (recoverable) to permanent hard-delete; role clarified as `admin` only. §6.10 `DELETE /courses/:id/hard` ★ NEW — documented missing endpoint restricted to `super_admin`; identical permanent hard-delete behaviour. ToC updated.
**Change in 2.38.0:** §13.9 `DELETE /cells/:id/members/:uid` — full error table added; separate response examples for registered-member and external-member deletion; URL path parameter table added. §13.14 `GET /cells/network/members` — `members[]` updated to discriminated union (`type: "registered" | "external"`) matching §13.4; response example and field-reference table updated to include external-member fields (`id`, `name`, `phone?`, `uid: null`); G12 scope corrected (G12 sees **all** active cells org-wide, not only own-network cells).
**Change in 2.37.0:** §12.6 `POST /progress/lessons/:lessonId/complete` and §12.8 `POST /progress/lessons/:lessonId/video-position` — both endpoints now update `lastAccessedLessonId` and `lastAccessedSubjectId` on the subject-progress record as a side-effect. Fixes "resume on wrong lesson" bug: after a mid-watch logout the next `GET /me/progress/courses/:courseId` returns the correct `lastAccessedLessonId`.
**Change in 2.36.0:** §13.4 `GET /cells/:id` — `members[]` response updated to discriminated union (`type: "registered" | "external"`); registered members include `uid`, `firstName`, `lastName`, `displayName`; external members include `id` (UUID), `name`, `phone?`, `displayName`, `uid: null`.
**Change in 2.35.0:** §13.8 `POST /cells/:id/members` — extended to support external (unregistered) members via `externalMembers[]` alongside existing `userUids[]`; response now includes `addedExternal[]`. §13.9 `DELETE /cells/:id/members/:uid` — clarified that `:uid` accepts both Firebase UIDs and external member UUIDs.
**Change in 2.34.0:** §6.2 `GET /courses/:id` — bug fix: `batches[]` is now returned for all callers (admin, student, anonymous). Previously, non-admin callers received `batches: []` regardless of course state. Response example and field reference updated.
**Change in 2.33.0:** Documentation drift corrections — §14.7 `GET /cells/network/summary` query param reverted to `?month=YYYY-MM` (required); §14.7 response field table corrected (`month` row replaced with `from`/`to` rows); §14.7 response JSON example values updated to match actual output; §14.6 already correct (no change needed); §4.5–4.6 already correct; §10.3 `GET /attachments/:id/download-url` role restriction clarified (`leader`/`g12` → `403 FORBIDDEN`).
**Change in 2.32.0:** §12 Progress Endpoints — two new endpoints: §12.8 `POST /progress/lessons/:lessonId/video-position` (save YouTube playback position in seconds) and §12.9 `GET /progress/lessons/:lessonId/video-position` (retrieve saved position; returns `{ watchedSeconds: 0 }` when never watched). New `video_progress` Firestore collection. Enables frontend video resume feature across devices.
**Change in 2.31.0:** §12.6 and §12.7 lesson-level progress endpoints documented. §7.7, §7.8, §7.9 batch semester scheduling endpoints added.
**Change in 2.30.0:** Added §3.11 `GET /me/courses/:courseId` (student batch-aware course view with semester states); added §7.7 `PUT /courses/:courseId/batches/:batchId/semester-dates` and §7.8 `PATCH /courses/:courseId/batches/:batchId/semester-dates/:semesterId` (batch semester scheduling); updated §14.7 `GET /cells/network/summary` from `?month=` to `?from=`/`?to=` date-range signature with adaptive period labels; updated §14.6 `GET /cells/network/reports` and §14.1 `GET /cells/:id/reports` with `leaderUid`, `cellId`, and corrected `voided` param type.
**Change in 2.29.0:** §4.4 and §17.2 `GET /users/:uid/audit-log` — marked as **implemented** (was incorrectly flagged NOT YET IMPLEMENTED). Endpoint is live in audit-service; filters audit entries by `actorUid`.
**Change in 2.28.0:** Added §14.7 `GET /cells/network/summary` (Reports page stat cards, charts, by-leader table); updated §14.6 `GET /cells/network/reports` with `month` and `type` filter params (Cell Type tab filtering for All Reports table).
**Change in 2.27.0:** Email verification gate enforced on registration (§1.2, §2.1). `POST /auth/register` now creates accounts with `emailVerified=false` — users must click the verification link in the welcome email before accessing protected routes. Welcome email updated: green "Verify My Email" button (primary) + blue "Log in to TCCR" button (secondary). `POST /auth/password-reset` now sends a direct Firebase reset link (no OTP). `POST /auth/password-reset/verify` deprecated. `docker-compose.yml` fix: `SERVICE_ENROLLMENT_URL` added to `progress-service`.
**Change in 2.26.0:** Added lesson-level progress endpoints (§12.6, §12.7) and extended `GET /me/progress/courses/:courseId` (§12.3) with `completedLessonIds[]`, `totalLessons`, `lessonCompletionPercent`, and `lastAccessedAt`. New Firestore collection: `lesson_progress`.
**Change in 2.25.0:** Developed `GET /users/summary` (§4.11) — enriched `SummaryProfile` with `roles[]`, `phoneNumber`, `createdAt`; added Frontend Integration Guide; 10 unit tests added.
**Change in 2.24.0:** PDF file inputs made optional across all upload endpoints (§3.5, §10.1):
- §3.5 `POST /me/qualification`: `qualification` field now optional — omitting it returns `{ fileUrl: null }`
- §10.1 `POST /subjects/:id/attachments`: `file` field now optional — omitting it returns `200 { message }`
**Change in 2.23.0:** Corrected §4.8 Promote, §4.9 Delete, §4.10 Demote response shapes and delete semantics:
- §4.8 Promote: `204` → `200 { message }` (promote + idempotent path)
- §4.9 Delete: "soft-delete" → "hard-delete" (permanently removes Firestore doc + Firebase Auth)
- §4.10 Demote: `204` → `200 { message }` (demote + idempotent path)
- ToC: added missing §4.10 Demote link

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Auth Endpoints](#2-auth-endpoints)
   - 2.1 [Register](#21-post-authregister) · 2.2 [Google](#22-post-authfederatedgoogle--new-v2) · 2.3 [Apple](#23-post-authfederatedapple--new-v2) · 2.4 [Logout](#24-post-authlogout)
   - 2.5 [Password Reset](#25-post-authpassword-reset) · 2.6 [Verify OTP](#26-post-authpassword-resetverify) · 2.7 [Track Failure](#27-post-authtrack-failure)
   - **2.8 [Resend Verification](#28-post-authresend-verification--new) ★** · **2.9 [Verify Email OTP](#29-post-authverify-email--new) ★**
   - **2.10 [Apple Init](#210-get-authappleinit--new--apple-web-oauth-step-1) ★** · **2.11 [Apple Callback](#211-post-authapplecallback--new--apple-web-oauth-step-2) ★** · **2.12 [Apple Refresh](#212-post-authapplerefresh--new--apple-web-oauth-validate-session) ★** · **2.13 [Apple Revoke](#213-post-authapplerevoke--new--apple-web-oauth-account-deletion) ★**
3. [Profile Endpoints (Me)](#3-profile-endpoints-me)
   - 3.1 [Get Profile](#31-get-me) · 3.2 [Update Profile](#32-patch-me) · 3.3 [Change Password](#33-post-mechange-password)
   - 3.4 [Upload Avatar](#34-post-meavatar) · 3.5 [Upload Qualification](#35-post-mequalification--new) · 3.6 [Link Provider](#36-post-meproviders-link--new-v2) · 3.7 [Unlink Provider](#37-delete-meproviders-provider--new-v2)
   - 3.8 [Register FCM Token](#38-post-mefcm-token--new-v2) · 3.9 [Deregister FCM Token](#39-delete-mefcm-token--new-v2) · 3.10 [Notification Preferences](#310-patch-menotificationspreferences--new-v2)
   - **3.11 [Student Course View ★ NEW](#311-get-mecoursescourseid--new)**
4. [User Management — Admin](#4-user-management--admin)
   - 4.1 [List Users](#41-get-users) · 4.2 [Get User](#42-get-usersuid) · 4.3 [Assign Roles](#43-patch-usersuidroles--new-v2)
   - 4.4 [User Audit Log](#44-get-usersuidaudit-log--new-v2) · 4.5 [Suspend](#45-post-usersusidsuspend) · 4.6 [Reactivate](#46-post-usersuidreactivate)
   - 4.7 [Provision Leader/G12 User (with welcome email)](#47-post-users--new) · 4.8 [Promote Existing User](#48-post-usersuidpromote--new-v2) · 4.9 [Delete User ★](#49-delete-usersuid--new)
   - **4.10 [Demote User ★](#410-post-usersuiddemote--new)** · **4.11 [System Member Summary ★ NEW](#411-get-userssummary--new)**
5. [Role Requests — NEW V2](#5-role-requests--new-v2)
   - 5.1 [Submit Role Request (multipart)](#51-post-role-requests) · 5.2 [My Requests](#52-get-role-requestsmine) · 5.3 [Admin List](#53-get-role-requests)
   - 5.4 [Get Request](#54-get-role-requestsid) · 5.5 [Download Qualification PDF ★](#55-get-role-requestsidqualification) · 5.6 [Approve](#56-post-role-requestsidapprove) · 5.7 [Reject](#57-post-role-requestsidreject)
6. [Course Endpoints](#6-course-endpoints)
   - 6.1–6.7 [List/Get/Create/Update/Publish/Unpublish/Archive](#61-get-courses)
   - 6.8 [Restore Course](#68-post-coursesidrestore) · 6.9 [Delete Course (admin)](#69-delete-coursesid) · 6.10 [Hard Delete Course (super_admin)](#610-delete-coursesidhard)
7. [Batch Endpoints — NEW V2](#7-batch-endpoints--new-v2)
   - 7.1 [List Batches](#71-get-coursesidbatches)
   - 7.2 [Create Batch](#72-post-coursesidbatches)
   - 7.3 [Get Batch](#73-get-batchesid)
   - 7.4 [Update Batch](#74-patch-batchesid)
   - 7.5 [Open Batch (Manual)](#75-post-batchesidopen)
   - 7.6 [Close Batch (Manual)](#76-post-batchesidclose)
   - **7.7 [Set Batch Semester Dates ★ NEW](#77-put-coursescourseidbatchesbatchidsemester-dates--new)**
   - **7.8 [Patch One Semester Date ★ NEW](#78-patch-coursescourseidbatchesbatchidsemester-datessemesterid--new)**
8. [Semester Endpoints](#8-semester-endpoints)
9. [Subject & Lesson Endpoints](#9-subject--lesson-endpoints)
10. [Attachment & Image Endpoints](#10-attachment--image-endpoints)
11. [Enrollment Endpoints](#11-enrollment-endpoints)
12. [Progress Endpoints](#12-progress-endpoints)
    - 12.1 [Mark Subject Complete](#121-post-progresssubjectsidcomplete) · 12.2 [Subject Access](#122-post-progresssubjectsidaccess) · 12.3 [My Course Progress](#123-get-meprogress-coursescourseid)
    - 12.4 [My Subject Progress](#124-get-meprogresssubjectssubjectid) · 12.5 [Admin Course Progress](#125-get-adminprogresscoursescourseid)
    - **12.6 [Mark Lesson Complete ★ NEW](#126-post-progresslessonslessionidcomplete--new) · 12.7 [Unmark Lesson ★ NEW](#127-delete-progresslessonslessonidcomplete--new)**
    - **12.8 [Save Video Position ★ NEW](#128-post-progresslessonslessonidvideo-position--new) · 12.9 [Get Video Position ★ NEW](#129-get-progresslessonslessonidvideo-position--new)**
13. [Cell Group Endpoints — NEW V2](#13-cell-group-endpoints--new-v2)
    - 13.1 [List Cells](#131-get-cells)
    - 13.2 [My Cells](#132-get-cellsmine)
    - 13.3 [Create Cell](#133-post-cells)
    - 13.4 [Get Cell](#134-get-cellsid)
    - 13.5 [Update Cell](#135-patch-cellsid)
    - 13.6 [Archive Cell](#136-post-cellsidarchive)
    - 13.7 [Delete Cell ★ NEW](#137-delete-cellsid--new) · **13.7b [Transfer Ownership ★ NEW](#137b-post-cellsidtransfer-ownership--new)** · 13.8 [Add Members (Direct)](#138-post-cellsidmembers)
    - 13.9 [Remove Member](#138-delete-cellsidmembersuid)
    - 13.10 [Apply to Join (Member)](#139-post-cellsidjoin-requests)
    - 13.11 [List Join Requests](#1310-get-cellsidjoin-requests)
    - 13.12 [Approve Join Request](#1311-post-cellsidjoin-requestsridapprove)
    - 13.13 [Reject Join Request](#1312-post-cellsidjoin-requestsridreject)
    - **13.14 [Network Members (G12 view) ★ NEW](#1314-get-cellsnetworkmembers--new)**
14. [Cell Report Endpoints — NEW V2](#14-cell-report-endpoints--new-v2)
   - **14.6 [Network Reports — month + type filters ★ UPDATED](#146-get-cellsnetworkreports--updated)**
   - **14.7 [Network Summary (Reports page) ★ NEW](#147-get-cellsnetworksummary--new)**
15. [Analytics Endpoints — NEW V2](#15-analytics-endpoints--new-v2)
16. [Notification Endpoints](#16-notification-endpoints)
17. [Audit Log Endpoints](#17-audit-log-endpoints)
18. [Admin Management — Super Admin](#18-admin-management--super-admin)
19. [Health Endpoints](#19-health-endpoints)
20. [Data Models](#20-data-models)
21. [Error Codes Reference](#21-error-codes-reference)
22. [HTTP Status Code Reference](#22-http-status-code-reference)
23. [Domain Events Reference](#23-domain-events-reference)

---

## 1. Getting Started

### 1.1 Base URL & Versioning

```
Production:  https://api.tccr.lk/api/v1
Staging:     https://api-staging.tccr.lk/api/v1
Local Dev:   http://localhost:3000/api/v1
```

### 1.2 Authentication

The TCCR API uses Firebase Authentication with stateless Bearer tokens.

```
Authorization: Bearer <firebase-id-token>
```

- Firebase ID tokens expire after **1 hour**; always call `user.getIdToken()` before each request
- Revoked tokens are rejected immediately (`checkRevoked=true`)
- **V2 locale header:** `Accept-Language: si` or `Accept-Language: ta` to receive localised notifications and responses; falls back to user's `preferredLanguage` profile field, then `en`

**Public endpoints (no token required):**

> **Email-verification gate:** Users who sign up via `POST /auth/register` receive `emailVerified=false` on account creation. They must click the **"Verify My Email"** link in the welcome email before they can access any protected endpoint — calling a protected route with an unverified token returns `403 EMAIL_NOT_VERIFIED`. Federated users (Google/Apple) are always verified automatically by Firebase and are **exempt** from this gate.

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | Member registration |
| `POST /auth/federated/google` | Google sign-in |
| `POST /auth/federated/apple` | Apple sign-in |
| `POST /auth/password-reset` | Send Firebase password reset link |
| `POST /auth/password-reset/verify` | ⚠️ Deprecated — use reset link instead |
| `POST /auth/track-failure` | Record failed login attempt |
| `GET /courses` | Browse published catalogue |
| `GET /courses/:id` | View published course |
| `GET /healthz` | Liveness probe |
| `GET /readyz` | Readiness probe |

### 1.3 Request Format

- JSON bodies: `Content-Type: application/json`
- File uploads: `multipart/form-data`
- Optional: `X-Request-Id` (UUID v4); server generates if absent
- **Strongly recommended** on `POST /cells/:id/reports`: `X-Idempotency-Key: <client-uuid>` — when provided, the server stores it and returns the existing report on duplicate submission rather than creating a duplicate; ideal for mobile clients that may retry on network failure

### 1.4 Response Format

```json
// Single resource
{ "id": "abc", "name": "...", "createdAt": "2026-05-01T08:00:00.000Z" }

// Paginated list
{ "items": [...], "nextCursor": "abc123", "total": 47 }

// Empty success
HTTP 204 No Content
```

### 1.5 Error Format

```json
{
  "error": {
    "code":    "BATCH_CLOSED",
    "message": "Target batch has closed its intake window.",
    "details": { "batchId": ["Intake window closed on 2026-04-30"] }
  },
  "requestId": "7f3a1c2d-4e5b-6f7a-8b9c-0d1e2f3a4b5c"
}
```

### 1.6 Pagination

| Parameter | Default | Max | Description |
|-----------|:-------:|:---:|-------------|
| `limit` | 20 | 100 | Items per page |
| `cursor` | — | — | Value from previous `nextCursor` |

### 1.7 Rate Limiting

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| `POST /auth/*` | 20 | Per IP per minute |
| All other endpoints | 500 | Per IP per minute |

Returns `429 Too Many Requests` with `Retry-After` header.

### 1.8 Performance & Usability Constraints

The following SRS non-functional requirements directly constrain API behaviour and client implementation:

| Requirement | Constraint | SRS Ref |
|-------------|-----------|---------|
| API response time | p95 GET latency < **800 ms** at 50 RPS steady state | NFR-PER-001 |
| Analytics dashboards | All `/analytics/*` responses < **2 s** (served from pre-aggregated snapshots, never raw scans) | NFR-PER-003 |
| Registered users | Designed for **10,000 registered users** | NFR-SCA-001 |
| Concurrent cells | System must sustain **500 concurrent cells**, **100,000 cell reports/year** | NFR-SCA-002 |
| Cell report UX | A Leader must be able to complete and submit a cell report in **under 3 minutes** on mobile. Clients should pre-populate attendance from the roster and default `date` to today (FR-CR-003). | NFR-USA-003 |
| Offline cell reports | Clients may queue reports offline and retry for up to **24 hours** using the `X-Idempotency-Key` header. Same key always returns the existing report (`200 OK`) rather than a duplicate. | NFR-AVA-004 |
| Token refresh | Firebase ID tokens expire in 1 hour. Always call `user.getIdToken(true)` before requests after idle periods. Inactivity timeout is **30 minutes** on web (FR-AUTH-008). | NFR-SEC-002 |
| TLS | All traffic must use **TLS 1.2+**. Plain HTTP is rejected at the load balancer. | NFR-SEC-001 |
| Injection prevention | All request bodies are Zod-validated server-side. Clients must not rely on client-side sanitisation as a security boundary. | NFR-SEC-007 |
| CORS | Only configured origins are allowed. Wildcard (`*`) is never permitted in production. | NFR-SEC-009 |
| Audit log integrity | `audit_log` entries are append-only. No update or delete operation exists on audit entries. | NFR-SEC-011 |

### 1.9 Role Summary V2

Roles are **additive** — a user holds multiple roles simultaneously (e.g. `["member","student","leader"]`). The `member` role is assigned automatically on registration and **can never be removed**. `super_admin` inherits all `admin` permissions.

| Role | How Assigned | Key Capabilities |
|------|-------------|-----------------|
| `member` | Auto on registration | View system; apply for Bible School; apply to join cell group; view own cell (read-only) |
| `student` | Admin approves role request | Everything member can do + browse course batches; apply to enroll; access approved course content; track progress |
| `leader` | Admin/Super Admin assigns after physical request | Everything member can do + create cell groups; add members to cells; fill cell reports; view own-cell analytics |
| `g12` | Admin/Super Admin/G12 assigns after physical request | Everything leader can do + promote `leader` → `g12`; view network-wide analytics dashboard |
| `admin` | Super Admin creates | Approve student role requests; approve cell group join requests; approve course enrollments; assign `leader`/`g12` roles; manage courses/users; view per-user audit log. **Cannot file cell reports** |
| `super_admin` | Platform owner | All admin capabilities + create admin accounts + assign any role |

> A member can follow **two paths** after registration — apply for Bible School and/or apply to join a Cell Group — both require Admin or Super Admin approval.

---

## 2. Auth Endpoints

---

### 2.1 `POST /auth/register`

Register a new account. **V2:** Creates an **active Member** immediately — no approval queue. V1 created a `pending_approval` Student.

**Authentication:** None (public)  
**Content-Type:** `application/json`

**Request Body:**

```json
{
  "firstName":         "Viruli",
  "lastName":          "Weerasinghe",
  "email":             "viruli@example.com",
  "password":          "SecurePass1@",
  "preferredLanguage": "si"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `firstName` | string | Yes | 1–100 chars |
| `lastName` | string | Yes | 1–100 chars |
| `email` | string | Yes | Valid RFC-5322 email · must be unique |
| `password` | string | Yes | Min **10 chars** · ≥1 uppercase · ≥1 lowercase · ≥1 digit · ≥1 special char |
| `preferredLanguage` | string | No | `"en"` \| `"si"` \| `"ta"` — defaults to `"en"` |

#### Side Effects (on `201`)

| Step | Detail |
|------|--------|
| 1 | Firebase Auth account created with the supplied email + password |
| 2 | Firebase custom claims set: `{ role: "member", roles: ["member"] }` |
| 3 | Firestore user doc created: `status: "approved"`, `roles: ["member"]` |
| 4 | `user.registered` event published to the outbox |
| 5 | Outbox-worker dispatches (~5 s) → **`UserRegisteredHandler`** runs: |
|   | &nbsp;&nbsp;• In-app notification to all Admins: *"New Member Joined"* |
|   | &nbsp;&nbsp;• **Welcome email** sent to the registrant (see below) |

#### Welcome Email

| Field | Value |
|-------|-------|
| **To** | Registered email address |
| **Subject** | `Welcome to TCCR — Please Verify Your Email` |
| **Greeting** | `Welcome, <firstName> <lastName>! 👋` |
| **Description** | Short text: account created, must verify to activate |
| **Verify button** | 🟢 `Verify My Email` (green, primary CTA) — Firebase verification link, **24-hour TTL** |
| **Login button** | 🔵 `Log in to TCCR →` (blue, secondary CTA) — links to `APP_URL` env var |
| **Footer** | Security note: contact support if account was not created by the user |

> **Verification gate:** Until the user clicks the verify button, all protected routes return `403 EMAIL_NOT_VERIFIED`.  
> `APP_URL` env var controls the login button link (default `https://cms.bethelnet.au/login`).  
> Google/Apple users are verified automatically — they never receive this email gate.

> **Environment variable:** `APP_URL` controls the login button link in **all** welcome emails (member registration + leader/g12/admin creation). Set it in `.env`:
> ```
> APP_URL=https://cms.bethelnet.au/login
> ```
> Default: `https://cms.bethelnet.au/login`
>
> **Email delivery:** Configured via `EMAIL_PROVIDER` (`sendgrid` \| `smtp` \| `console`). Delivery is retried 3× with 1 s → 2 s → 4 s backoff. A delivery failure is logged but never surfaces to the client — `201` is always returned if account creation succeeds.

**Response:**
```json
{ "uid": "Xf3aBC...", "message": "Registration successful. Please check your email and click the verification link to activate your account." }
```

| Validation Rule | Error message |
|----------------|--------------|
| `firstName` missing or empty | `firstName: Required` |
| `lastName` missing or empty | `lastName: Required` |
| `email` not valid RFC-5322 | `email: Invalid email` |
| `password` < 10 chars | `password: Password must be at least 10 characters.` |
| `password` missing uppercase | `password: Password must contain an uppercase letter.` |
| `password` missing lowercase | `password: Password must contain a lowercase letter.` |
| `password` missing digit | `password: Password must contain a number.` |
| `password` missing special char | `password: Password must contain a special character.` |
| `preferredLanguage` not `en`/`si`/`ta` | `preferredLanguage: Invalid enum value` |

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — registration successful |
| 400 | `VALIDATION_ERROR` — Zod validation failure (see table above) |
| 409 | `EMAIL_EXISTS` — Email already registered |
| 422 | `DISPOSABLE_EMAIL` — Disposable email domain blocked |
| 422 | `EMAIL_DOMAIN_UNREACHABLE` — Domain has no MX record |

---

### 2.2 `POST /auth/federated/google` — NEW V2

Exchange a Google ID token for a Firebase session (FR-AUTH-003). Creates an active Member if email is new. Google token is discarded after exchange — never persisted (NFR-SEC-006).

**Authentication:** None (public)

**Request Body:**
```json
{ "idToken": "<google-id-token>", "preferredLanguage": "en" }
```

**Response:**
```json
{ "firebaseToken": "<firebase-custom-token>", "uid": "Xf3aBC...", "isNewUser": false }
```

> Client exchanges `firebaseToken` via `signInWithCustomToken()`.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Firebase custom token returned |
| 401 | `FEDERATED_TOKEN_INVALID` — Google ID token validation failed |

---

### 2.3 `POST /auth/federated/apple` — NEW V2

Exchange an Apple identity token for a Firebase session (FR-AUTH-004). Same semantics as Google flow.

**Authentication:** None (public)

**Request Body:**
```json
{ "idToken": "<apple-identity-token>", "preferredLanguage": "en" }
```

**Response:**
```json
{ "firebaseToken": "<firebase-custom-token>", "uid": "Xf3aBC...", "isNewUser": false }
```

Same response shape as `POST /auth/federated/google`.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Firebase custom token returned |
| 401 | `FEDERATED_TOKEN_INVALID` — Apple identity token validation failed |

---

### 2.4 `POST /auth/logout`

Revoke all refresh tokens for the authenticated user.

**Authentication:** Bearer required | **Roles:** Any

**Response:**
```json
{ "message": "Logged out successfully." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Tokens revoked |
| 401 | `UNAUTHORIZED` — Missing or invalid Bearer token |

---

### 2.5 `POST /auth/password-reset`

Sends a TCCR-branded email containing a **direct Firebase password reset link**. User clicks the button → taken directly to Firebase reset page → sets new password. Always `204` regardless of whether the email exists (enumeration prevention).

**Authentication:** None (public)

**Request Body:**
```json
{ "email": "viruli@example.com" }
```

**Response:**
```json
{ "message": "Verification email sent." }
```

**Email sent:**

| Field | Value |
|-------|-------|
| **Subject** | `Reset Your TCCR Password` |
| **Button** | `Reset My Password →` — direct Firebase reset link (1 hr TTL) |
| **Fallback** | Plain reset URL below the button for clients that block HTML |
| **Warning** | ⚠ Ignore if not requested — password unchanged |

> **No OTP required.** The user clicks the link in the email and is taken directly to the Firebase reset page — no second step needed.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Reset email sent (or silently suppressed if email not found) |
| 400 | `VALIDATION_ERROR` — Invalid email format |

---

### 2.6 `POST /auth/password-reset/verify`

> **⚠️ Deprecated.** This endpoint is no longer needed — `POST /auth/password-reset` now sends a direct reset link in a single email. This endpoint remains available for backward compatibility but will always return `400 INVALID_OTP` since no OTP is generated by the new flow.

**Authentication:** None (public)

**Request Body:**
```json
{ "email": "viruli@example.com", "otp": "482910" }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 400 | `INVALID_OTP` — No OTP stored — use the reset link from the email instead |

---

### 2.7 `POST /auth/track-failure`

Record a failed login attempt. After **10 consecutive failures in 15 minutes**, account is locked for 15 minutes and the user is notified (FR-AUTH-009). Locks clear automatically after the window expires — no admin action required.

**Authentication:** None (public)

**Request Body:**
```json
{ "email": "viruli@example.com" }
```

**Response:**
```json
{ "locked": false, "attempts": 3 }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Failure recorded; returns lock status and attempt count |
| 400 | `VALIDATION_ERROR` — Invalid email format |

---

### 2.8 `POST /auth/resend-verification` ★ NEW

Resend a 6-digit email verification OTP. Always returns `204` even if the email is not found (prevents enumeration). OTP expires in 15 minutes.

**Authentication:** None (public) | **Content-Type:** `application/json`

**Request Body:**
```json
{ "email": "user@example.com" }
```

**Response:**
```json
{ "message": "Verification email sent." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — OTP sent (or email not found — silent) |
| 400 | `EMAIL_ALREADY_VERIFIED` — Email is already verified |
| 400 | `VALIDATION_ERROR` — Invalid email format |

---

### 2.9 `POST /auth/verify-email` ★ NEW

Verify email with a 6-digit OTP from the welcome email. Sets `emailVerified = true` in Firebase Auth on success — all protected routes then become accessible.

**Authentication:** None (public) | **Content-Type:** `application/json`

**Request Body:**
```json
{ "email": "user@example.com", "otp": "748349" }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `email` | string | Yes | Valid RFC-5322 email |
| `otp` | string | Yes | Exactly 6 digits |

**OTP Rules:** 15-minute TTL · max 5 wrong attempts (then deleted) · on success: `emailVerified=true` in Firebase Auth

**Response:**
```json
{ "message": "Email verified successfully." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Email verified |
| 400 | `INVALID_OTP` — Wrong code (shows remaining attempts) |
| 400 | `OTP_EXPIRED` — Code has expired — call `POST /auth/resend-verification` |
| 400 | `OTP_MAX_ATTEMPTS` — 5 failed attempts — call `POST /auth/resend-verification` |

---

### 2.10 `GET /auth/apple/init` ★ NEW — Apple Web OAuth (Step 1)

Generates a CSRF state JWT and returns the full Apple authorisation URL. The frontend redirects the user there. For mobile apps using the Apple SDK, use `POST /auth/federated/apple` (§2.3) instead.

**Authentication:** None (public)

**Response:**
```json
{
  "state":        "eyJhbGciOiJIUzI1NiJ9...",
  "authorizeUrl": "https://appleid.apple.com/auth/authorize?client_id=...&state=...&response_type=code&..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `state` | string | CSRF state JWT (10-minute TTL, signed with `JWT_SECRET`). Pass back unmodified in `POST /auth/apple/callback`. |
| `authorizeUrl` | string | Full Apple authorisation URL — redirect the user's browser here |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — State JWT and Apple authorisation URL returned |
| 404 | `APPLE_NOT_CONFIGURED` — `APPLE_CLIENT_ID` env var is missing (expected on local/dev stacks without Apple credentials) |

---

### 2.11 `POST /auth/apple/callback` ★ NEW — Apple Web OAuth (Step 2)

Apple POSTs the auth code here after user consent. Also accepts a forwarded JSON body from frontends. Validates the CSRF state, exchanges the code for tokens, and signs the user in.

**Authentication:** None (public)  
**Content-Type:** `application/x-www-form-urlencoded` (Apple redirect) or `application/json` (frontend forward)

**Request Body:**
```json
{ "code": "<apple-auth-code>", "state": "<state-from-init>" }
```

**Response:**
```json
{ "firebaseToken": "<firebase-custom-token>", "uid": "Xf3aBC...", "isNewUser": false }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Firebase custom token returned |
| 400 | `INVALID_STATE` — State JWT invalid, expired, or mismatched |
| 401 | `FEDERATED_TOKEN_INVALID` — Apple code exchange failed |

---

### 2.12 `POST /auth/apple/refresh` ★ NEW — Apple Web OAuth (Validate Session)

Verify the Apple session is still active. Call periodically to confirm the user has not revoked Apple access. Requires a valid Firebase ID token.

**Authentication:** Bearer required | **Roles:** Any

**Response:**
```json
{ "valid": true }
```

Apple session is confirmed active.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Apple session is active |
| 401 | `UNAUTHORIZED` — Apple refresh token has been revoked — user must re-authenticate |
| 404 | `APPLE_TOKEN_NOT_FOUND` — No Apple refresh token stored for this account (user did not sign in with Apple) |

---

### 2.13 `POST /auth/apple/revoke` ★ NEW — Apple Web OAuth (Account Deletion)

Revoke Apple tokens. **Required by Apple App Store guidelines** when a user deletes their TCCR account — apps that miss this step fail App Store review. Call this endpoint as part of any account-deletion flow for users who signed in with Apple.

**Authentication:** Bearer required | **Roles:** Any

**Response:**
```json
{ "message": "Apple session revoked." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Apple tokens revoked |
| 404 | `NOT_FOUND` — No Apple token stored for this account (non-Apple user) |

---

## 3. Profile Endpoints (Me)

---

### 3.1 `GET /me`

Get the authenticated user's full profile.

**Authentication:** Bearer required | **Roles:** Any

**Response:**
```json
{
  "uid":                     "firebase-uid-abc123",
  "email":                   "viruli@example.com",
  "firstName":               "Viruli",
  "lastName":                "Weerasinghe",
  "role":                    "student",
  "roles":                   ["member", "student"],
  "status":                  "approved",
  "profilePhotoUrl":         null,
  "phoneNumber":             null,
  "preferredLanguage":       "en",
  "fcmTokens":               [],
  "notificationPreferences": { "email": true, "push": true },
  "providers":               ["password"],
  "dateOfBirth":             null,
  "gender":                  null,
  "address":                 null,
  "qualifications":          [],
  "qualificationTitle":      null,
  "qualificationUrl":        null,
  "qualificationStoragePath": null,
  "createdAt":               "2026-05-01T08:00:00.000Z",
  "updatedAt":               "2026-05-01T08:00:00.000Z",
  "deletedAt":               null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | Firebase Auth UID |
| `email` | string | Registered email |
| `firstName` | string | |
| `lastName` | string | |
| `role` | string | Primary role scalar — V1 backward-compat field; always equals the highest role in `roles[]` |
| `roles` | string[] | All current roles e.g. `["member","student"]` |
| `status` | string | `approved` \| `suspended` |
| `profilePhotoUrl` | string \| null | Firebase Storage URL |
| `phoneNumber` | string \| null | International format |
| `preferredLanguage` | string | `en` \| `si` \| `ta` |
| `fcmTokens` | string[] | Registered FCM push tokens |
| `notificationPreferences` | object | `{ email: boolean, push: boolean }` |
| `providers` | string[] | `password`, `google.com`, `apple.com` |
| `dateOfBirth` | string \| null | `YYYY-MM-DD` |
| `gender` | string \| null | `male` \| `female` \| `other` |
| `address` | string \| null | Free text |
| `qualifications` | array | `[{ id, title, fileUrl }]` — ordered list |
| `qualificationTitle` | string \| null | Title of the first qualification (convenience field) |
| `qualificationUrl` | string \| null | Download URL of the first qualification PDF |
| `qualificationStoragePath` | string \| null | Internal Firebase Storage path of the first qualification PDF |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |
| `deletedAt` | string \| null | Non-null = soft-deleted |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Returns full user profile |
| 401 | `UNAUTHORIZED` — Missing or invalid token |

---
END---

---

### 3.2 `PATCH /me`

Update own profile. `email`, `roles`, `status` are immutable through this endpoint.

**Authentication:** Bearer required | **Roles:** Any

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `firstName` | string | No | 1–100 chars |
| `lastName` | string | No | 1–100 chars |
| `profilePhotoUrl` | string\|null | No | Valid URL or null |
| `phoneNumber` | string\|null | No | International format e.g. `+94771234567` |
| `preferredLanguage` | string | No | `en` \| `si` \| `ta` |
| `dateOfBirth` | string\|null | No | `YYYY-MM-DD` |
| `gender` | string\|null | No | `male` \| `female` \| `other` |
| `address` | string\|null | No | 1–500 chars |
| `qualifications` | array | No | Ordered list of qualification entries — see shape below |

**`qualifications[]` item shape:**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | string | Yes | Client-generated UUID — used to identify the entry |
| `title` | string | Yes | Qualification name — no length limit |
| `fileUrl` | string\|null | No | URL returned by `POST /me/qualification`; `null` if no PDF attached |

> The first entry (`qualifications[0]`) is automatically used as the primary qualification when submitting a role request via `POST /role-requests`. `dateOfBirth`, `gender`, and `address` are also required before submitting.

**Response:** Updated User object (includes `qualifications` array).

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Updated user profile |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 401 | `UNAUTHORIZED` — Missing or invalid token |

---
END---

---

### 3.3 `POST /me/change-password`

Change password. Verified via Firebase Identity Toolkit.

**Authentication:** Bearer required | **Roles:** Any

**Request Body:**
```json
{ "currentPassword": "OldPass1", "newPassword": "NewPass2" }
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `currentPassword` | string | Yes | User's existing password |
| `newPassword` | string | Yes | Replacement password |

**Response:**
```json
{ "message": "Password changed successfully." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Password changed |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 401 | `UNAUTHORIZED` — Missing or invalid token |

---
END---

---

### 3.4 `POST /me/avatar`

Upload or replace the authenticated user's profile photo. Stored under `avatars/{uid}.{ext}` in Firebase Storage; the resulting public URL is saved as `profilePhotoUrl` on the user document.

**Authentication:** Bearer required | **Roles:** Any
**Content-Type:** `multipart/form-data`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `photo` | file | Yes | `image/jpeg` or `image/png` · max **2 MB** |

**Response:**
```json
{ "profilePhotoUrl": "https://storage.googleapis.com/bucket/avatars/uid.jpg" }
```

| Field | Type | Description |
|-------|------|-------------|
| `profilePhotoUrl` | string | Firebase Storage public URL of the uploaded photo |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Photo uploaded; returns new `profilePhotoUrl` |
| 400 | `VALIDATION_ERROR` — Wrong MIME type or file too large |
| 401 | `UNAUTHORIZED` — Missing or invalid token |

---
END---

---

### 3.5 `POST /me/qualification` ★ NEW

Upload a qualification PDF to Firebase Storage and receive a download URL.

> **Stateless** — this endpoint does **not** save anything to the user profile. The returned `fileUrl` must be included in the `qualifications[].fileUrl` field when calling `PATCH /me` (§3.2) to persist the qualification. This design supports multiple qualification entries — each PDF gets a unique UUID-namespaced path so uploads never overwrite each other.

**Flow:**
1. `POST /me/qualification` → receive `{ fileUrl }` (or `{ fileUrl: null }` if no file sent)
2. Store `fileUrl` alongside the qualification title in the `qualifications[]` array
3. `PATCH /me` with `{ qualifications: [{ id, title, fileUrl }, ...] }` to save

**Authentication:** Bearer required | **Roles:** Any
**Content-Type:** `multipart/form-data`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `qualification` | file | **No (optional)** | PDF only · max **10 MB** · field name `qualification` |

> **File is optional.** If the `qualification` field is omitted, the endpoint returns `{ fileUrl: null }` without uploading anything. This allows clients to call the endpoint without a PDF and still receive a valid response.

**Response — with file:**
```json
{
  "fileUrl": "https://firebasestorage.googleapis.com/v0/b/bucket/o/qualifications%2Fuid%2Fuuid.pdf?alt=media&token=..."
}
```

**Response — no file provided:**
```json
{ "fileUrl": null }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Returns `{ fileUrl }` (string URL or null if no file sent) |
| 401 | `UNAUTHORIZED` — Missing or invalid token |
| 413 | `FILE_TOO_LARGE` — File exceeds 10 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` — File is not a PDF |

---
END---

---

### 3.6 `POST /me/providers/link` — NEW V2

Link a Google or Apple identity to the account (FR-AUTH-010).

**Authentication:** Bearer required | **Roles:** Any

**Request Body:**
```json
{ "provider": "google", "idToken": "<google-id-token>" }
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `provider` | string | Yes | `google` or `apple` |
| `idToken` | string | Yes | OAuth ID token from the provider |

**Response:**
```json
{ "providers": ["password", "google.com"] }
```

| Field | Type | Description |
|-------|------|-------------|
| `providers` | string[] | All sign-in providers now linked to this account |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Provider linked; returns updated providers list |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 401 | `UNAUTHORIZED` — Missing or invalid token |
| 409 | `PROVIDER_ALREADY_LINKED` — Provider is already linked to this account |

---
END---

---

### 3.7 `DELETE /me/providers/:provider` — NEW V2

Unlink a federated provider. Cannot remove the only remaining sign-in method (FR-AUTH-010).
`:provider` — `google` or `apple`

**Authentication:** Bearer required | **Roles:** Any

**Response:**
```json
{ "providers": ["password"] }
```

| Field | Type | Description |
|-------|------|-------------|
| `providers` | string[] | All sign-in providers still linked after unlinking |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Provider unlinked; returns updated providers list |
| 401 | `UNAUTHORIZED` — Missing or invalid token |
| 409 | `INVALID_STATE` — Cannot remove the only remaining sign-in method |

---
END---

---

### 3.8 `POST /me/fcm-token` — NEW V2

Register/refresh an FCM push token. Call after every login and on token rotation (SRS §8.1.1).

**Authentication:** Bearer required | **Roles:** Any

**Request Body:**
```json
{ "token": "<fcm-token>" }
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `token` | string | Yes | FCM device push token |

**Response:**
```json
{ "message": "FCM token registered." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — FCM token registered |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 401 | `UNAUTHORIZED` — Missing or invalid token |

---
END---

---

### 3.9 `DELETE /me/fcm-token` — NEW V2

Remove FCM token on logout or invalidation.

**Authentication:** Bearer required | **Roles:** Any

**Request Body:**
```json
{ "token": "<fcm-token>" }
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `token` | string | Yes | FCM device push token to remove |

**Response:** Empty response body.

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — FCM token removed |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 401 | `UNAUTHORIZED` — Missing or invalid token |

---
END---

---

### 3.10 `PATCH /me/notifications/preferences` — NEW V2

Update per-channel notification opt-out (FR-NOT-006). Essential notifications always delivered in-app regardless.

**Authentication:** Bearer required | **Roles:** Any

**Request Body:**
```json
{ "email": true, "push": false }
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `email` | boolean | No | Opt in/out of email notifications |
| `push` | boolean | No | Opt in/out of push notifications |

**Response:**
```json
{ "email": true, "push": false }
```

| Field | Type | Description |
|-------|------|-------------|
| `email` | boolean | Current email notification preference |
| `push` | boolean | Current push notification preference |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Preferences updated |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 401 | `UNAUTHORIZED` — Missing or invalid token |

---
END---

---

### 3.11 `GET /me/courses/:courseId` ★ NEW

Returns the authenticated student's personalised view of a course — semester schedule and state derived from their **enrolled batch's** `BatchSemester` dates. Each semester carries a computed `state` so the frontend can lock/unlock content without additional calls.

**Authentication:** Bearer required | **Roles:** Any authenticated
**Gateway proxy:** `/api/v1/me/courses` → course-service (registered before `/api/v1/me` → user-service)

**Semester States:**

| State | Condition |
|-------|-----------|
| `unscheduled` | No `openDate` or `endDate` set for this batch |
| `upcoming` | Today < `openDate` |
| `open` | `openDate` ≤ today ≤ `endDate` |
| `closed` | Today > `endDate` |

**Response:**
```json
{
  "id":    "course-abc",
  "title": "Bible Foundations",
  "state": "published",
  "batch": {
    "id":          "batch-xyz",
    "name":        "2026 Intake 01",
    "intakeStart": "2026-06-01",
    "intakeEnd":   "2026-06-30"
  },
  "semesters": [
    {
      "id":           "sem-001",
      "title":        "Semester 1 — Foundations",
      "order":        1,
      "subjectCount": 1,
      "openDate":     "2026-06-01",
      "endDate":      "2026-08-31",
      "state":        "open",
      "subjects": [
        { "id": "sub-001", "title": "The Gospel of John", "order": 1, "createdAt": "2026-01-15T08:00:00.000Z", "updatedAt": "2026-01-15T08:00:00.000Z" }
      ]
    },
    {
      "id":           "sem-002",
      "title":        "Semester 2 — Deeper Truths",
      "order":        2,
      "subjectCount": 0,
      "openDate":     "2026-09-01",
      "endDate":      "2026-11-30",
      "state":        "upcoming",
      "subjects": []
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Course ID |
| `title` | string | Course title |
| `state` | string | Course lifecycle state |
| `batch` | object | Student's enrolled batch |
| `batch.id` | string | Batch ID |
| `batch.name` | string | Human-readable batch name |
| `batch.intakeStart` | `YYYY-MM-DD` | Enrolment window start |
| `batch.intakeEnd` | `YYYY-MM-DD` | Enrolment window end |
| `semesters[]` | array | All semesters ordered by `order` |
| `semesters[].subjectCount` | number | Number of subjects in this semester |
| `semesters[].state` | string | `unscheduled` \| `upcoming` \| `open` \| `closed` — derived from batch-specific dates |
| `semesters[].openDate` | `YYYY-MM-DD` \| null | Null if not yet scheduled for this batch |
| `semesters[].endDate` | `YYYY-MM-DD` \| null | Null if not yet scheduled for this batch |
| `semesters[].subjects[].createdAt` | ISO datetime | Subject creation timestamp |
| `semesters[].subjects[].updatedAt` | ISO datetime | Subject last-updated timestamp |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Returns student's personalised course view |
| 401 | `UNAUTHORIZED` — Missing or invalid token |
| 404 | `COURSE_NOT_FOUND` — Course not found or student not enrolled |

---
END---
Now I have enough context to produce all the

---

## 4. User Management — Admin

---

### 4.1 `GET /users`

List users with filtering.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`

> **Scoped view for `leader` / `g12`:** These callers only see users with `status: "approved"` and without `admin` or `super_admin` roles — i.e. members, students, and other leaders/g12s. Admin callers see the full unfiltered list.

| Parameter | Type | Description |
|-----------|------|-------------|
| `role` | string | Filter by single role — `member` \| `student` \| `leader` \| `g12` \| `admin` \| `super_admin` |
| `status` | string | `pending_approval` \| `approved` \| `rejected` \| `suspended` |
| `name` | string | Case-sensitive prefix search on `firstName` (min 1, max 100 chars) |
| `limit` | number | 1–100, default 20 |
| `cursor` | string | Cursor from previous `nextCursor` |

**Response:**
```json
{
  "items": [{
    "uid": "firebase-uid-abc", "email": "saman@tccr.lk", "firstName": "Saman", "lastName": "Silva",
    "role": "leader", "roles": ["member","leader"], "status": "approved",
    "profilePhotoUrl": null, "phoneNumber": "+94771234567", "preferredLanguage": "en",
    "fcmTokens": [], "notificationPreferences": {"email":true,"push":true}, "providers": ["password"],
    "dateOfBirth": null, "gender": null, "address": null, "qualifications": [],
    "qualificationTitle": null, "qualificationUrl": null, "qualificationStoragePath": null,
    "createdAt": "2026-05-19T08:00:00.000Z", "updatedAt": "2026-05-19T08:00:00.000Z", "deletedAt": null
  }],
  "nextCursor": "eyJpZCI6ImFiYzEyMyJ9",
  "total": 47
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Paginated user list |
| 401 | `UNAUTHORIZED` — Missing or invalid token |
| 403 | `FORBIDDEN` — Insufficient role |

---

---

### 4.2 `GET /users/:uid`

Get a specific user's profile.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`

> **Scoped access for `leader` / `g12`:** These callers can look up any non-admin user. Attempting to fetch a user who holds `admin` or `super_admin` returns `403 FORBIDDEN`.

**Response:**
```json
{
  "uid": "firebase-uid-abc", "email": "saman@tccr.lk", "firstName": "Saman", "lastName": "Silva",
  "role": "leader", "roles": ["member","leader"], "status": "approved",
  "profilePhotoUrl": null, "phoneNumber": "+94771234567", "preferredLanguage": "en",
  "fcmTokens": [], "notificationPreferences": {"email":true,"push":true}, "providers": ["password"],
  "dateOfBirth": null, "gender": null, "address": null, "qualifications": [],
  "qualificationTitle": null, "qualificationUrl": null, "qualificationStoragePath": null,
  "createdAt": "2026-05-19T08:00:00.000Z", "updatedAt": "2026-05-19T08:00:00.000Z", "deletedAt": null
}
```

User object. See §3.1 for the full User field reference.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — User object |
| 403 | `FORBIDDEN` — leader/g12 attempted to fetch an admin profile |
| 404 | `USER_NOT_FOUND` — User not found |

---

---

### 4.3 `PATCH /users/:uid/roles` — NEW V2

Add or remove a **single role** per request. Role change rules:

| Caller | Can add | Can remove | Cannot |
|--------|---------|-----------|--------|
| `super_admin` | Any role except `super_admin` on others | Any role | Demote last super_admin |
| `admin` | `student`, `leader`, `g12` | `student`, `leader`, `g12` | Touch `admin` or `super_admin` |
| `g12` | `leader`, `g12` | `leader`, `g12` | Touch `admin`, `super_admin`, or `member` |

> `member` can never be removed from any user. Dual-write: every role mutation updates **both** Firestore `roles[]` and Firebase Auth custom claims atomically.

**Authentication:** Bearer required | **Roles:** `admin`, `g12` (super_admin inherits admin)

**Request Body:**
```json
{ "role": "leader", "action": "add" }
```

| Field | Type | Required | Values |
|-------|------|:--------:|--------|
| `role` | string | Yes | Any `UserRole` |
| `action` | string | Yes | `"add"` or `"remove"` |

**Response:**
```json
{ "message": "Role updated successfully." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Role updated successfully |
| 403 | `FORBIDDEN` — caller does not have permission to assign this role |
| 409 | `LAST_SUPER_ADMIN` — cannot demote last super_admin |

---

---

### 4.4 `GET /users/:uid/audit-log` — NEW V2

Per-user audit timeline — all audit entries where this user was the **actor** (FR-SADM-005 / FR-ADM-005). Proxied through the gateway to audit-service.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `action` | Filter by action key (exact match) |
| `category` | Filter by category |
| `from`, `to` | ISO datetime range |
| `limit`, `cursor` | Pagination |

**Response:**
```json
{
  "items": [
    {
      "id": "log-001", "when": "2026-05-15T10:00:00.000Z",
      "actor": { "uid": "admin-uid", "email": "admin@tccr.lk" },
      "action": "role.granted", "category": "enrollment",
      "targetType": "user", "targetId": "Xf3aBC...",
      "ip": "203.0.113.45",
      "requestId": "7f3a-..."
    }
  ],
  "nextCursor": null, "total": 12
}
```

> **Scope note:** Returns entries where `:uid` is the **actor** (the user who performed the action). This is equivalent to calling `GET /audit-log?actorUid=:uid`.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Paginated audit log entries |
| 401 | `UNAUTHORIZED` — Missing or invalid token |
| 403 | `FORBIDDEN` — Insufficient role |

---

---

### 4.5 `POST /users/:uid/suspend`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**
```json
{ "reason": "Policy violation." }
```

**Response:**
```json
{
  "uid": "firebase-uid-abc", "email": "saman@tccr.lk", "firstName": "Saman", "lastName": "Silva",
  "role": "leader", "roles": ["member","leader"], "status": "suspended",
  "profilePhotoUrl": null, "phoneNumber": null, "preferredLanguage": "en",
  "fcmTokens": [], "notificationPreferences": {"email":true,"push":true}, "providers": ["password"],
  "dateOfBirth": null, "gender": null, "address": null, "qualifications": [],
  "qualificationTitle": null, "qualificationUrl": null, "qualificationStoragePath": null,
  "createdAt": "2026-05-19T08:00:00.000Z", "updatedAt": "2026-05-27T14:30:00.000Z", "deletedAt": null
}
```

Updated User with `status: "suspended"`. See §3.1 for field reference.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Updated user object with `status: "suspended"` |
| 404 | `USER_NOT_FOUND` — User not found |

---

---

### 4.6 `POST /users/:uid/reactivate`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**
```json
{
  "uid": "firebase-uid-abc", "email": "saman@tccr.lk", "firstName": "Saman", "lastName": "Silva",
  "role": "leader", "roles": ["member","leader"], "status": "approved",
  "profilePhotoUrl": null, "phoneNumber": null, "preferredLanguage": "en",
  "fcmTokens": [], "notificationPreferences": {"email":true,"push":true}, "providers": ["password"],
  "dateOfBirth": null, "gender": null, "address": null, "qualifications": [],
  "qualificationTitle": null, "qualificationUrl": null, "qualificationStoragePath": null,
  "createdAt": "2026-05-19T08:00:00.000Z", "updatedAt": "2026-05-27T14:35:00.000Z", "deletedAt": null
}
```

Updated User with `status: "approved"`. See §3.1 for field reference.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Updated user object with `status: "approved"` |
| 404 | `USER_NOT_FOUND` — User not found |

---

---

### 4.7 `POST /users` — NEW

Provision a brand-new **leader** or **g12** account for a person who is **not yet registered** in the system. Both a Firebase Auth login and a Firestore user record are created atomically — the user can sign in immediately with the `initialPassword` provided.

Use this when a G12 leader, admin, or super admin needs to on-board a cell leader or G12 leader without requiring self-registration or the role-request flow. For admin accounts use `POST /super-admin/admins` instead.

> **Why this endpoint exists:** `PATCH /users/:uid/roles` can only update an already-registered user's roles — it cannot create a Firebase Auth account for a brand-new person. This endpoint fills that gap.

**Side effects:**
- Firebase Auth account created with `initialPassword`
- Firestore user record created with `roles: ["member", "<role>"]` and `status: "approved"`
- An `admin.created` outbox event is published → `AdminCreatedHandler` sends a **role-specific welcome email**:

  | Condition | Email content |
  |-----------|--------------|
  | `role = "leader"` or `"g12"` | Full welcome with credentials table (email + temp password) + **"Set Your Password →"** button (Firebase reset link, 1 hr TTL) + system URL |
  | `promoted: true` (admin promotion path) | Short promotion notice — no password shown |
  | Default (admin account) | Legacy admin welcome with credentials + reset link |

- Audit log entry written (`audit.action`)

**Authentication:** Bearer required | **Roles:** `g12`, `admin`, `super_admin`

> **Caller restrictions:** A **g12** caller may provision both `leader` and `g12` accounts. An **admin / super_admin** caller may provision any `leader` or `g12` account.

**Request Body:**

```json
{
  "firstName":       "Saman",
  "lastName":        "Silva",
  "email":           "saman@tccr.lk",
  "initialPassword": "Leader@12345",
  "role":            "leader"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `firstName` | string | Yes | 1–50 chars |
| `lastName` | string | Yes | 1–50 chars |
| `email` | string | Yes | Valid email; must be unique |
| `initialPassword` | string | Yes | Min 8 characters |
| `role` | string | Yes | `"leader"` or `"g12"` only |

**Response:** — Full User object. `status: "approved"`, `roles: ["member", "<role>"]`.

```json
{
  "uid":                     "firebase-uid-abc123",
  "email":                   "saman@tccr.lk",
  "firstName":               "Saman",
  "lastName":                "Silva",
  "role":                    "leader",
  "roles":                   ["member", "leader"],
  "status":                  "approved",
  "profilePhotoUrl":         null,
  "phoneNumber":             null,
  "preferredLanguage":       "en",
  "fcmTokens":               [],
  "notificationPreferences": { "email": true, "push": true },
  "providers":               ["password"],
  "dateOfBirth":             null,
  "gender":                  null,
  "address":                 null,
  "qualifications":          [],
  "qualificationTitle":      null,
  "qualificationUrl":        null,
  "qualificationStoragePath": null,
  "createdAt":               "2026-05-19T08:00:00.000Z",
  "updatedAt":               "2026-05-19T08:00:00.000Z",
  "deletedAt":               null
}
```

**Welcome email received by the new user (`leader` / `g12` path):**

| Field | Value |
|-------|-------|
| Subject | `Your Cell Leader Account has been Created — TCCR` or `Your G12 Leader Account has been Created — TCCR` |
| Credentials table | Email + temporary password |
| Reset button | `"Set Your Password →"` — Firebase one-time reset link (1 hr TTL) |
| Fallback (no reset link) | Prompt to change via *My Profile → Change Password* |
| System URL | Configured via `APP_URL` env var (default `https://cms.bethelnet.au/login`) |

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — user created successfully |
| 400 | `VALIDATION_ERROR` — wrong role, missing field, password too short |
| 403 | `FORBIDDEN` — caller is not `g12`, `admin`, or `super_admin` |
| 409 | `EMAIL_EXISTS` — email already registered |

---

### 4.8 `POST /users/:uid/promote` — NEW V2

Promote an **already-registered** user to `leader` or `g12`. Unlike `POST /users` (section 4.7), this endpoint targets an existing user rather than creating a new account. Promotes the Firebase custom claims and Firestore `roles[]` array atomically.

> **Use `POST /users` (4.7) to create a brand-new account.
> Use `POST /users/:uid/promote` (4.8) to elevate an existing member.**

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**Caller-role business rules (enforced in use case, beyond the route guard):**

| Caller | Can promote to |
|--------|----------------|
| `g12`, `admin`, `super_admin` | `leader` or `g12` |
| `leader` | `g12` only (cannot create more leaders) |
| Any | Cannot target a user who holds `admin` or `super_admin` |

**Idempotent** — if the target already holds the requested role, returns `200` silently without re-writing.

**Request Body:**

```json
{ "role": "leader" }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `role` | string | Yes | `"leader"` or `"g12"` only |

**Response:**
```json
{ "message": "User promoted successfully." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — promotion successful |
| 403 | `FORBIDDEN` — caller lacks permission for this role transition |
| 404 | `USER_NOT_FOUND` — user does not exist |

---

### 4.9 `DELETE /users/:uid` ★ NEW

**Permanently hard-deletes** a regular (non-admin) user. Both the Firestore document and the Firebase Auth account are irreversibly removed. This is **not** a soft-delete — there is no recovery.

> **For admin/super_admin accounts** use `DELETE /super-admin/admins/:uid` (section 18) which does a hard-delete instead.

**Authentication:** Bearer required | **Roles:** `admin`

**Business rules — enforced by `DeleteUserUseCase`:**

| Condition | Result |
|-----------|--------|
| `targetUid === callerUid` | `403 FORBIDDEN` — cannot delete yourself |
| Target not found | `404 USER_NOT_FOUND` |
| Target holds `admin` or `super_admin` role | `403 FORBIDDEN` — use `/super-admin/admins/:uid` |
| Target is a `member`, `student`, `leader`, or `g12` | `204 No Content` — permanently deleted |

**Side effects (both must succeed — no partial rollback):**
1. `userRepo.hardDelete(uid)` — **permanently removes** the Firestore document
2. `authClient.deleteUser(uid)` — **permanently removes** the Firebase Auth account

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — user permanently deleted |
| 403 | `FORBIDDEN` — self-delete attempt or target is admin/super_admin |
| 404 | `USER_NOT_FOUND` — user does not exist |

---

### 4.10 `POST /users/:uid/demote` ★ NEW

Remove a specific role from a user and revert them to their remaining roles. Firebase Auth custom claims are updated immediately — the user's access changes on their next token refresh.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**Request Body:**

```json
{ "role": "leader" }
```

| Field | Type | Required | Values |
|-------|------|:--------:|--------|
| `role` | string | Yes | `"student"` \| `"leader"` \| `"g12"` |

#### Caller-Role Permission Matrix

| Caller | Can demote |
|--------|-----------|
| `super_admin` | `student`, `leader`, `g12` |
| `admin` | `student`, `leader`, `g12` |
| `g12` | `leader` only — **cannot demote another `g12`** |
| `leader` | `g12` only |

**Additional guards enforced in use case:**
- Cannot demote yourself
- Cannot demote an `admin` or `super_admin` via this endpoint
- `member` role can never be removed (permanent base role)
- Idempotent — returns `200` silently if the user does not already hold the role

#### What changes after a successful demote

| Before | After (example: remove `leader`) | Access |
|--------|-------------------------------------|--------|
| `roles: ["member","leader"]` | `roles: ["member"]` | Member access only |
| `roles: ["member","student","leader"]` | `roles: ["member","student"]` | Student access |
| `roles: ["member","g12"]` | `roles: ["member"]` | Member access only |

> **Token refresh required:** The user must sign out and sign in again (or call `user.getIdToken(true)`) to receive a new token with the updated roles claim. Existing tokens remain valid until they expire (1 hour).

**Response:**
```json
{ "message": "User demoted successfully." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — demotion successful |
| 400 | `VALIDATION_ERROR` — invalid role value |
| 403 | `FORBIDDEN` — caller does not have permission for this role demotion |
| 404 | `USER_NOT_FOUND` — user does not exist |

---
---

### 4.11 `GET /users/summary` ★ NEW

Returns **all approved users grouped by their highest role** with full profiles in a single response. Designed as a one-page system roster — no pagination needed.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`

> **Scope:** `leader` and `g12` callers follow the same scoped-access rule as `GET /users` — they see only approved non-admin users. The `superAdmins` and `admins` arrays will be empty for these callers. `admin` / `super_admin` callers see all groups.

#### Role Grouping Logic

Each user appears in **exactly one group** — their highest role in this hierarchy:

```
super_admin > admin > g12 > leader > student > member
```

A user with `roles: ["member", "student", "leader"]` appears in **leaders** only. Users are sorted **A→Z by `displayName`** within each group.

**Response:**
```json
{
  "superAdmins": [
    {
      "uid":             "SA001",
      "firstName":       "Pastor",
      "lastName":        "Jayasinghe",
      "displayName":     "Pastor Jayasinghe",
      "email":           "pastor@tccr.lk",
      "roles":           ["super_admin"],
      "phoneNumber":     "+94711234567",
      "profilePhotoUrl": null,
      "createdAt":       "2025-01-10T08:00:00.000Z"
    }
  ],
  "admins": [
    {
      "uid":             "AD001",
      "firstName":       "Admin",
      "lastName":        "User",
      "displayName":     "Admin User",
      "email":           "admin@tccr.lk",
      "roles":           ["admin"],
      "phoneNumber":     null,
      "profilePhotoUrl": null,
      "createdAt":       "2025-02-01T08:00:00.000Z"
    }
  ],
  "g12": [
    {
      "uid":             "G12001",
      "firstName":       "G12",
      "lastName":        "Leader",
      "displayName":     "G12 Leader",
      "email":           "g12leader@tccr.lk",
      "roles":           ["member", "g12"],
      "phoneNumber":     "+94771234567",
      "profilePhotoUrl": "https://firebasestorage.googleapis.com/.../avatars/G12001.jpg",
      "createdAt":       "2025-03-01T08:00:00.000Z"
    }
  ],
  "leaders": [
    {
      "uid":             "LDR001",
      "firstName":       "Cell",
      "lastName":        "Leader",
      "displayName":     "Cell Leader",
      "email":           "leader@tccr.lk",
      "roles":           ["member", "leader"],
      "phoneNumber":     null,
      "profilePhotoUrl": null,
      "createdAt":       "2025-04-01T08:00:00.000Z"
    }
  ],
  "students": [
    {
      "uid":             "STU001",
      "firstName":       "Viruli",
      "lastName":        "Weerasinghe",
      "displayName":     "Viruli Weerasinghe",
      "email":           "viruli@example.com",
      "roles":           ["member", "student"],
      "phoneNumber":     "+94761234567",
      "profilePhotoUrl": null,
      "createdAt":       "2026-01-15T08:00:00.000Z"
    }
  ],
  "members": [
    {
      "uid":             "MEM001",
      "firstName":       "Nimal",
      "lastName":        "Perera",
      "displayName":     "Nimal Perera",
      "email":           "nimal@example.com",
      "roles":           ["member"],
      "phoneNumber":     null,
      "profilePhotoUrl": null,
      "createdAt":       "2026-03-20T08:00:00.000Z"
    }
  ],
  "totals": {
    "superAdmins": 1,
    "admins":      2,
    "g12":         3,
    "leaders":     8,
    "students":    45,
    "members":     120,
    "total":       179
  }
}
```

#### Response Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `superAdmins[]` | `SummaryProfile[]` | Users whose highest role is `super_admin` |
| `admins[]` | `SummaryProfile[]` | Users whose highest role is `admin` |
| `g12[]` | `SummaryProfile[]` | Users whose highest role is `g12` |
| `leaders[]` | `SummaryProfile[]` | Users whose highest role is `leader` |
| `students[]` | `SummaryProfile[]` | Users whose highest role is `student` |
| `members[]` | `SummaryProfile[]` | Base members — hold only the `member` role |
| `totals.total` | number | Sum of all groups (= total approved system users) |

**`SummaryProfile` shape — every profile in every group:**

| Field | Type | Frontend use |
|-------|------|-------------|
| `uid` | string | Firebase Auth UID — use as unique key |
| `firstName` | string | Given name |
| `lastName` | string | Family name |
| `displayName` | string | `firstName + ' ' + lastName`; falls back to `email` if both names are empty |
| `email` | string | Registered email — contact / login identifier |
| `roles` | string[] | Full roles array — use to render role badges (e.g. `["member","leader"]`) |
| `phoneNumber` | string \| null | Contact phone — show in contact directory; `null` if not set |
| `profilePhotoUrl` | string \| null | Firebase Storage download URL for avatar — `null` if no photo |
| `createdAt` | string | ISO 8601 — use for "Joined on …" display |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Grouped user roster |
| 401 | `UNAUTHORIZED` — Missing or invalid token |
| 403 | `FORBIDDEN` — Insufficient role |

#### Frontend Summary Page — Integration Guide

```
GET /api/v1/users/summary
Authorization: Bearer <admin-or-leader-token>
```

**Render the page:**
```
totals.total        → "179 Total Members"
totals.superAdmins  → Super Admin count card
totals.admins       → Admin count card
totals.g12          → G12 Leaders count card
totals.leaders      → Cell Leaders count card
totals.students     → Students count card
totals.members      → Members count card

leaders[]           → Render leader cards (displayName, email, phoneNumber, profilePhotoUrl)
students[]          → Render student table (displayName, email, createdAt)
members[]           → Render member list
roles[]             → Show role badge chips per profile
```

**Scoped view for leader/g12 callers:**
```
superAdmins → [] (empty — hidden)
admins      → [] (empty — hidden)
g12         → visible
leaders     → visible
students    → visible
members     → visible
```

#### Notes

- **No pagination** — entire roster returned in one call. Internally paginates Firestore (100/page) until exhausted.
- **Suspended users excluded** — only `status: "approved"` users appear.
- **Deleted users excluded** — `deletedAt != null` users never appear.
- Response time is proportional to total approved users; at TCCR's scale (≤ 10 000 users) stays under 800 ms (NFR-PER-001).

#### Errors

| Status | Code | Reason |
|--------|------|--------|
| `401` | `UNAUTHENTICATED` | Missing or expired Bearer token |
| `403` | `FORBIDDEN` | Caller does not hold `leader`, `g12`, or `admin` |

---

## 5. Role Requests — NEW V2

After registration every user is a **Member**. From there they can follow two paths — both require Admin/Super Admin approval:

```
              MEMBER (auto on register)
             ↙                        ↘
          apply                      apply
            ↓                          ↓
     Bible School               Cell Group
  (POST /role-requests)   (POST /cells/:id/join-requests)
  Admin/Super Admin approves    Admin/Super Admin approves
            ↓                          ↓
    roles: ["member","student"]   Added to cell group
    Can now enroll in courses     Can view cell (read-only)
```

The Bible School path is **two separate steps**:

**Step 1 — Get Student role** (this section): Member submits a role request with their personal details and education qualification PDF. Admin/Super Admin reviews and approves → member gains `student` role.

**Step 2 — Enroll in a course** (Section 11): Student selects a course + batch and submits an enrollment request. Admin/Super Admin approves → student can access course content.

> `POST /role-requests` grants only the **student role**. Course enrollment is handled separately under [Enrollment Endpoints](#11-enrollment-endpoints). Cell group joining is handled separately under [Cell Group Endpoints](#13-cell-group-endpoints--new-v2).

---

### 5.1 `POST /role-requests`

Member submits an application for the `student` role. Personal details and qualification PDF are read automatically from the member's existing profile — no extra fields needed in the request body.

> **Before submitting**, the member must have completed their profile via `PATCH /me` (§3.2) and uploaded their qualification PDF via `POST /me/qualification` (§3.5). The system snapshots the profile at submission time.

**Authentication:** Bearer required | **Roles:** `member`
**Content-Type:** `application/json`

**Request Body:**
```json
{ "requestedRole": "student" }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `requestedRole` | string | Yes | `"student"` only |

**Response:**
```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "pending",
  "applicantProfile": {
    "firstName":          "John",
    "lastName":           "Doe",
    "phoneNumber":        "+94771234567",
    "email":              "john@example.com",
    "dateOfBirth":        "2000-06-15",
    "gender":             "male",
    "address":            "123 Main St, Colombo",
    "qualificationTitle": "BSc Computer Science",
    "qualificationUrl":   "https://firebasestorage.googleapis.com/v0/b/bucket/o/qualifications%2Fuid.pdf?alt=media&token=..."
  },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": null,
  "decidedByUid":  null,
  "decisionNote":  null,
  "createdAt":     "2026-05-22T09:00:00.000Z",
  "decidedAt":     null
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — role request submitted successfully |
| 400 | `VALIDATION_ERROR` — invalid or missing `requestedRole` |
| 404 | `USER_NOT_FOUND` — profile could not be loaded from user-service |
| 409 | `ROLE_REQUEST_PENDING` — a pending request already exists |

---

### 5.2 `GET /role-requests/mine`

List own role requests (FR-MEM-004).

**Authentication:** Bearer required | **Roles:** Any authenticated

> **Response shape:** Returns a **plain array** (not paginated). `GetMyRoleRequestsUseCase` fetches all requests for the caller and returns them directly via `sendSuccess()`.

**Response:**
```json
[
  {
    "id":            "req-001",
    "requesterUid":  "Xf3aBC...",
    "requestedRole": "student",
    "status":        "pending",
    "applicantProfile": {
      "firstName":   "John",
      "lastName":    "Doe",
      "phoneNumber": "+94771234567",
      "email":       "john@example.com",
      "dateOfBirth": "2000-06-15",
      "gender":      "male",
      "address":     "123 Main St, Colombo"
    },
    "qualificationTitle":       "BSc Computer Science",
    "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
    "decidedByUid":  null,
    "decisionNote":  null,
    "createdAt":     "2026-05-22T09:00:00.000Z",
    "decidedAt":     null
  }
]
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — plain array of own role requests |
| 401 | `UNAUTHENTICATED` — missing or expired token |

---

### 5.3 `GET /role-requests`

List all requests in the admin review queue.

**Authentication:** Bearer required | **Roles:** `admin`

| Parameter | Description |
|-----------|-------------|
| `status` | `pending` \| `approved` \| `rejected` |
| `limit`, `cursor` | Pagination |

**Response:**

Paginated RoleRequest list. Each item includes the full `applicantProfile` object, `qualificationTitle`, and `qualificationStoragePath`.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — paginated list of role requests |
| 401 | `UNAUTHENTICATED` — missing or expired token |
| 403 | `FORBIDDEN` — caller does not hold `admin` |

---

### 5.4 `GET /role-requests/:id` ★ Updated

Get a single role request including full applicant details. For `admin` / `super_admin` callers, the response also includes a **`memberProfile`** block with the member's **current live profile** fetched from user-service — giving the reviewer up-to-date information before approving or rejecting.

**Authentication:** Bearer required | **Roles:** Any authenticated (`member`, `student`, `leader`, `g12`, `admin`, `super_admin`)

**Ownership rule** — enforced by `GetRoleRequestByIdUseCase`:

| Caller | Access | `memberProfile` |
|--------|--------|----------------|
| `admin` / `super_admin` | May fetch **any** role request | ✅ Included (live from user-service) |
| All other roles | May only fetch requests where `roleRequest.requesterUid === caller UID` → `403` otherwise | `null` |

**Response (admin / super_admin)** — Full `RoleRequestDetail` object with live `memberProfile`:

```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "pending",
  "applicantProfile": {
    "firstName":          "John",
    "lastName":           "Doe",
    "phoneNumber":        "+94771234567",
    "email":              "john@example.com",
    "dateOfBirth":        "2000-06-15",
    "gender":             "male",
    "address":            "123 Main St, Colombo",
    "qualificationTitle": "BSc Computer Science",
    "qualificationUrl":   "https://firebasestorage.googleapis.com/..."
  },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
  "decidedByUid":  null,
  "decisionNote":  null,
  "createdAt":     "2026-05-22T09:00:00.000Z",
  "decidedAt":     null,
  "memberProfile": {
    "uid":               "Xf3aBC...",
    "email":             "john@example.com",
    "firstName":         "John",
    "lastName":          "Doe",
    "phoneNumber":       "+94771234567",
    "profilePhotoUrl":   "https://firebasestorage.googleapis.com/.../avatars/Xf3aBC....jpg",
    "dateOfBirth":       "2000-06-15",
    "gender":            "male",
    "address":           "123 Main St, Colombo",
    "preferredLanguage": "en",
    "roles":             ["member"],
    "status":            "approved",
    "accountCreatedAt":  "2026-04-10T07:30:00.000Z",
    "qualifications": [
      {
        "id":      "qual-001",
        "title":   "BSc Computer Science",
        "fileUrl": "https://firebasestorage.googleapis.com/..."
      }
    ]
  }
}
```

**Response (non-admin — own request only)** — Same shape but `memberProfile` is `null`:

```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "pending",
  "applicantProfile": { "..." : "..." },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
  "decidedByUid": null,
  "decisionNote": null,
  "createdAt":    "2026-05-22T09:00:00.000Z",
  "decidedAt":    null,
  "memberProfile": null
}
```

> **Note:** `memberProfile` data is fetched live from user-service on every admin request — it always reflects the member's current profile, unlike `applicantProfile` which is a snapshot taken at submission time. If user-service is temporarily unavailable, `memberProfile` degrades to `null` (the role request data is still returned).

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — role request detail returned |
| 403 | `FORBIDDEN` — non-admin caller tried to view another user's request |
| 404 | `ROLE_REQUEST_NOT_FOUND` — role request not found |

---

### 5.5 `GET /role-requests/:id/qualification` ★ NEW

Generate a **15-minute signed URL** for the applicant's qualification PDF. The file is never publicly accessible — every download requires a fresh signed URL from this endpoint.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**
```json
{
  "signedUrl":          "https://storage.googleapis.com/bucket/qualifications/...?X-Goog-Signature=...",
  "expiresAt":          "2026-05-22T10:15:00.000Z",
  "qualificationTitle": "BSc Computer Science"
}
```

> The signed URL expires after **15 minutes**. Re-call this endpoint to get a fresh URL if needed.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — signed URL returned |
| 401 | `UNAUTHENTICATED` — missing or expired token |
| 403 | `FORBIDDEN` — caller does not hold `admin` or `super_admin` |
| 404 | `ROLE_REQUEST_NOT_FOUND` — role request not found |

---

### 5.6 `POST /role-requests/:id/approve`

Grants the requested role — adds `student` to `roles[]` and updates Firebase custom claims atomically. **Does not create a course enrollment** — the student must separately apply for a course batch via `POST /enrollments`.

**Authentication:** Bearer required | **Roles:** `admin`

> Admin cannot approve their own requests (FR-ADM-008).

**Request Body:**
```json
{ "note": "Welcome! You can now browse and apply for courses." }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `note` | string | No | max 500 chars — shown in the approval email sent to the student |

#### Side Effects (on `200`)

| Step | Detail |
|------|--------|
| 1 | `student` role added to user's `roles[]` in Firestore and Firebase Auth custom claims (dual-write) |
| 2 | `role.granted` event published to the outbox |
| 3 | Outbox-worker dispatches (~5 s) → **`RoleGrantedHandler`** runs: |
|   | &nbsp;&nbsp;• In-app notification to the student: *"Student Role Approved"* |
|   | &nbsp;&nbsp;• **Approval email** sent to the student's registered address (see below) |
|   | &nbsp;&nbsp;• Audit log entry written |
| 4 | Student enrichment is fire-and-forget — if user-service is unavailable, role grant still proceeds and email fields fall back to `undefined` |

#### Approval Email

| Field | Value |
|-------|-------|
| **To** | Student's registered email address |
| **Subject** | `Your Student Application has been Approved — TCCR` |
| **Greeting** | `Hi <firstName> <lastName>,` |
| **Role table** | Role Granted: **Student ✓** (green) |
| **Admin note** | Blue left-border callout showing the `note` field (omitted if blank) |
| **Next steps** | Browse courses → Submit enrollment requests → Track progress |
| **Login button** | `Log in to TCCR →` — links to `APP_URL` (default `https://cms.bethelnet.au/login`) |

> Role labels: `student` → "Student", `leader` → "Cell Leader", `g12` → "G12 Leader"  
> Email delivery is retried 3× with 1 s → 2 s → 4 s backoff. Failure is logged but never surfaces — `200` is always returned if the role grant succeeds.

**Response:**
```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "approved",
  "decidedByUid":  "admin-uid",
  "decisionNote":  "Welcome! You can now browse and apply for courses.",
  "applicantProfile": {
    "firstName":   "John",
    "lastName":    "Doe",
    "phoneNumber": "+94771234567",
    "email":       "john@example.com",
    "dateOfBirth": "2000-06-15",
    "gender":      "male",
    "address":     "123 Main St, Colombo"
  },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
  "createdAt":     "2026-05-22T09:00:00.000Z",
  "decidedAt":     "2026-05-22T10:05:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — role request approved; role granted to student |
| 404 | `ROLE_REQUEST_NOT_FOUND` — role request not found |
| 409 | `INVALID_STATE` — request is already approved or rejected |

---

### 5.7 `POST /role-requests/:id/reject`

Rejects the role application (FR-ENR-005).

**Authentication:** Bearer required | **Roles:** `admin`

**Request Body:**
```json
{ "note": "Batch is full. Please apply for the next intake." }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `note` | string | No | max 500 chars |

#### Side Effects (on `200`)

| Step | Detail |
|------|--------|
| 1 | `role.rejected` event published to the outbox |
| 2 | Outbox-worker dispatches — event is **not currently wired** in EventDispatcher; silently skipped. No email or in-app notification is sent to the student at this time. |

**Response:**

```json
{
  "id":            "req-001",
  "requesterUid":  "Xf3aBC...",
  "requestedRole": "student",
  "status":        "rejected",
  "decidedByUid":  "admin-uid",
  "decisionNote":  "Batch is full. Please apply for the next intake.",
  "applicantProfile": {
    "firstName":   "John",
    "lastName":    "Doe",
    "phoneNumber": "+94771234567",
    "email":       "john@example.com",
    "dateOfBirth": "2000-06-15",
    "gender":      "male",
    "address":     "123 Main St, Colombo"
  },
  "qualificationTitle":       "BSc Computer Science",
  "qualificationStoragePath": "qualifications/Xf3aBC.../req-001.pdf",
  "createdAt":     "2026-05-22T09:00:00.000Z",
  "decidedAt":     "2026-05-22T10:05:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — role request rejected |
| 404 | `ROLE_REQUEST_NOT_FOUND` — role request not found |
| 409 | `INVALID_STATE` — request is already approved or rejected |

---

## 6. Course Endpoints

---

### 6.1 `GET /courses`

List courses. Member/Student/public see `published` only. Admin sees all states.

**Authentication:** Optional | **Roles:** All

| Parameter | Description |
|-----------|-------------|
| `title` | Case-sensitive prefix search on course title |
| `state` | `draft` \| `published` \| `archived` (admin only) |
| `limit`, `cursor` | Pagination |

**Response:**
```json
{
  "items": [{
    "id":           "course-abc",
    "title":        "Bible Foundations",
    "description":  "An introduction to the Bible.",
    "coverImageUrl": null,
    "state":        "published",
    "createdBy":    "admin-uid-xyz",
    "semesterCount": 3,
    "publishedAt":  "2026-02-01T08:00:00.000Z",
    "deletedAt":    null,
    "createdAt":    "2026-01-01T08:00:00.000Z",
    "updatedAt":    "2026-05-01T09:00:00.000Z"
  }],
  "nextCursor": null, "total": 5
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — paginated list of courses |

---

### 6.2 `GET /courses/:id`

Get course with full semester/subject tree and batch schedule. Student/public get `404` if draft or archived. `batches[]` is returned for **all** callers — no authentication required to read it.

**Authentication:** Optional | **Roles:** All

**Response:**
```json
{
  "id":            "course-abc",
  "title":         "Bible Foundations",
  "description":   "An introduction to the Bible.",
  "coverImageUrl": null,
  "state":         "published",
  "createdBy":     "admin-uid-xyz",
  "semesterCount": 2,
  "publishedAt":   "2026-02-01T08:00:00.000Z",
  "deletedAt":     null,
  "createdAt":     "2026-01-01T08:00:00.000Z",
  "updatedAt":     "2026-05-01T09:00:00.000Z",
  "semesters": [
    {
      "id": "sem-001", "title": "Semester 1 — Foundations",
      "subjectCount": 1, "order": 1,
      "createdAt": "2026-01-15T08:00:00.000Z", "updatedAt": "2026-01-15T08:00:00.000Z",
      "subjects": [{ "id": "sub-001", "title": "The Gospel of John", "order": 1, "createdAt": "2026-01-15T08:00:00.000Z", "updatedAt": "2026-01-15T08:00:00.000Z" }]
    }
  ],
  "batches": [
    {
      "id":          "batch-xyz",
      "name":        "2026 Intake 01",
      "intakeStart": "2026-06-01",
      "intakeEnd":   "2026-06-30",
      "capacity":    50,
      "state":       "open",
      "semesters": [
        { "semesterId": "sem-001", "openDate": "2026-07-01", "endDate": "2026-09-30" },
        { "semesterId": "sem-002", "openDate": null,          "endDate": null }
      ]
    }
  ]
}
```

#### Response field reference — `batches[]`

| Field | Type | Description |
|-------|------|-------------|
| `batches[].id` | string | Batch UUID |
| `batches[].name` | string | Human-readable intake name (e.g. `"2026 Intake 01"`) |
| `batches[].intakeStart` | `YYYY-MM-DD` | Enrolment window start date |
| `batches[].intakeEnd` | `YYYY-MM-DD` | Enrolment window end date |
| `batches[].capacity` | number \| null | Max enrolments; `null` = unlimited |
| `batches[].state` | string | `draft` \| `open` \| `closed` |
| `batches[].semesters[]` | array | Per-batch semester schedule written via `PUT /courses/:cid/batches/:bid/semester-dates` |
| `batches[].semesters[].semesterId` | string | Matches a `semesters[].id` in this response |
| `batches[].semesters[].openDate` | `YYYY-MM-DD` \| null | Null when not yet scheduled for this batch |
| `batches[].semesters[].endDate` | `YYYY-MM-DD` \| null | Null when not yet scheduled for this batch |

> **Student use:** To derive a semester's open/close state for a specific student, cross-reference `batches[].semesters[]` against the student's enrolled batch ID (available from `GET /me/courses/:courseId` §3.11, which computes states server-side). `GET /courses/:id` returns the raw schedule for all batches; §3.11 returns computed states for the student's own batch only.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — course detail with semester/subject tree and batch schedule |
| 404 | `COURSE_NOT_FOUND` — course not found or not accessible |

---

### 6.3 `POST /courses`

Create a course in `draft` state. `title` must be unique.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**
```json
{ "title": "Bible Foundations", "description": "...", "coverImageUrl": null }
```

**Response:**
```json
{
  "id":             "course-abc",
  "title":          "Bible Foundations",
  "description":    "An introductory course covering fundamental biblical principles.",
  "coverImageUrl":  null,
  "state":          "draft",
  "createdBy":      "admin-001",
  "semesterCount":  0,
  "publishedAt":    null,
  "deletedAt":      null,
  "createdAt":      "2026-05-31T10:00:00.000Z",
  "updatedAt":      "2026-05-31T10:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Course UUID |
| `title` | string | Unique course title |
| `description` | string | Course description |
| `coverImageUrl` | string \| null | Course cover image URL or null |
| `state` | string | `draft` \| `published` \| `archived` |
| `createdBy` | string | UID of the admin who created the course |
| `semesterCount` | number | Number of semesters |
| `publishedAt` | string \| null | ISO datetime when published; null if draft |
| `deletedAt` | string \| null | Always null for active courses |
| `createdAt` | string | ISO datetime of creation |
| `updatedAt` | string | ISO datetime of last update |

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — course created in draft state |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 409 | `COURSE_TITLE_EXISTS` — a course with this title already exists |

---

### 6.4 `PATCH /courses/:id`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `title` | string | No | 1–200 chars; must be unique |
| `description` | string | No | Max 500 chars |
| `coverImageUrl` | string \| null | No | Valid URL or `null` |

**Response:**
```json
{
  "id":             "course-abc",
  "title":          "Bible Foundations: Complete Edition",
  "description":    "An updated introductory course covering fundamental biblical principles.",
  "coverImageUrl":  "https://example.com/images/course-cover.jpg",
  "state":          "draft",
  "createdBy":      "admin-001",
  "semesterCount":  2,
  "publishedAt":    null,
  "deletedAt":      null,
  "createdAt":      "2026-05-31T10:00:00.000Z",
  "updatedAt":      "2026-05-31T11:30:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — course updated |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 404 | `COURSE_NOT_FOUND` — course not found |
| 409 | `COURSE_TITLE_EXISTS` — a course with this title already exists |

---

### 6.5 `POST /courses/:id/publish`

Publish a `draft` course. Requires: ≥1 Semester, and every semester must have ≥1 Subject.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**
```json
{
  "id": "course-abc", "title": "Bible Foundations", "description": "An introductory course.",
  "coverImageUrl": null, "state": "published", "createdBy": "admin-001", "semesterCount": 2,
  "publishedAt": "2026-05-31T12:00:00.000Z", "deletedAt": null,
  "createdAt": "2026-05-31T10:00:00.000Z", "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — course published |
| 404 | `COURSE_NOT_FOUND` — course not found |
| 409 | `INVALID_STATE` — course is not in draft state |
| 422 | `NO_SEMESTERS` — course has no semesters |
| 422 | `EMPTY_SEMESTER` — a semester has no subjects |

---

### 6.6 `POST /courses/:id/unpublish`

Return to `draft`. Enrolled students retain enrollments; content suspended until re-published.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**
```json
{
  "id": "course-abc", "title": "Bible Foundations", "description": "An introductory course.",
  "coverImageUrl": null, "state": "draft", "createdBy": "admin-001", "semesterCount": 2,
  "publishedAt": null, "deletedAt": null,
  "createdAt": "2026-05-31T10:00:00.000Z", "updatedAt": "2026-05-31T13:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — course returned to draft |
| 404 | `COURSE_NOT_FOUND` — course not found |
| 409 | `INVALID_STATE` — course is not in published state |

---

### 6.7 `POST /courses/:id/archive`

Archive a published course. Cannot archive if active enrollments exist (FR-CRS-008).

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**
```json
{
  "id": "course-abc", "title": "Bible Foundations", "description": "An introductory course.",
  "coverImageUrl": null, "state": "archived", "createdBy": "admin-001", "semesterCount": 2,
  "publishedAt": "2026-05-31T12:00:00.000Z", "deletedAt": null,
  "createdAt": "2026-05-31T10:00:00.000Z", "updatedAt": "2026-05-31T14:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — course archived |
| 404 | `COURSE_NOT_FOUND` — course not found |
| 409 | `INVALID_STATE` — course has active enrollments or is not in published state |

---

### 6.8 `POST /courses/:id/restore`

Restore an `archived` course back to `draft`. The course must be re-published before it is visible to students again.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**
```json
{
  "id": "course-abc", "title": "Bible Foundations", "description": "An introductory course.",
  "coverImageUrl": null, "state": "draft", "createdBy": "admin-001", "semesterCount": 2,
  "publishedAt": null, "deletedAt": null,
  "createdAt": "2026-05-31T10:00:00.000Z", "updatedAt": "2026-05-31T15:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — course restored to draft |
| 404 | `COURSE_NOT_FOUND` — course not found |
| 409 | `INVALID_STATE` — course is not in archived state |

---

### 6.9 `DELETE /courses/:id`

Permanently hard-deletes the course and **all** its dependent data in a single atomic Firestore operation: semesters, subjects, lessons, and `batch_semesters` records. There is no recovery window.

**Authentication:** Bearer required | **Roles:** `admin`

**Response:**

Empty response body.

> The `deletedAt` field still exists on Firestore documents for backward compatibility with legacy soft-deleted data, but new deletes are permanent. `super_admin` may use `DELETE /courses/:id/hard` (§6.10) — same behaviour, separate route.

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — course and all dependent data permanently deleted |
| 404 | `COURSE_NOT_FOUND` — course not found |

---

### 6.10 `DELETE /courses/:id/hard` ★ NEW

Permanently hard-deletes the course and all its dependent data. Identical behaviour to `DELETE /courses/:id` (§6.9) but restricted to `super_admin` only.

**Authentication:** Bearer required | **Roles:** `super_admin`

**Response:**

Empty response body.

> Both §6.9 and §6.10 call the same underlying `courseRepo.hardDelete(id)` operation. The two routes exist to give `admin` a delete capability while reserving the explicit `/hard` path as a super-admin-only action.

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — course and all dependent data permanently deleted |
| 404 | `COURSE_NOT_FOUND` — course not found |

---

## 7. Batch Endpoints — NEW V2

Batches are intake cohorts. They carry **no curriculum** — all batches of a course share the same Semesters/Subjects/Lessons (SRS §8.2.2).

---

### 7.1 `GET /courses/:id/batches`

**Authentication:** Bearer required | **Roles:** Any authenticated

| Parameter | Description |
|-----------|-------------|
| `state` | `draft` \| `open` \| `closed` |
| `limit`, `cursor` | Pagination |

**Response:**
```json
{
  "items": [{
    "id":               "batch-xyz",
    "courseId":         "course-abc",
    "name":             "2026 Intake 01",
    "scheduledOpenAt":  "2026-06-01T08:00:00.000Z",
    "intakeStart":      "2026-06-01",
    "intakeEnd":        "2026-06-30",
    "capacity":         50,
    "state":            "open",
    "createdAt":        "2026-05-01T00:00:00.000Z",
    "updatedAt":        "2026-05-01T00:00:00.000Z"
  }],
  "nextCursor": null, "total": 2
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — paginated list of batches |
| 401 | `UNAUTHENTICATED` — missing or expired token |
| 404 | `COURSE_NOT_FOUND` — course not found |

---

### 7.2 `POST /courses/:id/batches`

Create a batch (FR-CRS-002).

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**
```json
{
  "name":            "2026 Intake 01",
  "scheduledOpenAt": "2026-06-01T08:00:00.000Z",
  "intakeStart":     "2026-06-01",
  "intakeEnd":       "2026-06-30",
  "capacity":        50
}
```

| Field | Required | Notes |
|-------|:--------:|-------|
| `name` | Yes | Unique within course |
| `scheduledOpenAt` | No | ISO datetime — batch **auto-opens** at this time (Scheduled Jobs trigger). If omitted, admin must open manually via `POST /batches/:id/open`. |
| `intakeStart` | Yes | ISO date — earliest date students can submit enrollment |
| `intakeEnd` | Yes | ISO date — must be after `intakeStart`; enrollment window **auto-closes** when this passes |
| `capacity` | No | Optional max student cap |

> **Auto-scheduling:** When `scheduledOpenAt` is set, the Scheduled Jobs service polls every 15 minutes and flips `state` from `draft` → `open` at the scheduled time. When `intakeEnd` passes, the same job flips `state` from `open` → `closed` automatically.

**Response:**

Batch object (see §7.3 for field reference).

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — batch created |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 404 | `COURSE_NOT_FOUND` — course not found |

---

### 7.3 `GET /batches/:id`

**Authentication:** Bearer required | **Roles:** Any authenticated

**Response:**
```json
{
  "id": "batch-xyz", "courseId": "course-abc", "name": "2026 Intake 01",
  "scheduledOpenAt": "2026-06-01T08:00:00.000Z", "intakeStart": "2026-06-01",
  "intakeEnd": "2026-06-30", "capacity": 50, "state": "open",
  "createdAt": "2026-05-31T00:00:00.000Z", "updatedAt": "2026-05-31T00:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Batch UUID |
| `courseId` | string | Parent course UUID |
| `name` | string | Intake name |
| `scheduledOpenAt` | string \| null | ISO datetime for auto-open; null if not scheduled |
| `intakeStart` | string | ISO date for enrollment window start |
| `intakeEnd` | string | ISO date for enrollment window end |
| `capacity` | number \| null | Max enrolments; null = unlimited |
| `state` | string | `draft` \| `open` \| `closed` |
| `createdAt` | string | ISO datetime of creation |
| `updatedAt` | string | ISO datetime of last update |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — batch detail |
| 401 | `UNAUTHENTICATED` — missing or expired token |
| 404 | `BATCH_NOT_FOUND` — batch not found |

---

### 7.4 `PATCH /batches/:id`

Cannot change `scheduledOpenAt` once the batch leaves `draft`.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `name` | string | No | 1–200 chars |
| `scheduledOpenAt` | ISO datetime \| null | No | Cannot change once batch leaves `draft` |
| `intakeStart` | `YYYY-MM-DD` | No | Enrollment window start |
| `intakeEnd` | `YYYY-MM-DD` | No | Must be ≥ `intakeStart` |
| `capacity` | number \| null | No | Integer ≥ 1; `null` = unlimited |

**Response:**
```json
{
  "id": "batch-xyz", "courseId": "course-abc", "name": "2026 Intake 01 (Extended)",
  "scheduledOpenAt": "2026-06-01T08:00:00.000Z", "intakeStart": "2026-06-01",
  "intakeEnd": "2026-07-15", "capacity": 100, "state": "open",
  "createdAt": "2026-05-31T00:00:00.000Z", "updatedAt": "2026-05-31T11:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — batch updated |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 404 | `BATCH_NOT_FOUND` — batch not found |
| 409 | `INVALID_STATE` — attempted to change `scheduledOpenAt` after batch left draft |

---

### 7.5 `POST /batches/:id/open`

Manually open a batch for enrollment before or instead of the `scheduledOpenAt` time. Batch must be in `draft` state.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**
```json
{
  "id": "batch-xyz", "courseId": "course-abc", "name": "2026 Intake 01",
  "scheduledOpenAt": "2026-06-01T08:00:00.000Z", "intakeStart": "2026-06-01",
  "intakeEnd": "2026-06-30", "capacity": 50, "state": "open",
  "createdAt": "2026-05-31T00:00:00.000Z", "updatedAt": "2026-05-31T09:30:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — batch opened |
| 404 | `BATCH_NOT_FOUND` — batch not found |
| 409 | `INVALID_STATE` — batch is not in draft state |

---

### 7.6 `POST /batches/:id/close`

Manually close intake window before `intakeEnd` is reached. No new enrollment requests will be accepted after closing.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**
```json
{
  "id": "batch-xyz", "courseId": "course-abc", "name": "2026 Intake 01",
  "scheduledOpenAt": "2026-06-01T08:00:00.000Z", "intakeStart": "2026-06-01",
  "intakeEnd": "2026-06-30", "capacity": 50, "state": "closed",
  "createdAt": "2026-05-31T00:00:00.000Z", "updatedAt": "2026-05-31T16:45:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — batch closed |
| 404 | `BATCH_NOT_FOUND` — batch not found |
| 409 | `INVALID_STATE` — batch is not in open state |

---

### 7.7 `PUT /courses/:courseId/batches/:batchId/semester-dates` ★ NEW

Set open and end dates for every semester in a batch in one call. Replaces all existing `BatchSemester` records for this batch. Admin only.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "schedule": [
    { "semesterId": "sem-001", "openDate": "2026-06-01", "endDate": "2026-08-31" },
    { "semesterId": "sem-002", "openDate": "2026-09-01", "endDate": "2026-11-30" }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `schedule` | array | Yes | One entry per semester to schedule |
| `schedule[].semesterId` | string | Yes | Must belong to the batch's parent course |
| `schedule[].openDate` | `YYYY-MM-DD` \| null | Yes | Date the semester opens for this batch |
| `schedule[].endDate` | `YYYY-MM-DD` \| null | Yes | Date the semester closes for this batch |

**Response:**
```json
[
  { "semesterId": "sem-001", "openDate": "2026-06-01", "endDate": "2026-08-31" },
  { "semesterId": "sem-002", "openDate": "2026-09-01", "endDate": "2026-11-30" }
]
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — array of updated BatchSemesterView entries |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 403 | `FORBIDDEN` — caller is not `admin` or `super_admin` |
| 404 | `BATCH_NOT_FOUND` — batch not found |
| 404 | `SEMESTER_NOT_FOUND` — a semesterId does not belong to the course |

---

### 7.8 `PATCH /courses/:courseId/batches/:batchId/semester-dates/:semesterId` ★ NEW

Update a single semester's open and end dates within a batch without touching other semesters.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`
**Content-Type:** `application/json`

**Request Body:**
```json
{ "openDate": "2026-07-01", "endDate": "2026-09-30" }
```

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `openDate` | `YYYY-MM-DD` \| null | Yes | New open date for this semester in this batch |
| `endDate` | `YYYY-MM-DD` \| null | Yes | New end date for this semester in this batch |

**Response:**
```json
{ "semesterId": "sem-001", "openDate": "2026-07-01", "endDate": "2026-09-30" }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — updated BatchSemesterView |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 403 | `FORBIDDEN` — caller is not `admin` or `super_admin` |
| 404 | `BATCH_NOT_FOUND` — batch not found |
| 404 | `SEMESTER_NOT_FOUND` — semester not found in this batch |

---

## 8. Semester Endpoints

V1 carry-forward. V2 adds `openDate` and `endDate` (FR-CRS-003).

> **SRS §8.2.3:** Semesters are a sub-collection of **courses**, not batches. `GET /batches/:id/semesters` is an alias that returns the parent course's semesters.

---

### 8.1 `GET /courses/:id/semesters`

**Authentication:** Bearer required | **Roles:** Any authenticated

**Response:**
```json
{
  "items": [{
    "id": "sem-001", "courseId": "course-abc",
    "title": "Semester 1 — Foundations", "order": 1,
    "openDate": "2026-07-01", "endDate": "2026-09-30",
    "status": "active", "subjectCount": 4,
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-05-01T08:00:00.000Z"
  }],
  "nextCursor": null, "total": 3
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — paginated semester list |
| 404 | `COURSE_NOT_FOUND` — course does not exist |

---

### 8.2 `POST /courses/:id/semesters` — Amended V2

V2 adds `openDate` and `endDate`. After `endDate` the semester is auto-disabled by the nightly sweep job (FR-CRS-004).

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**
```json
{ "title": "Semester 1 — Foundations", "openDate": "2026-07-01", "endDate": "2026-09-30" }
```

> **`order`** is assigned automatically (incrementing count of existing semesters + 1) and cannot be set in the request.

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | string | Yes | 1–200 chars |
| `openDate` | string | No | ISO date (`YYYY-MM-DD`); when content becomes accessible. Defaults to `null`. |
| `endDate` | string | No | ISO date (`YYYY-MM-DD`); semester auto-disabled by nightly sweep after this date. Defaults to `null`. |

**Response:**
```json
{
  "id": "sem-001", "courseId": "course-abc", "title": "Semester 1 — Foundations",
  "subjectCount": 0, "order": 1, "openDate": "2026-07-01", "endDate": "2026-09-30",
  "status": "active", "deletedAt": null,
  "createdAt": "2026-05-31T10:00:00.000Z", "updatedAt": "2026-05-31T10:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Semester UUID |
| `courseId` | string | Parent course ID |
| `title` | string | Semester title |
| `subjectCount` | number | Number of subjects (starts at 0) |
| `order` | number | Display order (auto-assigned) |
| `openDate` | string \| null | ISO date when semester opens |
| `endDate` | string \| null | ISO date when semester ends |
| `status` | string | `active` \| `disabled` |
| `deletedAt` | string \| null | Null for active records |
| `createdAt` | string | ISO datetime of creation |
| `updatedAt` | string | ISO datetime of last update |

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — semester created successfully |
| 400 | `VALIDATION_ERROR` — Zod validation failure |

---

### 8.3 `PATCH /semesters/:id`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | string | No | 1–200 chars |
| `openDate` | `YYYY-MM-DD` \| null | No | Semester open date |
| `endDate` | `YYYY-MM-DD` \| null | No | Semester end date |

**Response:**
```json
{
  "id": "sem-001", "courseId": "course-abc", "title": "Semester 1 — Advanced Topics",
  "subjectCount": 4, "order": 1, "openDate": "2026-08-01", "endDate": "2026-10-31",
  "status": "active", "deletedAt": null,
  "createdAt": "2026-05-01T08:00:00.000Z", "updatedAt": "2026-05-31T11:30:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — semester updated |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 404 | `SEMESTER_NOT_FOUND` — semester does not exist |

---

### 8.4 `DELETE /semesters/:id`

Soft-delete a semester and all its subjects.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**

Empty response body.

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — semester deleted |
| 404 | `SEMESTER_NOT_FOUND` — semester does not exist |

---

## 9. Subject & Lesson Endpoints

---

### 9.1 `GET /semesters/:id/subjects`

List active subjects. Student must have approved enrollment in the parent course.

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`, `admin`, `super_admin`

**Response:**
```json
[{
  "id": "sub-001",
  "semesterId": "sem-001",
  "courseId": "course-abc",
  "title": "The Gospel of John",
  "order": 1,
  "deletedAt": null,
  "createdAt": "2026-05-01T09:00:00.000Z",
  "updatedAt": "2026-05-01T09:00:00.000Z"
}]
```

> Use `POST /subjects/:id/attachments` (§10.1) and `POST /subjects/:id/images` (§10.2) to upload files associated with a subject. Use `GET /attachments/:id/download-url` (§10.3) to retrieve a signed download URL for an attachment.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — subject list returned |
| 403 | `SEMESTER_DISABLED` — semester's endDate passed (FR-STU-005) |

---

### 9.2 `POST /semesters/:id/subjects`

Creates a new subject under the specified semester. `order` is assigned automatically. Use `POST /subjects/:id/attachments` (§10.1) and `POST /subjects/:id/images` (§10.2) to upload files separately after creation.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**
```json
{ "title": "The Gospel of John" }
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | string | Yes | 1–200 chars |

**Response:**
```json
{
  "id": "sub-001", "semesterId": "sem-001", "courseId": "course-abc",
  "title": "The Gospel of John", "order": 1, "deletedAt": null,
  "createdAt": "2026-05-31T10:15:00.000Z", "updatedAt": "2026-05-31T10:15:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Subject UUID |
| `semesterId` | string | Parent semester ID |
| `courseId` | string | Parent course ID |
| `title` | string | Subject title |
| `order` | number | Display order (auto-assigned) |
| `deletedAt` | string \| null | Null for active records |
| `createdAt` | string | ISO datetime of creation |
| `updatedAt` | string | ISO datetime of last update |

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — subject created successfully |
| 400 | `VALIDATION_ERROR` — Zod validation failure |

---

### 9.3 `PATCH /subjects/:id`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | string | No | 1–200 chars |

**Response:**
```json
{
  "id": "sub-001", "semesterId": "sem-001", "courseId": "course-abc",
  "title": "The Gospel of John — Advanced Study", "order": 1, "deletedAt": null,
  "createdAt": "2026-05-01T09:00:00.000Z", "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — subject updated |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 404 | `SUBJECT_NOT_FOUND` — subject does not exist |

---

### 9.4 `DELETE /subjects/:id`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**

Empty response body.

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — subject deleted |
| 404 | `SUBJECT_NOT_FOUND` — subject does not exist |

---

### 9.5 `GET /subjects/:id/lessons`

Plain array of Lesson objects, ordered by `order` ascending (FR-LRN-001).

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12` (enrolled), `admin`, `super_admin`

**Response:**
```json
[{
  "id": "lesson-001", "subjectId": "sub-001", "courseId": "course-abc", "semesterId": "sem-001",
  "title": "Introduction to John's Gospel",
  "description": "Overview of the fourth Gospel.",
  "youtubeVideoId": "dQw4w9WgXcQ",
  "attachmentIds": ["att-001"],
  "order": 1, "deletedAt": null,
  "createdAt": "2026-05-12T09:00:00.000Z",
  "updatedAt": "2026-05-12T09:00:00.000Z"
}]
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — lesson list returned |

---

### 9.6 `POST /subjects/:id/lessons`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**
```json
{
  "title": "Introduction to John's Gospel",
  "description": "Overview of the fourth Gospel.",
  "youtubeVideoId": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "attachmentIds": []
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | string | Yes | 1–200 chars |
| `description` | string | No | Max 2000 chars |
| `youtubeVideoId` | string \| null | No | Valid YouTube URL; 11-char ID extracted and stored. Pass `null` to clear. |
| `attachmentIds` | string[] | No | Array of existing Attachment IDs |

**Response:**
```json
{
  "id": "lesson-001", "subjectId": "sub-001", "courseId": "course-abc", "semesterId": "sem-001",
  "title": "Introduction to John's Gospel", "description": "Overview of the fourth Gospel.",
  "youtubeVideoId": "dQw4w9WgXcQ", "attachmentIds": ["att-001"], "order": 1, "deletedAt": null,
  "createdAt": "2026-05-31T10:30:00.000Z", "updatedAt": "2026-05-31T10:30:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Lesson UUID |
| `subjectId` | string | Parent subject ID |
| `courseId` | string | Parent course ID |
| `semesterId` | string | Parent semester ID |
| `title` | string | Lesson title |
| `description` | string | Lesson description |
| `youtubeVideoId` | string \| null | 11-character YouTube video ID |
| `attachmentIds` | string[] | Associated attachment IDs |
| `order` | number | Display order (auto-assigned) |
| `deletedAt` | string \| null | Null for active records |
| `createdAt` | string | ISO datetime of creation |
| `updatedAt` | string | ISO datetime of last update |

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — lesson created successfully |
| 400 | `VALIDATION_ERROR` — Zod validation failure |

---

### 9.7 `PATCH /lessons/:id`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | string | No | 1–200 chars |
| `description` | string | No | 1–2000 chars; min 1 char if provided |
| `youtubeVideoId` | YouTube URL \| null | No | Full URL accepted; 11-char ID extracted at validation time |
| `attachmentIds` | string[] | No | Array of attachment UUIDs |

**Response:**
```json
{
  "id": "lesson-001", "subjectId": "sub-001", "courseId": "course-abc", "semesterId": "sem-001",
  "title": "Introduction to John's Gospel — Extended",
  "description": "Comprehensive overview of the fourth Gospel with theological insights.",
  "youtubeVideoId": "dQw4w9WgXcQ", "attachmentIds": ["att-001", "att-002"], "order": 1,
  "deletedAt": null, "createdAt": "2026-05-12T09:00:00.000Z", "updatedAt": "2026-05-31T13:15:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — lesson updated |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 404 | `LESSON_NOT_FOUND` — lesson does not exist |

---

### 9.8 `DELETE /lessons/:id`

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**

Empty response body.

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — lesson deleted |
| 404 | `LESSON_NOT_FOUND` — lesson does not exist |

---

## 10. Attachment & Image Endpoints

---

### 10.1 `POST /subjects/:id/attachments`

Upload PDF or DOCX. Max **25 MB** (FR-CRS-010).

**Authentication:** Bearer required | **Roles:** `admin`
**Content-Type:** `multipart/form-data`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `file` | file | No | Allowed MIME: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Max 25 MB. |

> **File is optional.** If the `file` field is omitted, the endpoint returns a `200 OK` with a message instead of creating an attachment record.

**Response:**

**Response:**
```json
{
  "id": "att-001", "subjectId": "sub-001", "courseId": "course-abc",
  "filename": "study-notes.pdf", "mimeType": "application/pdf",
  "sizeBytes": 204800,
  "storagePath": "subjects/sub-001/attachments/att-001.pdf",
  "createdAt": "2026-05-02T10:00:00.000Z"
}
```

**Response:**
```json
{ "message": "No file uploaded. Provide a PDF, DOC, or DOCX file to create an attachment." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — file uploaded and attachment record created |
| 200 | OK — no file provided |
| 413 | `FILE_TOO_LARGE` — file exceeds 25 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` — file type not allowed |

---

### 10.2 `POST /subjects/:id/images` — NEW V2

Upload PNG or JPG cover image (FR-CRS-005). Max **10 MB**.

**Authentication:** Bearer required | **Roles:** `admin`
**Content-Type:** `multipart/form-data`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `file` | file | Yes | Allowed MIME: `image/png`, `image/jpeg`. Max 10 MB. |

**Response:**
```json
{
  "id": "img-001", "subjectId": "sub-001",
  "url": "https://storage.googleapis.com/.../cover.jpg",
  "mimeType": "image/jpeg", "sizeBytes": 512000,
  "createdAt": "2026-05-02T10:05:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — image uploaded successfully |
| 413 | `FILE_TOO_LARGE` — file exceeds 10 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` — file type not allowed |

---

### 10.3 `GET /attachments/:id/download-url`

Short-lived signed URL. Expires in **15 minutes** (FR-LRN-002). Student must have approved enrollment.

**Authentication:** Bearer required | **Roles:** `student` (enrolled), `admin`, `super_admin`

> **Role restriction:** `leader` and `g12` callers receive `403 FORBIDDEN` — only enrolled students and admins can generate download URLs.

**Response:**
```json
{ "downloadUrl": "https://storage.googleapis.com/...?X-Goog-Signature=...", "expiresAt": "2026-05-15T11:00:00.000Z" }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — signed download URL returned |
| 403 | `FORBIDDEN` — not enrolled, or caller is `leader`/`g12` |
| 404 | `ATTACHMENT_NOT_FOUND` — attachment does not exist |

---

### 10.4 `DELETE /attachments/:id`

Remove attachment or image from Cloud Storage and subject record.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:** Empty response body.

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content â€” attachment deleted |

---

## 11. Enrollment Endpoints

---



---

### 11.2 `POST /enrollments`

**Already-Student path:** enroll in an additional course (FR-STU-004). No role grant needed.

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**Request Body:**
```json
{ "courseId": "course-def", "batchId": "batch-456" }
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `courseId` | string | Yes | Must be a `published` course |
| `batchId` | string | No | Optional batch reference |

**Response:** Enrollment object with `state: "pending"`.

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — enrollment created with `state: "pending"` |
| 404 | `COURSE_NOT_FOUND` — course does not exist or is not published |
| 409 | `ALREADY_ENROLLED` — student is already enrolled in this course |
| 409 | `ENROLLMENT_PENDING` — existing pending enrollment for this course |
| 422 | `COOLOFF_ACTIVE` — within the rejection cooloff window |

---

### 11.3 `POST /enrollments/:id/withdraw`

**Authentication:** Bearer required | **Roles:** `student` (own only)

**Response:** Enrollment object with `state: "withdrawn"`.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — enrollment withdrawn |
| 403 | `FORBIDDEN` — not the enrollment owner |
| 409 | `INVALID_STATE` — enrollment is not in a withdrawable state |

---

### 11.4 `GET /enrollments`

Admin view.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `courseId` | Filter by course |
| `state` | `pending` \| `approved` \| `withdrawn` \| `rejected` |
| `limit`, `cursor` | Pagination |

**Response:** Paginated Enrollment list.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — paginated list of enrollments |

---

### 11.5 `POST /enrollments/:id/approve`

Approve an enrollment. Sets `state: "approved"` on the enrollment and dispatches a **welcome email** to the student (FR-ENR-005).

**Authentication:** Bearer required | **Roles:** `admin`  
**Content-Type:** `application/json`

**Request Body:**

```json
{ "note": "Congratulations! Your enrollment has been approved for the 2026 intake." }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `note` | string | No | 1–500 chars — shown in the approval email sent to the student |

#### Side Effects (on `200`)

| Step | Detail |
|------|--------|
| 1 | Enrollment `state` → `approved`, `approvedAt` timestamp set |
| 2 | `enrollment.approved` event published to the outbox |
| 3 | Outbox-worker dispatches (~5 s) → **`EnrollmentApprovedHandler`** runs: |
|   | &nbsp;&nbsp;• In-app notification to the student: *"Enrollment Approved"* |
|   | &nbsp;&nbsp;• **Approval email** sent to the student's registered address (see below) |
|   | &nbsp;&nbsp;• Push notification to student's FCM token (if registered; best-effort) |

#### Approval Email

| Field | Value |
|-------|-------|
| **To** | Student's registered email address |
| **Subject** | `Enrollment Approved — <Course Title> — TCCR` |
| **Greeting** | `Hi <firstName> <lastName>,` |
| **Course table** | Course name + Status: **Approved ✓** |
| **Admin note** | Highlighted callout block showing the `note` field (omitted if blank) |
| **Body** | Instruction to log in and access the course from *My Enrollments* |
| **Login button** | `Log in to TCCR →` — links to `APP_URL` (default `https://cms.bethelnet.au/login`) |

> **Email delivery:** Retried 3× with 1 s → 2 s → 4 s backoff. Failure is logged but never surfaces — `200` is returned if the state transition succeeds.

**Response:** — Enrollment object with `state: "approved"`.

```json
{
  "id": "Xf3aBC..._course-abc",
  "studentUid": "Xf3aBC...",
  "courseId": "course-abc",
  "state": "approved",
  "approvedAt": "2026-05-22T10:00:00.000Z",
  "reason": null,
  "createdAt": "2026-05-20T09:00:00.000Z",
  "updatedAt": "2026-05-22T10:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — enrollment approved |
| 404 | `ENROLLMENT_NOT_FOUND` — enrollment does not exist |
| 409 | `INVALID_STATE` — enrollment is not in `pending` state |

---

### 11.6 `POST /enrollments/:id/reject`

Reject an enrollment application and send a **rejection notification email** to the student.

**Authentication:** Bearer required | **Roles:** `admin`  
**Content-Type:** `application/json`

**Request Body:**

```json
{ "reason": "We have reached the maximum capacity for this intake. Please apply for the next available batch." }
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `reason` | string | No | 1–500 chars — shown in the rejection email; if omitted the email states no reason was provided |

#### Side Effects (on `200`)

| Step | Detail |
|------|--------|
| 1 | Enrollment `state` → `rejected`, `rejectedAt` timestamp set, `reason` stored |
| 2 | `enrollment.rejected` event published to the outbox |
| 3 | Outbox-worker dispatches (~5 s) → **`EnrollmentRejectedHandler`** runs: |
|   | &nbsp;&nbsp;• In-app notification to the student: *"Enrollment Not Approved"* |
|   | &nbsp;&nbsp;• **Rejection email** sent to the student's registered address (see below) |

#### Rejection Email

| Field | Value |
|-------|-------|
| **To** | Student's registered email address |
| **Subject** | `Enrollment Update — <Course Title> — TCCR` |
| **Greeting** | `Hi <firstName> <lastName>,` |
| **Course table** | Course name + Status: **Not Approved** (red) |
| **Reason block** | Red left-border callout showing the `reason` (shows "No specific reason provided" when blank) |
| **Body** | Encouragement to contact admin or reapply in a future intake |
| **Login button** | `Log in to TCCR →` — links to `APP_URL` (default `https://cms.bethelnet.au/login`) |

**Response:** — Enrollment object with `state: "rejected"`.

```json
{
  "id": "Xf3aBC..._course-abc",
  "studentUid": "Xf3aBC...",
  "courseId": "course-abc",
  "state": "rejected",
  "reason": "Batch capacity reached.",
  "rejectedAt": "2026-05-22T10:00:00.000Z",
  "approvedAt": null,
  "createdAt": "2026-05-20T09:00:00.000Z",
  "updatedAt": "2026-05-22T10:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — enrollment rejected |
| 404 | `ENROLLMENT_NOT_FOUND` — enrollment does not exist |
| 409 | `INVALID_STATE` — enrollment is not in `pending` state |

---

## 12. Progress Endpoints

---

### 12.1 `POST /progress/subjects/:id/complete`

Mark subject complete. **Idempotent** — already-completed returns existing record unchanged (FR-LRN-003 / FR-STU-011).

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**Request Body:**
```json
{ "courseId": "course-abc", "semesterId": "sem-001" }
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `courseId` | string | Yes | Parent course ID |
| `semesterId` | string | Yes | Parent semester ID |

**Response:**
```json
{
  "id":             "Xf3aBC..._sub-001",
  "studentUid":     "Xf3aBC...",
  "subjectId":      "sub-001",
  "courseId":       "course-abc",
  "semesterId":     "sem-001",
  "state":          "completed",
  "completedAt":    "2026-05-07T14:00:00.000Z",
  "lastAccessedAt": "2026-05-07T14:00:00.000Z"
}
```

> **Field note:** The progress status field is named `state` (not `status`). Values: `not_started` | `in_progress` | `completed`.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — subject marked complete (or already completed, returned unchanged) |
| 403 | `SEMESTER_DISABLED` — semester is disabled (FR-STU-005) |

---

### 12.2 `POST /progress/subjects/:id/access`

Update `lastAccessedAt`. Transitions `not_started` → `in_progress` on first access (FR-LRN-007).

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**Request Body:**
```json
{ "courseId": "course-abc", "semesterId": "sem-001" }
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `courseId` | string | Yes | Parent course ID |
| `semesterId` | string | Yes | Parent semester ID |

**Response:**
```json
{
  "id": "Xf3aBC..._sub-001", "studentUid": "Xf3aBC...", "subjectId": "sub-001",
  "courseId": "course-abc", "semesterId": "sem-001", "state": "in_progress",
  "completedAt": null, "lastAccessedAt": "2026-05-27T11:30:00.000Z",
  "lastAccessedLessonId": "lesson-005"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Composite ID (`studentUid_subjectId`) |
| `studentUid` | string | Firebase UID of the student |
| `subjectId` | string | Parent subject ID |
| `courseId` | string | Parent course ID |
| `semesterId` | string | Parent semester ID |
| `state` | string | `not_started` \| `in_progress` \| `completed` |
| `completedAt` | string \| null | ISO datetime of completion; null if not done |
| `lastAccessedAt` | string \| null | ISO datetime of most recent access |
| `lastAccessedLessonId` | string \| null | Most recently accessed lesson ID for resume |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — subject access recorded |
| 404 | `SUBJECT_NOT_FOUND` — subject does not exist |

---

### 12.3 `GET /me/progress/courses/:courseId`

Course-level progress aggregate (FR-LRN-004).

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**Response:**
```json
{
  "courseId":               "course-abc",
  "studentUid":             "Xf3aBC...",
  "completedCount":         4,
  "pendingCount":           6,
  "totalSubjects":          10,
  "completionPercent":      40.0,
  "lastAccessedSubjectId":  "sub-003",
  "lastAccessedLessonId":   "les-007",
  "lastAccessedAt":         "2026-05-27T11:30:00.000Z",

  "completedLessonIds":     ["les-001", "les-002", "les-005"],
  "totalLessons":           9,
  "lessonCompletionPercent": 33
}
```

| Field | Type | Description |
|-------|------|-------------|
| `completedCount` | number | Subjects fully completed |
| `pendingCount` | number | Subjects not yet completed (`totalSubjects − completedCount`) |
| `totalSubjects` | number | Total non-deleted subjects in the course |
| `completionPercent` | number | Subject-weighted percent — one decimal place e.g. `66.7`. **Dashboard uses this field.** |
| `lastAccessedSubjectId` | string \| null | Most-recently accessed subject UID — use as fallback when `lastAccessedLessonId` is null |
| `lastAccessedLessonId` | string \| null | Most-recently accessed lesson UID — updated by both `POST …/video-position` and `POST …/complete`. `null` if the student has never opened a lesson. Use this field to resume on the correct lesson. |
| `lastAccessedAt` | string \| null | ISO 8601 timestamp of the most-recent lesson access |
| `completedLessonIds` | string[] | IDs of every lesson the student has marked complete — use to rehydrate lesson tick-boxes in the course viewer |
| `totalLessons` | number | Total non-deleted lessons across all subjects in the course |
| `lessonCompletionPercent` | number | `Math.round(completedLessons / totalLessons * 100)` — integer percent. **Course-viewer progress bar uses this field.** |

> **Backwards compatibility:** `completedCount`, `pendingCount`, `totalSubjects`, and `completionPercent` are unchanged. The Dashboard should continue reading `completionPercent` (subject-weighted). The course-viewer progress bar should switch to `lessonCompletionPercent`.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — course progress aggregate returned |

---

### 12.4 `GET /me/progress/subjects/:subjectId`

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**Response:** SubjectProgress object. See §12.2 for full field reference.
```json
{
  "id": "Xf3aBC..._sub-001", "studentUid": "Xf3aBC...", "subjectId": "sub-001",
  "courseId": "course-abc", "semesterId": "sem-001", "state": "in_progress",
  "completedAt": null, "lastAccessedAt": "2026-05-27T11:30:00.000Z",
  "lastAccessedLessonId": "lesson-005"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — subject progress returned |
| 404 | `SUBJECT_NOT_FOUND` — subject does not exist |

---

### 12.5 `GET /admin/progress/courses/:courseId`

Admin view — all students' progress for a course.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Response:**
```json
[
  {
    "studentUid": "Xf3aBC...", "courseId": "course-abc",
    "completedCount": 4, "pendingCount": 6, "totalSubjects": 10,
    "completionPercent": 40.0, "lastAccessedSubjectId": "sub-003",
    "lastAccessedAt": "2026-05-27T11:30:00.000Z",
    "completedLessonIds": ["lesson-001","lesson-002"], "totalLessons": 9,
    "lessonCompletionPercent": 22
  }
]
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Array of all students' progress for the course |
| 404 | `COURSE_NOT_FOUND` — Course does not exist |

---

### 12.6 `POST /progress/lessons/:lessonId/complete` ★ NEW

Mark an individual lesson complete. **Idempotent** — calling again for the same lesson returns `200` with the original `completedAt` unchanged.

**Auto-rollup:** When every lesson in the parent subject is now complete, the backend automatically marks the subject complete — the frontend does **not** need to make a second call to `POST /progress/subjects/:id/complete`.

**Side-effect — last-accessed tracking:** Every call (including idempotent repeats) updates `lastAccessedLessonId` and `lastAccessedSubjectId` on the student's subject-progress record. The next `GET /me/progress/courses/:courseId` will reflect this lesson as the resume point.

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "courseId":   "course-abc",
  "subjectId":  "sub-001",
  "semesterId": "sem-001",
  "batchId":    "batch-xyz"
}
```

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `courseId` | string | ✅ | Must match the lesson's parent course |
| `subjectId` | string | ✅ | Must match the lesson's parent subject |
| `semesterId` | string | ✅ | Must match the lesson's parent semester |
| `batchId` | string | ➖ | Student's enrollment batch — optional |

#### Validation Rules

| Condition | Error |
|-----------|-------|
| Caller has no approved enrollment in `courseId` | `403 NOT_ENROLLED` |
| `lessonId` does not exist | `404 LESSON_NOT_FOUND` |
| `lessonId` does not belong to stated `courseId` / `subjectId` | `400 LESSON_MISMATCH` |

**Response:**
```json
{
  "lessonId":             "les-001",
  "subjectId":            "sub-001",
  "courseId":             "course-abc",
  "completedAt":          "2026-05-27T11:45:00.000Z",
  "subjectAutoCompleted": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `lessonId` | string | The lesson that was marked complete |
| `subjectId` | string | Parent subject |
| `courseId` | string | Parent course |
| `completedAt` | string | ISO 8601 — server timestamp of first completion; unchanged on repeated calls |
| `subjectAutoCompleted` | boolean | `true` if this lesson completion triggered an auto-rollup of the parent subject; `false` otherwise (including idempotent calls) |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Lesson marked complete (or already was complete — idempotent) |
| 400 | `LESSON_MISMATCH` — lessonId does not belong to the stated courseId / subjectId |
| 403 | `NOT_ENROLLED` — An approved enrollment is required to mark lessons complete |
| 404 | `LESSON_NOT_FOUND` — Lesson not found |

---

### 12.7 `DELETE /progress/lessons/:lessonId/complete` ★ NEW

Unmark a lesson as complete — removes the completion record. Intended for mistakes or video re-watch flows.

**Auto-revert:** If the parent subject was previously auto-completed (via §12.6 rollup), and removing this lesson means not all lessons are done, the subject is automatically reverted to `in_progress`.

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**Response:**
Empty response body.

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — Lesson completion removed |
| 404 | `LESSON_PROGRESS_NOT_FOUND` — No completion record exists for this lesson and caller |

---

### 12.8 `POST /progress/lessons/:lessonId/video-position` ★ NEW

Save the student's current YouTube video playback position (in seconds). Called every few seconds while the video plays, and on pause/close. Allows the frontend to resume from the exact position on return.

**Side-effect — last-accessed tracking:** Every call also updates `lastAccessedLessonId` and `lastAccessedSubjectId` on the student's subject-progress record. This is what powers the "Continue learning" resume feature — after a mid-watch logout, the next `GET /me/progress/courses/:courseId` returns the correct `lastAccessedLessonId` pointing to the lesson the student was watching, not the last *completed* lesson.

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**Request Body:**
```json
{
  "watchedSeconds": 150,
  "courseId":       "course-uuid"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `watchedSeconds` | integer | ✅ | `>= 0` — current playback position in seconds |
| `courseId` | UUID | ✅ | Parent course of the lesson |

**Response:**
```json
{
  "lessonId":       "lesson-uuid",
  "watchedSeconds": 150,
  "updatedAt":      "2026-05-29T10:30:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Position saved |
| 400 | `VALIDATION_ERROR` — `watchedSeconds` missing or negative |

---

### 12.9 `GET /progress/lessons/:lessonId/video-position` ★ NEW

Get the saved video playback position for the authenticated student. Returns `{ watchedSeconds: 0 }` when the student has never watched — never returns `404`.

**Authentication:** Bearer required | **Roles:** `student`, `leader`, `g12`

**Response:**
```json
{
  "lessonId":       "lesson-uuid",
  "watchedSeconds": 150
}
```

> Always returns `200`. There is no `404` for this endpoint — a missing record is treated as position `0` (start of video).

**Response — never watched (no record exists):**
```json
{
  "lessonId":       "lesson-uuid",
  "watchedSeconds": 0
}
```

#### Frontend Usage

```javascript
// On lesson page load — seek YouTube player to saved position
const res = await fetch(`/api/v1/progress/lessons/${lessonId}/video-position`, {
  headers: { Authorization: `Bearer ${token}` }
});
const { watchedSeconds } = await res.json();
if (watchedSeconds > 10) {
  player.seekTo(watchedSeconds, true);  // resume from saved position
}

// Every 5 seconds while playing — save current position
setInterval(() => {
  const currentTime = player.getCurrentTime();
  fetch(`/api/v1/progress/lessons/${lessonId}/video-position`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ watchedSeconds: Math.floor(currentTime), courseId })
  });
}, 5000);
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Position returned (`watchedSeconds: 0` if never watched) |

---

## 13. Cell Group Endpoints — NEW V2

---

### 13.1 `GET /cells`

List cell groups. Scope is **automatically enforced by role** — callers cannot override their own scope:

| Role | Cells returned |
|------|---------------|
| **Member / Student** | All `active` cells (discovery — to find one to join) |
| **Leader** | Only cells where `leaderUid === caller` (`active` by default) |
| **G12** | Only cells where `g12LeaderUid === caller` — i.e. their own network (`active` by default, pass `?state=archived` for archived) |
| **Admin / Super Admin** | All cells, all states by default; filter with `?state=active\|archived` |

> **G12 network scope:** A G12 leader only sees cells they personally oversee (`g12LeaderUid` matches their UID). They cannot see cells outside their network. This is consistent with `GET /cells/network/members` and `GET /cells/network/reports`.

**Authentication:** Bearer required | **Roles:** Any authenticated

| Parameter | Description |
|-----------|-------------|
| `search` | Partial match on cell name |
| `type` | `g12` \| `care` \| `children` \| `outreach` |
| `area` | Exact match on area |
| `state` | `active` \| `archived` — admin/super_admin see all states when omitted; all other roles default to `active` |
| `leaderUid` | Filter by specific leader UID — **admin only** (ignored for leader/g12 callers, whose scope is already forced) |
| `limit`, `cursor` | Pagination |

**Response:**
```json
{
  "items": [
    {
      "id":           "cell-001",
      "name":         "Rathmalana West G12",
      "type":         "g12",
      "area":         "Rathmalana",
      "leaderUid":    "usr-leader1",
      "g12LeaderUid": "usr-g12-1",
      "members": [
        {
          "uid":         "usr-mem1",
          "firstName":   "Saman",
          "lastName":    "Silva",
          "displayName": "Saman Silva"
        },
        {
          "uid":         "usr-mem2",
          "firstName":   "Nimal",
          "lastName":    "Perera",
          "displayName": "Nimal Perera"
        }
      ],
      "memberCount":  8,
      "reportCount":  12,
      "state":        "active",
      "createdAt":    "2026-01-15T00:00:00.000Z",
      "updatedAt":    "2026-05-14T00:00:00.000Z"
    }
  ],
  "nextCursor": null, "total": 3
}
```

**`members[]` object shape:**

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Firebase Auth UID of the member |
| `firstName` | string | First name from user-service profile (empty string if user deleted or service unavailable) |
| `lastName` | string | Last name from user-service profile |
| `displayName` | string | `firstName + " " + lastName` — trimmed convenience field |

> **Member name enrichment:** Member UIDs are deduplicated across all cells in the response and resolved in a single parallel batch call to user-service. Profile lookups are **non-fatal** — if a user has been deleted or user-service is temporarily unavailable, that member is returned with empty name fields rather than failing the entire request.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Paginated list of cell groups |

---

### 13.2 `GET /cells/mine`

Cells the signed-in user belongs to (FR-MEM-006 / FR-CG-005).

**Authentication:** Bearer required | **Roles:** Any authenticated

**Response:**
```json
{
  "items": [{
    "id": "cell-001", "name": "Rathmalana West G12", "type": "g12", "area": "Rathmalana",
    "leaderUid": "usr-leader1", "g12LeaderUid": "usr-g12-1",
    "memberCount": 8, "reportCount": 12, "state": "active",
    "createdAt": "2026-01-15T00:00:00.000Z", "updatedAt": "2026-05-14T00:00:00.000Z"
  }],
  "nextCursor": null, "total": 1
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Paginated list of CellGroup objects the caller belongs to |

---

### 13.3 `POST /cells`

Create a cell group (FR-LDR-001).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

**Request Body:**
```json
{ "name": "Rathmalana West G12", "type": "g12", "area": "Rathmalana", "g12LeaderUid": "usr-g12-1" }
```

**Response:**
```json
{
  "id": "cell-001", "name": "Rathmalana West G12", "type": "g12", "area": "Rathmalana",
  "leaderUid": "usr-leader1", "g12LeaderUid": "usr-g12-1",
  "members": [], "externalMembers": [], "memberCount": 0, "reportCount": 0, "state": "active",
  "createdAt": "2026-05-31T00:00:00.000Z", "updatedAt": "2026-05-31T00:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated cell ID |
| `name` | string | Cell name |
| `type` | string | `g12` \| `care` \| `children` \| `outreach` |
| `area` | string | Geographic area |
| `leaderUid` | string | UID of the authenticated creator (cell leader) |
| `g12LeaderUid` | string | G12 leader UID |
| `members` | string[] | Registered member UIDs (empty on creation) |
| `externalMembers` | object[] | External member objects (empty on creation) |
| `memberCount` | number | Total members count |
| `reportCount` | number | Total reports filed |
| `state` | string | `active` \| `archived` |
| `createdAt` | string | ISO datetime of creation |
| `updatedAt` | string | ISO datetime of last update |

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created â€” Cell group created successfully |
| 400 | `VALIDATION_ERROR` â€” Zod validation failure |

---

### 13.4 `GET /cells/:id`

Fetch cell with full member roster (FR-CG-005).

**Authentication:** Bearer required | **Roles:** Member of cell, owning leader/G12, `admin`+

**Response:**
```json
{
  "id": "cell-001",
  "name": "Rathmalana West G12",
  "type": "g12",
  "area": "Rathmalana",
  "leaderUid": "usr-leader1",
  "g12LeaderUid": "usr-g12-1",
  "memberCount": 3,
  "reportCount": 12,
  "state": "active",
  "createdAt": "2026-01-15T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "members": [
    {
      "type": "registered",
      "uid": "usr-mem1",
      "firstName": "Sapna",
      "lastName": "Nethmini",
      "displayName": "Sapna Nethmini"
    },
    {
      "type": "external",
      "id": "ext-uuid-xyz789",
      "name": "Suresh Fernando",
      "phone": "+94771234567",
      "displayName": "Suresh Fernando",
      "uid": null
    },
    {
      "type": "external",
      "id": "ext-uuid-abc456",
      "name": "Priya Jayasinghe",
      "displayName": "Priya Jayasinghe",
      "uid": null
    }
  ]
}
```

**`members[]` field reference**

| Field | Type | Present when |
|-------|------|-------------|
| `type` | `"registered"` \| `"external"` | Always — discriminator |
| `uid` | string | `type: "registered"` — Firebase Auth UID |
| `uid` | `null` | `type: "external"` — always null |
| `id` | string (UUID) | `type: "external"` — server-generated; use as `:uid` in `DELETE /cells/:id/members/:uid` |
| `firstName` | string | `type: "registered"` |
| `lastName` | string | `type: "registered"` |
| `name` | string | `type: "external"` |
| `phone` | string \| absent | `type: "external"` — optional |
| `displayName` | string | Always — `"firstName lastName"` for registered; same as `name` for external |

> `memberCount` equals `registered members + external members` combined.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Cell group with full member roster |
| 403 | `FORBIDDEN` — Caller is not a member, owner, or admin |
| 404 | `CELL_NOT_FOUND` — Cell does not exist |

---

### 13.5 `PATCH /cells/:id`

**Authentication:** Bearer required | **Roles:** Owning leader/G12, `admin`+

**Request Body:**
```json
{ "name": "Rathmalana West Care", "type": "care", "area": "Rathmalana East" }
```

**Response:**
```json
{
  "id": "cell-001", "name": "Rathmalana West Care", "type": "care", "area": "Rathmalana East",
  "leaderUid": "usr-leader1", "g12LeaderUid": "usr-g12-1",
  "memberCount": 8, "reportCount": 12, "state": "active",
  "createdAt": "2026-01-15T00:00:00.000Z", "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Updated cell group object |
| 403 | `FORBIDDEN` — Caller is not the owning leader/G12 or admin |
| 404 | `CELL_NOT_FOUND` — Cell does not exist |

---

### 13.6 `POST /cells/:id/archive`

**Authentication:** Bearer required | **Roles:** Owning leader/G12, `admin`+

**Response:**
```json
{
  "id": "cell-001", "name": "Rathmalana West G12", "type": "g12", "area": "Rathmalana",
  "leaderUid": "usr-leader1", "g12LeaderUid": "usr-g12-1",
  "memberCount": 8, "reportCount": 12, "state": "archived",
  "createdAt": "2026-01-15T00:00:00.000Z", "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Cell group archived |
| 403 | `FORBIDDEN` — Caller is not the owning leader/G12 or admin |
| 404 | `CELL_NOT_FOUND` — Cell does not exist |

---

### 13.7 `DELETE /cells/:id` ★ NEW

Permanently delete a cell group. Only the cell's own leader, G12 leader, or an admin can delete it.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`  

**Ownership rule — enforced in `DeleteCellGroupUseCase`:**

| Caller | Can delete? |
|--------|------------|
| Cell's `leaderUid` (owner) | ✅ Yes |
| Cell's `g12LeaderUid` | ✅ Yes |
| `admin` / `super_admin` | ✅ Yes |
| Different leader (not the owner) | ❌ `403 FORBIDDEN` |
| `member` / `student` | ❌ `403 FORBIDDEN` |

**Response:**
Empty response body.

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — Cell permanently deleted |
| 403 | `FORBIDDEN` — Not the cell owner or admin |
| 404 | `CELL_NOT_FOUND` — Cell does not exist |

---

### 13.7b `POST /cells/:id/transfer-ownership` ★ NEW

Transfer cell group ownership to a new leader and/or G12 leader.

**Who can transfer:**

| Caller | Access |
|--------|--------|
| `admin` / `super_admin` | ✅ Full override — can change any combination of fields |
| `leader` / `g12` / `member` / `student` | ❌ `403 FORBIDDEN` |

On success the new owner(s) receive:
- An **in-app notification**: *"Cell Leadership Assigned"* / *"G12 Leadership Assigned"*
- An **email** with the assignment details

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "leaderUid":    "new-leader-uid",
  "g12LeaderUid": "new-g12-uid"
}
```

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `leaderUid` | string | Conditional | New cell leader UID. At least one of `leaderUid` / `g12LeaderUid` must be provided. |
| `g12LeaderUid` | string | Conditional | New G12 leader UID. |

> At least one field must differ from the current owners — submitting the same UIDs returns `422 NO_CHANGE`.

> Only `admin` and `super_admin` can initiate ownership transfer. No auto-demotion occurs — the previous owner retains their role unless separately demoted via `POST /users/:uid/demote`.

#### Notifications sent on success

| Recipient | Channel | Message |
|-----------|---------|---------|
| New leader (if changed) | In-app + Email | *"You have been assigned as Cell Leader of [Cell Name]"* |
| New G12 leader (if changed, different person) | In-app + Email | *"You have been assigned as G12 Leader of [Cell Name]"* |

**Response:**
Updated `CellGroup` object with new `leaderUid` and/or `g12LeaderUid`.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Updated CellGroup object with new `leaderUid` and/or `g12LeaderUid` |
| 400 | `VALIDATION_ERROR` — No fields provided |
| 403 | `FORBIDDEN` — Caller is not admin or super_admin |
| 404 | `CELL_NOT_FOUND` — Cell does not exist |
| 409 | `INVALID_STATE` — Cell is archived; cannot transfer ownership of archived cell |
| 422 | `NO_CHANGE` — The provided UIDs are the same as the current owners |

---
### 13.8 `POST /cells/:id/members`

Add members to a cell directly — no join request needed. Supports both registered app users (via `userUids`) and external/unregistered people (via `externalMembers`). Both arrays can be supplied in the same request; at least one must be non-empty. Atomically updates `memberCount`.

**Authentication:** Bearer required | **Roles:** Owning `leader`, `g12`, `admin`, `super_admin`

**Request Body:**
```json
{
  "userUids": ["usr-mem2", "usr-mem3"],
  "externalMembers": [
    { "name": "Priya Perera", "phone": "+94771234567" },
    { "name": "Nimal Silva" }
  ]
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `userUids` | string[] | No | Max 50 UIDs; defaults to `[]` |
| `externalMembers` | object[] | No | Max 50 entries; defaults to `[]` |
| `externalMembers[].name` | string | Yes | 1`-`200 chars |
| `externalMembers[].phone` | string | No | Max 30 chars |

> At least one of `userUids` or `externalMembers` must be non-empty — sending both empty arrays returns `400 VALIDATION_ERROR`.

**Response:**
```json
{
  "added":         ["usr-mem2", "usr-mem3"],
  "addedExternal": [
    { "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "name": "Priya Perera", "phone": "+94771234567" },
    { "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901", "name": "Nimal Silva" }
  ],
  "memberCount": 12
}
```

| Field | Type | Description |
|-------|------|-------------|
| `added` | string[] | Firebase UIDs of newly added registered members (already-members are silently skipped) |
| `addedExternal` | object[] | External members created; each has a server-generated UUID `id`, `name`, and optional `phone` |
| `addedExternal[].id` | string | Server-generated UUID — use this as `:uid` in `DELETE /cells/:id/members/:uid` |
| `memberCount` | number | Updated total: registered + external combined |

> **Registered-only request** (backward compatible): omit `externalMembers` or pass `[]` — `addedExternal` will be `[]` in the response.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Members added; returns updated counts and new external member IDs |
| 400 | `VALIDATION_ERROR` — Both `userUids` and `externalMembers` are empty |
| 403 | `FORBIDDEN` — Caller is not the owning leader/G12 or admin |
| 404 | `CELL_NOT_FOUND` — Cell does not exist |

---
### 13.9 `DELETE /cells/:id/members/:uid`

Remove a member from the cell. Works for **both registered members and external (unregistered) members** — pass either a Firebase UID or an external member's server-generated UUID as `:uid`. The server auto-disambiguates. Atomically decrements `memberCount`.

**Authentication:** Bearer required | **Roles:** Owning `leader`, `g12`, `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `:id` | Cell group ID |
| `:uid` | Firebase UID (registered member) **or** external member UUID returned by `POST /cells/:id/members` in `addedExternal[].id` |

#### Disambiguation Logic

```
if :uid matches externalMembers[].id  →  removes external member
else                                  →  removes registered member by Firebase UID
```

> Store the `addedExternal[].id` value returned by `POST /cells/:id/members` — this is the only reference to an external member's server-assigned UUID.

**Response:**
```json
{ "removed": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "memberCount": 11 }
```

**Response — removing a registered member:**
```json
{ "removed": "usr-firebase-uid-abc123", "memberCount": 10 }
```

| Field | Type | Description |
|-------|------|-------------|
| `removed` | string | The `:uid` value that was removed (UUID for external, Firebase UID for registered) |
| `memberCount` | number | Updated total after removal: `registered + external` combined |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Member removed; returns updated `memberCount` |
| 403 | `FORBIDDEN` — Caller is not the cell owner or an admin / super_admin |
| 404 | `CELL_NOT_FOUND` — No cell group exists with the given `:id` |
| 404 | `MEMBER_NOT_FOUND` — `:uid` does not match any registered UID or external member UUID in this cell |

---
### 13.10 `POST /cells/:id/join-requests`

Member applies to join a cell group. Admin or Super Admin must approve before the member is added to the cell.

**Authentication:** Bearer required | **Roles:** `member`, `student`

**Request Body:**
```json
{ "message": "I would like to join this cell group." }
```

| Field | Required | Notes |
|-------|:--------:|-------|
| `message` | No | Optional note from the applicant |

**Response:**
```json
{
  "id":           "jreq-001",
  "cellId":       "cell-001",
  "requesterUid": "usr-mem1",
  "message":      "I would like to join this cell group.",
  "status":       "pending",
  "decidedByUid": null,
  "decisionNote": null,
  "createdAt":    "2026-05-16T09:00:00.000Z",
  "decidedAt":    null
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — Join request submitted |
| 409 | `CELL_JOIN_REQUEST_PENDING` — Already has a pending request for this cell |

---

### 13.11 `GET /cells/:id/join-requests`

List all pending join requests for a cell.

**Authentication:** Bearer required | **Roles:** Owning `leader`, `g12`, `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `status` | `pending` \| `approved` \| `rejected` (default: `pending`) |
| `limit`, `cursor` | Pagination |

**Response:**
```json
{
  "items": [{
    "id":           "jreq-001",
    "cellId":       "cell-001",
    "requesterUid": "usr-mem1",
    "message":      "I would like to join this cell group.",
    "status":       "pending",
    "decidedByUid": null,
    "decisionNote": null,
    "createdAt":    "2026-05-16T09:00:00.000Z",
    "decidedAt":    null
  }],
  "nextCursor": null, "total": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Join request ID |
| `cellId` | string | Cell group ID |
| `requesterUid` | string | UID of the requesting user |
| `message` | string \| null | Optional note from the applicant |
| `status` | string | `pending` \| `approved` \| `rejected` |
| `decidedByUid` | string \| null | UID of the admin who decided (null if pending) |
| `decisionNote` | string \| null | Admin note (null if pending) |
| `createdAt` | string | ISO datetime |
| `decidedAt` | string \| null | ISO datetime when decided (null if pending) |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK â€” Paginated list of join requests |

---

### 13.12 `POST /cells/:id/join-requests/:rid/approve`

Approve a member's request to join the cell. Adds the member to the cell and increments `memberCount`.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**
```json
{ "note": "Welcome to the cell!" }
```

**Response:**
```json
{
  "joinRequestId": "jreq-001",
  "memberUid":     "usr-mem1",
  "memberCount":   9,
  "message":       "Member added to cell group."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `joinRequestId` | string | The approved join request ID |
| `memberUid` | string | UID of the newly added member |
| `memberCount` | number | Updated member count |
| `message` | string | Confirmation message |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Join request approved; member added to cell |
| 403 | `FORBIDDEN` — Caller is not admin or super_admin |
| 404 | `CELL_NOT_FOUND` — Cell does not exist |
| 404 | `CELL_JOIN_REQUEST_NOT_FOUND` — Join request does not exist |
| 409 | `INVALID_STATE` — Request is not in pending state |

---

### 13.13 `POST /cells/:id/join-requests/:rid/reject`

Reject a member's request to join the cell. The member is not added.

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

**Request Body:**
```json
{ "note": "Cell is currently full." }
```

**Response:**
```json
{
  "id": "jreq-001", "cellId": "cell-001", "requesterUid": "usr-mem1",
  "message": "I would like to join this cell group.", "status": "rejected",
  "decidedByUid": "admin-uid-1", "decisionNote": "Cell is currently full.",
  "createdAt": "2026-05-16T09:00:00.000Z", "decidedAt": "2026-05-31T14:00:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Join request rejected |
| 403 | `FORBIDDEN` — Caller is not admin or super_admin |
| 404 | `CELL_NOT_FOUND` — Cell does not exist |
| 404 | `CELL_JOIN_REQUEST_NOT_FOUND` — Join request does not exist |
| 409 | `INVALID_STATE` — Request is not in pending state |

---

### 13.14 `GET /cells/network/members` ★ NEW

Returns all cell members across every active cell in scope, grouped by cell. Each cell's `members[]` is a **discriminated union** of registered and external (unregistered) members — same shape as `GET /cells/:id`.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

#### Scope by Role

| Caller | Cells included |
|--------|---------------|
| `g12` | **All** active cells org-wide (no UID filter) |
| `leader` | Only the leader's **own** active cell (`leaderUid === callerUid`) |
| `admin` / `super_admin` | **All** active cells (no UID filter) |

**Response:**
```json
{
  "items": [
    {
      "cellId":      "cell-001",
      "cellName":    "Rathmalana West G12",
      "cellType":    "g12",
      "area":        "Rathmalana",
      "leaderUid":   "usr-leader1",
      "memberCount": 4,
      "members": [
        {
          "type":        "registered",
          "uid":         "usr-mem1",
          "firstName":   "Sapna",
          "lastName":    "Nethmini",
          "displayName": "Sapna Nethmini"
        },
        {
          "type":        "registered",
          "uid":         "usr-mem2",
          "firstName":   "Viruli",
          "lastName":    "W.",
          "displayName": "Viruli W."
        },
        {
          "type":        "external",
          "id":          "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "name":        "Priya Perera",
          "phone":       "+94771234567",
          "displayName": "Priya Perera",
          "uid":         null
        },
        {
          "type":        "external",
          "id":          "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          "name":        "Nimal Silva",
          "displayName": "Nimal Silva",
          "uid":         null
        }
      ]
    },
    {
      "cellId":      "cell-002",
      "cellName":    "Colombo East Care",
      "cellType":    "care",
      "area":        "Colombo",
      "leaderUid":   "usr-leader2",
      "memberCount": 2,
      "members": [
        {
          "type":        "registered",
          "uid":         "usr-mem4",
          "firstName":   "Chamari",
          "lastName":    "Silva",
          "displayName": "Chamari Silva"
        },
        {
          "type":        "registered",
          "uid":         "usr-mem5",
          "firstName":   "Ruwan",
          "lastName":    "K.",
          "displayName": "Ruwan K."
        }
      ]
    }
  ],
  "totalCells":   2,
  "totalMembers": 6
}
```

#### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `items[]` | object[] | One entry per active cell in scope |
| `items[].cellId` | string | Cell group ID |
| `items[].cellName` | string | Cell display name |
| `items[].cellType` | string | `g12` \| `care` \| `children` \| `outreach` |
| `items[].area` | string | Geographic area of the cell |
| `items[].leaderUid` | string | UID of the cell leader |
| `items[].memberCount` | number | `registered members + external members` combined |
| `items[].members[]` | `CellMember[]` | Discriminated union — see below |
| `totalCells` | number | Number of cells included in the response |
| `totalMembers` | number | Sum of all `memberCount` values (not deduplicated across cells) |

**`members[]` discriminated union:**

| Field | Present when | Description |
|-------|-------------|-------------|
| `type` | Always | `"registered"` or `"external"` — discriminator field |
| `uid` | `type: "registered"` | Firebase UID |
| `firstName` | `type: "registered"` | First name (empty string if user-service unavailable) |
| `lastName` | `type: "registered"` | Last name (empty string if user-service unavailable) |
| `displayName` | Always | `"firstName lastName"` for registered; same as `name` for external |
| `id` | `type: "external"` | Server-generated UUID — use as `:uid` in `DELETE /cells/:id/members/:uid` |
| `name` | `type: "external"` | Full name supplied when the external member was added |
| `phone` | `type: "external"` (optional) | Phone number; absent if not provided |
| `uid` | `type: "external"` | Always `null` |

> **Graceful degradation:** If user-service is temporarily unavailable for a registered member lookup, that member is returned with `firstName: ""`, `lastName: ""`, `displayName: ""` rather than failing the entire request. The cell is still included in the response.

> **No pagination:** Results are capped at 100 cells per call. Member lists are returned in full per cell.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Network members grouped by cell |
| 403 | `FORBIDDEN` — Caller does not hold `leader`, `g12`, `admin`, or `super_admin` |

---

## 14. Cell Report Endpoints — NEW V2

Reports are **immutable once filed** (FR-CR-014). Corrections: void the report and file a new corrected one.

Include `X-Idempotency-Key: <client-uuid>` on every `POST /cells/:id/reports`. Same key → returns existing report with `200 OK` (FR-CR-015 / NFR-AVA-004).

> **RBAC (SRS §9.3):** Only the owning Leader, G12 Leader, or Super Admin may file. Regular **Admin cannot**. Members cannot regardless of membership (FR-MEM-007).

**Typical mobile flow for filing a report:**
1. `GET /cells/:id` — fetch cell roster to pre-populate the attendance / absent-members fields
2. `POST /cells/:id/reports` — file the report **with photos attached in the same request** (`multipart/form-data`; photos are optional)

---

### 14.0 `POST /cells/:id/report-photos` — NEW

Upload 1–10 meeting photos **before** filing the report. Returns public URLs to include in `photoUrls[]` when calling `POST /cells/:id/reports`.

**Authentication:** Bearer required | **Roles:** Owning leader, G12, `super_admin`
**Content-Type:** `multipart/form-data`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `photos` | file(s) | Yes | Field name `photos`; 1–10 files; `image/jpeg` or `image/png`; max **5 MB** each |

**Response:**
```json
{ "photoUrls": [
    "https://storage.googleapis.com/bucket/cells/cell-001/report-photos/1716000000000-1.jpg",
    "https://storage.googleapis.com/bucket/cells/cell-001/report-photos/1716000000000-2.jpg"
] }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — photo URLs returned |
| 400 | `VALIDATION_ERROR` — no files or > 10 files |
| 413 | `FILE_TOO_LARGE` — a single photo exceeds 5 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` — non-JPEG/PNG file |

---



---

### 14.2 `POST /cells/:id/reports`

File a cell meeting report. Photos are uploaded **in the same request** as `multipart/form-data` — no separate upload step needed.

`filledByUid` is system-populated from the authenticated user — read-only (FR-CR-002).

**Frontend UX notes:**
- **Leader name** — auto-display from `GET /me` (`firstName + lastName`); shown as read-only
- **Date** — defaults to today; editable
- **Names of members absent** — pre-populate from `GET /cells/:id` member roster as removable chips. Each chip has a ✕ button. Leader taps ✕ to remove members who **were present**; remaining chips = absent members. Pass them as `attendance[]` entries with `status: "absent"`

**Authentication:** Bearer required | **Roles:** Owning leader, owning G12, `super_admin`
**Content-Type:** `multipart/form-data`
**Header:** `X-Idempotency-Key: <client-uuid>` (required)

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `data` | string (JSON) | Yes | All report fields serialised as a JSON string |
| `photos` | file(s) | No | 0–10 JPEG/PNG images, max **5 MB** each. Named `[Image #1]` through `[Image #10]` in the UI |

#### `data` JSON structure

```json
{
  "date":                   "2026-05-15",
  "didMeet":                true,
  "leaderPresent":          true,
  "location":               "TCCR",
  "timeStarted":            "2026-05-15T18:00:00+05:30",
  "timeEnded":              "2026-05-15T19:30:00+05:30",
  "language":               "si",
  "subjectDiscussed":       "sunday_sermon",
  "cellType":               "g12",
  "g12LeaderUid":           "usr-g12-1",
  "immediateG12LeaderText": null,
  "attendance": [
    { "userUid": "usr-mem1", "name": "Sapna Nethmini", "status": "present", "isNew": false },
    { "userUid": "usr-mem2", "name": "Viruli W.",       "status": "absent",  "isNew": false },
    { "name":    "Walk-in",                              "status": "present", "isNew": true  }
  ],
  "contactedAbsentees":   "yes",
  "absenteeNotes":        "Called Viruli — will attend next week.",
  "additionalVisitors":   1,
  "childrenCount":        2,
  "satisfactionRate":     4,
  "additionalInfo":       "Great session."
}
```

| Field | Required | Condition | Notes |
|-------|:--------:|-----------|-------|
| `date` | Yes | — | ISO date `YYYY-MM-DD`; defaults to today on mobile (FR-CR-003) |
| `didMeet` | Yes | — | If `false`, only `noMeetReason` needed; all meeting fields ignored (FR-CR-004) |
| `noMeetReason` | When `didMeet=false` | — | Free text |
| `leaderPresent` | No | `didMeet=true` | Defaults to `true` (FR-CR-005) |
| `conductedByIfAbsent` | When `leaderPresent=false` | — | Substitute name |
| `location` | No | `didMeet=true` | `TCCR` \| `Online` \| `Other` \| free text; defaults to `""` (FR-CR-006) |
| `timeStarted`, `timeEnded` | No | `didMeet=true` | ISO datetime with timezone; defaults to `""` |
| `language` | No | `didMeet=true` | `si` \| `ta` \| `en`; defaults to `"en"` |
| `subjectDiscussed` | No | `didMeet=true` | `sunday_sermon` \| `other`; defaults to `"sunday_sermon"` |
| `otherSubjectReason` | When `subjectDiscussed=other` | — | Free text |
| `cellType` | No | — | `g12` \| `care` \| `children` \| `outreach`; defaults to parent cell's type |
| `g12LeaderUid` | No | `didMeet=true` | From G12 leader dropdown; defaults to `""` (FR-CR-009) |
| `immediateG12LeaderText` | No | — | Free-text offline reference (FR-CR-009) |
| `attendance` | No | `didMeet=true` | Pre-populated from `GET /cells/:id` roster; `isNew:true` for walk-ins; defaults to `[]` (FR-CR-010) |
| `contactedAbsentees` | No | `didMeet=true` | `"yes"` \| `"no"` \| `"future"`; defaults to `"no"` (FR-CR-011) |
| `absenteeNotes` | No | — | Notes on absent members (FR-CR-011) |
| `additionalVisitors` | No | `didMeet=true` | Count; defaults to `0` (FR-CR-012) |
| `childrenCount` | No | `didMeet=true` | Count; defaults to `0` (FR-CR-012) |
| `satisfactionRate` | No | `didMeet=true` | Integer **1–6**; defaults to `3` (FR-CR-013) |
| `additionalInfo` | No | — | Additional notes (FR-CR-013) |

**Response:**

CellReport object with `photoUrls[]` populated.

**Status Codes:**
| Code | Description |
|------|-------------|
| 201 | Created — CellReport object returned |
| 200 | OK — duplicate idempotency key; existing report returned |
| 400 | `VALIDATION_ERROR` — Zod validation failure |
| 403 | `FORBIDDEN` — caller is not the owning leader, G12, or super_admin |
| 404 | `CELL_NOT_FOUND` — cell does not exist |

---

### 14.3 `GET /cells/:id/reports/:rid`

**Authentication:** Bearer required | **Roles:** Member of cell, owning leader/G12, `admin`+

**Response:**

Full CellReport object. See §14.2 for field reference.
```json
{
  "id": "report-001", "cellId": "cell-001", "filledByUid": "usr-leader1",
  "clientReqId": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2026-05-27", "didMeet": true, "noMeetReason": null, "leaderPresent": true,
  "conductedByIfAbsent": null, "location": "Church Hall",
  "timeStarted": "2026-05-27T09:00:00.000Z", "timeEnded": "2026-05-27T11:00:00.000Z",
  "language": "en", "subjectDiscussed": "sunday_sermon", "otherSubjectReason": null,
  "cellType": "care", "g12LeaderUid": "uid-g12-1", "immediateG12LeaderText": null,
  "attendance": [{"userUid":"uid-1","name":"Saman S.","status":"present","isNew":false},
                 {"name":"Walk-in Visitor","status":"present","isNew":true}],
  "contactedAbsentees": "yes", "absenteeNotes": "Will attend next week",
  "additionalVisitors": 2, "childrenCount": 0, "satisfactionRate": 4,
  "additionalInfo": "Great attendance",
  "photoUrls": ["https://storage.googleapis.com/.../photo-1.jpg"],
  "voided": false, "createdAt": "2026-05-27T11:30:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — full CellReport object |
| 403 | `FORBIDDEN` — caller lacks access |
| 404 | `CELL_REPORT_NOT_FOUND` — report does not exist |

---

### 14.4 `POST /cells/:id/reports/:rid/void`

Void a report (FR-CR-014). Preserved for audit. File corrected report separately.

**Authentication:** Bearer required | **Roles:** Owning leader/G12, `admin`+

**Request Body:**
```json
{ "reason": "Wrong date. Corrected report filed separately." }
```

**Response:**

CellReport with `voided: true`. See §14.2 for field reference.
```json
{
  "id": "report-001", "cellId": "cell-001", "filledByUid": "usr-leader1",
  "clientReqId": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2026-05-27", "didMeet": true, "noMeetReason": null, "leaderPresent": true,
  "conductedByIfAbsent": null, "location": "Church Hall",
  "timeStarted": "2026-05-27T09:00:00.000Z", "timeEnded": "2026-05-27T11:00:00.000Z",
  "language": "en", "subjectDiscussed": "sunday_sermon", "otherSubjectReason": null,
  "cellType": "care", "g12LeaderUid": "uid-g12-1", "attendance": [],
  "contactedAbsentees": "no", "absenteeNotes": null,
  "additionalVisitors": 0, "childrenCount": 0, "satisfactionRate": 0,
  "additionalInfo": null, "photoUrls": [], "voided": true, "createdAt": "2026-05-27T11:30:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — CellReport returned with `voided: true` |
| 403 | `FORBIDDEN` — caller lacks access |
| 404 | `CELL_REPORT_NOT_FOUND` — report does not exist |
| 409 | `REPORT_ALREADY_VOIDED` — report is already voided |

---

### 14.5 `PATCH /cells/:id/reports/:rid` ★ NEW

Edit a cell report. Only allowed within **24 hours** of the original filing time. After that the report becomes read-only.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `super_admin`

**Who can edit:**

| Caller | Can edit? |
|--------|----------|
| The user who filed the report (`filledByUid`) | ✅ Yes (within 24h) |
| `super_admin` | ✅ Yes (within 24h) |
| Different leader / G12 (not the filer) | ❌ `403 FORBIDDEN` |
| `admin` | ❌ `403 FORBIDDEN` (admin does not file reports) |

**Immutable fields** — never changed by this endpoint:
`clientReqId`, `filledByUid`, `cellId`, `id`, `createdAt`

#### Request Body (all fields optional — PATCH semantics)

```json
{
  "location":         "Church Hall",
  "satisfactionRate": 5,
  "additionalInfo":   "Great attendance today.",
  "attendance": [
    { "name": "Kasun Perera", "status": "present", "isNew": false }
  ]
}
```

> At least one field must be provided. Sending an empty body returns `400 VALIDATION_ERROR`.

**Response:**
```json
{
  "id": "report-001", "cellId": "cell-001", "filledByUid": "usr-leader1",
  "clientReqId": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2026-05-27", "didMeet": true, "leaderPresent": true, "location": "Church Hall",
  "timeStarted": "2026-05-27T09:00:00.000Z", "timeEnded": "2026-05-27T11:00:00.000Z",
  "language": "en", "subjectDiscussed": "sunday_sermon",
  "cellType": "care", "g12LeaderUid": "uid-g12-1",
  "attendance": [{"name":"Kasun Perera","status":"present","isNew":false}],
  "contactedAbsentees": "yes", "absenteeNotes": null,
  "additionalVisitors": 2, "childrenCount": 0, "satisfactionRate": 5,
  "additionalInfo": "Great attendance today.",
  "photoUrls": [], "voided": false, "createdAt": "2026-05-27T11:30:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — report updated |
| 400 | `VALIDATION_ERROR` — empty body or field validation failure |
| 403 | `FORBIDDEN` — not the original filer or super_admin |
| 404 | `CELL_NOT_FOUND` / `CELL_REPORT_NOT_FOUND` |
| 409 | `REPORT_ALREADY_VOIDED` — cannot edit a voided report |
| 422 | `EDIT_WINDOW_EXPIRED` — more than 24 hours since filing |

---
### 14.6 `GET /cells/network/reports` ★ UPDATED

Returns reports from all cells in the caller's network. G12 leaders see reports from every cell where they are the `g12LeaderUid`. Cell leaders see their own cell's reports. Admin sees all cells.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `limit` | Reports per cell (default 20, max 100) |
| `from` | Filter by date (`YYYY-MM-DD`) |
| `to` | Filter by date (`YYYY-MM-DD`) |
| `voided` | `true` \| `false` (default: non-voided) |
| `month` ★ NEW | Calendar month (`YYYY-MM`, e.g. `2026-05`). When provided, overrides `from`/`to` with the full month range (`2026-05-01` → `2026-05-31`). |
| `type` ★ NEW | Cell type filter: `g12` \| `care` \| `children` \| `outreach`. Omit for all types. **This is the Cell Type tab filter on the Reports page.** |

#### Scope by role

| Caller | Sees |
|--------|------|
| `g12` | All reports from cells where `g12LeaderUid === callerUid` |
| `leader` | Reports from their own cell only (`leaderUid === callerUid`) |
| `admin` / `super_admin` | Reports from all active cells |

**Response:**
```json
{
  "items": [
    {
      "id":                  "report-001",
      "cellId":              "cell-001",
      "cellName":            "FCX Cell",
      "date":                "2026-05-27",
      "didMeet":             true,
      "noMeetReason":        null,
      "leaderPresent":       true,
      "conductedByIfAbsent": null,
      "location":            "Church Hall",
      "timeStarted":         "2026-05-27T09:00:00.000Z",
      "timeEnded":           "2026-05-27T11:00:00.000Z",
      "language":            "en",
      "subjectDiscussed":    "sunday_sermon",
      "otherSubjectReason":  null,
      "cellType":            "care",
      "g12LeaderUid":        "uid-g12-1",
      "attendance": [
        { "userUid": "uid-1", "name": "Saman S.", "status": "present", "isNew": false },
        { "userUid": "uid-2", "name": "Nimal P.", "status": "absent",  "isNew": false }
      ],
      "contactedAbsentees":  "yes",
      "absenteeNotes":       null,
      "additionalVisitors":  2,
      "childrenCount":       0,
      "satisfactionRate":    4,
      "photoUrls":           [],
      "additionalInfo":      null,
      "voided":              false,
      "clientReqId":         "550e8400-e29b-41d4-a716-446655440000",
      "filledByUid":         "uid-leader-1",
      "createdAt":           "2026-05-27T11:30:00.000Z"
    }
  ],
  "totalCells": 4
}
```

> Reports are sorted by `date` descending (newest first). The `cellName` field is added automatically for each report item.  
> `totalCells` = number of cells matching the filter (not the full network size).  
> When `type=care` is set, only reports where `cellType === "care"` are returned — this is the Cell Type tab filter.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK |
| 403 | `FORBIDDEN` — member or student (not leader/G12/admin) |

---

### 14.7 `GET /cells/network/summary` ★ UPDATED

Returns the complete reporting summary for the **Reports page dashboard** — stat cards, unreported-cell alert, weekly/monthly chart data, meeting-type donut, and per-leader breakdown table — all scoped to the caller's network in a single call.

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `month` | `YYYY-MM` | ✅ | Calendar month to summarise (e.g. `2026-05`) |

#### Scope (same rule as §14.6)

| Caller | Sees |
|--------|------|
| `g12` | Only cells where `g12LeaderUid === callerUid` |
| `leader` | Only their own cell |
| `admin` / `super_admin` | All active cells |

**Response:**
```json
{
  "period": "May 2026",
  "from":   "2026-05",
  "to":     "2026-05-29",
  "scope": {
    "totalCells":   18,
    "totalLeaders": 6
  },
  "summary": {
    "cellsHeld":     9,
    "reportsFiled":  12,
    "activeLeaders": 4,
    "g12Active":     1
  },
  "attendance": {
    "present":         55,
    "roster":          52,
    "rate":            1.058,
    "visitors":        7,
    "avgSatisfaction": 4.1
  },
  "unreportedCells": [
    {
      "id":         "cell-1",
      "name":       "Care Cell A",
      "type":       "care",
      "leaderUid":  "uid-1",
      "leaderName": "Saman S."
    }
  ],
  "weeklyBreakdown": [
    { "weekLabel": "W1", "reportCount": 2, "attendance": 10 },
    { "weekLabel": "W2", "reportCount": 3, "attendance": 15 },
    { "weekLabel": "W3", "reportCount": 4, "attendance": 20 },
    { "weekLabel": "W4", "reportCount": 3, "attendance": 7  }
  ],
  "meetingTypeBreakdown": { "g12": 0, "care": 9, "children": 3, "outreach": 0 },
  "byLeader": [
    {
      "leaderUid":       "uid-1",
      "leaderName":      "Saman S.",
      "g12Uid":          "g12-uid-1",
      "g12Name":         "G12 Leader Name",
      "cellCount":       2,
      "reportCount":     3,
      "attendance":      15,
      "avgSatisfaction": 4.2
    }
  ]
}
```

#### Response Field Reference

| Field | Type | Frontend Use |
|-------|------|-------------|
| `period` | string | Page heading — *"May 2026"* |
| `from`   | string | Month string echoed back from the request (e.g. `"2026-05"`) |
| `to`     | string | End date resolved server-side (today's date in `YYYY-MM-DD`) |
| `scope.totalCells` | number | Denominator for *"X of Y in scope"* sub-label |
| `scope.totalLeaders` | number | Total leader count in scope |
| `summary.cellsHeld` | number | **Cells held** stat card (numerator) |
| `summary.reportsFiled` | number | **Reports filed** stat card |
| `summary.activeLeaders` | number | **Active leaders** stat card |
| `summary.g12Active` | number | **G12 supervisors active** stat card |
| `attendance.present` | number | **Attendance** stat card |
| `attendance.roster` | number | **Total roster** stat card |
| `attendance.rate` | number | **Attendance rate** — multiply × 100 for display (e.g. `0.83` → `83%`). Can exceed `1.0` (100%+) when visitors join beyond the registered roster size. |
| `attendance.visitors` | number | **Visitors** stat card |
| `attendance.avgSatisfaction` | number | **Avg. satisfaction** stat card — 1–6 scale |
| `unreportedCells[]` | array | Alert banner — *"N cells haven't filed a report this month"*; render each as a chip |
| `weeklyBreakdown[]` | array | **Reports filed by week** bar chart — `weekLabel` on X-axis, `reportCount` bar height |
| `meetingTypeBreakdown` | object | **Meetings by cell type** donut chart — keys are the four cell types |
| `byLeader[]` | array | **By cell leader** table — `leaderName`, `g12Name`, `cellCount`, `reportCount`, `attendance`, `avgSatisfaction` |

#### Frontend Integration

```
Page load
  ├─ GET /cells/network/summary?month=2026-05   → stat cards + charts + by-leader table
  └─ GET /cells/network/reports?month=2026-05   → All reports table (no type filter = all types)

Month picker changes (e.g. Apr 2026)
  ├─ GET /cells/network/summary?month=2026-04
  └─ GET /cells/network/reports?month=2026-04

Cell Type tab click (e.g. "Care")
  └─ GET /cells/network/reports?month=2026-05&type=care   → All reports table re-renders only
     (summary stats NOT re-fetched — they already show all-type totals)
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — network summary dashboard data |
| 400 | `VALIDATION_ERROR` — `month` param missing or not `YYYY-MM` format |
| 403 | `FORBIDDEN` — member or student caller |

---

## 15. Analytics Endpoints — NEW V2

All endpoints read from **pre-aggregated snapshots** — never raw reports. <2 s latency (NFR-PER-003). Scope auto-resolved from caller's role.

**Filter parameters** (accepted by every endpoint in §15):

| Parameter | Type | Roles allowed | Description |
|-----------|------|:-------------:|-------------|
| `cellType` | `care` \| `children` \| `outreach` \| `g12` | all | Restrict data to one cell type. Populated by the weekly snapshot job; returns empty data until the next snapshot runs. |
| `leaderUid` | string (UID) | `admin`, `g12`, `super_admin` | Override scope to a specific cell leader's snapshot. Ignored for `leader` callers (they always see their own scope). |
| `g12Uid` | string (UID) | `admin`, `super_admin` | Override scope to a specific G12 supervisor's network snapshot. Ignored for non-admin callers. |

Filters are composable — pass any combination together. An invalid `cellType` value returns `400 VALIDATION_ERROR`.

**Combined filter priority** — when multiple params are present, the backend resolves scope in this order:

| `g12Uid` | `leaderUid` | `cellType` | Resolved scope |
|:--------:|:-----------:|:----------:|----------------|
| ✅ | ❌ | ❌ | `g12:<uid>` |
| ✅ | ✅ | ❌ | `leader:<uid>` ← leaderUid wins |
| ✅ | ❌ | ✅ | `g12:<uid>\|<type>` |
| ❌ | ✅ | ❌ | `leader:<uid>` |
| ❌ | ✅ | ✅ | `leader:<uid>\|<type>` |
| ✅ | ✅ | ✅ | `leader:<uid>\|<type>` ← leaderUid wins |
| ❌ | ❌ | ✅ | `org\|<type>` |
| ❌ | ❌ | ❌ | caller's role scope (`org` / `g12:<uid>` / `leader:<uid>`) |

**Priority rule:** `leaderUid` > `g12Uid` > role-based default. `cellType` is always appended as a `|<type>` suffix to the resolved base scope regardless of which other filters are active.

---

### 15.1 `GET /analytics/cells/weekly`

Weekly cell-count and active-cell trend (FR-ANL-001).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

| Parameter | Default | Description |
|-----------|:-------:|-------------|
| `weeks` | 12 | Past weeks to return (max 52) |
| `cellType` | — | See §15 filter params |
| `leaderUid` | — | See §15 filter params |
| `g12Uid` | — | See §15 filter params |

**Response:**
```json
{
  "scope": "leader:usr-leader1", "periodType": "weekly",
  "data": [
    { "periodKey": "2026-W18", "cellCount": 3, "activeCells": 3, "reportCount": 3 },
    { "periodKey": "2026-W19", "cellCount": 3, "activeCells": 2, "reportCount": 2 }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `periodKey` | string | Week identifier (YYYY-WW) |
| `cellCount` | number | Total cells in scope for this week |
| `activeCells` | number | Cells that held at least one meeting |
| `reportCount` | number | Total reports filed |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — weekly cell trend data |
| 400 | `VALIDATION_ERROR` — invalid filter param value |
| 403 | `FORBIDDEN` — caller lacks required role |

---

### 15.2 `GET /analytics/attendance`

Attendance trend (FR-ANL-002).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `from`, `to` | Period key range `YYYY-WW` |
| `cellType` | See §15 filter params |
| `leaderUid` | See §15 filter params |
| `g12Uid` | See §15 filter params |

**Response:**
```json
{
  "scope": "g12:usr-g12-1",
  "data": [{ "periodKey": "2026-W18", "present": 42, "absent": 6, "visitors": 3, "children": 5, "newAttendees": 2 }]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `periodKey` | string | Week identifier (YYYY-WW) |
| `present` | number | Members marked present |
| `absent` | number | Members marked absent |
| `visitors` | number | Additional visitors |
| `children` | number | Children count |
| `newAttendees` | number | Walk-ins marked as new |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK |
| 400 | `VALIDATION_ERROR` — invalid `cellType` value |

---

### 15.3 `GET /analytics/meeting-types`

Meeting-type breakdown (FR-ANL-002).

**Authentication:** Bearer required | **Roles:** `leader`, `g12`, `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `cellType` | See §15 filter params |
| `leaderUid` | See §15 filter params |
| `g12Uid` | See §15 filter params |

**Response:**
```json
{
  "scope": "org",
  "period": "2026-W18",
  "breakdown": { "g12": 12, "care": 8, "children": 4, "outreach": 3 }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `g12` | number | Count of G12 cell meetings |
| `care` | number | Count of care cell meetings |
| `children` | number | Count of children cell meetings |
| `outreach` | number | Count of outreach cell meetings |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK |
| 400 | `VALIDATION_ERROR` — invalid `cellType` value |

---

### 15.4 `GET /analytics/growth`

Member growth and retention trend (FR-ANL-003).

**Authentication:** Bearer required | **Roles:** `g12`, `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `from`, `to` | Period key range `YYYY-WW` |
| `cellType` | See §15 filter params |
| `leaderUid` | See §15 filter params |
| `g12Uid` | See §15 filter params |

**Response:**
```json
{
  "scope": "org",
  "data": [{ "periodKey": "2026-W18", "memberGrowth": 5, "participationRate": 0.87 }]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `periodKey` | string | Week identifier (YYYY-WW) |
| `memberGrowth` | number | Net new members added this week |
| `participationRate` | number | Fraction of roster that attended (0.0–1.0+) |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK |
| 400 | `VALIDATION_ERROR` — invalid `cellType` value |
| 403 | `FORBIDDEN` — caller does not have g12/admin/super_admin role |

---

### 15.5 `GET /analytics/participation`

Participation per leader (FR-ANL-003).

**Authentication:** Bearer required | **Roles:** `g12`, `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `cellType` | See §15 filter params |
| `leaderUid` | See §15 filter params |
| `g12Uid` | See §15 filter params |

**Response:**
```json
{
  "scope": "g12:usr-g12-1",
  "data": [{ "leaderUid": "usr-leader1", "leaderName": "Sithuru K.", "averageAttendance": 7.5, "cellCount": 2 }]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `leaderUid` | string | Cell leader UID |
| `leaderName` | string | Cell leader display name |
| `averageAttendance` | number | Average attendance per meeting |
| `cellCount` | number | Number of cells led by this leader |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK |
| 400 | `VALIDATION_ERROR` — invalid `cellType` value |
| 403 | `FORBIDDEN` — caller does not have g12/admin/super_admin role |

---

### 15.6 `GET /analytics/:chart/export`

CSV export (FR-ANL-005). `:chart` — one of `cells-weekly`, `attendance`, `meeting-types`, `growth`, `participation`

**Authentication:** Bearer required | **Roles:** `g12`, `admin`, `super_admin`

Same query parameters as the corresponding chart endpoint, including `cellType`, `leaderUid`, and `g12Uid` filter params (see §15 filter params).

**Response:**

`Content-Type: text/csv`; `Content-Disposition: attachment; filename="analytics-{chart}-export.csv"` (e.g. `analytics-attendance-export.csv`)

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — CSV file download |
| 400 | `VALIDATION_ERROR` — invalid `:chart` value or filter param |
| 403 | `FORBIDDEN` — caller lacks required role |

---

## 16. Notification Endpoints

---

### 16.1 `GET /me/notifications`

**Authentication:** Bearer required | **Roles:** Any

| Parameter | Description |
|-----------|-------------|
| `read` | `true` \| `false` |
| `limit`, `cursor` | Pagination |

**Response:**
```json
{
  "items": [{
    "id": "notif-001", "type": "role.granted",
    "title": "Role Granted",
    "body": "You are now a Student in the TCCR system.",
    "read": false,
    "createdAt": "2026-05-15T09:05:00.000Z"
  }],
  "nextCursor": null, "total": 5
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Notification ID |
| `type` | string | Event type key (e.g. `role.granted`, `enrollment.approved`) |
| `title` | string | Short notification title |
| `body` | string | Full notification message |
| `read` | boolean | `true` if marked read |
| `createdAt` | string | ISO datetime of creation |

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK â€” Paginated notification list returned |

---

### 16.2 `POST /me/notifications/:id/read`

**Authentication:** Bearer required | **Roles:** Any (own notifications only)

**Response:**
```json
{
  "id": "notif-001", "type": "role.granted",
  "title": "Role Granted",
  "body": "You are now a Student in the TCCR system.",
  "read": true,
  "createdAt": "2026-05-15T09:05:00.000Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — Notification marked as read |
| 404 | `NOTIFICATION_NOT_FOUND` — Notification not found |

---

---

### 16.3 `POST /me/notifications/read-all`

**Authentication:** Bearer required | **Roles:** Any

**Response:**
```json
{ "message": "All notifications marked as read." }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — All notifications marked as read |

---

---

## 17. Audit Log Endpoints

---

### 17.1 `GET /audit-log`

Organisation-wide audit log (FR-SADM-007 / FR-ADM-005).

**Authentication:** Bearer required | **Roles:** `admin`, `super_admin`

| Parameter | Description |
|-----------|-------------|
| `actorUid` | Filter by actor UID |
| `action` | Filter by action key (exact match) |
| `category` | Filter by category |
| `targetType`, `targetId` | Filter by target entity |
| `from`, `to` | ISO datetime range |
| `limit`, `cursor` | Pagination |

**Response:**
```json
{
  "items": [{
    "id": "log-001", "when": "2026-05-07T14:00:00.000Z",
    "actor": { "uid": "admin-uid-xyz", "email": "admin@tccr.lk" },
    "action": "enrollment.approved", "category": "enrollment",
    "targetType": "enrollment", "targetId": "enr-abc",
    "ip": "203.0.113.45",
    "requestId": "7f3a1c2d-..."
  }],
  "nextCursor": null, "total": 142
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto UUID |
| `when` | string | ISO timestamp of the action |
| `actor.uid` | string \| null | UID of the user who performed the action (`null` for system events) |
| `actor.email` | string \| null | Email of the actor at the time of the action |
| `action` | string | Event type key (e.g. `enrollment.approved`, `role.granted`) |
| `category` | string \| null | Broad category of the action |
| `targetType` | string \| null | Type of the affected entity (e.g. `user`, `enrollment`) |
| `targetId` | string \| null | ID of the affected entity |
| `ip` | string \| null | Client IP address of the request; `null` for system-generated events |
| `requestId` | string | Correlates with `X-Request-Id` response header |

> `before`/`after` state snapshots are stored internally and excluded from API responses.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK â€” Paginated audit log returned |

---



## 18. Admin Management — Super Admin

V1 endpoints carry forward unchanged.

---

### 18.1 `GET /super-admin/admins`

**Authentication:** Bearer required | **Roles:** `super_admin`

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | 1–100, default 20 |
| `cursor` | string | Cursor from previous `nextCursor` |

**Response:**
```json
{
  "items": [{
    "uid": "admin-uid-xyz", "email": "admin@tccr.lk", "firstName": "Ushani", "lastName": "Amanda",
    "role": "admin", "roles": ["member","admin"], "status": "approved",
    "profilePhotoUrl": null, "phoneNumber": null, "preferredLanguage": "en",
    "fcmTokens": [], "notificationPreferences": {"email":true,"push":true}, "providers": ["password"],
    "dateOfBirth": null, "gender": null, "address": null, "qualifications": [],
    "qualificationTitle": null, "qualificationUrl": null, "qualificationStoragePath": null,
    "createdAt": "2026-05-15T10:00:00.000Z", "updatedAt": "2026-05-15T10:00:00.000Z", "deletedAt": null
  }],
  "nextCursor": null,
  "total": 3
}
```

---

### 18.2 `POST /super-admin/admins`

Create Admin account (FR-SADM-001).

**Authentication:** Bearer required | **Roles:** `super_admin`

```json
{
  "firstName": "Ushani", "lastName": "Amanda",
  "email": "ushani@tccr.lk",
  "initialPassword": "Admin@2026X"
}
```

| Field | Required | Validation |
|-------|:--------:|-----------|
| `firstName` | Yes | 1–100 chars |
| `lastName` | Yes | 1–100 chars |
| `email` | string | Yes | Valid email; must be unique |
| `initialPassword` | Yes | Min 10 chars; ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 special char |

> **Note:** `preferredLanguage` defaults to `"en"` for admin accounts and cannot be set at creation time. The admin can update it after login via `PATCH /me`.

**Response:** — User with `roles: ["admin"]`.

---

### 18.3 `GET /super-admin/admins/:uid`

**Authentication:** Bearer required | **Roles:** `super_admin`

**Response:**
```json
{
  "uid": "admin-uid-xyz", "email": "admin@tccr.lk", "firstName": "Ushani", "lastName": "Amanda",
  "role": "admin", "roles": ["member","admin"], "status": "approved",
  "profilePhotoUrl": null, "phoneNumber": null, "preferredLanguage": "en",
  "fcmTokens": [], "notificationPreferences": {"email":true,"push":true}, "providers": ["password"],
  "dateOfBirth": null, "gender": null, "address": null, "qualifications": [],
  "qualificationTitle": null, "qualificationUrl": null, "qualificationStoragePath": null,
  "createdAt": "2026-05-15T10:00:00.000Z", "updatedAt": "2026-05-15T10:00:00.000Z", "deletedAt": null
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — admin profile returned |
| 404 | `ADMIN_NOT_FOUND` — admin user does not exist |

---

### 18.4 `POST /super-admin/admins/:uid/suspend`

**Authentication:** Bearer required | **Roles:** `super_admin`

No request body.

**Response:** — User with `status: "suspended"`. Same shape as §18.3.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — admin suspended |
| 404 | `ADMIN_NOT_FOUND` — admin user does not exist |

---

### 18.5 `POST /super-admin/admins/:uid/reactivate`

**Authentication:** Bearer required | **Roles:** `super_admin`

No request body.

**Response:** — User with `status: "approved"`. Same shape as §18.3.

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — admin reactivated |
| 404 | `ADMIN_NOT_FOUND` — admin user does not exist |

---

### 18.6 `DELETE /super-admin/admins/:uid`

Permanently hard-deletes the admin account from Firestore and Firebase Auth.

**Authentication:** Bearer required | **Roles:** `super_admin`

**Status Codes:**
| Code | Description |
|------|-------------|
| 204 | No Content — admin permanently deleted |
| 404 | `ADMIN_NOT_FOUND` — admin user does not exist |

---

### 18.7 `POST /super-admin/users/:uid/make-admin`

Promote student to Admin. User retains both `student` and `admin` roles (dual-role).

**Authentication:** Bearer required | **Roles:** `super_admin`

No request body.

**Response:**
```json
{
  "uid": "firebase-uid-student123", "email": "student@tccr.lk",
  "firstName": "Anuradha", "lastName": "Perera",
  "role": "admin", "roles": ["member","student","admin"], "status": "approved",
  "profilePhotoUrl": null, "phoneNumber": null, "preferredLanguage": "en",
  "fcmTokens": [], "notificationPreferences": {"email":true,"push":true}, "providers": ["password"],
  "dateOfBirth": null, "gender": null, "address": null, "qualifications": [],
  "qualificationTitle": null, "qualificationUrl": null, "qualificationStoragePath": null,
  "createdAt": "2026-05-10T08:00:00.000Z", "updatedAt": "2026-05-27T14:50:00.000Z", "deletedAt": null
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — student promoted to admin |
| 404 | `USER_NOT_FOUND` — user does not exist |
| 409 | `INVALID_ROLE` — user is not a student |

---

## 19. Health Endpoints

---

### 19.1 `GET /healthz`

Liveness probe.

**Response:**
```json
{ "status": "ok", "service": "gateway" }
```

`service` is the `SERVICE_NAME` env var (e.g. `"gateway"`, `"auth-service"`, etc.)

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — service is alive |

---

### 19.2 `GET /readyz`

Readiness probe.

**Response:**
```json
{ "status": "ready" }
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK — service is ready |
| 503 | `{ "status": "not_ready", "error": "Firestore unreachable" }` — dependency unavailable |

---

## 20. Data Models

---

### User

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | Firebase Auth UID |
| `email` | string | Unique |
| `firstName` | string | |
| `lastName` | string | |
| `preferredLanguage` | string | `si` \| `ta` \| `en` — defaults to `en` — **NEW V2** |
| `roles` | string[] | `member`, `student`, `leader`, `g12`, `admin`, `super_admin` — **NEW V2** (was scalar `role` in V1) |
| `providers` | string[] | `password`, `google.com`, `apple.com` — **NEW V2** |
| `status` | string | `approved` \| `suspended` |
| `profilePhotoUrl` | string or null | |
| `notificationPreferences` | object | `{ email: boolean, push: boolean }` — **NEW V2** (FR-NOT-006) |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |
| `deletedAt` | string or null | Non-null = soft-deleted |

---

### RoleRequest — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `requesterUid` | string | FK → users |
| `requestedRole` | string | `"student"` — only value at this stage |
| `status` | string | `pending` \| `approved` \| `rejected` |
| `applicantProfile` | ApplicantProfile | Snapshot taken at submission time — see below |
| `qualificationTitle` | string or null | Admin-visible label for the qualification PDF |
| `qualificationStoragePath` | string or null | Internal Firebase Storage path — use `GET /role-requests/:id/qualification` to obtain a signed URL |
| `decidedByUid` | string or null | UID of admin who approved/rejected |
| `decisionNote` | string or null | Optional note from the reviewer |
| `createdAt` | string | ISO 8601 |
| `decidedAt` | string or null | ISO 8601 — set when status changes from `pending` |
| `memberProfile` | MemberProfile or null | **Admin only** — live member profile fetched from user-service; `null` for non-admin callers or if user-service is unavailable |

#### ApplicantProfile

Nested inside `RoleRequest.applicantProfile`. Snapshot of the member's profile at the time they submitted the request. May differ from current live data.

| Field | Type | Notes |
|-------|------|-------|
| `firstName` | string | 1–100 chars |
| `lastName` | string | 1–100 chars |
| `phoneNumber` | string or null | 5–30 chars |
| `email` | string | Valid email address |
| `dateOfBirth` | string or null | `YYYY-MM-DD` |
| `gender` | string or null | `male` \| `female` \| `other` |
| `address` | string or null | 1–500 chars |
| `qualificationTitle` | string or null | Label snapshotted from the uploaded PDF |
| `qualificationUrl` | string or null | Firebase Storage URL snapshotted at submission |

#### MemberProfile ★ NEW

Live member profile included in `GET /role-requests/:id` responses **for admin and super_admin callers only**. Always reflects the member's current state — use this for the approval review UI.

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | Firebase Auth UID |
| `email` | string | Current registered email |
| `firstName` | string | Current first name |
| `lastName` | string | Current last name |
| `phoneNumber` | string or null | Current phone number |
| `profilePhotoUrl` | string or null | Current avatar URL (Firebase Storage) |
| `dateOfBirth` | string or null | `YYYY-MM-DD` |
| `gender` | string or null | `male` \| `female` \| `other` |
| `address` | string or null | Current address |
| `preferredLanguage` | string | `en` \| `si` \| `ta` |
| `roles` | string[] | Current roles array e.g. `["member"]` |
| `status` | string | `approved` \| `pending_approval` \| `suspended` \| `rejected` |
| `accountCreatedAt` | string | ISO 8601 — when the user account was registered |
| `qualifications` | Qualification[] | All uploaded qualifications (ordered list) |

#### Qualification (inside MemberProfile.qualifications)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `title` | string | e.g. "Bachelor of Theology" |
| `fileUrl` | string or null | Firebase Storage download URL; `null` if no PDF uploaded |

---

### Course

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `title` | string | Unique (incl. soft-deleted) |
| `description` | string | Max 500 chars; defaults to `""` |
| `coverImageUrl` | string or null | |
| `state` | string | `draft` \| `published` \| `archived` |
| `createdBy` | string | UID of the user who created the course |
| `semesterCount` | number | Denormalised count maintained by create/delete semester use cases |
| `publishedAt` | string or null | ISO 8601; set when course is first published; reset to `null` on unpublish |
| `deletedAt` | string or null | Non-null = soft-deleted |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

---

### Batch — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `courseId` | string | FK → courses |
| `name` | string | Unique within course |
| `scheduledOpenAt` | string or null | ISO 8601 datetime — batch auto-opens at this time via Scheduled Jobs |
| `intakeStart` | string | ISO date — enrollment window opens |
| `intakeEnd` | string | ISO date — enrollment window auto-closes when this passes |
| `capacity` | number or null | Optional max student cap |
| `state` | string | `draft` → `open` → `closed` |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

---

### Semester

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `courseId` | string | FK → courses |
| `title` | string | 1–200 chars |
| `order` | number | Auto-assigned sequential within course; gaps expected after deletions |
| `openDate` | string or null | ISO date (`YYYY-MM-DD`); content accessible from this date |
| `endDate` | string or null | ISO date (`YYYY-MM-DD`); auto-disabled by nightly sweep after this date |
| `status` | string | `active` \| `disabled` |
| `subjectCount` | number | Denormalised; maintained by create/delete subject use cases |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |
| `deletedAt` | string or null | Non-null = soft-deleted |

---

### Subject

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `semesterId` | string | FK → semesters |
| `courseId` | string | FK → courses |
| `title` | string | 1–200 chars |
| `order` | number | Auto-assigned sequential within semester; gaps expected after deletions |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |
| `deletedAt` | string or null | Non-null = soft-deleted |

> To attach files to a subject use `POST /subjects/:id/attachments` (PDF/DOCX, max 25 MB) and `POST /subjects/:id/images` (PNG/JPG, max 10 MB). To download an attachment use `GET /attachments/:id/download-url`.

---

### Lesson

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `subjectId` | string | |
| `courseId` | string | |
| `semesterId` | string | |
| `title` | string | |
| `description` | string | Max 2000 chars |
| `youtubeVideoId` | string or null | 11-char ID; extracted from URL on write; rendered via YouTube IFrame Player API (FR-LRN-001) |
| `attachmentIds` | string[] | IDs of associated Attachments |
| `order` | number | Auto-assigned sequential within subject |
| `deletedAt` | string or null | |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

---

### Attachment

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `subjectId` | string | |
| `courseId` | string | |
| `filename` | string | Original file name |
| `mimeType` | string | PDF/DOC/DOCX + `image/png`, `image/jpeg` (**V2 adds PNG/JPG**) |
| `sizeBytes` | number | |
| `storagePath` | string | Internal Cloud Storage path |
| `createdAt` | string | ISO 8601 |

---

### Enrollment

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `${studentUid}_${courseId}` |
| `studentUid` | string | FK → users |
| `courseId` | string | FK → courses |
| `state` | string | `pending` \| `approved` \| `withdrawn` \| `rejected` |
| `reason` | string or null | Rejection reason (set on rejection) |
| `approvedAt` | string or null | ISO 8601; set when `state` → `approved` |
| `rejectedAt` | string or null | ISO 8601; set when `state` → `rejected` |
| `withdrawnAt` | string or null | ISO 8601; set when `state` → `withdrawn` |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

---

### SubjectProgress

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `${studentUid}_${subjectId}` |
| `studentUid` | string | FK → users |
| `subjectId` | string | FK → subjects |
| `courseId` | string | FK → courses |
| `semesterId` | string | FK → semesters |
| `state` | string | `not_started` \| `in_progress` \| `completed` |
| `completedAt` | string or null | ISO 8601; immutable once set |
| `lastAccessedAt` | string or null | ISO 8601; updated on lesson open |

---

### CellJoinRequest — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `cellId` | string | FK → cell_groups |
| `requesterUid` | string | FK → users |
| `message` | string or null | Optional note from applicant |
| `status` | string | `pending` \| `approved` \| `rejected` |
| `decidedByUid` | string or null | Admin who approved/rejected |
| `decisionNote` | string or null | Admin note |
| `createdAt` | string | ISO 8601 |
| `decidedAt` | string or null | ISO 8601 |

---

### CellGroup — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `name` | string | |
| `type` | string | `g12` \| `care` \| `children` \| `outreach` |
| `area` | string | Geographic area / district |
| `leaderUid` | string | FK → users |
| `g12LeaderUid` | string | FK → users |
| `members` | string[] | Array of member UIDs |
| `memberCount` | number | Denormalised; incremented atomically (FR-CG-007) |
| `reportCount` | number | Denormalised; incremented atomically (FR-CG-007) |
| `state` | string | `active` \| `archived` |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

---

### CellReport — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `cellId` | string | FK → cell_groups |
| `filledByUid` | string | System-populated; read-only (FR-CR-002) |
| `clientReqId` | string | Client UUID for idempotent offline retry (FR-CR-015) |
| `date` | string | ISO date |
| `didMeet` | boolean | FR-CR-004 |
| `noMeetReason` | string or null | Required when `didMeet=false` |
| `leaderPresent` | boolean | FR-CR-005 |
| `conductedByIfAbsent` | string or null | Required when `leaderPresent=false` |
| `location` | string | FR-CR-006 |
| `timeStarted` / `timeEnded` | string | ISO datetime (FR-CR-006) |
| `language` | string | `si` \| `ta` \| `en` (FR-CR-006) |
| `subjectDiscussed` | string | `sunday_sermon` \| `other` (FR-CR-007) |
| `otherSubjectReason` | string or null | FR-CR-007 |
| `cellType` | string | `g12` \| `care` \| `children` \| `outreach`; defaults to parent cell's type (FR-CR-008) |
| `g12LeaderUid` | string | From system roster (FR-CR-009) |
| `immediateG12LeaderText` | string or null | Free-text offline reference (FR-CR-009) |
| `attendance` | AttendanceEntry[] | `{ userUid?, name, status: "present"\|"absent"\|"new", isNew }` (FR-CR-010) |
| `contactedAbsentees` | boolean | FR-CR-011 |
| `absenteeNotes` | string or null | FR-CR-011 |
| `additionalVisitors` | number | FR-CR-012 |
| `childrenCount` | number | FR-CR-012 |
| `satisfactionRate` | number | 1–6 (FR-CR-013) |
| `additionalInfo` | string or null | FR-CR-013 |
| `voided` | boolean | Immutable once `true` (FR-CR-014) |
| `createdAt` | string | ISO 8601 |

---

### AnalyticsSnapshot — NEW V2

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `{scope}_{periodKey}` |
| `scope` | string | `leader:{uid}` \| `g12:{uid}` \| `org` |
| `periodKey` | string | `YYYY-WW` (weekly) or `YYYY-MM` (monthly) |
| `metrics` | object | Pre-aggregated: `cellCount`, `activeCells`, `reportCount`, `attendance`, `meetingTypeBreakdown`, `memberGrowth`, `participationRate`, `averageSatisfaction` |
| `computedAt` | string | ISO 8601 |

---

### Notification

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `userUid` | string | Recipient user UID |
| `type` | string | Event type key, e.g. `role.granted`, `enrollment.approved`, `cell_report.filed` |
| `title` | string | Notification title text |
| `body` | string | Notification body text |
| `read` | boolean | `false` when unread; set to `true` via `PATCH /me/notifications/:id/read` |
| `createdAt` | string | ISO 8601 |

---

### AuditLogEntry

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto UUID |
| `when` | string | ISO 8601 (mapped from `createdAt`) |
| `actor` | object | `{ uid: string or null, email: string or null }` |
| `action` | string | Stable key, e.g. `role.granted`, `enrollment.approved` |
| `category` | string or null | Logical grouping, e.g. `enrollment`, `cell`, `auth` |
| `targetType` | string or null | Affected collection |
| `targetId` | string or null | Affected document ID |
| `ip` | string or null | Client IP of the originating request; `null` for system-generated events |
| `requestId` | string | `X-Request-Id` from originating HTTP request |

> `before`/`after` snapshots stored internally; excluded from API responses.

---

## 21. Error Codes Reference

### V1 Codes (all preserved)

| Code | Status | Description |
|------|:------:|-------------|
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
| `INVALID_OTP` | 400 | OTP invalid or not found |
| `EMAIL_ALREADY_VERIFIED` | 400 | `POST /auth/resend-verification` called for an already-verified address ★ NEW |
| `OTP_EXPIRED` | 400 | OTP has passed its 15-minute expiry |
| `OTP_MAX_ATTEMPTS` | 400 | Too many incorrect OTP attempts |
| `FILE_TOO_LARGE` | 413 | File exceeds the size limit for that endpoint |
| `MISSING_TOKEN` | 401 | Authorization header absent |
| `INVALID_TOKEN` | 401 | Token expired, revoked, or malformed |
| `TOKEN_REVOKED` | 401 | Session has been revoked |
| `TOKEN_EXPIRED` | 401 | ID token has expired |
| `FORBIDDEN` | 403 | Valid token; insufficient role or ownership mismatch |
| `COURSE_NOT_FOUND` | 404 | Course not found |
| `USER_NOT_FOUND` | 404 | User not found |
| `SEMESTER_NOT_FOUND` | 404 | Semester not found |
| `SUBJECT_NOT_FOUND` | 404 | Subject not found |
| `LESSON_NOT_FOUND` | 404 | Lesson not found |
| `ATTACHMENT_NOT_FOUND` | 404 | Attachment not found |
| `ENROLLMENT_NOT_FOUND` | 404 | Enrollment not found |
| `REPORT_NOT_FOUND` | 404 | Cell report not found (returned by `PATCH /cells/:id/reports/:rid`) ★ NEW |
| `EMAIL_EXISTS` | 409 | Email already registered |
| `COURSE_TITLE_EXISTS` | 409 | Course name already in use |
| `ENROLLMENT_PENDING` | 409 | Pending enrollment already exists |
| `ALREADY_ENROLLED` | 409 | Active enrollment already exists |
| `INVALID_STATE` | 409 | Entity not in required state for this operation |
| `INVALID_ROLE` | 409 | User role does not permit this operation |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | File MIME type not allowed |
| `COOLOFF_ACTIVE` | 422 | Must wait before re-enrolling |
| `EMAIL_DOMAIN_UNREACHABLE` | 422 | Email domain has no MX DNS records — domain cannot receive email ★ NEW |
| `DISPOSABLE_EMAIL` | 422 | Disposable/throwaway email address not accepted at registration ★ NEW |
| `EDIT_WINDOW_EXPIRED` | 422 | Cell report can only be edited within 24 hours of filing ★ NEW |
| `NO_CHANGE` | 422 | Transfer ownership called with same UIDs as current owners ★ NEW |
| `EMAIL_DOMAIN_UNREACHABLE` | 422 | Email domain has no MX DNS records — cannot receive email (register) ★ NEW |
| `DISPOSABLE_EMAIL` | 422 | Disposable/throwaway email address not accepted (register) ★ NEW |
| `EDIT_WINDOW_EXPIRED` | 422 | Cell report can only be edited within 24 hours of filing ★ NEW |
| `NO_CHANGE` | 422 | Transfer ownership called with same UIDs as current owners ★ NEW |
| `NO_SEMESTERS` | 422 | Cannot publish: course has no semesters |
| `EMPTY_SEMESTER` | 422 | Cannot publish: semester has no subjects |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### V2 New Codes

| Code | Status | Description |
|------|:------:|-------------|
| `FEDERATED_TOKEN_INVALID` | 401 | Google or Apple ID token failed verification |
| `EMAIL_NOT_VERIFIED` | 401 | Federated sign-in with unverified email |
| `APPLE_NOT_CONFIGURED` | 404 | `APPLE_CLIENT_ID` env var missing; Apple OAuth not available on this server |
| `APPLE_TOKEN_NOT_FOUND` | 404 | No Apple refresh token stored for this account (user did not sign in with Apple) |
| `SEMESTER_DISABLED` | 403 | Semester's endDate passed; student not enrolled before cutoff |
| `BATCH_NOT_FOUND` | 404 | Batch not found |
| `ROLE_REQUEST_NOT_FOUND` | 404 | Role request not found |
| `CELL_NOT_FOUND` | 404 | Cell group not found |
| `CELL_REPORT_NOT_FOUND` | 404 | Cell report not found |
| `LAST_SUPER_ADMIN` | 409 | Cannot demote the only remaining Super Admin (FR-SADM-004) |
| `ROLE_REQUEST_PENDING` | 409 | Pending role request already exists for this role |
| `REPORT_ALREADY_VOIDED` | 409 | Report has already been voided |
| `CELL_JOIN_REQUEST_PENDING` | 409 | Member already has a pending join request for this cell |
| `BATCH_CLOSED` | 422 | Batch intake window closed at time of enrollment |

---

## 22. HTTP Status Code Reference

| Status | Meaning | When Used |
|:------:|---------|-----------|
| `200` | OK | Successful GET, PATCH, state-change POST |
| `201` | Created | Successful POST creating a new resource |
| `204` | No Content | Successful DELETE; logout; change-password; mark-all-read |
| `400` | Bad Request | Validation failure; invalid OTP |
| `401` | Unauthorized | Missing, expired, or revoked token |
| `413` | Payload Too Large | Uploaded file exceeds the size limit for that endpoint |
| `403` | Forbidden | Valid token; wrong role; ownership mismatch; semester disabled |
| `404` | Not Found | Resource not found; draft/archived course accessed by student |
| `409` | Conflict | Duplicate; invalid state transition; last super admin |
| `410` | Gone | Deprecated V1 endpoint removed in Phase 3 |
| `415` | Unsupported Media Type | Invalid file MIME type |
| `422` | Unprocessable Entity | Business rule violation (batch closed, no semesters, cooloff) |
| `429` | Too Many Requests | Rate limit — see `Retry-After` header |
| `500` | Internal Server Error | Unhandled exception; sanitised message returned |
| `502` | Bad Gateway | Upstream service unreachable |
| `503` | Service Unavailable | Readiness check failed |

---

## 23. Domain Events Reference

Events published to the `outbox` Firestore collection and dispatched by the Outbox Worker. At-least-once delivery; up to 5 retries with exponential backoff.

> **Wiring legend:** ✅ Wired in `EventDispatcher` and handler exists. ⚠️ Published to outbox but **not wired** in EventDispatcher — silently skipped (known gap). 🔇 Delivered to service but **no handler** exists in that service — silently dropped.

### V1 Events (all preserved)

| Event | Publisher | Wired Consumers | Trigger |
|-------|-----------|-----------------|---------|
| `user.registered` | Auth Service | ✅ Notification, ✅ Audit | Registration (payload expanded in V2) |
| `registration.approved` | Enrollment Service | ✅ Notification, ✅ Audit | V1 registration approval |
| `registration.rejected` | Enrollment Service | ✅ Notification, ✅ Audit | V1 registration rejection |
| `enrollment.pending` | Enrollment Service | ✅ Notification, ✅ Audit | Student submits enrollment |
| `enrollment.approved` | Enrollment Service | ✅ Notification, ✅ Audit | Admin approves enrollment |
| `enrollment.rejected` | Enrollment Service | ✅ Notification, ✅ Audit | Admin rejects enrollment |
| `enrollment.withdrawn` | Enrollment Service | ✅ Audit | Student withdraws |
| `course.published` | Course Service | 🔇 Notification (delivered but no handler — silently dropped), ✅ Audit | Course published |
| `progress.subjectCompleted` | Progress Service | ✅ Audit | Subject marked complete |
| `admin.created` | User Service | ✅ Notification (`AdminCreatedHandler` — 3 branches: promotion notice / leader+g12 welcome with credentials / default admin welcome), ✅ Audit | Admin/leader/g12 created or promoted |
| `admin.suspended` | User Service | ✅ Notification, ✅ Audit | Admin suspended |
| `audit.action` | Any service | ✅ Audit | Direct audit write |

### V2 New Events

| Event | Publisher | Wired Consumers | Trigger |
|-------|-----------|-----------------|---------|
| `role.requested` | Enrollment Service | ⚠️ Not wired — silently skipped | Member submits role request |
| `role.granted` | Enrollment Service | ✅ Notification (`RoleGrantedHandler` — in-app notification + approval email with role label, optional admin note, next-steps, login link), ✅ Audit | Admin approves role request |
| `role.rejected` | Enrollment Service | ⚠️ Not wired — silently skipped | Admin rejects role request |
| `cell.created` | Cell Service | ✅ Audit | Cell group created |
| `cell.join_requested` | Cell Service | ✅ Notification (leader + G12 leader in-app: "New Cell Join Request"), ✅ Audit | Member applies to join a cell — notifies owning leader and G12 leader ★ Updated |
| `cell.join_approved` | Cell Service | ✅ Notification (member in-app: "Cell Join Request Approved"), ✅ Audit | Admin approves member into cell ★ Updated |
| `cell.join_rejected` | Cell Service | ✅ Notification (member in-app: "Cell Join Request Not Approved"), ✅ Audit | Admin rejects cell join request ★ Updated |
| `cell_report.filed` | Cell Service | ✅ Notification (G12 leader in-app: "Cell Report Filed" — skipped if G12=filer), ✅ Audit | Leader files cell report ★ Updated |
| `cell_report.voided` | Cell Service | ✅ Audit | Cell report voided |
| `cell.ownership_transferred` | Cell Service | ✅ Auto-demotion of previous owner when self-initiated (`POST /internal/users/remove-role`), ✅ Notification (new leader + G12 in-app + email), ✅ Audit | Cell ownership transferred; previous owner auto-demoted when they initiated it ★ Updated |

**Delivery guarantees:**
- At-least-once; Outbox Worker retries up to **5 times** with exponential backoff
- Events failing all 5 attempts remain as `status: "failed"` for manual investigation
- `Promise.allSettled` across a batch — one failure does not block other events

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*
*Document version: 2.19.0 | Paired with TCCR SRS v2.0 dated 22 May 2026 and TCCR Backend Blueprint v2.0.0*
