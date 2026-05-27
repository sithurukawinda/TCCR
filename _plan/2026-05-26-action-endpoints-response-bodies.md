# Implementation Plan: Add Response Bodies to Action Endpoints

**Created:** 2026-05-26T00:00:00.000Z
**Status:** 🟡 Draft
**Author:** Claude
**Estimated Time:** 1 hour

---

## 📋 Context

Several user-facing action endpoints (POST/PATCH) currently return `res.status(204).send()` — an empty body with no confirmation message. While HTTP 204 is correct for DELETE operations, it is wrong for action endpoints because:

- The client gets no confirmation of what happened
- Frontend must fire a separate GET request to verify the state change
- It is inconsistent with the project's own HTTP status policy (`204 = Successful DELETE` only)

This plan changes all non-DELETE, non-internal action endpoints from `204 No Content` → `200 OK` with a meaningful JSON body using the existing `sendSuccess()` helper from `@shared/response`.

---

## 🎯 Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Response shape | `{ message: "..." }` | Simple, consistent, no use case changes needed |
| Status code | 200 | Correct for non-DELETE action endpoints |
| Helper | `sendSuccess(res, { message })` | Already used across codebase, consistent |
| Use case changes | None | All return `Promise<void>` — message constructed in controller |
| Internal routes | Keep 204 | Not user-facing, service-to-service calls |
| DELETE routes | Keep 204 | Correct HTTP spec for deletions |
| `POST /auth/password-reset` | Keep 204 | Intentional — prevents email enumeration |

---

## 🚀 Implementation Steps

### Phase 1: auth-service — AuthController

**File:** `packages/auth-service/src/http/controllers/AuthController.ts`

- [ ] `logout` (~line 76): `res.status(204).send()` → `sendSuccess(res, { message: 'Logged out successfully.' })`
- [ ] `verifyOtpAndReset` (~line 94): `res.status(204).send()` → `sendSuccess(res, { message: 'Password reset email sent to your inbox.' })`
- [ ] `resendVerification` (~line 112): `res.status(204).send()` → `sendSuccess(res, { message: 'Verification email sent.' })`
- [ ] `verifyEmailOtp` (~line 121): `res.status(204).send()` → `sendSuccess(res, { message: 'Email verified successfully.' })`
- [ ] `appleRevoke` (~line 246): `res.status(204).send()` → `sendSuccess(res, { message: 'Apple session revoked.' })`
- [ ] Verify `sendSuccess` is imported from `@shared/response` (add import if missing)

> ⚠️ `passwordReset` at ~line 85 **stays 204** — intentional by spec to prevent email enumeration.

---

### Phase 2: user-service — MeController

**File:** `packages/user-service/src/http/controllers/MeController.ts`

- [ ] `postChangePassword` (~line 85): `res.status(204).send()` → `sendSuccess(res, { message: 'Password changed successfully.' })`
- [ ] `postFcmToken` (~line 95): `res.status(204).send()` → `sendSuccess(res, { message: 'FCM token registered.' })`

> ⚠️ `deleteFcmToken` at ~line 105 **stays 204** — it is a DELETE operation.

---

### Phase 3: user-service — UsersController

**File:** `packages/user-service/src/http/controllers/UsersController.ts`

- [ ] `assignRole` (~line 104): `res.status(204).send()` → `sendSuccess(res, { message: 'Role updated successfully.' })`
- [ ] `promote` (~line 129): `res.status(204).send()` → `sendSuccess(res, { message: 'User promoted successfully.' })`
- [ ] `demote` (~line 159): `res.status(204).send()` → `sendSuccess(res, { message: 'User demoted successfully.' })`

> ⚠️ `delete` at ~line 80 **stays 204** — it is a DELETE operation.

---

### Phase 4: notification-service — NotificationController

**File:** `packages/notification-service/src/http/controllers/NotificationController.ts`

- [ ] `markAllRead` (~line 33): `res.status(204).send()` → `sendSuccess(res, { message: 'All notifications marked as read.' })`

---

## 📁 Key Files

