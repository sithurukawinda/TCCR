# Spec: API Specification

**Slug:** api-spec  
**Service(s):** All services (via API Gateway :3000)  
**Status:** Release Baseline  
**Date:** 2026-05-07  
**Version:** 1.0.0

---

## 1. API Conventions

### Base URL
```
Production:  https://api.yourdomain.com/api/v1
Staging:     https://api-staging.yourdomain.com/api/v1
Local Dev:   http://localhost:3000/api/v1
```

### Authentication
```
Authorization: Bearer <firebase-id-token>
```
All authenticated endpoints require a valid, non-expired, non-revoked Firebase ID token. Tokens expire in 1 hour — the Firebase client SDK refreshes them automatically. Never cache tokens.

### Required Headers

| Header | Required | Notes |
|--------|:--------:|-------|
| `Authorization` | On authenticated endpoints | `Bearer <token>` |
| `Content-Type` | On POST / PATCH with body | `application/json` |
| `X-Request-Id` | No | UUID v4; server generates if absent; echoed in response |

### Response — Single Resource
```json
{
  "id": "abc123",
  "title": "Introduction to TypeScript",
  "state": "published",
  "createdAt": "2026-05-01T08:00:00.000Z"
}
```

### Response — Paginated List
```json
{
  "items": [ ... ],
  "nextCursor": "abc123",
  "total": 47
}
```
`nextCursor` is `null` when there are no more pages.

### Response — Empty (DELETE)
```
HTTP 204 No Content
```

### Error Envelope
```json
{
  "error": {
    "code":    "COURSE_NOT_FOUND",
    "message": "The requested course could not be found.",
    "details": { "courseId": ["Course with this ID does not exist"] }
  },
  "requestId": "7f3a1c2d-4e5b-6f7a-8b9c-0d1e2f3a4b5c"
}
```
`details` is only present on `400` validation errors.

### Pagination
All list endpoints support cursor-based pagination:

| Parameter | Type | Default | Max |
|-----------|------|:-------:|:---:|
| `limit` | number | 20 | 100 |
| `cursor` | string | — | — |

### Rate Limiting
| Endpoint group | Limit | Window |
|---------------|-------|--------|
| `POST /auth/*` | 10 requests | Per IP per minute |
| All other endpoints | 200 requests | Per IP per minute |

Rate limit exceeded: `429 Too Many Requests` with `RateLimit-*` headers.

---

## 2. HTTP Status Code Reference

| Status | When used |
|--------|-----------|
| 200 | Successful GET, PATCH, POST (non-create actions) |
| 201 | Resource created (POST) |
| 204 | Successful DELETE or action with no response body |
| 400 | Zod validation failure — includes `error.details` |
| 401 | Missing / expired / revoked token |
| 403 | Valid token, insufficient role or ownership |
| 404 | Resource does not exist; DRAFT course accessed by student |
| 409 | Duplicate email, duplicate enrollment, invalid state transition |
| 415 | Invalid attachment MIME type |
| 422 | Business rule violation (e.g., publish with no subjects) |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error (sanitised message only) |
| 502 | Downstream service unreachable (Gateway level) |
| 503 | Readiness probe failed — Firestore unreachable |

---

## 3. Auth Endpoints

### `POST /auth/register` — public
Register a new student account.

**Request body:**
```json
{
  "firstName": "Viruli",
  "lastName":  "Weerasinghe",
  "email":     "viruli@example.com",
  "password":  "SecurePass@2026"
}
```
| Field | Validation |
|-------|-----------|
| `firstName` | 1–100 characters |
| `lastName` | 1–100 characters |
| `email` | Valid email, unique |
| `password` | Min 10 chars · uppercase · lowercase · number · special character |

**Responses:** `201` registration submitted · `400` validation error · `409 EMAIL_EXISTS`

---

### `POST /auth/logout` — any authenticated
Revoke all refresh tokens. All devices are logged out immediately.

**Responses:** `204`

---

### `POST /auth/password-reset` — public
Send a password reset email.

**Request body:** `{ "email": "viruli@example.com" }`

**Responses:** `204` (always — never reveals whether email exists)

---

## 4. Profile Endpoints

### `GET /me` — any authenticated
Returns the authenticated user's full profile.

**Response:**
```json
{
  "uid": "firebase-uid",
  "email": "viruli@example.com",
  "firstName": "Viruli",
  "lastName": "Weerasinghe",
  "role": "student",
  "status": "approved",
  "profilePhotoUrl": null,
  "createdAt": "2026-05-01T08:00:00.000Z",
  "updatedAt": "2026-05-01T08:00:00.000Z"
}
```

---

### `PATCH /me` — any authenticated
Update own profile fields.

