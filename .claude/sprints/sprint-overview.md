# CMP Backend — Sprint Overview

**Project:** Course Management Portal (`slp-backend`)  
**Organisation:** Future CX Lanka (Pvt) Ltd  
**Total Sprints:** 7  
**Sprint Duration:** 1 week each  
**Start Date:** 2026-05-08

---

## Sprint Map

| Sprint | Services / Focus | Duration | Status |
|--------|-----------------|----------|--------|
| [Sprint 1 — Setup & Shared Packages](sprint-1-setup-and-shared-packages.md) | Project Setup + Shared Packages | Week 1 | `[x] Complete` |
| [Sprint 2 — Gateway, Auth & User Service](sprint-2-gateway-auth-and-user-service.md) | API Gateway + Auth Service + User Service | Week 2 | `[x] Complete` |
| [Sprint 3 — Course Service](sprint-3-course-service.md) | Course Service (Courses, Semesters, Subjects) | Week 3 | `[~] In Progress` |
| [Sprint 4 — Enrollment & Progress Service](sprint-4-enrollment-and-progress-service.md) | Enrollment Service + Progress Service | Week 4 | `[~] In Progress` |
| [Sprint 5 — Storage & Notification Service](sprint-5-storage-and-notification-service.md) | Storage Service + Notification Service | Week 5 | `[~] In Progress` |
| [Sprint 6 — Audit & Outbox Worker](sprint-6-audit-and-outbox-worker.md) | Audit Service + Outbox Worker | Week 6 | `[~] In Progress` |
| [Sprint 7 — Production & CI/CD](sprint-7-production-and-cicd.md) | Firestore Indexes + Security Rules + CI/CD + Production | Week 7 | `[x] Complete` |

---

## Microservice Delivery Timeline

```
Week 1    Week 2    Week 3    Week 4    Week 5    Week 6    Week 7
─────────────────────────────────────────────────────────────────
[Setup ]
[Shared]
          [Gateway]
          [Auth   ]
          [User   ]
                    [Course ]
                              [Enroll ]
                              [Progres]
                                        [Storage]
                                        [Notify ]
                                                  [Audit  ]
                                                  [Outbox ]
                                                            [Index ]
                                                            [CI/CD ]
                                                            [Prod  ]
```

---

## Dependency Chain

```
Sprint 1 (Shared)
    ↓
Sprint 2 (Auth + User + Gateway)
    ↓
Sprint 3 (Course)
    ↓
Sprint 4 (Enrollment + Progress)   ← both depend on Course
Sprint 5 (Storage)                 ← depends on Course
    ↓
Sprint 6 (Notification + Audit + Outbox Worker)
    ↓
Sprint 7 (Production)
```

---

## Definition of Done (All Sprints)

A sprint task is **Done** when:
1. Code compiles with `npm run type-check`
2. `npm run lint` passes with zero warnings
3. Unit tests written and passing for all use cases
4. Integration tests written and passing (Firestore emulator)
5. `docker-compose up` starts the service without errors
6. `/healthz` and `/readyz` return `200`

---

*Reference: [Implementation Plan](../plan/implementation-plan.md) · [Tracker](../tracker/tracker.md)*
