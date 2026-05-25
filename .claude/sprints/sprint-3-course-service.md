# Sprint 3 — Course Service

**Sprint:** 3 of 7  
**Week:** 3  
**Focus:** Course lifecycle, semesters, subjects, and content structure  
**Status:** `[~] In Progress`

---

## Goal

By end of Sprint 3, admins can create and manage courses with the full DRAFT → PUBLISHED → ARCHIVED lifecycle. Students can browse the published course catalog. The course content hierarchy (Course → Semester → Subject) is fully operational.

---

## Services Involved

| Service | Port | Responsibility |
|---------|:----:|----------------|
| `course-service` | 3003 | Courses, Semesters, Subjects, lifecycle state machine |

---

## User Stories

| ID | Story | Points |
|----|-------|:------:|
| S3-01 | As an admin, I can create a course in DRAFT state | 2 |
| S3-02 | As an admin, I can update a course's title, description, and cover image | 1 |
| S3-03 | As an admin, I can publish a DRAFT course that has at least one semester with subjects | 3 |
| S3-04 | As an admin, I cannot publish a course with no semesters | 2 |
| S3-05 | As an admin, I cannot publish a course if any semester has no subjects | 2 |
| S3-06 | As an admin, I can unpublish a PUBLISHED course back to DRAFT | 2 |
| S3-07 | As an admin, I can archive a PUBLISHED course | 2 |
| S3-08 | As an admin, I can soft-delete a course (recoverable within 30 days) | 2 |
| S3-09 | As a student, I can browse only PUBLISHED courses | 2 |
| S3-10 | As a student, accessing a DRAFT course returns 404 | 2 |
| S3-11 | As an admin, I can add, update, and soft-delete semesters within a course | 3 |
| S3-12 | As an admin, I can add subjects with a YouTube video ID and description | 3 |
| S3-13 | As an admin, YouTube video IDs are validated as exactly 11 valid characters | 2 |
| S3-14 | As an admin, I can soft-delete subjects | 1 |

**Total Points:** 29

---

## Tasks

### `packages/course-service/` (:3003)

#### Domain
- [ ] `Course` entity
  - Fields: `id`, `title`, `titleSlug`, `description`, `coverImageUrl`, `state`, `createdBy`, `createdByName`, `semesterCount`, `publishedAt`, `deletedAt`, `createdAt`, `updatedAt`
  - Methods: `publish()`, `unpublish()`, `archive()`, `softDelete()`
  - State machine enforced inside entity methods — invalid transitions throw domain errors
- [ ] `CourseState` value object — `draft | published | archived`
- [ ] `Semester` entity — `id`, `courseId`, `title`, `description`, `subjectCount`, `order`, `deletedAt`
- [ ] `Subject` entity — `id`, `semesterId`, `courseId`, `title`, `description`, `youtubeVideoId`, `attachmentIds`, `order`, `deletedAt`
- [ ] `YouTubeVideoId` value object — validates 11-char `[A-Za-z0-9_-]`; `YouTubeVideoId.from(input)` throws `400 INVALID_YOUTUBE_ID` on failure
- [ ] `Attachment` value object — `id`, `filename`, `mimeType`, `sizeBytes`
- [ ] `ICourseRepository` interface — `findById`, `findPublished` (cursor-paginated), `findAll` (admin), `create`, `update`, `softDelete`
- [ ] `ISemesterRepository` interface — `findById`, `findByCourseId`, `create`, `update`, `softDelete`
- [ ] `ISubjectRepository` interface — `findById`, `findBySemesterId`, `create`, `update`, `softDelete`

#### Infrastructure
- [ ] `FirestoreCourseRepository`
  - `findPublished` — `where('state','==','published').where('deletedAt','==',null).orderBy('publishedAt','desc')` with cursor
  - `findAll` — admin view, all states, no `deletedAt` filter
  - `toDomain` / `toFirestore` mapping; `publishedAt` Timestamp → ISO string
- [ ] `FirestoreSemesterRepository`
- [ ] `FirestoreSubjectRepository`
- [ ] `FirestoreOutboxRepository` (for atomic batch writes)
- [ ] `firestore.indexes.json` — `courses`: `state` ASC, `publishedAt` DESC, `deletedAt` ASC

#### Application
- [ ] `CreateCourseUseCase` — generate UUID, set `state: draft`, write to Firestore
- [ ] `UpdateCourseUseCase` — update allowed fields only
- [ ] `PublishCourseUseCase`
  - Load semesters → guard: `length === 0` → `422 NO_SEMESTERS`
  - Guard: any semester has `subjectCount === 0` → `422 EMPTY_SEMESTER`
  - `course.publish()` → update + `course.published` outbox event