**Request body (all optional):**
```json
{
  "firstName": "Viruli",
  "lastName":  "Weerasinghe",
  "profilePhotoUrl": "https://storage.googleapis.com/..."
}
```
**Responses:** `200` updated profile · `400` validation error

---

### `POST /me/change-password` — any authenticated

**Request body:**
```json
{
  "currentPassword": "OldPass@2026",
  "newPassword":     "NewPass@2026"
}
```
**Responses:** `204` · `400` validation error · `401` wrong current password

---

## 5. Course Endpoints

### `GET /courses` — public
List published courses. Students and public see only `PUBLISHED` courses with no `deletedAt`.

**Query params:** `limit`, `cursor`, `search` (optional keyword filter)

**Response:** paginated list of course objects

---

### `GET /courses/:id` — public
Get a single course. Returns `404` if course is `DRAFT` and caller is a student or unauthenticated.

---

### `POST /courses` — admin
Create a course in `DRAFT` state.

**Request body:**
```json
{
  "title":        "Node.js Fundamentals",
  "description":  "A beginner-friendly course on Node.js.",
  "coverImageUrl": null
}
```
**Responses:** `201` course object · `400` validation error

---

### `PATCH /courses/:id` — admin
Update course metadata.

**Request body (all optional):** `title`, `description`, `coverImageUrl`

**Responses:** `200` · `404 COURSE_NOT_FOUND`

---

### `POST /courses/:id/publish` — admin
Publish a `DRAFT` course. Requires ≥ 1 semester and every semester must have ≥ 1 subject.

**Responses:**
- `200` published course
- `404 COURSE_NOT_FOUND`
- `409 INVALID_STATE` — course is not in DRAFT state
- `422 NO_SEMESTERS` — no semesters exist
- `422 EMPTY_SEMESTER` — at least one semester has no subjects

---

### `POST /courses/:id/unpublish` — admin
Return a `PUBLISHED` course to `DRAFT`.

**Responses:** `200` · `409 INVALID_STATE`

---

### `POST /courses/:id/archive` — admin
Archive a `PUBLISHED` course. Archived courses are hidden from all users.

**Responses:** `200` · `409 INVALID_STATE`

---

### `DELETE /courses/:id` — admin
Soft-delete a course (sets `deletedAt`). Recoverable within 30 days.

**Responses:** `204` · `404 COURSE_NOT_FOUND`

---

## 6. Semester Endpoints

### `POST /courses/:id/semesters` — admin
**Request body:** `{ "title": "Semester 1", "description": "..." }`
**Responses:** `201` semester object · `404 COURSE_NOT_FOUND`

---

### `PATCH /semesters/:id` — admin
**Request body (all optional):** `title`, `description`
**Responses:** `200` · `404 SEMESTER_NOT_FOUND`

---

### `DELETE /semesters/:id` — admin
Soft-delete a semester.
**Responses:** `204` · `404 SEMESTER_NOT_FOUND`

---

## 7. Subject Endpoints

### `POST /semesters/:id/subjects` — admin
**Request body:**
```json
{
  "title":          "Introduction to Express",
  "description":    "Setting up your first Express server.",
  "youtubeVideoId": "dQw4w9WgXcQ",
  "attachmentIds":  []
}
```
| Field | Validation |
|-------|-----------|
| `youtubeVideoId` | Exactly 11 characters `[A-Za-z0-9_-]` or null |
| `attachmentIds` | Array of existing attachment IDs |

**Responses:** `201` · `400 INVALID_YOUTUBE_ID` · `404 SEMESTER_NOT_FOUND`

---

### `PATCH /subjects/:id` — admin
**Request body (all optional):** `title`, `description`, `youtubeVideoId`, `attachmentIds`
**Responses:** `200` · `404 SUBJECT_NOT_FOUND`

---

### `DELETE /subjects/:id` — admin
Soft-delete a subject.
**Responses:** `204` · `404 SUBJECT_NOT_FOUND`

---

## 8. Attachment Endpoints

### `POST /subjects/:id/attachments` — admin
Upload a file attachment. Uses `multipart/form-data`.

| Constraint | Value |
|-----------|-------|
| Accepted MIME types | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Max file size | 25 MB |

**Responses:** `201` attachment object · `415 UNSUPPORTED_MEDIA_TYPE` · `413` file too large

---

### `GET /attachments/:id/download-url` — student (enrolled), admin
Generate a short-lived signed download URL (expires in 15 minutes).

**Response:** `{ "downloadUrl": "https://storage.googleapis.com/...", "expiresAt": "..." }`

---

### `DELETE /attachments/:id` — admin
Remove an attachment from storage and the subject.
**Responses:** `204` · `404 ATTACHMENT_NOT_FOUND`

