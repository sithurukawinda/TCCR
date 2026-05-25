# Sprint 4 — Enrollment Service + Progress Service

**Sprint:** 4 of 7  
**Week:** 4  
**Focus:** Student registration queue, course enrollment, and learning progress tracking  
**Status:** `[~] In Progress`

---

## Goal

By end of Sprint 4, students can request enrollment in published courses, admins can manage the registration and enrollment queues (including bulk operations), and students can track their learning progress per subject and course.

---

## Services Involved

| Service | Port | Responsibility |
|---------|:----:|----------------|
| `enrollment-service` | 3004 | Registration queue, enrollment approvals, bulk operations, cooloff |
| `progress-service` | 3005 | Subject completion (idempotent), course progress aggregates, resume pointer |

---

## User Stories

| ID | Story | Points |
|----|-------|:------:|
| S4-01 | As a student, I can request enrollment in a published course | 3 |
| S4-02 | As a student, I cannot have two PENDING enrollments for the same course | 2 |
| S4-03 | As a student, I can view all my enrollments | 1 |
| S4-04 | As a student, I can withdraw from a course | 2 |
| S4-05 | As an admin, I can view and approve/reject pending student registrations | 3 |
| S4-06 | As an admin, I can bulk-approve multiple registrations in one request | 3 |
| S4-07 | As an admin, I can view and approve/reject pending enrollment requests | 3 |
| S4-08 | As an admin, a rejected student cannot re-enroll within the cooloff period | 3 |
| S4-09 | As a student, I can mark a subject as complete (idempotent) | 3 |
| S4-10 | As a student, `completedAt` never changes once set | 2 |
| S4-11 | As a student, I can update my last-accessed subject for resume functionality | 1 |
| S4-12 | As a student, I can view my course progress with completion percentage to 1 decimal | 3 |
| S4-13 | As an admin, I can view aggregated progress for all students in a course | 2 |

**Total Points:** 31

---

## Tasks

### `packages/enrollment-service/` (:3004)

#### Domain
- [ ] `Enrollment` entity
  - Fields: `id` (`${studentUid}_${courseId}`), `studentUid`, `courseId`, `state`, `type` (`registration | enrollment`), `reason`, `rejectedAt`, `approvedAt`, `withdrawnAt`, `createdAt`, `updatedAt`
  - Methods: `approve()`, `reject(reason?)`, `withdraw()`
- [ ] `EnrollmentState` value object — `pending | approved | rejected | withdrawn`
- [ ] `IEnrollmentRepository` interface — `findById`, `findByStudentAndCourse`, `findByState` (paginated), `create`, `update`

#### Infrastructure
- [ ] `FirestoreEnrollmentRepository`
  - Document ID: `${studentUid}_${courseId}`
  - `findByStudentAndCourse` — used to check for existing PENDING
  - `findByState` — cursor-paginated, filterable by `courseId`
- [ ] `firestore.indexes.json` — `enrollments`: `state` ASC, `courseId` ASC, `createdAt` ASC

#### Inter-Service Clients
- [ ] `UserServiceClient` — `POST /internal/users/approve`, `POST /internal/users/exists`
- [ ] `CourseServiceClient` — `GET /internal/courses/:id` to verify course is PUBLISHED

#### Application
- [ ] `CreateEnrollmentUseCase`
  - Verify course is PUBLISHED (Course Service) → `404 COURSE_NOT_FOUND`
  - Check no existing PENDING enrollment → `409 ENROLLMENT_PENDING`
  - Check no existing APPROVED enrollment → `409 ALREADY_ENROLLED`
  - Create enrollment → publish `enrollment.pending` outbox event
- [ ] `ApproveRegistrationUseCase` — approve → User Service `approve` → `registration.approved` event
- [ ] `RejectRegistrationUseCase` — reject with optional reason → `registration.rejected` event
- [ ] `BulkApproveRegistrationsUseCase` — `Promise.allSettled` over `ApproveRegistrationUseCase`; return `{ approved[], failed[] }`
- [ ] `ApproveEnrollmentUseCase` — approve → `enrollment.approved` event
- [ ] `RejectEnrollmentUseCase`
  - Check cooloff: if `rejectedAt` exists and within `ENROLLMENT_REJECTION_COOLOFF_HOURS` → `422 COOLOFF_ACTIVE`
  - Reject → `enrollment.rejected` event
- [ ] `WithdrawEnrollmentUseCase` — withdraw → `enrollment.withdrawn` event (does NOT reset progress)
- [ ] `EnrollmentEventPublisher`

#### HTTP Routes
- [ ] `POST /courses/:id/enroll` (student)
- [ ] `GET /me/enrollments` (student, paginated)
- [ ] `POST /enrollments/:id/withdraw` (student)
- [ ] `GET /admin/registrations` (admin, paginated, filterable by `status`)
- [ ] `POST /admin/registrations/:id/approve` (admin)
- [ ] `POST /admin/registrations/:id/reject` (admin)
- [ ] `POST /admin/registrations/bulk-approve` (admin)
- [ ] `GET /admin/enrollments` (admin, paginated)
- [ ] `POST /admin/enrollments/:id/approve` (admin)
- [ ] `POST /admin/enrollments/:id/reject` (admin)
- [ ] `Dockerfile`, `package.json`, `tsconfig.json`

---

### `packages/progress-service/` (:3005)

