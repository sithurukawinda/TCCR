# Master Role — API Reference

**Version:** 1.0.0  
**Service:** user-service (proxied via gateway at `https://cms.api.bethelnet.au/api/v1`)  
**Role:** `master`  
**Access Level:** Full system access — inherits every role in the system

---

## Legend

| Badge | Meaning |
|-------|---------|
| `🆕 NEW` | Endpoint created specifically for the master role |
| `🔄 OLD` | Pre-existing endpoint — master now has access via role inheritance |

---

## Overview

The `master` role is the highest privilege level in the TCCR system. It inherits all permissions from every other role (`super_admin`, `admin`, `g12`, `leader`, `student`, `member`) via middleware injection. Two roles can manage master: `master` itself and `super_admin`.

**Role hierarchy:**
```
master  ←  inherits everything below
  super_admin  ←  inherits admin
    admin
      g12 / leader / student / member
```

---

## Authentication

All endpoints require a Firebase ID token in the `Authorization` header:

```
Authorization: Bearer <idToken>
```

---

## 1. Dedicated Master Management APIs

> Base path: `/api/v1/master`  
> Access: `master` and `super_admin` only. Regular `admin` is blocked (403).

---

### 1.1 List Master Users `🆕 NEW`

```
GET /api/v1/master/users
```

Returns all users who currently hold the `master` role.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | `20` | Max results (1–100) |
| `cursor` | string | — | Pagination cursor from previous response |

**Request**
```http
GET /api/v1/master/users?limit=20
Authorization: Bearer {{masterToken}}
```

**Response `200 OK`**
```json
{
  "items": [
    {
      "uid": "abc123",
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@cmp.com",
      "roles": ["member", "super_admin", "master"],
      "status": "approved",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": null,
  "total": 1
}
```

**Error Responses**

| Status | Code | Description |
|--------|------|-------------|
| `401` | `UNAUTHENTICATED` | Missing or invalid token |
| `403` | `FORBIDDEN` | Caller does not hold `master` or `super_admin` role |

---

### 1.2 Grant Master Role `🆕 NEW`

```
POST /api/v1/master/grant/:uid
```

Grants the `master` role to the specified user. Idempotent — returns `200` if user already has master.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | string | UID of the target user |

**Request**
```http
POST /api/v1/master/grant/WIoGKOQ52XNGLmjs7nskjUxJVG63
Authorization: Bearer {{masterToken}}
```

**Response `200 OK`**
```json
{
  "message": "Master role granted successfully."
}
```

**Error Responses**

| Status | Code | Description |
|--------|------|-------------|
| `401` | `UNAUTHENTICATED` | Missing or invalid token |
| `403` | `FORBIDDEN` | Caller is not `master` or `super_admin`; or caller is granting to themselves |
| `404` | `USER_NOT_FOUND` | Target user does not exist |

> **Note:** Self-grant is blocked — a master cannot grant master to their own account.

---

### 1.3 Revoke Master Role `🆕 NEW`

```
DELETE /api/v1/master/revoke/:uid
```

Removes the `master` role from the specified user. Idempotent — returns `200` if user does not have master.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | string | UID of the target user |

**Request**
```http
DELETE /api/v1/master/revoke/WIoGKOQ52XNGLmjs7nskjUxJVG63
Authorization: Bearer {{masterToken}}
```

**Response `200 OK`**
```json
{
  "message": "Master role revoked successfully."
}
```

**Error Responses**

| Status | Code | Description |
|--------|------|-------------|
| `401` | `UNAUTHENTICATED` | Missing or invalid token |
| `403` | `FORBIDDEN` | Caller is not `master` or `super_admin`; or caller is revoking from themselves |
| `404` | `USER_NOT_FOUND` | Target user does not exist |

> **Note:** Self-revoke is blocked — a master cannot remove master from their own account.

---

## 2. Super Admin APIs — Now Accessible by Master

> These endpoints previously required `super_admin` only. Master inherits them automatically.

---

