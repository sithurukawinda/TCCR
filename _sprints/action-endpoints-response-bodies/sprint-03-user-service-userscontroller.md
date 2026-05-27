# Sprint 3: user-service — UsersController

**Plan:** Add Response Bodies to Action Endpoints
**Status:** 🟡 Not Started
**Estimated Time:** 10 min
**Actual Time:** ___ min
**Started:** ___
**Completed:** ___

---

## 🎯 Sprint Goal

Update 3 action endpoints in `UsersController` (`assignRole`, `promote`, `demote`) to return `200 OK` with a meaningful JSON message body. The `delete` endpoint stays at 204 (DELETE operation).

---

## 📋 Tasks

- [ ] Open `packages/user-service/src/http/controllers/UsersController.ts`
- [ ] Verify `sendSuccess` is already imported from `@shared/response`
- [ ] `assignRole` (~line 104): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'Role updated successfully.' });
  ```
- [ ] `promote` (~line 129): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'User promoted successfully.' });
  ```
- [ ] `demote` (~line 159): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'User demoted successfully.' });
  ```

---

## ⚠️ Do NOT Change

`delete` at ~line 80 **stays 204** — it is a DELETE operation (HTTP spec: 204 = Successful DELETE).

---

## 📁 Files to Modify

**Modified Files:**
- `packages/user-service/src/http/controllers/UsersController.ts`

---

## 🔗 Dependencies

**Requires Completion Of:**
- Sprint 2: user-service — MeController *(independent, same service — run type-check together)*

**Required By:**
- Sprint 4: notification-service — NotificationController *(independent)*

---

## ✅ Acceptance Criteria

- [ ] `assignRole` returns `200` with `{ message: "Role updated successfully." }`
- [ ] `promote` returns `200` with `{ message: "User promoted successfully." }`
- [ ] `demote` returns `200` with `{ message: "User demoted successfully." }`
- [ ] `delete` still returns `204` with no body
- [ ] Type-check passes: `npm run type-check --workspace=packages/user-service`
- [ ] All unit tests pass: `npx jest packages/user-service/tests/unit --no-coverage`

---

## 🧪 Verification Commands

```bash
# Type-check (covers both Sprint 2 + Sprint 3 changes)
npm run type-check --workspace=packages/user-service

# Unit tests
npx jest packages/user-service/tests/unit --no-coverage
```

**Postman checks (requires services running):**
- `PATCH /api/v1/users/:uid/roles` → `200 { "message": "Role updated successfully." }`
- `POST /api/v1/users/:uid/promote` → `200 { "message": "User promoted successfully." }`
- `POST /api/v1/users/:uid/demote` → `200 { "message": "User demoted successfully." }`
- `DELETE /api/v1/users/:uid` → still `204` (no body)

---

## 📝 Notes

- 3 changes in 1 file
- Run type-check and unit tests once after BOTH Sprint 2 and Sprint 3 are done to save time
- `assignRole` handles both add-role and remove-role actions — the single `sendSuccess` covers both branches

---

## 🐛 Issues Encountered

**Issue:** ___
**Resolution:** ___
**Time Lost:** ___

---

**Next Sprint:** `sprint-04-notification-service-notificationcontroller.md`
