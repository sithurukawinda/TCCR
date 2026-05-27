# Sprint 1: auth-service — AuthController

**Plan:** Add Response Bodies to Action Endpoints
**Status:** 🟡 Not Started
**Estimated Time:** 15 min
**Actual Time:** ___ min
**Started:** ___
**Completed:** ___

---

## 🎯 Sprint Goal

Update 5 action endpoints in `AuthController` to return `200 OK` with a meaningful JSON message body instead of an empty `204 No Content`. The `passwordReset` endpoint intentionally stays at 204.

---

## 📋 Tasks

- [ ] Open `packages/auth-service/src/http/controllers/AuthController.ts`
- [ ] Verify `sendSuccess` is imported from `@shared/response` — add import if missing:
  ```typescript
  import { sendSuccess } from '@shared/response';
  ```
- [ ] `logout` (~line 76): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'Logged out successfully.' });
  ```
- [ ] `verifyOtpAndReset` (~line 94): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'Password reset email sent to your inbox.' });
  ```
- [ ] `resendVerification` (~line 112): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'Verification email sent.' });
  ```
- [ ] `verifyEmailOtp` (~line 121): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'Email verified successfully.' });
  ```
- [ ] `appleRevoke` (~line 246): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'Apple session revoked.' });
  ```

---

## ⚠️ Do NOT Change

`passwordReset` at ~line 85 **stays 204** — intentional by spec to prevent email enumeration (always returns 204 regardless of whether the email exists).

---

## 📁 Files to Modify

**Modified Files:**
- `packages/auth-service/src/http/controllers/AuthController.ts`

---

## 🔗 Dependencies

**Requires Completion Of:** None (first sprint)

**Required By:**
- Sprint 2: user-service — MeController
- Sprint 3: user-service — UsersController
- Sprint 4: notification-service — NotificationController

---

## ✅ Acceptance Criteria

- [ ] All 5 target methods return `200` with `{ message: "..." }` body
- [ ] `passwordReset` still returns `204` with no body
- [ ] Type-check passes: `npm run type-check --workspace=packages/auth-service`
- [ ] Unit tests pass: `npx jest packages/auth-service/tests/unit --no-coverage`

---

## 🧪 Verification Commands

```bash
# Type-check
npm run type-check --workspace=packages/auth-service

# Unit tests
npx jest packages/auth-service/tests/unit --no-coverage
```

**Postman checks (requires services running):**
- `POST /api/v1/auth/logout` → `200 { "message": "Logged out successfully." }`
- `POST /api/v1/auth/password-reset/verify` → `200 { "message": "Password reset email sent to your inbox." }`
- `POST /api/v1/auth/resend-verification` → `200 { "message": "Verification email sent." }`
- `POST /api/v1/auth/verify-email` → `200 { "message": "Email verified successfully." }`
- `POST /api/v1/auth/apple/revoke` → `200 { "message": "Apple session revoked." }`
- `POST /api/v1/auth/password-reset` → still `204` (no body)

---

## 📝 Notes

- 5 changes in 1 file — all follow the exact same pattern
- `sendSuccess` may already be imported in this file; check before adding
- No use case changes needed — all use cases return `void`

---

## 🐛 Issues Encountered

**Issue:** ___
**Resolution:** ___
**Time Lost:** ___

---

**Next Sprint:** `sprint-02-user-service-mecontroller.md`