### 2.1 List All Admins `🔄 OLD`

```
GET /api/v1/super-admin/admins
```

**Request**
```http
GET /api/v1/super-admin/admins
Authorization: Bearer {{masterToken}}
```

**Response `200 OK`**
```json
{
  "items": [{ "uid": "...", "firstName": "...", "email": "...", "roles": ["admin"] }],
  "nextCursor": null,
  "total": 2
}
```

---

### 2.2 Create Admin `🔄 OLD`

```
POST /api/v1/super-admin/admins
```

**Request Body**
```json
{
  "firstName": "New",
  "lastName": "Admin",
  "email": "newadmin@tccr.lk",
  "initialPassword": "Admin@Tccr2026",
  "preferredLanguage": "en"
}
```

**Response `201 Created`**
```json
{
  "uid": "newAdminUid",
  "email": "newadmin@tccr.lk",
  "firstName": "New",
  "lastName": "Admin",
  "roles": ["member", "admin"]
}
```

---

### 2.3 Get Admin by UID `🔄 OLD`

```
GET /api/v1/super-admin/admins/:uid
```

**Response `200 OK`** — full user profile object.

---

### 2.4 Suspend Admin `🔄 OLD`

```
POST /api/v1/super-admin/admins/:uid/suspend
```

**Response `200 OK`**
```json
{ "message": "Admin suspended." }
```

---

### 2.5 Reactivate Admin `🔄 OLD`

```
POST /api/v1/super-admin/admins/:uid/reactivate
```

**Response `200 OK`**
```json
{ "message": "Admin reactivated." }
```

---

### 2.6 Delete Admin Account `🔄 OLD`

```
DELETE /api/v1/super-admin/admins/:uid
```

Permanently hard-deletes an admin from Firebase Auth and Firestore. Irreversible.

**Response `204 No Content`**

---

### 2.7 Promote User to Admin `🔄 OLD`

```
POST /api/v1/super-admin/users/:uid/make-admin
```

**Response `200 OK`**
```json
{ "message": "User promoted to admin." }
```

---

### 2.8 Hard Delete Course `🔄 OLD`

```
DELETE /api/v1/courses/:id/hard
```

Permanently removes a course and all its sub-collections (semesters, subjects, lessons, batches). Irreversible.

**Response `204 No Content`**

---

## 3. All Inherited APIs by Category

Master passes every `authorize()` check in the system. Below is the full inherited access by service.

---

### 3.1 User Service

| Method | Endpoint | Badge | Notes |
|--------|----------|-------|-------|
| `GET` | `/api/v1/me` | `🔄 OLD` | Own profile |
| `PATCH` | `/api/v1/me` | `🔄 OLD` | Update own profile |
| `POST` | `/api/v1/me/avatar` | `🔄 OLD` | Upload profile photo |
| `POST` | `/api/v1/me/fcm-token` | `🔄 OLD` | Register push token |
| `DELETE` | `/api/v1/me/fcm-token` | `🔄 OLD` | Remove push token |
| `PATCH` | `/api/v1/me/notifications/preferences` | `🔄 OLD` | Notification opt-in/out |
| `POST` | `/api/v1/me/providers/link` | `🔄 OLD` | Link OAuth provider |
| `DELETE` | `/api/v1/me/providers/:provider` | `🔄 OLD` | Unlink OAuth provider |
| `POST` | `/api/v1/me/change-password` | `🔄 OLD` | Change password |
| `GET` | `/api/v1/users` | `🔄 OLD` | List all users (org-wide) |
| `GET` | `/api/v1/users/summary` | `🔄 OLD` | Users grouped by role |
| `GET` | `/api/v1/users/:uid` | `🔄 OLD` | Get any user profile |
| `POST` | `/api/v1/users` | `🔄 OLD` | Create leader/g12 user |
| `PATCH` | `/api/v1/users/:uid/roles` | `🔄 OLD` | Add or remove any role |
| `POST` | `/api/v1/users/:uid/suspend` | `🔄 OLD` | Suspend user |
| `POST` | `/api/v1/users/:uid/reactivate` | `🔄 OLD` | Reactivate user |
| `DELETE` | `/api/v1/users/:uid` | `🔄 OLD` | Hard-delete regular user |
| `POST` | `/api/v1/users/:uid/promote` | `🔄 OLD` | Promote member to leader/g12 |
| `POST` | `/api/v1/users/:uid/demote` | `🔄 OLD` | Remove a role from user |