- [ ] `UnpublishCourseUseCase` — `course.unpublish()` → guard: must be PUBLISHED
- [ ] `ArchiveCourseUseCase` — `course.archive()` → guard: must be PUBLISHED
- [ ] `DeleteCourseUseCase` — `course.softDelete()` → sets `deletedAt`
- [ ] `CreateSemesterUseCase` — verify course exists, create semester, increment `course.semesterCount`
- [ ] `UpdateSemesterUseCase`
- [ ] `DeleteSemesterUseCase` — soft-delete, decrement `course.semesterCount`
- [ ] `CreateSubjectUseCase` — validate `YouTubeVideoId` if provided, create subject, increment `semester.subjectCount`
- [ ] `UpdateSubjectUseCase`
- [ ] `DeleteSubjectUseCase` — soft-delete, decrement `semester.subjectCount`
- [ ] `CourseEventPublisher`

#### Internal Endpoints
- [ ] `GET /internal/courses/:id/subject-count` — returns `{ subjectCount: number }` for Progress Service

#### HTTP Routes
- [ ] `GET /courses` (public) — paginated, published only for non-admin
- [ ] `GET /courses/:id` (public) — 404 if DRAFT + student/public
- [ ] `POST /courses` (admin)
- [ ] `PATCH /courses/:id` (admin)
- [ ] `POST /courses/:id/publish` (admin)
- [ ] `POST /courses/:id/unpublish` (admin)
- [ ] `POST /courses/:id/archive` (admin)
- [ ] `DELETE /courses/:id` (admin)
- [ ] `POST /courses/:id/semesters` (admin)
- [ ] `PATCH /semesters/:id` (admin)
- [ ] `DELETE /semesters/:id` (admin)
- [ ] `POST /semesters/:id/subjects` (admin)
- [ ] `PATCH /subjects/:id` (admin)
- [ ] `DELETE /subjects/:id` (admin)
- [ ] `Dockerfile`, `package.json`, `tsconfig.json`

---

## Unit Tests

| Test file | Cases |
|-----------|-------|
| `course-service/tests/unit/PublishCourseUseCase.test.ts` | success; no semesters → 422; empty semester → 422; already published → 409 |
| `course-service/tests/unit/ArchiveCourseUseCase.test.ts` | success; not published → 409 |
| `course-service/tests/unit/UnpublishCourseUseCase.test.ts` | success; not published → 409 |
| `course-service/tests/unit/YouTubeVideoId.test.ts` | valid 11-char ID; too short; too long; invalid chars; null/undefined → null |
| `course-service/tests/unit/CreateSemesterUseCase.test.ts` | success; course not found → 404 |
| `course-service/tests/unit/CreateSubjectUseCase.test.ts` | success; invalid YouTube ID → 400; semester not found → 404 |
| `course-service/tests/unit/DeleteCourseUseCase.test.ts` | sets deletedAt; course not found → 404 |

---

## Integration Tests

| Test file | Cases |
|-----------|-------|
| `course-service/tests/integration/publishCourse.test.ts` | full flow: create → add semester → add subject → publish → 200; no semester → 422 |
| `course-service/tests/integration/listCourses.test.ts` | student sees only PUBLISHED; admin sees all states |
| `course-service/tests/integration/getCourse.test.ts` | student gets PUBLISHED → 200; student gets DRAFT → 404 |
| `course-service/tests/integration/createSubject.test.ts` | valid YouTube ID → 201; invalid YouTube ID → 400 |

---

## Acceptance Criteria

- [ ] `POST /courses/:id/publish` returns `422 NO_SEMESTERS` when course has no semesters
- [ ] `POST /courses/:id/publish` returns `422 EMPTY_SEMESTER` when any semester has zero subjects
- [ ] `POST /courses/:id/publish` succeeds when all semesters have at least one subject
- [ ] `GET /courses` for student returns only `PUBLISHED` courses with no `deletedAt`
- [ ] `GET /courses/:id` returns `404` when course is `DRAFT` and caller is student
- [ ] Invalid YouTube video ID (not 11 chars) returns `400 INVALID_YOUTUBE_ID`
- [ ] Soft-deleted courses are excluded from all public queries
- [ ] Course state transitions only allowed by state machine (`DRAFT → PUBLISHED → ARCHIVED`, `PUBLISHED → DRAFT`)
- [ ] `GET /healthz` and `GET /readyz` return `200`

---

## Sprint Notes

_Use this section during the sprint to record decisions, blockers, and discoveries._

---

*Previous: [Sprint 2 — Gateway, Auth & User Service](sprint-2-gateway-auth-and-user-service.md) | Next: [Sprint 4 — Enrollment & Progress Service](sprint-4-enrollment-and-progress-service.md)*