#### Domain
- [ ] `SubjectProgress` entity
  - Fields: `id` (`${studentUid}_${subjectId}`), `studentUid`, `subjectId`, `courseId`, `semesterId`, `state`, `completionSource`, `completedAt`, `lastAccessedAt`
  - `completedAt` is **immutable** — never updated after first set
  - `state`: `not_started | in_progress | completed`
  - Static factory: `SubjectProgress.createNew(studentUid, subjectId)`
- [ ] `CourseProgressAggregate` — `courseId`, `studentUid`, `completedCount`, `pendingCount`, `totalSubjects`, `completionPercent` (1 decimal), `lastAccessedSubjectId`
- [ ] `IProgressRepository` — `findByStudentAndSubject`, `findByCourseAndStudent`, `upsert`, `deleteByStudentAndCourse`

#### Infrastructure
- [ ] `FirestoreProgressRepository`
  - Document ID: `${studentUid}_${subjectId}`
  - `upsert` — creates or updates; never overwrites `completedAt` if already set
- [ ] `firestore.indexes.json` — `progress`: `studentUid` ASC, `courseId` ASC, `state` ASC

#### Inter-Service Clients
- [ ] `CourseServiceClient` — `GET /internal/courses/:id/subject-count`

#### Application
- [ ] `MarkSubjectCompleteUseCase` — **idempotent**
  - Load existing record; if `state === 'completed'` → return unchanged (no write, no event)
  - Otherwise: set `state = completed`, `completedAt = now()` (only set once), `source`
  - Upsert → `progress.subjectCompleted` outbox event
- [ ] `UpdateLastAccessedUseCase` — update `lastAccessedAt` only
- [ ] `ComputeCourseProgressUseCase`
  - Parallel: `getSubjectCount(courseId)` + `findByCourseAndStudent`
  - `completionPercent = Math.round((completed / total) * 1000) / 10` (1 decimal)
  - Returns `0` when `total === 0`
  - `lastAccessedSubjectId` = `subjectId` of record with most recent `lastAccessedAt`
- [ ] `ResetProgressUseCase` — delete all progress records for (student, course); audited via outbox
- [ ] `ProgressEventPublisher`

#### Internal Endpoints
- [ ] `POST /internal/progress/reset` — body: `{ studentUid, courseId }`

#### HTTP Routes
- [ ] `POST /progress/subjects/:id/complete` (student)
- [ ] `POST /progress/subjects/:id/access` (student)
- [ ] `GET /me/progress/courses/:courseId` (student)
- [ ] `GET /me/progress/subjects/:subjectId` (student)
- [ ] `GET /admin/progress/courses/:courseId` (admin)
- [ ] `Dockerfile`, `package.json`, `tsconfig.json`

---

## Unit Tests

### Enrollment Service
| Test file | Cases |
|-----------|-------|
| `enrollment-service/tests/unit/CreateEnrollmentUseCase.test.ts` | success; course not published → 404; duplicate PENDING → 409; already enrolled → 409 |
| `enrollment-service/tests/unit/BulkApproveRegistrationsUseCase.test.ts` | all succeed; partial success; all fail |
| `enrollment-service/tests/unit/RejectEnrollmentUseCase.test.ts` | success; cooloff active → 422; not found → 404 |
| `enrollment-service/tests/unit/WithdrawEnrollmentUseCase.test.ts` | success; not found → 404; already withdrawn → 409 |

### Progress Service
| Test file | Cases |
|-----------|-------|
| `progress-service/tests/unit/MarkSubjectCompleteUseCase.test.ts` | first call → sets completedAt; second call → same completedAt (idempotent); no write on second call |
| `progress-service/tests/unit/ComputeCourseProgressUseCase.test.ts` | 0% (none completed); 33.3% (1 of 3); 100% (all); 0% when totalSubjects=0 |
| `progress-service/tests/unit/UpdateLastAccessedUseCase.test.ts` | updates lastAccessedAt only; completedAt unchanged |

---

## Integration Tests

### Enrollment Service
| Test file | Cases |
|-----------|-------|
| `enrollment-service/tests/integration/enroll.test.ts` | success → 201; duplicate PENDING → 409; student with wrong role → 403 |
| `enrollment-service/tests/integration/bulkApprove.test.ts` | partial success → correct approved/failed arrays |

### Progress Service
| Test file | Cases |
|-----------|-------|
| `progress-service/tests/integration/completeSubject.test.ts` | idempotency — same `completedAt` on second call |
| `progress-service/tests/integration/courseProgress.test.ts` | correct completionPercent; correct lastAccessedSubjectId |

---

## Acceptance Criteria

- [ ] Student cannot enroll in a DRAFT course (`404 COURSE_NOT_FOUND`)
- [ ] Two PENDING enrollments for same course returns `409 ENROLLMENT_PENDING`
- [ ] Bulk-approve returns `{ approved: [...], failed: [...] }` — partial success allowed
- [ ] Rejected student gets `422 COOLOFF_ACTIVE` within 24 hours of rejection
- [ ] `POST /progress/subjects/:id/complete` called twice: `completedAt` is identical both times
- [ ] `completionPercent` is `33.3` when 1 of 3 subjects completed
- [ ] `completionPercent` is `0.0` when `totalSubjects` is 0 (no division by zero)
- [ ] Withdrawing enrollment does NOT delete progress records
- [ ] `GET /healthz` and `GET /readyz` return `200` on both services

---

## Sprint Notes

_Use this section during the sprint to record decisions, blockers, and discoveries._

---

*Previous: [Sprint 3 — Course Service](sprint-3-course-service.md) | Next: [Sprint 5 — Storage & Notification Service](sprint-5-storage-and-notification-service.md)*
