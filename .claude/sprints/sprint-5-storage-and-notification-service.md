# Sprint 5 — Storage Service + Notification Service

**Sprint:** 5 of 7  
**Week:** 5  
**Focus:** File attachment management and all notification channels (in-app, email, push)  
**Status:** `[~] In Progress`

---

## Goal

By end of Sprint 5, admins can upload and manage file attachments on subjects. Students receive in-app notifications, emails, and push notifications for key platform events via the event-driven notification pipeline.

---

## Services Involved

| Service | Port | Responsibility |
|---------|:----:|----------------|
| `storage-service` | 3006 | File upload/download (PDF/DOC/DOCX, 25 MB max), signed URLs |
| `notification-service` | 3007 | In-app notifications, email (retry backoff), push (best-effort) |

---

## User Stories

| ID | Story | Points |
|----|-------|:------:|
| S5-01 | As an admin, I can upload a PDF, DOC, or DOCX file to a subject (max 25 MB) | 3 |
| S5-02 | As an admin, uploading an unsupported file type is rejected with 415 | 2 |
| S5-03 | As an enrolled student, I can get a short-lived download URL for an attachment | 3 |
| S5-04 | As an admin, I can delete an attachment | 1 |
| S5-05 | As a student, I receive an in-app notification when my registration is approved | 3 |
| S5-06 | As a student, I receive an email when my registration is rejected | 2 |
| S5-07 | As an admin, I receive an in-app notification when a new student registers | 2 |
| S5-08 | As a student, I receive in-app + email + push when my enrollment is approved | 3 |
| S5-09 | Email delivery retries 3 times with backoff; failure is logged but never blocks the response | 3 |
| S5-10 | Push failure is best-effort — logged as warn and not retried | 2 |
| S5-11 | As a user, I can list my notifications, mark one as read, or mark all as read | 2 |

**Total Points:** 26

---

## Tasks

### `packages/storage-service/` (:3006)

#### Infrastructure
- [ ] `CloudStorageRepository`
  - `upload(buffer, filename, mimeType, path)` → stores in Firebase Cloud Storage at `attachments/<subjectId>/<uuid>.<ext>`
  - `getSignedUrl(storagePath, expiresInMs)` → 15-minute signed URL
  - `delete(storagePath)` → removes file from bucket

#### Middleware
- [ ] `attachmentValidator` (multer)
  - `storage: multer.memoryStorage()` — keep file in memory for SDK upload
  - `limits: { fileSize: 25 * 1024 * 1024 }` — 25 MB max
  - `fileFilter` — allowed MIME types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - Unsupported MIME → `415 UNSUPPORTED_MEDIA_TYPE`
  - Oversized file → `413`

#### Inter-Service Clients
- [ ] `CourseServiceClient` — verify subject exists before upload

#### Application
- [ ] `UploadAttachmentUseCase`
  - Verify subject exists (Course Service)
  - Upload to Cloud Storage
  - Save attachment metadata to Firestore (`attachments` collection or embedded in subject)
  - Return attachment object with `id`, `filename`, `mimeType`, `sizeBytes`, `storagePath`
- [ ] `GetDownloadUrlUseCase`
  - Verify caller is enrolled student or admin (ownership check)
  - Generate 15-min signed URL via `CloudStorageRepository.getSignedUrl`
- [ ] `DeleteAttachmentUseCase`
  - Delete from Cloud Storage
  - Remove attachment record from Firestore

#### HTTP Routes
- [ ] `POST /subjects/:id/attachments` (admin) — `multipart/form-data`
- [ ] `GET /attachments/:id/download-url` (student enrolled, admin)
- [ ] `DELETE /attachments/:id` (admin)
- [ ] `Dockerfile`, `package.json`, `tsconfig.json`

---

### `packages/notification-service/` (:3007)

#### Domain
- [ ] `INotificationRepository` interface — `create`, `findByUser` (paginated), `markRead`, `markAllRead`

#### Infrastructure
- [ ] `FirestoreNotificationRepository`
  - `findByUser` — `where('userUid','==',uid).orderBy('createdAt','desc')` with cursor pagination
- [ ] `firestore.indexes.json` — `notifications`: `userUid` ASC, `createdAt` DESC
- [ ] `EmailClient` (SendGrid)
  - `sendMail({ to, subject, html })` — wraps `@sendgrid/mail`
- [ ] `FcmClient`
  - `sendPush(fcmToken, title, body)` — wraps `admin.messaging().send()`