---

### 3.2 Auth Service

| Method | Endpoint | Badge | Notes |
|--------|----------|-------|-------|
| `POST` | `/api/v1/auth/logout` | `🔄 OLD` | Sign out |
| `POST` | `/api/v1/auth/apple/refresh` | `🔄 OLD` | Refresh Apple session |
| `POST` | `/api/v1/auth/apple/revoke` | `🔄 OLD` | Revoke Apple tokens |

---

### 3.3 Course Service

| Method | Endpoint | Badge | Notes |
|--------|----------|-------|-------|
| `GET` | `/api/v1/courses` | `🔄 OLD` | List all courses (all states) |
| `POST` | `/api/v1/courses` | `🔄 OLD` | Create course |
| `GET` | `/api/v1/courses/:id` | `🔄 OLD` | Get course |
| `PATCH` | `/api/v1/courses/:id` | `🔄 OLD` | Update course |
| `POST` | `/api/v1/courses/:id/publish` | `🔄 OLD` | Publish |
| `POST` | `/api/v1/courses/:id/unpublish` | `🔄 OLD` | Unpublish |
| `POST` | `/api/v1/courses/:id/archive` | `🔄 OLD` | Archive |
| `POST` | `/api/v1/courses/:id/restore` | `🔄 OLD` | Restore to draft |
| `DELETE` | `/api/v1/courses/:id` | `🔄 OLD` | Delete course |
| `DELETE` | `/api/v1/courses/:id/hard` | `🔄 OLD` | Hard-delete (super_admin level) |
| `GET/POST` | `/api/v1/courses/:id/semesters` | `🔄 OLD` | List / create semesters |
| `PATCH/DELETE` | `/api/v1/semesters/:id` | `🔄 OLD` | Update / delete semester |
| `GET/POST` | `/api/v1/semesters/:id/subjects` | `🔄 OLD` | List / create subjects |
| `PATCH/DELETE` | `/api/v1/subjects/:id` | `🔄 OLD` | Update / delete subject |
| `GET/POST` | `/api/v1/subjects/:id/lessons` | `🔄 OLD` | List / create lessons |
| `PATCH/DELETE` | `/api/v1/lessons/:id` | `🔄 OLD` | Update / delete lesson |
| `GET/POST` | `/api/v1/courses/:id/batches` | `🔄 OLD` | List / create batches |
| `GET/PATCH` | `/api/v1/batches/:id` | `🔄 OLD` | Get / update batch |
| `POST` | `/api/v1/batches/:id/open` | `🔄 OLD` | Open batch |
| `POST` | `/api/v1/batches/:id/close` | `🔄 OLD` | Close batch |
| `PUT/PATCH` | `/api/v1/courses/:id/batches/:bId/semester-dates` | `🔄 OLD` | Set semester schedule |

---

### 3.4 Enrollment Service