---

## 9. Enrollment Endpoints — Student

### `POST /courses/:id/enroll` — student
Request enrollment in a published course.

**Responses:**
- `201` enrollment object
- `404 COURSE_NOT_FOUND` — course not published
- `409 ENROLLMENT_PENDING` — already has a pending enrollment for this course
- `409 ALREADY_ENROLLED` — already approved enrollment exists

---

### `GET /me/enrollments` — student
List own enrollments (paginated). Filterable by `status`.
**Response:** paginated enrollments

---

### `POST /enrollments/:id/withdraw` — student
Withdraw from a course. Enrollment status becomes `WITHDRAWN`. Progress is NOT reset.
**Responses:** `200` · `404` · `409 INVALID_STATE`

---

## 10. Registration Queue — Admin

### `GET /admin/registrations` — admin
List student registrations. Filterable by `status` (`pending`, `approved`, `rejected`).
**Response:** paginated registrations

---

### `POST /admin/registrations/:id/approve` — admin
Approve a pending student registration. Student account status → `APPROVED`.
**Responses:** `200` · `404` · `409 INVALID_STATE`

---

### `POST /admin/registrations/:id/reject` — admin
**Request body (optional):** `{ "reason": "Incomplete information provided." }`
**Responses:** `200` · `404` · `409 INVALID_STATE`

---

### `POST /admin/registrations/bulk-approve` — admin
Bulk approve multiple registrations.

**Request body:**
```json
{ "ids": ["reg-1", "reg-2", "reg-3"] }
```

**Response:**
```json
{
  "approved": ["reg-1", "reg-3"],
  "failed":   [{ "id": "reg-2", "reason": "Already approved." }]
}
```
Uses `Promise.allSettled` — partial success is allowed.

---

## 11. Enrollment Queue — Admin

### `GET /admin/enrollments` — admin
List enrollment requests. Filterable by `status` and `courseId`.

---

### `POST /admin/enrollments/:id/approve` — admin
Approve a pending enrollment.
**Responses:** `200` · `404` · `409 INVALID_STATE`

---

### `POST /admin/enrollments/:id/reject` — admin
**Request body (optional):** `{ "reason": "Course capacity reached." }`

After rejection, the student cannot re-enroll for `ENROLLMENT_REJECTION_COOLOFF_HOURS` (default 24 h).
**Responses:** `200` · `404` · `409 INVALID_STATE`

---

## 12. Progress Endpoints

### `POST /progress/subjects/:id/complete` — student
Mark a subject as complete. **Idempotent** — second call returns existing record unchanged. `completedAt` is immutable once set.

**Response:**
```json
{
  "subjectId":     "subject-1",
  "state":         "completed",
  "completedAt":   "2026-05-07T10:00:00.000Z",
  "lastAccessedAt": "2026-05-07T10:00:00.000Z"
}
```

---

### `POST /progress/subjects/:id/access` — student
Update `lastAccessedAt` — supports "resume where you left off".
**Responses:** `200`

---

### `GET /me/progress/courses/:courseId` — student
Course-level progress aggregate.

**Response:**
```json
{
  "courseId":              "course-1",
  "studentUid":            "uid-1",
  "completedCount":        3,
  "pendingCount":          2,
  "totalSubjects":         5,
  "completionPercent":     60.0,
  "lastAccessedSubjectId": "subject-2"
}
```
`completionPercent` is rounded to 1 decimal place.

---

### `GET /me/progress/subjects/:subjectId` — student
Single subject progress record.

---

### `GET /admin/progress/courses/:courseId` — admin
Aggregated progress for all enrolled students in a course.

---

## 13. Notification Endpoints

### `GET /me/notifications` — any authenticated
Paginated list of own notifications. Filterable by `read` (boolean).

