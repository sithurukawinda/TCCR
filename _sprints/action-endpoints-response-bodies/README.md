# Sprints: Add Response Bodies to Action Endpoints

**Source Plan:** `_plan/2026-05-26-action-endpoints-response-bodies.md`
**Created:** 2026-05-26
**Total Sprints:** 4
**Estimated Total Time:** ~40 min

---

## 🏃 Sprint Overview

| Sprint | Phase | File | Endpoints | Status | Est. | Actual | Completed |
|--------|-------|------|-----------|--------|------|--------|-----------|
| 1 | auth-service — AuthController | `AuthController.ts` | logout, verifyOtpAndReset, resendVerification, verifyEmailOtp, appleRevoke | 🟡 Not Started | 15 min | ___ | ___ |
| 2 | user-service — MeController | `MeController.ts` | postChangePassword, postFcmToken | 🟡 Not Started | 10 min | ___ | ___ |
| 3 | user-service — UsersController | `UsersController.ts` | assignRole, promote, demote | 🟡 Not Started | 10 min | ___ | ___ |
| 4 | notification-service — NotificationController | `NotificationController.ts` | markAllRead | 🟡 Not Started | 5 min | ___ | ___ |

**Status Legend:**
- 🟡 Not Started
- 🔵 In Progress
- 🟢 Complete
- 🔴 Blocked

---

## 📂 Sprint Files

1. [Sprint 1: auth-service — AuthController](./sprint-01-auth-service-authcontroller.md) — 5 endpoints
2. [Sprint 2: user-service — MeController](./sprint-02-user-service-mecontroller.md) — 2 endpoints
3. [Sprint 3: user-service — UsersController](./sprint-03-user-service-userscontroller.md) — 3 endpoints
4. [Sprint 4: notification-service — NotificationController](./sprint-04-notification-service-notificationcontroller.md) — 1 endpoint

---

## 🎯 Current Sprint

**Active:** Sprint 1 — auth-service AuthController
**Progress:** 0% (0/11 endpoints done)

---

## 🔁 Change Pattern (same across all sprints)

```typescript
// Before (wrong for non-DELETE action endpoints)
res.status(204).send();

// After
sendSuccess(res, { message: 'Action completed successfully.' });
```

---

## 📊 Overall Progress

**Completed Sprints:** 0/4
**Endpoints changed:** 0/11
**Total Progress:** 0%

---

## ✅ Final Checklist (after all 4 sprints)

```bash
# Type-checks
npm run type-check --workspace=packages/auth-service
npm run type-check --workspace=packages/user-service
npm run type-check --workspace=packages/notification-service

# Unit tests
npx jest packages/auth-service/tests/unit --no-coverage
npx jest packages/user-service/tests/unit --no-coverage
npx jest packages/notification-service/tests/unit --no-coverage

# Commit + push
git add packages/auth-service packages/user-service packages/notification-service
git commit -m "feat: return 200 with message body on all action endpoints"
git push origin develop
```

---

## 📌 Endpoints that stay 204 (do not touch)

| Endpoint | Reason |
|----------|--------|
| `POST /auth/password-reset` | Prevents email enumeration by design |
| `DELETE /me/fcm-token` | DELETE operation |
| `DELETE /users/:uid` | DELETE operation |
| `DELETE /super-admin/admins/:uid` | DELETE operation |
| `DELETE /courses/:id` | DELETE operation |
| `DELETE /semesters/:id` | DELETE operation |
| `DELETE /subjects/:id` | DELETE operation |
| `DELETE /lessons/:id` | DELETE operation |
| `DELETE /attachments/:id` | DELETE operation |
| `DELETE /cells/:id` | DELETE operation |
| All `/internal/*` routes | Service-to-service, not user-facing |