| Method | Endpoint | Badge | Notes |
|--------|----------|-------|-------|
| `GET` | `/api/v1/me/enrollments` | `🔄 OLD` | Own enrollments |
| `POST` | `/api/v1/courses/:id/enroll` | `🔄 OLD` | Enroll in course |
| `GET` | `/api/v1/admin/registrations` | `🔄 OLD` | All registrations |
| `POST` | `/api/v1/admin/registrations/bulk-approve` | `🔄 OLD` | Bulk approve |
| `POST` | `/api/v1/admin/registrations/:id/approve` | `🔄 OLD` | Approve registration |
| `POST` | `/api/v1/admin/registrations/:id/reject` | `🔄 OLD` | Reject registration |
| `GET` | `/api/v1/admin/enrollments` | `🔄 OLD` | All enrollments |
| `POST` | `/api/v1/enrollments/:id/approve` | `🔄 OLD` | Approve enrollment |
| `POST` | `/api/v1/enrollments/:id/reject` | `🔄 OLD` | Reject enrollment |
| `GET` | `/api/v1/role-requests` | `🔄 OLD` | All role requests |
| `GET` | `/api/v1/role-requests/:id` | `🔄 OLD` | Get role request |
| `GET` | `/api/v1/role-requests/:id/qualification` | `🔄 OLD` | Download PDF |
| `POST` | `/api/v1/role-requests/:id/approve` | `🔄 OLD` | Approve role request |
| `POST` | `/api/v1/role-requests/:id/reject` | `🔄 OLD` | Reject role request |

---

### 3.5 Progress Service

| Method | Endpoint | Badge | Notes |
|--------|----------|-------|-------|
| `GET` | `/api/v1/me/progress/courses/:courseId` | `🔄 OLD` | Course progress |
| `GET` | `/api/v1/me/progress/subjects/:subjectId` | `🔄 OLD` | Subject progress |
| `POST` | `/api/v1/progress/subjects/:id/complete` | `🔄 OLD` | Mark subject complete |
| `POST` | `/api/v1/progress/lessons/:lessonId/complete` | `🔄 OLD` | Mark lesson complete |
| `DELETE` | `/api/v1/progress/lessons/:lessonId/complete` | `🔄 OLD` | Unmark lesson |
| `POST/GET` | `/api/v1/progress/lessons/:lessonId/video-position` | `🔄 OLD` | Video resume position |
| `GET` | `/api/v1/admin/progress/courses/:courseId` | `🔄 OLD` | Admin progress view |

---

### 3.6 Cell Service

| Method | Endpoint | Badge | Notes |
|--------|----------|-------|-------|
| `GET` | `/api/v1/cells` | `🔄 OLD` | All cells (all states) |
| `GET` | `/api/v1/cells/mine` | `🔄 OLD` | Own cells |
| `POST` | `/api/v1/cells` | `🔄 OLD` | Create cell |
| `GET` | `/api/v1/cells/:id` | `🔄 OLD` | Get cell |
| `PATCH` | `/api/v1/cells/:id` | `🔄 OLD` | Update cell |
| `POST` | `/api/v1/cells/:id/archive` | `🔄 OLD` | Archive cell |
| `DELETE` | `/api/v1/cells/:id` | `🔄 OLD` | Hard-delete cell |
| `POST` | `/api/v1/cells/:id/transfer-ownership` | `🔄 OLD` | Transfer ownership |
| `POST` | `/api/v1/cells/:id/members` | `🔄 OLD` | Add members |
| `DELETE` | `/api/v1/cells/:id/members/:uid` | `🔄 OLD` | Remove member |
| `GET` | `/api/v1/cells/:id/join-requests` | `🔄 OLD` | List join requests |
| `POST` | `/api/v1/cells/:id/join-requests/:rid/approve` | `🔄 OLD` | Approve join request |
| `POST` | `/api/v1/cells/:id/join-requests/:rid/reject` | `🔄 OLD` | Reject join request |
| `GET` | `/api/v1/cells/network/members` | `🔄 OLD` | Network member roster |
| `GET` | `/api/v1/cells/network/reports` | `🔄 OLD` | Network reports |
| `GET` | `/api/v1/cells/network/summary` | `🔄 OLD` | Network summary |
| `POST` | `/api/v1/cells/:id/report-photos` | `🔄 OLD` | Upload report photos |
| `GET` | `/api/v1/cells/:id/reports` | `🔄 OLD` | List cell reports |
| `POST` | `/api/v1/cells/:id/reports` | `🔄 OLD` | File cell report |
| `GET` | `/api/v1/cells/:id/reports/:rid` | `🔄 OLD` | Get report |
| `PATCH` | `/api/v1/cells/:id/reports/:rid` | `🔄 OLD` | Edit report (24h window) |
| `POST` | `/api/v1/cells/:id/reports/:rid/void` | `🔄 OLD` | Void report |

