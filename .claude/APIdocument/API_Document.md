# CMP — API Reference Document
## Course Management Portal · `slp-backend`
### REST API · Version 1.3.0 · Base URL: `https://api.yourdomain.com/api/v1`

**Version:** 1.3.0
**Date:** 2026-05-16
**Organisation:** Future CX Lanka (Pvt) Ltd
**Status:** Release Baseline

---

## Table of Contents

1. [Getting Started](#1-getting-started)
   - 1.1 [Base URL & Versioning](#11-base-url--versioning)
   - 1.2 [Authentication](#12-authentication)
   - 1.3 [Request Format](#13-request-format)
   - 1.4 [Response Format](#14-response-format)
   - 1.5 [Error Format](#15-error-format)
   - 1.6 [Pagination](#16-pagination)
   - 1.7 [Rate Limiting](#17-rate-limiting)
   - 1.8 [Role Summary](#18-role-summary)
2. [Auth Endpoints](#2-auth-endpoints)
   - 2.1 [Register](#21-post-authregister)
   - 2.2 [Logout](#22-post-authlogout)
   - 2.3 [Request Password Reset](#23-post-authpassword-reset)
   - 2.4 [Verify OTP and Reset Password](#24-post-authpassword-resetverify)
   - 2.5 [Track Login Failure](#25-post-authtrack-failure)
3. [Profile Endpoints (Me)](#3-profile-endpoints-me)
   - 3.1 [Get Own Profile](#31-get-me)
   - 3.2 [Update Own Profile](#32-patch-me)
   - 3.3 [Change Password](#33-post-mechange-password)
   - 3.4 [Upload Profile Photo](#34-post-meavatar)
4. [Course Endpoints](#4-course-endpoints)
   - 4.1 [List Courses](#41-get-courses)
   - 4.2 [Get Course by ID](#42-get-coursesid)
   - 4.3 [Create Course (Admin)](#43-post-courses)
   - 4.4 [Update Course (Admin)](#44-patch-coursesid)
   - 4.5 [Publish Course (Admin)](#45-post-coursesidpublish)
   - 4.6 [Unpublish Course (Admin)](#46-post-coursesidunpublish)
   - 4.7 [Archive Course (Admin)](#47-post-coursesidarchive)
   - 4.8 [Delete Course (Admin)](#48-delete-coursesid)
   - 4.9 [Restore Course (Admin)](#49-post-coursesidrestore)
5. [Semester Endpoints](#5-semester-endpoints)
   - 5.1 [Create Semester](#51-post-coursesidsemesters)
   - 5.2 [Update Semester](#52-patch-semestersid)
   - 5.3 [Delete Semester](#53-delete-semestersid)
6. [Subject Endpoints](#6-subject-endpoints)
   - 6.1 [Create Subject](#61-post-semestersidsubjects)
   - 6.2 [Update Subject](#62-patch-subjectsid)
   - 6.3 [Delete Subject](#63-delete-subjectsid)
   - 6.4 [List Lessons](#64-get-subjectsidlessons)
   - 6.5 [Create Lesson](#65-post-subjectsidlessons)
   - 6.6 [Update Lesson](#66-patch-lessonsid)
   - 6.7 [Delete Lesson](#67-delete-lessonsid)
7. [Attachment Endpoints](#7-attachment-endpoints)
   - 7.1 [Upload Attachment](#71-post-subjectsidattachments)
   - 7.2 [Get Download URL](#72-get-attachmentsiddownload-url)
   - 7.3 [Delete Attachment](#73-delete-attachmentsid)
8. [Enrollment Endpoints — Student](#8-enrollment-endpoints--student)
   - 8.1 [Enroll in Course](#81-post-coursesididenroll)
   - 8.2 [List My Enrollments](#82-get-meenrollments)
   - 8.3 [Withdraw Enrollment](#83-post-enrollmentsidwithdraw)
9. [Registration Queue — Admin](#9-registration-queue--admin)
   - 9.1 [List Pending Registrations](#91-get-adminregistrations)
   - 9.2 [Approve Registration](#92-post-adminregistrationsidapprove)
   - 9.3 [Reject Registration](#93-post-adminregistrationsidreject)
   - 9.4 [Bulk Approve Registrations](#94-post-adminregistrationsbulk-approve)
10. [Enrollment Queue — Admin](#10-enrollment-queue--admin)
    - 10.1 [List Pending Enrollments](#101-get-adminenrollments)
    - 10.2 [Approve Enrollment](#102-post-adminenrollmentsidapprove)
    - 10.3 [Reject Enrollment](#103-post-adminenrollmentsidreject)
11. [Progress Endpoints](#11-progress-endpoints)
    - 11.1 [Mark Subject Complete](#111-post-progresssubjectsidcomplete)
    - 11.2 [Update Last Accessed](#112-post-progresssubjectsidaccess)
    - 11.3 [Get Course Progress](#113-get-meprogress-coursescourseid)
    - 11.4 [Get Subject Progress](#114-get-meprogress-subjectssubjectid)
    - 11.5 [Get Admin Course Progress](#115-get-adminprogress-coursescourseid)
12. [Notification Endpoints](#12-notification-endpoints)
    - 12.1 [List My Notifications](#121-get-menotifications)
    - 12.2 [Mark Notification Read](#122-post-menotificationsidread)
    - 12.3 [Mark All Read](#123-post-menotificationsread-all)
13. [User Management — Admin](#13-user-management--admin)
    - 13.1 [List Users](#131-get-users)
    - 13.2 [Get User by ID](#132-get-usersuid)
    - 13.3 [Suspend User](#133-post-usersusidsuspend)
    - 13.4 [Reactivate User](#134-post-usersuidreactivate)
    - 13.5 [Create Leader / G12 User](#135-post-users)
14. [Admin Management — Super Admin](#14-admin-management--super-admin)
    - 14.1 [List Admins](#141-get-super-adminadmins)
    - 14.2 [Create Admin](#142-post-super-adminadmins)
    - 14.3 [Get Admin by ID](#143-get-super-adminadminsuid)
    - 14.4 [Suspend Admin](#144-post-super-adminadminsusidsuspend)
    - 14.5 [Reactivate Admin](#145-post-super-adminadminsuidreactivate)
    - 14.6 [Delete Admin](#146-delete-super-adminadminsuid)
    - 14.7 [Promote Student to Admin](#147-post-super-adminusersuidmake-admin)
15. [Audit Log — Super Admin](#15-audit-log--super-admin)
    - 15.1 [Get Audit Log](#151-get-audit-log)
16. [Health Endpoints](#16-health-endpoints)
    - 16.1 [Liveness Probe](#161-get-healthz)
    - 16.2 [Readiness Probe](#162-get-readyz)
17. [Data Models](#17-data-models)
18. [Error Codes Reference](#18-error-codes-reference)
19. [HTTP Status Code Reference](#19-http-status-code-reference)
20. [Domain Events Reference](#20-domain-events-reference)

---

## 1. Getting Started

### 1.1 Base URL & Versioning

All API requests are made to the versioned base URL:

```
Production:  https://api.yourdomain.com/api/v1
Staging:     https://api-staging.yourdomain.com/api/v1
Local Dev:   http://localhost:3000/api/v1
```

All paths in this document are relative to the base URL. For example, `GET /courses` means `GET https://api.yourdomain.com/api/v1/courses`.

---

### 1.2 Authentication

The CMP API uses **Firebase Authentication** with stateless Bearer tokens. The client obtains a Firebase ID token via the Firebase client SDK, then includes it on every authenticated request.

#### How to Authenticate

```
Authorization: Bearer <firebase-id-token>
```

**Token lifecycle:**
- Firebase ID tokens expire after **1 hour**
- The Firebase client SDK automatically refreshes tokens; always use `user.getIdToken()` to get a fresh token before each request
- Revoked tokens are rejected immediately (server calls `verifyIdToken(token, checkRevoked=true)`)

**Login** is handled entirely by the Firebase client SDK:

```javascript
// Firebase client SDK (web)
import { signInWithEmailAndPassword, getAuth } from 'firebase/auth';

const auth   = getAuth();
const result = await signInWithEmailAndPassword(auth, email, password);
const token  = await result.user.getIdToken();

// Use token in API requests
fetch('https://api.yourdomain.com/api/v1/me', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**Endpoints that do NOT require authentication:**

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | Student registration |
| `POST /auth/password-reset` | Request OTP for password reset |
| `POST /auth/password-reset/verify` | Verify OTP and trigger Firebase reset email |
| `POST /auth/track-failure` | Record a failed login attempt |
| `GET /courses` | Browse published course catalog |
| `GET /courses/:id` | View a published course detail |
| `GET /healthz` | Liveness probe |
| `GET /readyz` | Readiness probe |

---

### 1.3 Request Format

- All request bodies must be JSON with `Content-Type: application/json`
- File upload endpoints use `multipart/form-data` (noted per endpoint)
- All request IDs are echoed in responses via `X-Request-Id` header
- Clients may supply their own `X-Request-Id` (UUID v4); if absent the server generates one

#### Required Headers

| Header | Value | Required |
|--------|-------|:--------:|
| `Authorization` | `Bearer <id-token>` | On authenticated endpoints |
| `Content-Type` | `application/json` | On POST / PATCH with body |
| `X-Request-Id` | UUID v4 (optional, server generates if absent) | No |

---

### 1.4 Response Format

All successful responses return JSON. The shape depends on the operation:

#### Single resource
```json
{
  "id": "abc123",
  "title": "Introduction to TypeScript",
  "state": "published",
  "createdAt": "2026-05-01T08:00:00.000Z"
}
```

#### Paginated list
```json
{
  "items": [ ... ],
  "nextCursor": "abc123",
  "total": 47
}
```

> `total` is included where the server can compute it efficiently. `nextCursor` is `null` when there are no more pages.

#### Empty success (DELETE)
```
HTTP 204 No Content
(empty body)
```

---

### 1.5 Error Format

All errors return a consistent envelope:

```json
{
  "error": {
    "code":    "COURSE_NOT_FOUND",
    "message": "The requested course could not be found.",
    "details": {
      "courseId": ["Course with this ID does not exist"]
    }
  },
  "requestId": "7f3a1c2d-4e5b-6f7a-8b9c-0d1e2f3a4b5c"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `error.code` | `string` | Machine-readable error code (see Section 18) |
| `error.message` | `string` | Human-readable description |
| `error.details` | `object` | Field-level validation errors (only on 400 responses) |
| `requestId` | `string` | Correlation ID — include this in support requests |

---

### 1.6 Pagination

All list endpoints that may return large datasets use **cursor-based pagination**.

#### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|:-------:|-------------|
| `limit` | `number` | `20` | Items per page (max `100`) |
| `cursor` | `string` | — | Cursor from `nextCursor` of previous response |

#### Example

```
GET /courses?limit=10
GET /courses?limit=10&cursor=abc123
```

#### Response

```json
{
  "items": [ ... ],
  "nextCursor": "xyz789",
  "total": 47
}
```

When `nextCursor` is `null`, you have reached the last page. Do not include `cursor` on the first request.

---

### 1.7 Rate Limiting

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| `POST /auth/*` | 10 requests | Per IP per minute |
| All other endpoints | 200 requests | Per IP per minute |

When a limit is exceeded, the server returns `429 Too Many Requests`. The response includes standard `RateLimit-*` headers:

```
RateLimit-Limit:     200
RateLimit-Remaining: 0
RateLimit-Reset:     1746684000
Retry-After:         34
```

---

### 1.8 Role Summary

| Role | Who | Access level |
|------|-----|-------------|
| **Public** | Unauthenticated visitors | Course catalog (published only), registration, password reset |
| **student** | Registered + approved students | Own profile, course catalog, own enrollments, learning content, own progress, own notifications |
| **admin** | Staff created directly by Super Admin | All course management, registration/enrollment queue, student management, notifications |
| **admin** *(promoted from student)* | Students promoted via `POST /super-admin/users/:uid/make-admin` | **Dual-role** — all admin capabilities **plus** all student capabilities (enroll in courses, track own progress, etc.) |
| **super_admin** | Platform owner | Everything admins can do + admin account management, audit log |

> **Note:** `super_admin` inherits all `admin` permissions. Any endpoint marked `admin` is also accessible to `super_admin`.
>
> **Dual-role admins:** When a student is promoted to admin, their account carries both `student` and `admin` roles. They pass role guards for either role simultaneously — they can manage courses as an admin and enroll in courses as a student within the same session. Admins created directly via `POST /super-admin/admins` carry only the `admin` role.

---

## 2. Auth Endpoints

---

### 2.1 `POST /auth/register`

Register a new student account. The account is created in a `pending_approval` state and cannot log in until an Admin approves it.

**Authentication:** None (public)

#### Request Body

```json
{
  "firstName": "Viruli",
  "lastName":  "Weerasinghe",
  "email":     "viruli@example.com",
  "password":  "SecurePass@2026"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `firstName` | `string` | Yes | 1–100 characters |
| `lastName` | `string` | Yes | 1–100 characters |
| `email` | `string` | Yes | Valid email format; must be unique |
| `password` | `string` | Yes | Min 10 chars · uppercase · lowercase · number · special character |

#### Responses

**`201 Created`** — Registration submitted successfully
```json
{
  "message": "Registration submitted. Your account is pending approval."
}
```

**`400 Bad Request`** — Validation error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "password": ["Must include at least one uppercase letter"],
      "email":    ["Enter a valid email address"]
    }
  },
  "requestId": "..."
}
```

**`409 Conflict`** — Email already registered
```json
{
  "error": {
    "code": "EMAIL_EXISTS",
    "message": "Email address already registered."
  },
  "requestId": "..."
}
```

---

### 2.2 `POST /auth/logout`

Revoke all refresh tokens for the authenticated user. Existing ID tokens remain valid until their 1-hour expiry, but no new tokens can be issued from the revoked refresh token.

**Authentication:** Bearer token required
**Roles:** `student`, `admin`, `super_admin`

#### Request Body

None.

#### Responses

**`204 No Content`** — Logged out successfully (empty body)

**`401 Unauthorized`** — Invalid or missing token
```json
{
  "error": { "code": "MISSING_TOKEN", "message": "Authorization header required." },
  "requestId": "..."
}
```

---

### 2.3 `POST /auth/password-reset`

Send a 6-digit OTP to the given email address. The OTP is valid for **15 minutes** and can be verified via `POST /auth/password-reset/verify`. Always returns `204` regardless of whether the email exists (prevents enumeration).

**Authentication:** None (public)

#### Request Body

```json
{
  "email": "viruli@example.com"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `email` | `string` | Yes | Valid email format |

#### Responses

**`204 No Content`** — OTP dispatched if account exists (always 204, to prevent email enumeration)

---

### 2.4 `POST /auth/password-reset/verify`

Verify the 6-digit OTP sent by `POST /auth/password-reset`. On success the server deletes the OTP record and dispatches a Firebase password-reset email to the user; the user follows the link in that email to set their new password.

**Authentication:** None (public)

#### Request Body

```json
{
  "email": "viruli@example.com",
  "otp":   "482910"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `email` | `string` | Yes | Valid email format |
| `otp` | `string` | Yes | Exactly 6 digits |

#### Responses

**`204 No Content`** — OTP verified; Firebase password-reset email dispatched (empty body)

**`400 Bad Request`** — OTP not found or invalid
```json
{
  "error": {
    "code": "INVALID_OTP",
    "message": "Invalid or expired verification code."
  },
  "requestId": "..."
}
```

**`400 Bad Request`** — OTP has expired
```json
{
  "error": {
    "code": "OTP_EXPIRED",
    "message": "Verification code has expired. Please request a new one."
  },
  "requestId": "..."
}
```

**`400 Bad Request`** — Too many incorrect attempts
```json
{
  "error": {
    "code": "OTP_MAX_ATTEMPTS",
    "message": "Too many incorrect attempts. Please request a new code."
  },
  "requestId": "..."
}
```

---

### 2.5 `POST /auth/track-failure`

Record a failed login attempt for a given email. Called by the client after each failed sign-in. After **10 failures within a 15-minute window**, the account is automatically locked (Firebase Auth `disabled: true`).

**Authentication:** None (public — called before the user has a token)

#### Request Body

```json
{
  "email": "viruli@example.com"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `email` | `string` | Yes | Valid email format |

#### Responses

**`200 OK`**
```json
{
  "locked":   false,
  "attempts": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `locked` | `boolean` | `true` when attempt count hit the lockout threshold (≥ 10) |
| `attempts` | `number` | Total failed attempts in the current 15-minute window |

---

## 3. Profile Endpoints (Me)

---

### 3.1 `GET /me`

Get the authenticated user's full profile.

**Authentication:** Bearer token required
**Roles:** `student`, `admin`, `super_admin`

#### Responses

**`200 OK`**
```json
{
  "uid":             "firebase-uid-abc123",
  "email":           "viruli@example.com",
  "firstName":       "Viruli",
  "lastName":        "Weerasinghe",
  "role":            "student",
  "roles":           ["student"],
  "status":          "approved",
  "profilePhotoUrl": "https://storage.googleapis.com/bucket/photos/abc.jpg",
  "createdAt":       "2026-05-01T08:00:00.000Z",
  "updatedAt":       "2026-05-05T10:30:00.000Z",
  "deletedAt":       null
}
```

See [User object](#user) in Data Models.

---

### 3.2 `PATCH /me`

Update the authenticated user's own profile. Only the fields listed below may be changed; `email`, `role`, and `status` are immutable through this endpoint.

**Authentication:** Bearer token required
**Roles:** `student`, `admin`, `super_admin`

#### Request Body

```json
{
  "firstName":       "Viruli",
  "lastName":        "Weerasinghe",
  "profilePhotoUrl": "https://storage.googleapis.com/bucket/photos/new.jpg"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `firstName` | `string` | No | 1–100 characters |
| `lastName` | `string` | No | 1–100 characters |
| `profilePhotoUrl` | `string or null` | No | Valid URL, or `null` to remove |

> Send only the fields you want to change (partial update).

#### Responses

**`200 OK`** — Updated user object (same shape as `GET /me`)

**`400 Bad Request`** — Validation error

---

### 3.3 `POST /me/change-password`

Initiate a server-side password change for the authenticated user. The current password is verified via the Firebase Identity Toolkit before the new password is applied.

**Authentication:** Bearer token required
**Roles:** `student`, `admin`, `super_admin`

#### Request Body

```json
{
  "currentPassword": "OldSecurePass@2026",
  "newPassword":     "NewSecurePass@2026"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `currentPassword` | `string` | Yes | Current password (verified server-side via Firebase Identity Toolkit) |
| `newPassword` | `string` | Yes | Min 10 chars · uppercase · lowercase · number · special character |

#### Responses

**`204 No Content`** — Password updated successfully (empty body)

---

### 3.4 `POST /me/avatar`

Upload or replace the authenticated user's profile photo. The file replaces any previously uploaded photo at the same storage path.

**Authentication:** Bearer token required
**Roles:** `student`, `admin`, `super_admin`
**Content-Type:** `multipart/form-data`

#### Request

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `photo` | `file` | Yes | `image/jpeg` or `image/png` only · max **2 MB** |

```
POST /me/avatar
Content-Type: multipart/form-data; boundary=----FormBoundary

------FormBoundary
Content-Disposition: form-data; name="photo"; filename="avatar.png"
Content-Type: image/png

<binary file data>
------FormBoundary--
```

#### Responses

**`200 OK`** — Updated user object with the new `profilePhotoUrl` (same shape as `GET /me`)

**`400 Bad Request`** — No file provided
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "No photo provided." }, "requestId": "..." }
```

**`413 Payload Too Large`** — File exceeds 2 MB
```json
{ "error": { "code": "FILE_TOO_LARGE", "message": "Profile photo must be under 2 MB." }, "requestId": "..." }
```

**`415 Unsupported Media Type`** — File is not JPEG or PNG
```json
{ "error": { "code": "UNSUPPORTED_MEDIA_TYPE", "message": "Only JPEG and PNG images are allowed." }, "requestId": "..." }
```

---

## 4. Course Endpoints

---

### 4.1 `GET /courses`

List courses. Returns only `published` courses for unauthenticated requests and `student` role. Returns all states (`draft`, `published`, `archived`) for `admin` and `super_admin`.

**Authentication:** Optional (`tryAuthenticate` — token accepted but not required)
**Roles:** All (response filtered by role)

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|:-------:|-------------|
| `limit` | `number` | `20` | Items per page (max 100) |
| `cursor` | `string` | — | Pagination cursor |
| `state` | `string` | — | Filter by state: `draft`, `published`, `archived` — **admin/super_admin only**; ignored for public/student requests |
| `title` | `string` | — | Prefix search on course title (case-sensitive, max 200 chars). When present, results are ordered alphabetically by `title` instead of `createdAt`. |

#### Responses

**`200 OK`**
```json
{
  "items": [
    {
      "id":            "course-abc",
      "title":         "Introduction to TypeScript",
      "description":   "Learn TypeScript from scratch.",
      "coverImageUrl": null,
      "state":         "published",
      "semesterCount": 3,
      "createdBy":     "admin-uid-xyz",
      "publishedAt":   "2026-05-03T09:00:00.000Z",
      "deletedAt":     null,
      "createdAt":     "2026-05-01T08:00:00.000Z",
      "updatedAt":     "2026-05-03T09:00:00.000Z"
    }
  ],
  "nextCursor": null,
  "total": 1
}
```

Each item in `items` is a [Course](#course) object.

---

### 4.2 `GET /courses/:id`

Get a single course by ID, including the full semester and subject tree (active records only, ordered by `order` ascending).

- **Students & public:** Returns `404` if the course is in `draft` or `archived` state
- **Admins:** Returns the course in any state (draft, published, or archived)

**Authentication:** Optional (`tryAuthenticate` — token accepted but not required)
**Roles:** All (visibility filtered by role)

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Course document ID |

#### Responses

**`200 OK`**
```json
{
  "id":            "course-abc",
  "title":         "Introduction to TypeScript",
  "description":   "Learn TypeScript from scratch.",
  "coverImageUrl": null,
  "state":         "published",
  "semesterCount": 2,
  "createdBy":     "admin-uid-xyz",
  "publishedAt":   "2026-05-03T09:00:00.000Z",
  "deletedAt":     null,
  "createdAt":     "2026-05-01T08:00:00.000Z",
  "updatedAt":     "2026-05-03T09:00:00.000Z",
  "semesters": [
    {
      "id":           "sem-001",
      "title":        "Semester 1 — Foundations",
      "subjectCount": 2,
      "order":        1,
      "createdAt":    "2026-05-01T08:30:00.000Z",
      "updatedAt":    "2026-05-01T08:30:00.000Z",
      "subjects": [
        {
          "id":        "sub-001",
          "title":     "TypeScript Basics",
          "order":     1,
          "createdAt": "2026-05-01T09:00:00.000Z",
          "updatedAt": "2026-05-01T09:00:00.000Z"
        }
      ]
    }
  ]
}
```

> The `semesters` array is **always present** — returns `[]` when the course has no non-deleted semesters. The array contains only non-deleted semesters, sorted by `order` ascending. Each `subjects` array contains only non-deleted subjects within that semester, also sorted by `order` ascending. Soft-deleted semesters and subjects are excluded. The semester object does **not** include `courseId` or `deletedAt`. The subject objects within `semesters[].subjects` include only `id`, `title`, `order`, `createdAt`, and `updatedAt` — they do **not** include `semesterId`, `courseId`, or `deletedAt`.

**`404 Not Found`**
```json
{
  "error": { "code": "COURSE_NOT_FOUND", "message": "Course not found." },
  "requestId": "..."
}
```

---

### 4.3 `POST /courses`

Create a new course in `draft` state. The `title` must be unique across all courses (including soft-deleted ones).

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Request Body

```json
{
  "title":         "Introduction to TypeScript",
  "description":   "Learn TypeScript from scratch.",
  "coverImageUrl": null
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `title` | `string` | Yes | 1–200 characters; must be unique across all courses (including soft-deleted) |
| `description` | `string` | No | Max 500 characters (defaults to `""`) |
| `coverImageUrl` | `string or null` | No | Valid URL or `null` (defaults to `null`) |

#### Responses

**`201 Created`** — Full Course object
```json
{
  "id":            "course-abc",
  "title":         "Introduction to TypeScript",
  "description":   "Learn TypeScript from scratch.",
  "coverImageUrl": null,
  "state":         "draft",
  "semesterCount": 0,
  "createdBy":     "admin-uid-xyz",
  "publishedAt":   null,
  "deletedAt":     null,
  "createdAt":     "2026-05-01T08:00:00.000Z",
  "updatedAt":     "2026-05-01T08:00:00.000Z"
}
```

> `POST /courses` returns a plain Course object. It does **not** include a `semesters` array (no semesters exist yet). Use `GET /courses/:id` to retrieve the full course-with-semesters tree.

**`409 Conflict`**
```json
{
  "error": { "code": "COURSE_TITLE_EXISTS", "message": "A course with this title already exists." },
  "requestId": "..."
}
```

---

### 4.4 `PATCH /courses/:id`

Update course metadata. Only `title` may be updated.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Course document ID |

#### Request Body

```json
{
  "title":         "Introduction to TypeScript — Updated",
  "description":   "Updated description.",
  "coverImageUrl": "https://example.com/cover.jpg"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `title` | `string` | No | 1–200 characters; must be unique across all courses |
| `description` | `string` | No | Max 500 characters |
| `coverImageUrl` | `string or null` | No | Valid URL or `null` to clear |

> Send only the fields to change (partial update).

#### Responses

**`200 OK`** — Updated Course object (same shape as `POST /courses` response — plain Course, no `semesters` array)

**`404 Not Found`** — Course does not exist

**`409 Conflict`** — Title already in use by another course

---

### 4.5 `POST /courses/:id/publish`

Publish a `draft` course, making it visible in the public catalog.

**Pre-conditions (server-enforced):**
- Course must have at least **1 semester**
- Every semester must have at least **1 subject**

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Course document ID |

#### Request Body

None.

#### Responses

**`200 OK`** — Updated Course object with `state: "published"` (plain Course object, no `semesters` array)

**`409 Conflict`** — Course is not in `draft` state
```json
{
  "error": { "code": "INVALID_STATE", "message": "Course must be in DRAFT state to publish." },
  "requestId": "..."
}
```

**`422 Unprocessable Entity`** — No semesters on the course
```json
{
  "error": {
    "code":    "NO_SEMESTERS",
    "message": "Course must have at least one semester before publishing."
  },
  "requestId": "..."
}
```

**`422 Unprocessable Entity`** — A semester has no subjects
```json
{
  "error": {
    "code":    "EMPTY_SEMESTER",
    "message": "Semester \"<title>\" has no subjects."
  },
  "requestId": "..."
}
```

---

### 4.6 `POST /courses/:id/unpublish`

Return a `published` course to `draft` state, hiding it from the public catalog.

> Enrolled students retain their approved enrollments. Access to learning content is suspended until the course is re-published.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Responses

**`200 OK`** — Updated Course object with `state: "draft"` (plain Course object, no `semesters` array)

**`409 Conflict`** — Course is not in `published` state
```json
{
  "error": { "code": "INVALID_STATE", "message": "Only a PUBLISHED course can be unpublished." },
  "requestId": "..."
}
```

---

### 4.7 `POST /courses/:id/archive`

Archive a `published` course. Archived courses are hidden from the public catalog but enrolled students retain read-only access to content.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Responses

**`200 OK`** — Updated Course object with `state: "archived"` (plain Course object, no `semesters` array)

**`409 Conflict`** — Course is not in `published` state
```json
{
  "error": { "code": "INVALID_STATE", "message": "Only a PUBLISHED course can be archived." },
  "requestId": "..."
}
```

---

### 4.8 `DELETE /courses/:id`

Soft-delete a course. Sets `deletedAt` timestamp; the document is recoverable for **30 days**.

> Courses with existing approved enrollments and progress data are soft-deleted, not hard-deleted.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Responses

**`204 No Content`** — Deleted successfully (empty body)

**`404 Not Found`** — Course does not exist

---

### 4.9 `POST /courses/:id/restore`

Restore an `archived` course back to `draft` state. The course must be reviewed and re-published by an admin before it becomes visible to students again.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Course document ID |

#### Responses

**`200 OK`** — Updated Course object with `state: "draft"` (plain Course object, no `semesters` array)

**`404 Not Found`** — Course does not exist

**`409 Conflict`** — Course is not in `archived` state
```json
{
  "error": { "code": "INVALID_STATE", "message": "Only an ARCHIVED course can be restored." },
  "requestId": "..."
}
```

> After restoring, the course is in `draft` and its full semester/subject tree is intact. Use `POST /courses/:id/publish` when ready to make it public again.

---

## 5. Semester Endpoints

---

### 5.1 `POST /courses/:id/semesters`

Add a new semester to a course. The `order` is auto-assigned as the next sequential position (existing semester count + 1).

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Course document ID |

#### Request Body

```json
{
  "title": "Semester 1 — Foundations"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `title` | `string` | Yes | 1–200 characters |

#### Responses

**`201 Created`**
```json
{
  "id":           "sem-001",
  "courseId":     "course-abc",
  "title":        "Semester 1 — Foundations",
  "subjectCount": 0,
  "order":        1,
  "deletedAt":    null,
  "createdAt":    "2026-05-01T08:00:00.000Z",
  "updatedAt":    "2026-05-01T08:00:00.000Z"
}
```

**`404 Not Found`** — Course does not exist

---

### 5.2 `PATCH /semesters/:id`

Update a semester's title.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Semester document ID |

#### Request Body

```json
{
  "title": "Semester 1 — Core Foundations"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `title` | `string` | No | 1–200 characters |

#### Responses

**`200 OK`** — Updated Semester object (same shape as `POST /courses/:id/semesters` response)

**`404 Not Found`** — Semester does not exist

---

### 5.3 `DELETE /semesters/:id`

Soft-delete a semester and all its subjects.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Responses

**`204 No Content`**

**`404 Not Found`** — Semester does not exist

---

## 6. Subject Endpoints

---

### 6.1 `POST /semesters/:id/subjects`

Add a subject to a semester. The `order` is auto-assigned as the next sequential position within the semester.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Semester document ID |

#### Request Body

```json
{
  "title": "TypeScript Basics"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `title` | `string` | Yes | 1–200 characters |

#### Responses

**`201 Created`**
```json
{
  "id":         "sub-001",
  "semesterId": "sem-001",
  "courseId":   "course-abc",
  "title":      "TypeScript Basics",
  "order":      1,
  "deletedAt":  null,
  "createdAt":  "2026-05-01T09:00:00.000Z",
  "updatedAt":  "2026-05-01T09:00:00.000Z"
}
```

**`404 Not Found`** — Semester does not exist

---

### 6.2 `PATCH /subjects/:id`

Update a subject's title.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Subject document ID |

#### Request Body

```json
{
  "title": "TypeScript Basics — Revised"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `title` | `string` | No | 1–200 characters |

#### Responses

**`200 OK`** — Updated Subject object (same shape as `POST /semesters/:id/subjects` response)

**`404 Not Found`** — Subject does not exist

---

### 6.3 `DELETE /subjects/:id`

Soft-delete a subject.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Responses

**`204 No Content`**

**`404 Not Found`** — Subject does not exist

---

### 6.4 `GET /subjects/:id/lessons`

List all lessons for a subject. Returns a plain array (not paginated), ordered by `order` ascending.

**Authentication:** Bearer token required
**Roles:** `student`, `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Subject document ID |

#### Responses

**`200 OK`** — Plain array of Lesson objects
```json
[
  {
    "id":             "lesson-001",
    "subjectId":      "sub-001",
    "courseId":       "course-abc",
    "semesterId":     "sem-001",
    "title":          "Introduction to TypeScript",
    "description":    "Overview of TypeScript features.",
    "youtubeVideoId": "dQw4w9WgXcQ",
    "attachmentIds":  ["att-001"],
    "order":          1,
    "deletedAt":      null,
    "createdAt":      "2026-05-12T09:00:00.000Z",
    "updatedAt":      "2026-05-12T09:00:00.000Z"
  }
]
```

---

### 6.5 `POST /subjects/:id/lessons`

Add a new lesson to a subject. The `order` is auto-assigned sequentially within the subject.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Subject document ID |

#### Request Body

```json
{
  "title":          "Introduction to TypeScript",
  "description":    "Overview of TypeScript features.",
  "youtubeVideoId": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "attachmentIds":  []
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| `title` | `string` | Yes | 1–200 characters |
| `description` | `string` | No | Max 2000 characters (defaults to `""`) |
| `youtubeVideoId` | `string or null` | No | Must be a valid YouTube URL — `https://www.youtube.com/watch?v=...`, `https://youtu.be/...`, or `https://www.youtube.com/embed/...`. The video ID is extracted and stored; bare IDs are rejected. Pass `null` to clear (defaults to `null`). |
| `attachmentIds` | `string[]` | No | Array of existing Attachment document IDs (defaults to `[]`) |

#### Responses

**`201 Created`**
```json
{
  "id":             "lesson-001",
  "subjectId":      "sub-001",
  "courseId":       "course-abc",
  "semesterId":     "sem-001",
  "title":          "Introduction to TypeScript",
  "description":    "Overview of TypeScript features.",
  "youtubeVideoId": "dQw4w9WgXcQ",
  "attachmentIds":  [],
  "order":          1,
  "deletedAt":      null,
  "createdAt":      "2026-05-12T09:00:00.000Z",
  "updatedAt":      "2026-05-12T09:00:00.000Z"
}
```

**`404 Not Found`** — Subject does not exist or is deleted

---

### 6.6 `PATCH /lessons/:id`

Update a lesson's fields. Only provided fields are changed.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Lesson document ID |

#### Request Body

```json
{
  "title":          "Introduction to TypeScript — Revised",
  "description":    "Updated lesson description.",
  "youtubeVideoId": "https://youtu.be/newVideoIdHere",
  "attachmentIds":  ["att-001", "att-002"]
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| `title` | `string` | No | 1–200 characters |
| `description` | `string` | No | 1–2000 characters |
| `youtubeVideoId` | `string or null` | No | Must be a valid YouTube URL (same formats as POST). Pass `null` to remove the video. |
| `attachmentIds` | `string[]` | No | Array of Attachment document IDs |

#### Responses

**`200 OK`** — Updated Lesson object (same shape as `POST /subjects/:id/lessons` response)

**`404 Not Found`** — Lesson does not exist or is deleted

---

### 6.7 `DELETE /lessons/:id`

Soft-delete a lesson.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Responses

**`204 No Content`**

**`404 Not Found`** — Lesson does not exist or is deleted

---

## 7. Attachment Endpoints

---

### 7.1 `POST /subjects/:id/attachments`

Upload a file attachment to a subject. Accepted file types: **PDF**, **DOC**, **DOCX**. Maximum file size: **25 MB**.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`
**Content-Type:** `multipart/form-data`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Subject document ID |

#### Request (multipart/form-data)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `file` | `File` | Yes | PDF, DOC, or DOCX file; max 25 MB |

#### Example cURL

```bash
curl -X POST https://api.yourdomain.com/api/v1/subjects/sub-001/attachments \
  -H "Authorization: Bearer <token>" \
  -F "file=@lesson-notes.pdf"
```

#### Responses

**`201 Created`**
```json
{
  "id":          "att-001",
  "subjectId":   "sub-001",
  "courseId":    "course-abc",
  "filename":    "lesson-notes.pdf",
  "mimeType":    "application/pdf",
  "sizeBytes":   204800,
  "storagePath": "attachments/sub-001/att-001.pdf",
  "createdAt":   "2026-05-02T10:00:00.000Z"
}
```

**`415 Unsupported Media Type`**
```json
{
  "error": {
    "code":    "UNSUPPORTED_MEDIA_TYPE",
    "message": "File type 'image/png' is not allowed. Accepted: PDF, DOC, DOCX."
  },
  "requestId": "..."
}
```

**`400 Bad Request`** — File exceeds 25 MB
```json
{
  "error": {
    "code":    "FILE_TOO_LARGE",
    "message": "File size exceeds the 25 MB limit."
  },
  "requestId": "..."
}
```

**`404 Not Found`** — Subject does not exist
```json
{
  "error": {
    "code":    "SUBJECT_NOT_FOUND",
    "message": "Subject not found."
  },
  "requestId": "..."
}
```

---

### 7.2 `GET /attachments/:id/download-url`

Get a short-lived signed download URL for a specific attachment. The URL expires in **15 minutes**.

> Students must have an **approved** enrollment in the course that contains this attachment. Admins may download without enrollment.

**Authentication:** Bearer token required
**Roles:** `student` (approved enrollment required), `admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Attachment document ID |

#### Responses

**`200 OK`**
```json
{
  "downloadUrl": "https://storage.googleapis.com/bucket/attachments/att-001.pdf?X-Goog-Signature=...",
  "expiresAt":   "2026-05-07T10:15:00.000Z"
}
```

**`403 Forbidden`** — Student is not enrolled in the course
```json
{
  "error": { "code": "FORBIDDEN", "message": "You must be enrolled in this course to download attachments." },
  "requestId": "..."
}
```

**`404 Not Found`** — Attachment does not exist
```json
{
  "error": { "code": "ATTACHMENT_NOT_FOUND", "message": "Attachment not found." },
  "requestId": "..."
}
```

---

### 7.3 `DELETE /attachments/:id`

Remove an attachment from Cloud Storage and from the subject's attachment list.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Responses

**`204 No Content`**

**`404 Not Found`** — Attachment does not exist

---

## 8. Enrollment Endpoints — Student

---

### 8.1 `POST /courses/:id/enroll`

Submit an enrollment request for a published course. The request enters a `pending` state until an Admin approves or rejects it.

**Constraints:**
- A student may only have **1 pending or approved** enrollment per course at a time
- The course must be in `published` state
- Student account must be in `approved` status

**Authentication:** Bearer token required
**Roles:** `student`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Course document ID |

#### Request Body

None.

#### Responses

**`201 Created`**
```json
{
  "id":          "firebase-uid-abc123_course-abc",
  "studentUid":  "firebase-uid-abc123",
  "courseId":    "course-abc",
  "state":       "pending",
  "reason":      null,
  "rejectedAt":  null,
  "approvedAt":  null,
  "withdrawnAt": null,
  "createdAt":   "2026-05-05T08:00:00.000Z",
  "updatedAt":   "2026-05-05T08:00:00.000Z"
}
```

**`409 Conflict`** — Already enrolled (pending)
```json
{
  "error": {
    "code":    "ENROLLMENT_PENDING",
    "message": "You already have a pending enrollment for this course."
  },
  "requestId": "..."
}
```

**`409 Conflict`** — Already enrolled (approved)
```json
{
  "error": {
    "code":    "ALREADY_ENROLLED",
    "message": "You are already enrolled in this course."
  },
  "requestId": "..."
}
```

**`404 Not Found`** — Course is not published or does not exist
```json
{
  "error": {
    "code":    "COURSE_NOT_FOUND",
    "message": "Course not found or not published."
  },
  "requestId": "..."
}
```

**`422 Unprocessable Entity`** — Resubmitting before the cool-off period expires (after rejection)
```json
{
  "error": {
    "code":    "COOLOFF_ACTIVE",
    "message": "You cannot re-enroll within the rejection cooloff period."
  },
  "requestId": "..."
}
```

---

### 8.2 `GET /me/enrollments`

List the authenticated student's enrollments.

**Authentication:** Bearer token required
**Roles:** `student`

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|:-------:|-------------|
| `limit` | `number` | `20` | Items per page (max 100) |
| `cursor` | `string` | — | Pagination cursor |

#### Responses

**`200 OK`**
```json
{
  "items": [
    {
      "id":          "firebase-uid-abc123_course-abc",
      "studentUid":  "firebase-uid-abc123",
      "courseId":    "course-abc",
      "state":       "approved",
      "reason":      null,
      "rejectedAt":  null,
      "approvedAt":  "2026-05-06T09:00:00.000Z",
      "withdrawnAt": null,
      "createdAt":   "2026-05-05T08:00:00.000Z",
      "updatedAt":   "2026-05-06T09:00:00.000Z"
    }
  ],
  "nextCursor": null,
  "total": 1
}
```

---

### 8.3 `POST /enrollments/:id/withdraw`

Withdraw a `pending` or `approved` enrollment request.

> Both `pending` and `approved` enrollments may be withdrawn by the student.

**Authentication:** Bearer token required
**Roles:** `student`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Enrollment document ID |

#### Request Body

None.

#### Responses

**`200 OK`** — Updated Enrollment object with `state: "withdrawn"`

**`403 Forbidden`** — Student does not own this enrollment
```json
{
  "error": {
    "code":    "FORBIDDEN",
    "message": "You do not own this enrollment."
  },
  "requestId": "..."
}
```

**`404 Not Found`** — Enrollment not found
```json
{
  "error": {
    "code":    "ENROLLMENT_NOT_FOUND",
    "message": "Enrollment not found."
  },
  "requestId": "..."
}
```

**`409 Conflict`** — Enrollment is not in a withdrawable state (`pending` or `approved`)
```json
{
  "error": {
    "code":    "INVALID_STATE",
    "message": "Enrollment cannot be withdrawn in its current state."
  },
  "requestId": "..."
}
```

---

## 9. Registration Queue — Admin

---

### 9.1 `GET /admin/registrations`

List student registration requests.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|:-------:|-------------|
| `status` | `string` | — | Filter by state: `pending`, `approved`, `rejected`, `withdrawn` (omit to return all) |
| `limit` | `number` | `20` | Items per page (max 100) |
| `cursor` | `string` | — | Pagination cursor |

#### Responses

**`200 OK`**
```json
{
  "items": [
    {
      "id":         "firebase-uid-abc123",
      "studentUid": "firebase-uid-abc123",
      "email":      "viruli@example.com",
      "firstName":  "Viruli",
      "lastName":   "Weerasinghe",
      "state":      "pending",
      "reason":     null,
      "createdAt":  "2026-05-05T08:00:00.000Z",
      "updatedAt":  "2026-05-05T08:00:00.000Z"
    }
  ],
  "nextCursor": null,
  "total": 12
}
```

---

### 9.2 `POST /admin/registrations/:id/approve`

Approve a pending student registration. The student's account status is set to `approved` and they can now log in.

**Side effects:** An email and in-app notification are sent to the student.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Registration document ID (Firebase Auth UID) |

#### Request Body

None.

#### Responses

**`200 OK`** — Full updated Registration object
```json
{
  "id":         "firebase-uid-abc123",
  "studentUid": "firebase-uid-abc123",
  "email":      "viruli@example.com",
  "firstName":  "Viruli",
  "lastName":   "Weerasinghe",
  "state":      "approved",
  "reason":     null,
  "createdAt":  "2026-05-05T08:00:00.000Z",
  "updatedAt":  "2026-05-06T09:00:00.000Z"
}
```

**`404 Not Found`** — Registration not found
```json
{
  "error": { "code": "ENROLLMENT_NOT_FOUND", "message": "Registration not found." },
  "requestId": "..."
}
```

**`409 Conflict`** — Registration is no longer in `pending` state
```json
{
  "error": { "code": "INVALID_STATE", "message": "Registration is not in PENDING state." },
  "requestId": "..."
}
```

---

### 9.3 `POST /admin/registrations/:id/reject`

Reject a pending student registration. An optional reason may be provided.

**Side effects:** An email and in-app notification are sent to the student.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Registration document ID (Firebase Auth UID) |

#### Request Body

```json
{
  "reason": "Incomplete registration information."
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `reason` | `string` | No | Max 500 characters |

#### Responses

**`200 OK`** — Full updated Registration object
```json
{
  "id":         "firebase-uid-abc123",
  "studentUid": "firebase-uid-abc123",
  "email":      "viruli@example.com",
  "firstName":  "Viruli",
  "lastName":   "Weerasinghe",
  "state":      "rejected",
  "reason":     "Incomplete registration information.",
  "createdAt":  "2026-05-05T08:00:00.000Z",
  "updatedAt":  "2026-05-06T09:00:00.000Z"
}
```

**`409 Conflict`** — Registration is no longer in `pending` state
```json
{
  "error": { "code": "INVALID_STATE", "message": "Registration is not in PENDING state." },
  "requestId": "..."
}
```

---

### 9.4 `POST /admin/registrations/bulk-approve`

Approve multiple pending registrations in one request. Uses `Promise.allSettled` — partial success is possible.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Request Body

```json
{
  "ids": ["firebase-uid-001", "firebase-uid-002", "firebase-uid-003"]
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `ids` | `string[]` | Yes | 1–100 registration IDs per request |

#### Responses

**`200 OK`**
```json
{
  "approved": ["firebase-uid-001", "firebase-uid-003"],
  "failed": [
    {
      "id":     "firebase-uid-002",
      "reason": "Registration is not in PENDING state."
    }
  ]
}
```

---

## 10. Enrollment Queue — Admin

---

### 10.1 `GET /admin/enrollments`

List course enrollment requests.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|:-------:|-------------|
| `status` | `string` | — | Filter by state: `pending`, `approved`, `rejected`, `withdrawn` |
| `courseId` | `string` | — | Filter by specific course |
| `limit` | `number` | `20` | Items per page (max 100) |
| `cursor` | `string` | — | Pagination cursor |

#### Responses

**`200 OK`**
```json
{
  "items": [
    {
      "id":          "firebase-uid-abc123_course-abc",
      "studentUid":  "firebase-uid-abc123",
      "courseId":    "course-abc",
      "state":       "pending",
      "reason":      null,
      "rejectedAt":  null,
      "approvedAt":  null,
      "withdrawnAt": null,
      "createdAt":   "2026-05-05T08:00:00.000Z",
      "updatedAt":   "2026-05-05T08:00:00.000Z"
    }
  ],
  "nextCursor": null,
  "total": 5
}
```

---

### 10.2 `POST /admin/enrollments/:id/approve`

Approve a pending enrollment request. The student gains access to course content.

**Side effects:** An in-app notification, email, and push notification (if opted-in) are sent to the student.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Enrollment document ID |

#### Request Body

None.

#### Responses

**`200 OK`** — Full updated Enrollment object
```json
{
  "id":          "firebase-uid-abc123_course-abc",
  "studentUid":  "firebase-uid-abc123",
  "courseId":    "course-abc",
  "state":       "approved",
  "reason":      null,
  "rejectedAt":  null,
  "approvedAt":  "2026-05-06T09:00:00.000Z",
  "withdrawnAt": null,
  "createdAt":   "2026-05-05T08:00:00.000Z",
  "updatedAt":   "2026-05-06T09:00:00.000Z"
}
```

**`409 Conflict`** — Enrollment is not in `pending` state
```json
{
  "error": { "code": "INVALID_STATE", "message": "Enrollment is not in PENDING state." },
  "requestId": "..."
}
```

---

### 10.3 `POST /admin/enrollments/:id/reject`

Reject a pending enrollment request.

**Side effects:** An in-app notification and email are sent to the student with the optional reason.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Enrollment document ID |

#### Request Body

```json
{
  "reason": "This course is currently at full capacity."
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `reason` | `string` | No | Max 500 characters |

#### Responses

**`200 OK`** — Full updated Enrollment object
```json
{
  "id":          "firebase-uid-abc123_course-abc",
  "studentUid":  "firebase-uid-abc123",
  "courseId":    "course-abc",
  "state":       "rejected",
  "reason":      "This course is currently at full capacity.",
  "rejectedAt":  "2026-05-06T09:00:00.000Z",
  "approvedAt":  null,
  "withdrawnAt": null,
  "createdAt":   "2026-05-05T08:00:00.000Z",
  "updatedAt":   "2026-05-06T09:00:00.000Z"
}
```

**`409 Conflict`** — Enrollment is not in `pending` state
```json
{
  "error": { "code": "INVALID_STATE", "message": "Enrollment is not in PENDING state." },
  "requestId": "..."
}
```

---

## 11. Progress Endpoints

---

### 11.1 `POST /progress/subjects/:id/complete`

Mark a subject as completed. This operation is **idempotent** — if the subject is already marked complete, the existing record is returned unchanged and `completedAt` is NOT updated.

> This endpoint is called either manually by the student tapping "Mark Complete", or automatically when YouTube playback reaches a threshold.

**Authentication:** Bearer token required
**Roles:** `student`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Subject document ID |

#### Request Body

```json
{
  "courseId":   "course-abc",
  "semesterId": "sem-001"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `courseId` | `string` | Yes | Course the subject belongs to |
| `semesterId` | `string` | Yes | Semester the subject belongs to |

#### Responses

**`200 OK`**
```json
{
  "id":             "firebase-uid-abc123_sub-001",
  "studentUid":     "firebase-uid-abc123",
  "subjectId":      "sub-001",
  "courseId":       "course-abc",
  "semesterId":     "sem-001",
  "state":          "completed",
  "completedAt":    "2026-05-07T14:00:00.000Z",
  "lastAccessedAt": "2026-05-07T14:00:00.000Z"
}
```

---

### 11.2 `POST /progress/subjects/:id/access`

Update the last-accessed timestamp for a subject (used to power the "Continue Learning" resume feature). Transitions state from `not_started` to `in_progress` on first access.

**Authentication:** Bearer token required
**Roles:** `student`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Subject document ID |

#### Request Body

```json
{
  "courseId":   "course-abc",
  "semesterId": "sem-001"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `courseId` | `string` | Yes | Course the subject belongs to |
| `semesterId` | `string` | Yes | Semester the subject belongs to |

#### Responses

**`200 OK`**
```json
{
  "id":             "firebase-uid-abc123_sub-001",
  "studentUid":     "firebase-uid-abc123",
  "subjectId":      "sub-001",
  "courseId":       "course-abc",
  "semesterId":     "sem-001",
  "state":          "in_progress",
  "completedAt":    null,
  "lastAccessedAt": "2026-05-07T14:30:00.000Z"
}
```

---

### 11.3 `GET /me/progress/courses/:courseId`

Get the authenticated student's progress aggregate for a course.

**Authentication:** Bearer token required
**Roles:** `student`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `courseId` | Course document ID |

#### Responses

**`200 OK`**
```json
{
  "courseId":              "course-abc",
  "studentUid":            "firebase-uid-abc123",
  "completedCount":        4,
  "pendingCount":          6,
  "totalSubjects":         10,
  "completionPercent":     40.0,
  "lastAccessedSubjectId": "sub-004"
}
```

| Field | Description |
|-------|-------------|
| `completedCount` | Number of subjects completed by this student |
| `pendingCount` | `totalSubjects - completedCount` |
| `totalSubjects` | Total subjects in the course (fetched from course-service) |
| `completionPercent` | Rounded to 1 decimal place (e.g., `33.3`) |
| `lastAccessedSubjectId` | Subject the student should resume from; `null` if no subjects accessed |

---

### 11.4 `GET /me/progress/subjects/:subjectId`

Get progress for a specific subject.

**Authentication:** Bearer token required
**Roles:** `student`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `subjectId` | Subject document ID |

#### Responses

**`200 OK`**
```json
{
  "id":             "firebase-uid-abc123_sub-001",
  "studentUid":     "firebase-uid-abc123",
  "subjectId":      "sub-001",
  "courseId":       "course-abc",
  "semesterId":     "sem-001",
  "state":          "completed",
  "completedAt":    "2026-05-07T14:00:00.000Z",
  "lastAccessedAt": "2026-05-07T14:00:00.000Z"
}
```

**`404 Not Found`** — No progress record exists (student has not accessed this subject)
```json
{
  "error": { "code": "SUBJECT_NOT_FOUND", "message": "No progress record found for this subject." },
  "requestId": "..."
}
```

---

### 11.5 `GET /admin/progress/courses/:courseId`

Get raw subject progress records for all students in a course.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `courseId` | Course document ID |

#### Responses

**`200 OK`** — Plain array of SubjectProgress records for all students in the course
```json
[
  {
    "id":             "firebase-uid-abc123_sub-001",
    "studentUid":     "firebase-uid-abc123",
    "subjectId":      "sub-001",
    "courseId":       "course-abc",
    "semesterId":     "sem-001",
    "state":          "completed",
    "completedAt":    "2026-05-07T14:00:00.000Z",
    "lastAccessedAt": "2026-05-07T14:00:00.000Z"
  }
]
```

> Returns a flat array of SubjectProgress records (not paginated). Each record is one subject progress entry for one student.

---

## 12. Notification Endpoints

---

### 12.1 `GET /me/notifications`

List the authenticated user's in-app notifications, newest first.

**Authentication:** Bearer token required
**Roles:** `student`, `admin`, `super_admin`

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|:-------:|-------------|
| `read` | `'true'` \| `'false'` | — | Filter by read state: `read=false` returns only unread, `read=true` returns only read |
| `limit` | `number` | `20` | Items per page (max 100) |
| `cursor` | `string` | — | Pagination cursor |

#### Responses

**`200 OK`**
```json
{
  "items": [
    {
      "id":        "notif-001",
      "userUid":   "firebase-uid-abc123",
      "type":      "enrollment.approved",
      "title":     "Enrollment Approved",
      "body":      "Your enrollment has been approved.",
      "read":      false,
      "createdAt": "2026-05-06T09:05:00.000Z"
    }
  ],
  "nextCursor": null,
  "total": 3
}
```

---

### 12.2 `POST /me/notifications/:id/read`

Mark a single notification as read.

**Authentication:** Bearer token required
**Roles:** `student`, `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Notification document ID |

#### Request Body

None.

#### Responses

**`200 OK`**
```json
{
  "id":   "notif-001",
  "read": true
}
```

---

### 12.3 `POST /me/notifications/read-all`

Mark all of the authenticated user's notifications as read.

**Authentication:** Bearer token required
**Roles:** `student`, `admin`, `super_admin`

#### Request Body

None.

#### Responses

**`204 No Content`** — All notifications marked as read (empty body)

---

## 13. User Management — Admin

---

### 13.1 `GET /users`

List all users in the system.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|:-------:|-------------|
| `role` | `string` | — | Filter by role: `student`, `admin`, `super_admin` |
| `status` | `string` | — | Filter by status: `pending_approval`, `approved`, `rejected`, `suspended` |
| `limit` | `number` | `20` | Items per page (max 100) |
| `cursor` | `string` | — | Pagination cursor |

#### Responses

**`200 OK`**
```json
{
  "items": [
    {
      "uid":             "firebase-uid-abc123",
      "email":           "viruli@example.com",
      "firstName":       "Viruli",
      "lastName":        "Weerasinghe",
      "role":            "student",
      "roles":           ["student"],
      "status":          "approved",
      "profilePhotoUrl": null,
      "createdAt":       "2026-05-01T08:00:00.000Z",
      "updatedAt":       "2026-05-05T10:30:00.000Z",
      "deletedAt":       null
    }
  ],
  "nextCursor": null,
  "total": 47
}
```

---

### 13.2 `GET /users/:uid`

Get a specific user's full profile.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `uid` | Firebase Auth UID |

#### Responses

**`200 OK`** — Full User object (same shape as `GET /me`)
```json
{
  "uid":             "firebase-uid-abc123",
  "email":           "viruli@example.com",
  "firstName":       "Viruli",
  "lastName":        "Weerasinghe",
  "role":            "student",
  "roles":           ["student"],
  "status":          "approved",
  "profilePhotoUrl": null,
  "createdAt":       "2026-05-01T08:00:00.000Z",
  "updatedAt":       "2026-05-05T10:30:00.000Z",
  "deletedAt":       null
}
```

**`404 Not Found`**
```json
{
  "error": { "code": "USER_NOT_FOUND", "message": "User not found." },
  "requestId": "..."
}
```

---

### 13.3 `POST /users/:uid/suspend`

Suspend a user account. Disables Firebase Auth login for the user.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `uid` | Firebase Auth UID |

#### Request Body

None.

#### Responses

**`200 OK`** — Full updated User object with `status: "suspended"`

**`404 Not Found`**
```json
{
  "error": { "code": "USER_NOT_FOUND", "message": "User not found." },
  "requestId": "..."
}
```

---

### 13.4 `POST /users/:uid/reactivate`

Reactivate a suspended user account. Re-enables Firebase Auth login.

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `uid` | Firebase Auth UID |

#### Request Body

None.

#### Responses

**`200 OK`** — Full updated User object with `status: "approved"`

**`404 Not Found`**
```json
{
  "error": { "code": "USER_NOT_FOUND", "message": "User not found." },
  "requestId": "..."
}
```

---

### 13.5 `POST /users`

Create a new leader or g12 user account directly. Both a Firebase Auth account and a Firestore user record are created in one operation — the user can log in immediately with the provided `initialPassword`.

Use this when an admin needs to provision a cell leader or G12 leader account without requiring them to self-register and go through the role-request flow.

**Side effects:** An `admin.created` outbox event is published (triggers an audit log entry).

**Authentication:** Bearer token required
**Roles:** `admin`, `super_admin`

#### Request Body

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
| `firstName` | `string` | Yes | 1–50 characters |
| `lastName` | `string` | Yes | 1–50 characters |
| `email` | `string` | Yes | Valid email; must be unique |
| `initialPassword` | `string` | Yes | Min 8 characters |
| `role` | `string` | Yes | `"leader"` or `"g12"` only |

#### Responses

**`201 Created`** — Full User object for the new account
```json
{
  "uid":             "firebase-uid-abc123",
  "email":           "saman@tccr.lk",
  "firstName":       "Saman",
  "lastName":        "Silva",
  "role":            "leader",
  "roles":           ["member", "leader"],
  "status":          "approved",
  "profilePhotoUrl": null,
  "createdAt":       "2026-05-19T08:00:00.000Z",
  "updatedAt":       "2026-05-19T08:00:00.000Z",
  "deletedAt":       null
}
```

**`409 Conflict`** — Email already registered
```json
{
  "error": { "code": "EMAIL_EXISTS", "message": "Email address already registered." },
  "requestId": "..."
}
```

**`400 Bad Request`** — Validation failure (e.g. invalid role, missing field)
```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "..." },
  "requestId": "..."
}
```

---

## 14. Admin Management — Super Admin

---

### 14.1 `GET /super-admin/admins`

List all admin accounts.

**Authentication:** Bearer token required
**Roles:** `super_admin`

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|:-------:|-------------|
| `limit` | `number` | `20` | Items per page (max 100) |
| `cursor` | `string` | — | Pagination cursor |

#### Responses

**`200 OK`**
```json
{
  "items": [
    {
      "uid":             "admin-uid-xyz",
      "email":           "admin@cmp.com",
      "firstName":       "Sapna",
      "lastName":        "Nethmini",
      "role":            "admin",
      "roles":           ["admin"],
      "status":          "approved",
      "profilePhotoUrl": null,
      "createdAt":       "2026-04-01T08:00:00.000Z",
      "updatedAt":       "2026-04-01T08:00:00.000Z",
      "deletedAt":       null
    }
  ],
  "nextCursor": null,
  "total": 3
}
```

---

### 14.2 `POST /super-admin/admins`

Create a new admin account directly (no approval needed). The admin can log in immediately.

**Side effects:** An `admin.created` outbox event is published (triggers an audit log entry).

**Authentication:** Bearer token required
**Roles:** `super_admin`

#### Request Body

```json
{
  "firstName":       "Sapna",
  "lastName":        "Nethmini",
  "email":           "sapna@cmp.com",
  "initialPassword": "SecureAdmin@2026"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|-----------|
| `firstName` | `string` | Yes | 1–100 characters |
| `lastName` | `string` | Yes | 1–100 characters |
| `email` | `string` | Yes | Valid email; must be unique |
| `initialPassword` | `string` | Yes | Min 10 chars · uppercase · lowercase · number · special character |

#### Responses

**`201 Created`** — Full User object for the new admin
```json
{
  "uid":             "admin-uid-xyz",
  "email":           "sapna@cmp.com",
  "firstName":       "Sapna",
  "lastName":        "Nethmini",
  "role":            "admin",
  "roles":           ["admin"],
  "status":          "approved",
  "profilePhotoUrl": null,
  "createdAt":       "2026-05-01T08:00:00.000Z",
  "updatedAt":       "2026-05-01T08:00:00.000Z",
  "deletedAt":       null
}
```

**`409 Conflict`** — Email already registered
```json
{
  "error": { "code": "EMAIL_EXISTS", "message": "This email address is already registered." },
  "requestId": "..."
}
```

---

### 14.3 `GET /super-admin/admins/:uid`

Get a specific admin's full profile.

**Authentication:** Bearer token required
**Roles:** `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `uid` | Firebase Auth UID |

#### Responses

**`200 OK`** — Full User object (same shape as 14.2 response)

**`404 Not Found`**
```json
{
  "error": { "code": "USER_NOT_FOUND", "message": "User not found." },
  "requestId": "..."
}
```

---

### 14.4 `POST /super-admin/admins/:uid/suspend`

Suspend an admin account. Publishes an `admin.suspended` outbox event (triggers notification + audit).

**Authentication:** Bearer token required
**Roles:** `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `uid` | Firebase Auth UID |

#### Request Body

None.

#### Responses

**`200 OK`** — Full updated User object with `status: "suspended"`

**`404 Not Found`**
```json
{
  "error": { "code": "USER_NOT_FOUND", "message": "User not found." },
  "requestId": "..."
}
```

---

### 14.5 `POST /super-admin/admins/:uid/reactivate`

Reactivate a suspended admin account.

**Authentication:** Bearer token required
**Roles:** `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `uid` | Firebase Auth UID |

#### Request Body

None.

#### Responses

**`200 OK`** — Full updated User object with `status: "approved"`

**`404 Not Found`**
```json
{
  "error": { "code": "USER_NOT_FOUND", "message": "User not found." },
  "requestId": "..."
}
```

---

### 14.6 `DELETE /super-admin/admins/:uid`

Soft-delete an admin account. Sets `deletedAt` and disables Firebase Auth login.

> Only users with `role: "admin"` can be deleted via this endpoint. Attempting to delete a non-admin returns `404`.

**Authentication:** Bearer token required
**Roles:** `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `uid` | Firebase Auth UID |

#### Responses

**`204 No Content`** — Deleted successfully (empty body)

**`404 Not Found`** — User not found or is not an admin
```json
{
  "error": { "code": "USER_NOT_FOUND", "message": "User not found." },
  "requestId": "..."
}
```

---

### 14.7 `POST /super-admin/users/:uid/make-admin`

Promote an existing student to admin. The user retains their student role and gains admin capabilities simultaneously (dual-role).

**Side effects:** An `admin.created` outbox event is published with `promoted: true` in the payload.

**Authentication:** Bearer token required
**Roles:** `super_admin`

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `uid` | Firebase Auth UID of the student to promote |

#### Request Body

None.

#### Responses

**`200 OK`** — Full updated User object
```json
{
  "uid":             "firebase-uid-abc123",
  "email":           "viruli@example.com",
  "firstName":       "Viruli",
  "lastName":        "Weerasinghe",
  "role":            "admin",
  "roles":           ["student", "admin"],
  "status":          "approved",
  "profilePhotoUrl": null,
  "createdAt":       "2026-05-01T08:00:00.000Z",
  "updatedAt":       "2026-05-10T11:00:00.000Z",
  "deletedAt":       null
}
```

**`404 Not Found`** — User not found
```json
{
  "error": { "code": "USER_NOT_FOUND", "message": "User not found." },
  "requestId": "..."
}
```

**`409 Conflict`** — User is not a student
```json
{
  "error": { "code": "INVALID_ROLE", "message": "Only students can be promoted to admin." },
  "requestId": "..."
}
```

---

## 15. Audit Log — Super Admin

---

### 15.1 `GET /audit-log`

Query the append-only audit log. Entries are created automatically by the outbox-worker; no direct write API exists.

**Authentication:** Bearer token required
**Roles:** `super_admin`

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|:-------:|-------------|
| `actorUid` | `string` | — | Filter by the UID of the user who performed the action |
| `action` | `string` | — | Filter by action string (exact match) |
| `category` | `string` | — | Filter by category (exact match) |
| `targetType` | `string` | — | Filter by target entity type (exact match) |
| `targetId` | `string` | — | Filter by target entity ID (exact match) |
| `from` | `string` | — | ISO 8601 datetime — return entries at or after this timestamp |
| `to` | `string` | — | ISO 8601 datetime — return entries at or before this timestamp |
| `limit` | `number` | `20` | Items per page (max 100) |
| `cursor` | `string` | — | Document ID cursor for pagination |

#### Responses

**`200 OK`**
```json
{
  "items": [
    {
      "id":         "log-001",
      "when":       "2026-05-07T14:00:00.000Z",
      "actor":      { "uid": "admin-uid-xyz", "email": "admin@cmp.com" },
      "action":     "enrollment.approved",
      "category":   "enrollment",
      "ip":         "203.0.113.42",
      "targetType": "enrollment",
      "targetId":   "enr-abc",
      "requestId":  "7f3a1c2d-4e5b-6f7a-8b9c-0d1e2f3a4b5c"
    }
  ],
  "nextCursor": null,
  "total": 142
}
```

| Field | Description |
|-------|-------------|
| `when` | Timestamp the event was recorded (mapped from internal `createdAt`) |
| `actor` | The user who triggered the action; `uid` and `email` may be `null` for system events |
| `action` | String identifier (e.g. `enrollment.approved`, `user.registered`) |
| `category` | Logical grouping (e.g. `enrollment`, `auth`, `course`); may be `null` |
| `targetType` | The type of entity affected (e.g. `user`, `enrollment`, `course`); may be `null` |
| `targetId` | The ID of the affected entity; may be `null` |
| `requestId` | The `X-Request-Id` from the originating HTTP request |

> The raw `payload` field is stored internally but intentionally excluded from API responses.

---

## 16. Health Endpoints

Health endpoints are exposed by every service. The gateway does not proxy them — use direct service URLs in Kubernetes probes.

---

### 16.1 `GET /healthz`

Liveness probe. Returns `200` if the process is running.

**Authentication:** None (public)

#### Responses

**`200 OK`**
```json
{ "status": "ok" }
```

---

### 16.2 `GET /readyz`

Readiness probe. Returns `200` when the service is ready to accept traffic.

**Authentication:** None (public)

#### Responses

**`200 OK`**
```json
{ "status": "ok" }
```

---

## 17. Data Models

---

### User

| Field | Type | Notes |
|-------|------|-------|
| `uid` | `string` | Firebase Auth UID |
| `email` | `string` | |
| `firstName` | `string` | |
| `lastName` | `string` | |
| `role` | `string` | Primary role: `student`, `admin`, or `super_admin` |
| `roles` | `string[]` | All roles held (e.g. `["student","admin"]` for promoted users) |
| `status` | `string` | `pending_approval`, `approved`, `rejected`, or `suspended` |
| `profilePhotoUrl` | `string or null` | |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |
| `deletedAt` | `string or null` | Non-null means soft-deleted |

---

### Course

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Auto UUID |
| `title` | `string` | Unique across all courses (including soft-deleted) |
| `description` | `string` | Max 500 chars; defaults to `""` |
| `coverImageUrl` | `string or null` | Valid URL or `null`; defaults to `null` |
| `state` | `string` | `draft`, `published`, or `archived` |
| `semesterCount` | `number` | |
| `createdBy` | `string` | Admin UID |
| `publishedAt` | `string or null` | ISO 8601 |
| `deletedAt` | `string or null` | Non-null means soft-deleted |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

> The `Course` object returned by `POST /courses`, `PATCH /courses/:id`, `POST /courses/:id/publish`, `POST /courses/:id/unpublish`, and `POST /courses/:id/archive` does **not** include a `semesters` array. Only `GET /courses/:id` returns the full course-with-semesters tree.

---

### CourseDetail (GET /courses/:id response)

The `GET /courses/:id` response extends the Course object with an embedded semester and subject tree.

| Field | Type | Notes |
|-------|------|-------|
| *(all Course fields)* | | See [Course](#course) above |
| `semesters` | `SemesterView[]` | Active (non-deleted) semesters, sorted by `order` |

**SemesterView fields** (embedded in `semesters` array):

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | |
| `title` | `string` | |
| `subjectCount` | `number` | |
| `order` | `number` | |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |
| `subjects` | `SubjectView[]` | Active (non-deleted) subjects, sorted by `order` |

> `SemesterView` does **not** include `courseId` or `deletedAt`.

**SubjectView fields** (embedded in `semesters[].subjects` array):

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | |
| `title` | `string` | |
| `order` | `number` | |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

> `SubjectView` does **not** include `semesterId`, `courseId`, or `deletedAt`.

---

### Semester

Returned by `POST /courses/:id/semesters` and `PATCH /semesters/:id`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Auto UUID |
| `courseId` | `string` | |
| `title` | `string` | |
| `subjectCount` | `number` | |
| `order` | `number` | Display order within course |
| `deletedAt` | `string or null` | |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

---

### Subject

Returned by `POST /semesters/:id/subjects` and `PATCH /subjects/:id`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Auto UUID |
| `semesterId` | `string` | |
| `courseId` | `string` | |
| `title` | `string` | |
| `order` | `number` | Display order within semester |
| `deletedAt` | `string or null` | |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

---

### Lesson

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Auto UUID |
| `subjectId` | `string` | |
| `courseId` | `string` | |
| `semesterId` | `string` | |
| `title` | `string` | |
| `description` | `string` | Max 2000 chars; defaults to `""` |
| `youtubeVideoId` | `string or null` | Raw YouTube video ID string; no format validation; defaults to `null` |
| `attachmentIds` | `string[]` | IDs of associated Attachment documents; defaults to `[]` |
| `order` | `number` | Auto-assigned; sequential within subject |
| `deletedAt` | `string or null` | |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

---

### Attachment

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Auto UUID |
| `subjectId` | `string` | |
| `courseId` | `string` | |
| `filename` | `string` | Original file name |
| `mimeType` | `string` | e.g. `application/pdf` |
| `sizeBytes` | `number` | |
| `storagePath` | `string` | Internal Cloud Storage path |
| `createdAt` | `string` | ISO 8601 |

---

### Enrollment

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | `${studentUid}_${courseId}` |
| `studentUid` | `string` | |
| `courseId` | `string` | |
| `state` | `string` | `pending`, `approved`, `rejected`, or `withdrawn` |
| `reason` | `string or null` | Rejection reason |
| `approvedAt` | `string or null` | ISO 8601 |
| `rejectedAt` | `string or null` | ISO 8601 |
| `withdrawnAt` | `string or null` | ISO 8601 |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

---

### Registration

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Firebase Auth UID (same as `studentUid`) |
| `studentUid` | `string` | |
| `email` | `string` | |
| `firstName` | `string` | |
| `lastName` | `string` | |
| `state` | `string` | `pending`, `approved`, or `rejected` |
| `reason` | `string or null` | Rejection reason |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

---

### SubjectProgress

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | `${studentUid}_${subjectId}` |
| `studentUid` | `string` | |
| `subjectId` | `string` | |
| `courseId` | `string` | |
| `semesterId` | `string` | |
| `state` | `string` | `not_started`, `in_progress`, or `completed` |
| `completedAt` | `string or null` | ISO 8601; immutable once set |
| `lastAccessedAt` | `string or null` | ISO 8601 |

---

### CourseProgressResult (GET /me/progress/courses/:courseId response)

| Field | Type | Notes |
|-------|------|-------|
| `courseId` | `string` | |
| `studentUid` | `string` | |
| `completedCount` | `number` | Subjects completed by this student |
| `pendingCount` | `number` | `totalSubjects - completedCount` |
| `totalSubjects` | `number` | Fetched from course-service |
| `completionPercent` | `number` | Rounded to 1 decimal place |
| `lastAccessedSubjectId` | `string or null` | `null` if no subjects accessed |

---

### Notification

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Auto UUID |
| `userUid` | `string` | |
| `type` | `string` | e.g. `enrollment.approved`, `registration.approved` |
| `title` | `string` | |
| `body` | `string` | |
| `read` | `boolean` | `false` when unread |
| `createdAt` | `string` | ISO 8601 |

---

### AuditLogEntry (response shape)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Auto UUID |
| `when` | `string` | ISO 8601 (mapped from internal `createdAt`) |
| `actor` | `object` | `{ uid: string or null, email: string or null }` |
| `action` | `string` | |
| `category` | `string or null` | |
| `ip` | `string or null` | |
| `targetType` | `string or null` | |
| `targetId` | `string or null` | |
| `requestId` | `string` | |

> `payload` is stored internally but not included in API responses.

---

## 18. Error Codes Reference

| Code | Status | Description |
|------|:------:|-------------|
| `VALIDATION_ERROR` | 400 | Zod schema validation failed; `details` contains field-level errors |
| `INVALID_OTP` | 400 | OTP is invalid, incorrect, or not found |
| `OTP_EXPIRED` | 400 | OTP has passed its 15-minute expiry |
| `OTP_MAX_ATTEMPTS` | 400 | Too many incorrect OTP attempts; request a new code |
| `FILE_TOO_LARGE` | 400 | Uploaded file exceeds the 25 MB limit |
| `MISSING_TOKEN` | 401 | `Authorization` header is absent |
| `INVALID_TOKEN` | 401 | Token is expired, revoked, or malformed |
| `FORBIDDEN` | 403 | Valid token, insufficient role, ownership mismatch, or enrollment required |
| `COURSE_NOT_FOUND` | 404 | Course does not exist, is soft-deleted, or not published (for student/public requests) |
| `USER_NOT_FOUND` | 404 | User does not exist or is soft-deleted |
| `SEMESTER_NOT_FOUND` | 404 | Semester does not exist or is soft-deleted |
| `SUBJECT_NOT_FOUND` | 404 | Subject does not exist, is soft-deleted, or no progress record found |
| `LESSON_NOT_FOUND` | 404 | Lesson does not exist or is soft-deleted |
| `ATTACHMENT_NOT_FOUND` | 404 | Attachment does not exist |
| `ENROLLMENT_NOT_FOUND` | 404 | Enrollment or Registration record not found |
| `EMAIL_EXISTS` | 409 | Email address is already registered |
| `COURSE_TITLE_EXISTS` | 409 | A course with this title already exists |
| `ENROLLMENT_PENDING` | 409 | Student already has a pending enrollment for this course |
| `ALREADY_ENROLLED` | 409 | Student already has an approved enrollment for this course |
| `INVALID_STATE` | 409 | Entity is not in the required state for this operation |
| `INVALID_ROLE` | 409 | User role does not permit this operation |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Uploaded file MIME type is not allowed (only PDF, DOC, DOCX) |
| `COOLOFF_ACTIVE` | 422 | Student must wait before resubmitting an enrollment request |
| `NO_SEMESTERS` | 422 | Cannot publish: course has no semesters |
| `EMPTY_SEMESTER` | 422 | Cannot publish: at least one semester has no subjects |
| `USER_NOT_FOUND` | 422 | Student account no longer exists (during registration approval) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests — see `Retry-After` header |

---

## 19. HTTP Status Code Reference

| Status | Meaning | When used |
|:------:|---------|-----------|
| `200` | OK | Successful GET, PATCH, POST (non-creating) |
| `201` | Created | Successful POST that creates a resource |
| `204` | No Content | Successful DELETE; also logout, password-reset, verify-otp, change-password, mark-all-read |
| `400` | Bad Request | Zod validation failure; invalid/expired OTP |
| `401` | Unauthorized | Missing, expired, or revoked token |
| `403` | Forbidden | Valid token, wrong role, ownership mismatch, or enrollment not approved |
| `404` | Not Found | Resource not found; draft/archived course accessed by student |
| `409` | Conflict | Duplicate email, duplicate enrollment, invalid state transition, invalid role |
| `415` | Unsupported Media Type | Invalid attachment MIME type |
| `422` | Unprocessable Entity | Business rule violation (cooloff active, no semesters, empty semester on publish, user not found during approval) |
| `429` | Too Many Requests | Rate limit exceeded |

---

## 20. Domain Events Reference

Events published to the `outbox` Firestore collection and dispatched by the outbox-worker.

| Event Type | Published By | Consumers | Trigger |
|-----------|-------------|-----------|---------|
| `user.registered` | auth-service | notify, audit | Student completes registration |
| `registration.approved` | enrollment-service | user-service `/internal/users/approve`, notify, audit | Admin approves registration |
| `registration.rejected` | enrollment-service | notify, audit | Admin rejects registration |
| `enrollment.pending` | enrollment-service | notify, audit | Student submits enrollment request |
| `enrollment.approved` | enrollment-service | notify, audit | Admin approves enrollment |
| `enrollment.rejected` | enrollment-service | notify, audit | Admin rejects enrollment |
| `enrollment.withdrawn` | enrollment-service | audit | Student withdraws enrollment |
| `course.published` | course-service | notify, audit | Admin publishes a course |
| `progress.subjectCompleted` | progress-service | audit | Student marks a subject complete |
| `admin.created` | user-service | audit | Super admin creates or promotes an admin |
| `admin.suspended` | user-service | notify, audit | Admin account is suspended |
| `audit.action` | any service | audit | Direct audit event |

**Delivery guarantees:**
- At-least-once delivery; outbox-worker retries up to **5 times**
- Events that fail all 5 attempts remain as `status: "failed"` in `outbox` for manual investigation
- Within a single event, handlers run sequentially — a handler failure stops remaining handlers and triggers a retry on the next poll cycle
- Across a batch, `Promise.allSettled` ensures one event failure does not block others in the same poll cycle