#### Services
- [ ] `NotificationDispatcher`
  - `dispatchEmail(to, subject, body, requestId)` — 3 retries, exponential backoff (1 s, 2 s, 4 s); permanent failure logged as `error`, NOT thrown
  - `dispatchPush(fcmToken, title, body)` — single attempt; failure logged as `warn`, NOT thrown
  - Both methods are always safe to call from event handlers — they never propagate errors

#### Event Handlers (called by outbox worker via internal HTTP)
- [ ] `RegistrationApprovedHandler`
  - In-app: notify student — "Your registration has been approved"
  - Email: approval confirmation to student
- [ ] `RegistrationRejectedHandler`
  - In-app: notify student — "Your registration was not approved"
  - Email: rejection notice to student with optional reason
- [ ] `EnrollmentPendingHandler`
  - In-app: notify all admins — "A student has requested enrollment in [course]"
- [ ] `EnrollmentApprovedHandler`
  - In-app + email + push (if FCM token available): notify student
- [ ] `EnrollmentRejectedHandler`
  - In-app + email: notify student with optional reason
- [ ] `UserRegisteredHandler`
  - In-app: notify all admins — "A new student registration is pending approval"
- [ ] `AdminSuspendedHandler`
  - In-app + email: notify affected admin

#### Internal Event Receiver Endpoint
- [ ] `POST /internal/events` — receives `{ eventType, payload, requestId }` from outbox worker; routes to correct handler; authenticated with `X-Internal-Service-Key`

#### HTTP Routes
- [ ] `GET /me/notifications` (any authenticated, paginated, filterable by `read`)
- [ ] `POST /me/notifications/:id/read` (any authenticated)
- [ ] `POST /me/notifications/read-all` (any authenticated)
- [ ] `Dockerfile`, `package.json`, `tsconfig.json`

---

## Unit Tests

### Storage Service
| Test file | Cases |
|-----------|-------|
| `storage-service/tests/unit/attachmentValidator.test.ts` | valid PDF → pass; invalid MIME → 415; file > 25 MB → 413 |
| `storage-service/tests/unit/UploadAttachmentUseCase.test.ts` | success; subject not found → 404 |
| `storage-service/tests/unit/GetDownloadUrlUseCase.test.ts` | enrolled student → success; non-enrolled student → 403; 15-min expiry set |

### Notification Service
| Test file | Cases |
|-----------|-------|
| `notification-service/tests/unit/NotificationDispatcher.test.ts` | email success first try; email fails 3× → logged as error, not thrown; push failure → warn, not thrown |
| `notification-service/tests/unit/RegistrationApprovedHandler.test.ts` | in-app created; email dispatched; handler does not throw on email failure |
| `notification-service/tests/unit/EnrollmentApprovedHandler.test.ts` | in-app + email + push dispatched; push failure does not abort |
| `notification-service/tests/unit/EnrollmentPendingHandler.test.ts` | all admins receive in-app notification |

---

## Integration Tests

### Storage Service
| Test file | Cases |
|-----------|-------|
| `storage-service/tests/integration/uploadAttachment.test.ts` | PDF upload → 201; invalid type → 415; no token → 401; student → 403 |

### Notification Service
| Test file | Cases |
|-----------|-------|
| `notification-service/tests/integration/notifications.test.ts` | GET → paginated list; mark read → read=true; mark all read → all read |

---

## Acceptance Criteria

- [ ] `POST /subjects/:id/attachments` with non-PDF/DOC/DOCX returns `415 UNSUPPORTED_MEDIA_TYPE`
- [ ] `POST /subjects/:id/attachments` with file > 25 MB returns `413`
- [ ] Signed download URL expires in 15 minutes
- [ ] Non-enrolled student cannot get a download URL (`403`)
- [ ] Email failure after 3 retries: logged as `error`, handler completes normally (no throw)
- [ ] Push failure: logged as `warn`, handler completes normally (no throw)
- [ ] In-app notification is persisted even when email and push both fail
- [ ] `POST /me/notifications/read-all` returns `204` and all notifications are marked read
- [ ] `GET /healthz` and `GET /readyz` return `200` on both services

---

## Sprint Notes

_Use this section during the sprint to record decisions, blockers, and discoveries._

---

*Previous: [Sprint 4 — Enrollment & Progress Service](sprint-4-enrollment-and-progress-service.md) | Next: [Sprint 6 — Audit & Outbox Worker](sprint-6-audit-and-outbox-worker.md)*