---

### 3.7 Analytics Service

| Method | Endpoint | Badge | Scope |
|--------|----------|-------|-------|
| `GET` | `/api/v1/analytics/cells/weekly` | `🔄 OLD` | Org-wide |
| `GET` | `/api/v1/analytics/attendance` | `🔄 OLD` | Org-wide |
| `GET` | `/api/v1/analytics/meeting-types` | `🔄 OLD` | Org-wide |
| `GET` | `/api/v1/analytics/growth` | `🔄 OLD` | Org-wide |
| `GET` | `/api/v1/analytics/participation` | `🔄 OLD` | Org-wide |
| `GET` | `/api/v1/analytics/:chart/export` | `🔄 OLD` | CSV export |

---

### 3.8 Audit Service

| Method | Endpoint | Badge | Notes |
|--------|----------|-------|-------|
| `GET` | `/api/v1/audit-log` | `🔄 OLD` | Full system audit log |
| `GET` | `/api/v1/users/:uid/audit-log` | `🔄 OLD` | Per-user audit timeline |

---

### 3.9 Notification Service

| Method | Endpoint | Badge | Notes |
|--------|----------|-------|-------|
| `GET` | `/api/v1/me/notifications` | `🔄 OLD` | Own notifications |
| `POST` | `/api/v1/me/notifications/:id/read` | `🔄 OLD` | Mark as read |
| `POST` | `/api/v1/me/notifications/read-all` | `🔄 OLD` | Mark all as read |

---

### 3.10 Storage Service

| Method | Endpoint | Badge | Notes |
|--------|----------|-------|-------|
| `POST` | `/api/v1/subjects/:id/attachments` | `🔄 OLD` | Upload attachment |
| `POST` | `/api/v1/subjects/:id/images` | `🔄 OLD` | Upload subject image |
| `GET` | `/api/v1/attachments/:id/download-url` | `🔄 OLD` | Get signed download URL |
| `DELETE` | `/api/v1/attachments/:id` | `🔄 OLD` | Delete attachment |

---

## 4. API Count Summary

| Category | Count |
|----------|-------|
| `🆕 NEW` — Dedicated master endpoints | **3** |
| `🔄 OLD` — Super admin endpoints now inherited by master | **8** |
| `🔄 OLD` — All other inherited endpoints | **75+** |
| **Total accessible by master** | **86+** |

---

## 5. Access Control Summary

| Role | `/api/v1/master/*` | `/api/v1/super-admin/*` | All Other Endpoints |
|------|--------------------|--------------------------|---------------------|
| `master` | ✅ Full | ✅ Full | ✅ Full |
| `super_admin` | ✅ Full | ✅ Full | ✅ Full (inherits admin) |
| `admin` | ❌ 403 | ❌ 403 | ✅ Admin-level |
| `g12` / `leader` | ❌ 403 | ❌ 403 | ✅ Leader-level |
| `student` / `member` | ❌ 403 | ❌ 403 | ✅ Member-level |

---

## 6. Error Reference

| Status | Code | Meaning |
|--------|------|---------|
| `200` | — | Success |
| `201` | — | Resource created |
| `204` | — | Success, no content (DELETE) |
| `401` | `UNAUTHENTICATED` | Missing or invalid Bearer token |
| `401` | `TOKEN_EXPIRED` | Token has expired — re-sign in |
| `403` | `FORBIDDEN` | Valid token but insufficient role |
| `403` | `EMAIL_NOT_VERIFIED` | Email not verified yet |
| `404` | `USER_NOT_FOUND` | Target user does not exist |
| `409` | `EMAIL_EXISTS` | Email already registered |

---

*Last updated: 2026-06-02 — TCCR Backend v2.6*
