# Sprint 4: notification-service — NotificationController

**Plan:** Add Response Bodies to Action Endpoints
**Status:** 🟡 Not Started
**Estimated Time:** 5 min
**Actual Time:** ___ min
**Started:** ___
**Completed:** ___

---

## 🎯 Sprint Goal

Update the `markAllRead` endpoint in `NotificationController` to return `200 OK` with a confirmation message body instead of `204 No Content`. This is the final sprint.

---

## 📋 Tasks

- [ ] Open `packages/notification-service/src/http/controllers/NotificationController.ts`
- [ ] Verify `sendSuccess` is imported from `@shared/response` — add import if missing:
  ```typescript
  import { sendSuccess } from '@shared/response';
  ```
- [ ] `markAllRead` (~line 33): replace `res.status(204).send()` with:
  ```typescript
  sendSuccess(res, { message: 'All notifications marked as read.' });
  ```
- [ ] Type-check: `npm run type-check --workspace=packages/notification-service`
- [ ] Unit tests: `npx jest packages/notification-service/tests/unit --no-coverage`

---

## 📁 Files to Modify

**Modified Files:**
- `packages/notification-service/src/http/controllers/NotificationController.ts`

---

## 🔗 Dependencies

**Requires Completion Of:**
- Sprint 1, 2, 3 *(independent — can be done in any order)*

**Required By:** Nothing (final sprint — leads to verification)

---

## ✅ Acceptance Criteria

- [ ] `markAllRead` returns `200` with `{ message: "All notifications marked as read." }`
- [ ] Type-check passes: `npm run type-check --workspace=packages/notification-service`
- [ ] Unit tests pass: `npx jest packages/notification-service/tests/unit --no-coverage`

---

## 🧪 Verification Commands

```bash
# Type-check
npm run type-check --workspace=packages/notification-service

# Unit tests
npx jest packages/notification-service/tests/unit --no-coverage
```

**Postman check (requires services running):**
- `POST /api/v1/me/notifications/read-all` → `200 { "message": "All notifications marked as read." }`

---

## 📝 Notes

- Smallest sprint — 1 change in 1 file
- After this sprint, run the final verification checklist from the plan
- Then commit all 4 services and push to develop

---

## 🐛 Issues Encountered

**Issue:** ___
**Resolution:** ___
**Time Lost:** ___

---

## 📊 Final Verification (after all sprints complete)

Run everything together before committing:

```bash
# All type-checks
npm run type-check --workspace=packages/auth-service
npm run type-check --workspace=packages/user-service
npm run type-check --workspace=packages/notification-service

# All unit tests
npx jest packages/auth-service/tests/unit --no-coverage
npx jest packages/user-service/tests/unit --no-coverage
npx jest packages/notification-service/tests/unit --no-coverage

# Commit and push
git add packages/auth-service packages/user-service packages/notification-service
git commit -m "feat: return 200 with message body on all action endpoints"
git push origin develop
```

---

**All sprints complete — ready to commit! 🎉**
