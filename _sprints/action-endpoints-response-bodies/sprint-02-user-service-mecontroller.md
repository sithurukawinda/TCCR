# Sprint 2: user-service — MeController

**Plan:** Add Response Bodies to Action Endpoints
**Status:** 🟡 Not Started
**Estimated Time:** 10 min
**Actual Time:** ___ min
**Started:** ___
**Completed:** ___

---

## 🎯 Sprint Goal

Update 2 action endpoints in `MeController` to return `200 OK` with a meaningful JSON message body. The `deleteFcmToken` endpoint stays at 204 (it is a DELETE operation).

---

## 📋 Tasks

- [ ] Open `packages/user-service/src/http/controllers/MeController.ts`
- [ ] Verify `sendSuccess` is already imported from `@shared/response` (it should be — used by other methods)
- [ ] `postChangePassword` (~line 85): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'Password changed successfully.' });
  ```
- [ ] `postFcmToken` (~line 95): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'FCM token registered.' });
  ```

---

## ⚠️ Do NOT Change

`deleteFcmToken` at ~line 105 **stays 204** — it is a DELETE operation (HTTP spec: 204 = Successful DELETE).

---

## 📁 Files to Modify

**Modified Files:**
- `packages/user-service/src/http/controllers/MeController.ts`

---

## 🔗 Dependencies

**Requires Completion Of:**
- Sprint 1: auth-service — AuthController *(independent, can run in any order)*

**Required By:**
- Sprint 3: user-service — UsersController

---

## ✅ Acceptance Criteria

- [ ] `postChangePassword` returns `200` with `{ message: "Password changed successfully." }`
- [ ] `postFcmToken` returns `200` with `{ message: "FCM token registered." }`
- [ ] `deleteFcmToken` still returns `204` with no body
- [ ] Type-check passes: `npm run type-check --workspace=packages/user-service`
- [ ] Unit tests pass: `npx jest packages/user-service/tests/unit --no-coverage`

---

## 🧪 Verification Commands

```bash
# Type-check
npm run type-check --workspace=packages/user-service

# Unit tests
npx jest packages/user-service/tests/unit --no-coverage
```

**Postman checks (requires services running):**
- `POST /api/v1/me/change-password` → `200 { "message": "Password changed successfully." }`
- `POST /api/v1/me/fcm-token` → `200 { "message": "FCM token registered." }`
- `DELETE /api/v1/me/fcm-token` → still `204` (no body)

---

## 📝 Notes

- 2 changes in 1 file — quick sprint
- `sendSuccess` is already used by `getMe`, `updateProfile`, etc. in this file — import already exists
- Sprint 2 and Sprint 3 both touch `user-service` — can combine into one type-check run at the end

---

## 🐛 Issues Encountered

**Issue:** ___
**Resolution:** ___
**Time Lost:** ___

---

**Next Sprint:** `sprint-03-user-service-userscontroller.md`