**Response item:**
```json
{
  "id":        "notif-1",
  "type":      "enrollment.approved",
  "title":     "Enrollment Approved",
  "body":      "Your enrollment in Node.js Fundamentals has been approved.",
  "read":      false,
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

---

### `POST /me/notifications/:id/read` — any authenticated
Mark a single notification as read.
**Responses:** `200` · `404 NOTIFICATION_NOT_FOUND`

---

### `POST /me/notifications/read-all` — any authenticated
Mark all own notifications as read.
**Responses:** `204`

---

## 14. User Management — Admin

### `GET /users` — admin
List all users (paginated). Filterable by `status`, `role`.

---

### `GET /users/:uid` — admin
Get a specific user's profile.
**Responses:** `200` · `404 USER_NOT_FOUND`

---

### `POST /users/:uid/suspend` — admin
Disable the user's Firebase account. Student cannot log in while suspended.
**Responses:** `200` · `404 USER_NOT_FOUND`

---

### `POST /users/:uid/reactivate` — admin
Re-enable a suspended user account.
**Responses:** `200` · `404 USER_NOT_FOUND`

---

## 15. Admin Management — Super Admin

### `GET /super-admin/admins` — super_admin
List all admin accounts (paginated).

---

### `POST /super-admin/admins` — super_admin
Create a new admin account.

**Request body:**
```json
{
  "firstName":       "Kavinda",
  "lastName":        "Perera",
  "email":           "kavinda@futurecx.com",
  "initialPassword": "Admin@Secure2026"
}
```
**Responses:** `201` · `409 EMAIL_EXISTS`

---

### `GET /super-admin/admins/:uid` — super_admin
**Responses:** `200` · `404 USER_NOT_FOUND`

---

### `POST /super-admin/admins/:uid/suspend` — super_admin
**Responses:** `200` · `404`

---

### `POST /super-admin/admins/:uid/reactivate` — super_admin
**Responses:** `200` · `404`

---

### `DELETE /super-admin/admins/:uid` — super_admin
Soft-delete an admin account.
**Responses:** `204` · `404`

---

## 16. Audit Log — Super Admin

### `GET /audit-log` — super_admin
Query the immutable audit log.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `actorUid` | string | Filter by actor |
| `action` | string | Filter by action type |
| `targetType` | string | Filter by resource type |
| `targetId` | string | Filter by resource ID |
| `from` | ISO 8601 | Start of date range |
| `to` | ISO 8601 | End of date range |
| `limit` | number | Default 20, max 100 |
| `cursor` | string | Pagination cursor |

**Response item:**
```json
{
  "id":         "audit-1",
  "actorUid":   "admin-uid",
  "action":     "registration.approved",
  "targetType": "registration",
  "targetId":   "reg-1",
  "payload":    { "studentUid": "student-uid" },
  "requestId":  "uuid",
  "createdAt":  "2026-05-07T10:00:00.000Z"
}
```

---

## 17. Health Endpoints

### `GET /healthz` — public
Liveness probe — confirms the process is alive.
**Response:** `{ "status": "ok", "service": "course-service" }`

---

### `GET /readyz` — public
Readiness probe — confirms Firestore is reachable.
**Response (ready):** `{ "status": "ready" }`
**Response (not ready):** `503 { "status": "not_ready", "error": "Firestore unreachable" }`

---

## 18. Error Code Reference

| Code | Status | Meaning |
|------|--------|---------|
| `VALIDATION_ERROR` | 400 | Zod schema validation failed — check `error.details` |
| `UNAUTHENTICATED` | 401 | No token provided |
| `TOKEN_EXPIRED` | 401 | Firebase ID token has expired |
| `TOKEN_REVOKED` | 401 | Token was revoked (user logged out) |
| `INVALID_TOKEN` | 401 | Token could not be verified |
| `FORBIDDEN` | 403 | Valid token but insufficient role or ownership |
| `USER_NOT_FOUND` | 404 | User with given UID does not exist |
| `COURSE_NOT_FOUND` | 404 | Course not found or not visible to this role |
| `SEMESTER_NOT_FOUND` | 404 | Semester not found |
| `SUBJECT_NOT_FOUND` | 404 | Subject not found |
| `ENROLLMENT_NOT_FOUND` | 404 | Enrollment not found |
| `ATTACHMENT_NOT_FOUND` | 404 | Attachment not found |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification not found |
| `EMAIL_EXISTS` | 409 | Email address already registered |
| `ENROLLMENT_PENDING` | 409 | Student already has a pending enrollment for this course |
| `ALREADY_ENROLLED` | 409 | Student is already approved/active for this course |
| `INVALID_STATE` | 409 | Operation not valid for the resource's current state |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | File type not allowed (only PDF, DOC, DOCX) |
| `NO_SEMESTERS` | 422 | Course has no semesters — cannot publish |
| `EMPTY_SEMESTER` | 422 | A semester has no subjects — cannot publish |
| `COOLOFF_ACTIVE` | 422 | Re-enrollment blocked by rejection cooloff period |
| `INVALID_YOUTUBE_ID` | 400 | YouTube video ID is not exactly 11 valid characters |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests — slow down |
| `AUTH_RATE_LIMIT_EXCEEDED` | 429 | Too many auth attempts — slow down |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## 19. Domain Events Reference

All events are dispatched asynchronously via the transactional outbox worker.

| Event | Published By | Consumers |
|-------|-------------|-----------|
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

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*  
*Paired with API Document v1.0.0 · Backend Blueprint v1.0.0*