| File | Change |
|------|--------|
| `packages/auth-service/src/http/controllers/AuthController.ts` | 5 endpoints updated |
| `packages/user-service/src/http/controllers/MeController.ts` | 2 endpoints updated |
| `packages/user-service/src/http/controllers/UsersController.ts` | 3 endpoints updated |
| `packages/notification-service/src/http/controllers/NotificationController.ts` | 1 endpoint updated |

**Unchanged (204 kept intentionally):**

| File | Endpoints kept at 204 | Reason |
|------|-----------------------|--------|
| `AuthController.ts` | `passwordReset` | Email enumeration prevention |
| `MeController.ts` | `deleteFcmToken` | DELETE operation |
| `UsersController.ts` | `delete` | DELETE operation |
| `SuperAdminController.ts` | `deleteAdmin` | DELETE operation |
| `CourseController.ts` | `remove` | DELETE operation |
| `SemesterController.ts` | `remove` | DELETE operation |
| `SubjectController.ts` | `remove` | DELETE operation |
| `LessonController.ts` | `remove` | DELETE operation |
| `AttachmentController.ts` | `remove` | DELETE operation |
| `CellGroupController.ts` | `delete` | DELETE operation |
| `InternalController.ts` | all methods | Internal routes |
| `InternalProgressController.ts` | `reset` | Internal route |
| `EventController.ts` | `receiveEvent` | Internal route |
| `AuditEventController.ts` | `receiveEvent` | Internal route |

---

## 🧪 Test Helpers

The change pattern is identical across all files:

```typescript
// Before
res.status(204).send();

// After
sendSuccess(res, { message: 'Action completed successfully.' });
```

`sendSuccess` from `@shared/response` sends the data object directly with HTTP 200. No wrapper — response body will be exactly `{ "message": "..." }`.

Import if not already present:
```typescript
import { sendSuccess } from '@shared/response';
```

---

## ✅ Verification Checklist

- [ ] Type-check auth-service: `npm run type-check --workspace=packages/auth-service`
- [ ] Type-check user-service: `npm run type-check --workspace=packages/user-service`
- [ ] Type-check notification-service: `npm run type-check --workspace=packages/notification-service`
- [ ] Unit tests auth-service: `npx jest packages/auth-service/tests/unit --no-coverage`
- [ ] Unit tests user-service: `npx jest packages/user-service/tests/unit --no-coverage`
- [ ] Unit tests notification-service: `npx jest packages/notification-service/tests/unit --no-coverage`
- [ ] Postman: `POST /auth/logout` → 200 `{ "message": "Logged out successfully." }`
- [ ] Postman: `POST /auth/verify-email` → 200 `{ "message": "Email verified successfully." }`
- [ ] Postman: `POST /me/change-password` → 200 `{ "message": "Password changed successfully." }`
- [ ] Postman: `PATCH /users/:uid/roles` → 200 `{ "message": "Role updated successfully." }`
- [ ] Postman: `POST /users/:uid/promote` → 200 `{ "message": "User promoted successfully." }`
- [ ] Postman: `POST /users/:uid/demote` → 200 `{ "message": "User demoted successfully." }`
- [ ] Postman: `POST /notifications/read-all` → 200 `{ "message": "All notifications marked as read." }`
- [ ] Confirm DELETE endpoints still return 204 with empty body
- [ ] Commit and push to develop

---

## 📝 Progress Tracking

**Status Legend:**
- 🟡 Draft — Planning stage
- 🔵 In Progress — Implementation started
- 🟢 Complete — All phases done
- 🔴 Blocked — Waiting on dependency

**Current Phase:** Phase 1
**Completion:** 0% (0/11 endpoints done)

---

## 📌 Notes

- **Total endpoints to change:** 11
- **Total endpoints left as 204:** 16 (8 DELETEs + 6 internal + 1 email-enumeration + 1 FCM DELETE)
- **No use case changes needed** — all affected use cases return `void`; message text is added only in the controller
- **No Zod schema changes needed** — response bodies are new additions, not input validation changes
- **No test assertion changes expected** — existing unit tests mock the use case and don't assert on the response body; only integration tests that check for 204 will need updating if they exist
