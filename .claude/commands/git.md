---
name: feature-spec-creator
description: Create a feature spec file and branch for the CMP backend from a short idea
argument-hint: Short feature description (e.g. "bulk enroll students to course")
allowed-tools: Read, Write, Glob, Bash
---

# Feature Spec Creator

You are creating a feature spec for the **CMP (Course Management Portal)** backend (`slp-backend`). Follow every step in order.

## 1. Git Check

```bash
git status
```

If the working tree is dirty (any `M` or `??` lines that aren't `.claude/`), stop immediately:

> ❌ Uncommitted changes detected. Commit or stash your work first, then re-run.

## 2. Parse `$ARGUMENTS`

Derive three values from the user's input:

| Value      | Rule                                          | Example                              |
| ---------- | --------------------------------------------- | ------------------------------------ |
| **Title**  | Title Case, keep meaningful words             | "Bulk Enroll Students To Course"     |
| **Slug**   | kebab-case, a–z 0–9 hyphens only, ≤ 40 chars  | `bulk-enroll-students`               |
| **Branch** | `feature/<slug>`                              | `feature/bulk-enroll-students`       |

If the description is too vague (< 3 words, or no clear user-facing goal), ask before continuing:

> ❓ Can you clarify: which service this touches, who the actor is (student / admin / super_admin), and what problem it solves?

## 3. Create Branch

```bash
git switch -c feature/<slug>
```

If the branch already exists, append `-01`, `-02`, … until the name is free.

## 4. Load Context

**Core — always read these two:**

| File | Purpose |
|------|---------|
| `.claude/blueprint/Backend_Blueprint.md` | Architecture, Clean Architecture layers (§4), service responsibilities (§5), inter-service communication (§6), event catalogue (§7), error handling (§14), security (§15), testing strategy (§19) |
| `.claude/APIdocument/API_Document.md` | Full REST API contract — endpoint shapes, request/response schemas, error codes |

**Read by feature type:**

| Feature touches…                              | Also read                                          |
| --------------------------------------------- | -------------------------------------------------- |
| Auth / token / role changes                   | Blueprint §10 (Auth & Authorization Flow)          |
| Firestore schema / new collection             | Blueprint §11 (Data Architecture), composite index rules |
| Domain events / async side-effects            | Blueprint §7 (Event Bus), §13 (Outbox Pattern)     |
| New inter-service HTTP call                   | Blueprint §6 (Inter-Service Communication)         |
| Notifications / email / push                  | Blueprint §5.7 (Notification Service)              |
| Audit logging                                 | Blueprint §5.8 (Audit Service)                     |
| File upload / storage                         | Blueprint §5.9 (Storage Service)                   |

Only read what is relevant to the feature — don't load everything.

## 5. Identify the Owning Service

State which service(s) this feature primarily belongs to:

| Service | Port | Owns |
|---------|:----:|------|
| gateway | 3000 | Rate limiting, CORS, routing |
| auth-service | 3001 | Registration, logout, lockout |
| user-service | 3002 | User profiles, admin accounts |
| course-service | 3003 | Courses, semesters, subjects |
| enrollment-service | 3004 | Registrations, enrollments |
| progress-service | 3005 | Subject completion, progress aggregates |
| storage-service | 3006 | File attachments |
| notification-service | 3007 | In-app, email, push |
| audit-service | 3008 | Audit log |
| outbox-worker | 3009 | Event dispatching |

If the feature spans multiple services, list all of them and identify which is the primary owner.

## 6. Determine Scope

Before writing the spec, state in 2–3 sentences:

- Which Clean Architecture layers this feature touches (`http/` → `application/` → `domain/` → `infrastructure/`)
- What new endpoints, use cases, repository methods, or domain events are needed
- Whether a new Firestore composite index is required (no SQL migrations — Firestore is schemaless, but composite queries need indexes in `firestore.indexes.json`)
- Whether the outbox pattern must be used for side-effects (notifications, audit writes)

If any layer would import across the forbidden boundary (e.g., `domain/` importing from `infrastructure/`), flag it now.

## 7. Write `.claude/specs/<slug>.md`

Rules:

- **WHAT, not HOW** — describe behaviour and acceptance criteria, not implementation
- **Non-technical language** where possible — a PM should be able to read it
- **No code snippets** — reference the blueprint and API document for endpoint shapes and error codes
- Fill every section; use "N/A" only if a section genuinely doesn't apply
- Every new endpoint must follow the API contract in `API_Document.md` (REST + JSON, `/api/v1` prefix, standard error envelope)
- Security requirements must reference blueprint §15 (OWASP mitigations), not invent new ones
- Roles must be one of: `student`, `admin`, `super_admin`

Use this structure:

```markdown
# Spec: <Title>

**Slug:** <slug>
**Service(s):** <owning service(s)>
**Status:** Draft
**Date:** <today>

## Problem
<!-- What user or system problem does this solve? -->

## Actors & Roles
<!-- Who triggers this? What role is required? -->

## Acceptance Criteria
<!-- Numbered list of testable "given / when / then" statements -->

## New Endpoints
<!-- Method + path + role + description, or "none" -->

## Domain Events
<!-- Events published and consumed, or "none" -->

## Firestore Changes
<!-- New collections, fields, or composite indexes needed, or "none" -->

## Security Constraints
<!-- Role enforcement, ownership guards, rate limiting, input validation rules -->

## Non-Functional Requirements
<!-- Performance, idempotency, retry behaviour — reference blueprint NFRs by ID -->

## Out of Scope
<!-- Explicitly list what this spec does NOT cover -->
```

Save the file to `.claude/specs/<slug>.md`.

## 8. Report

```
✅ Feature spec created!

Branch:    feature/<slug>
Spec:      .claude/specs/<slug>.md
Title:     <Title>

📚 References read: <list the files you actually opened>

Owning service(s): <service name(s)>
Layers affected:   <http / application / domain / infrastructure>
New endpoint(s):   <or "none">
Domain events:     <published / consumed, or "none">
Firestore index:   <yes / no>
Outbox required:   <yes / no>

Next steps:
  1. Review .claude/specs/<slug>.md and edit as needed
  2. git add .claude/specs/<slug>.md
  3. git commit -m "spec: <Title>"
  4. Implement following blueprint §4 layer order: domain → application → infrastructure → http
```

## Errors

| Issue | Action |
| ----------------------------------------------------- | -------------------------------------------------------- |
| Dirty working tree | Abort — tell user to commit/stash first |
| Vague description (< 3 words, no clear goal) | Ask for service, actor, and goal before continuing |
| Branch name collision | Append `-01`, `-02`, … |
| `.claude/specs/` directory missing | Create it, then write the spec |
| Missing reference file | Warn and continue — don't block on missing optional refs |
| Feature conflicts with a service's bounded domain | Surface the conflict, suggest the correct owning service |
| Feature requires cross-service Firestore reads | Flag as architecture violation — use internal HTTP instead |

## Example

Input: `"admin can export enrolled students list as CSV"`

```
✅ Feature spec created!

Branch:    feature/export-enrolled-students-csv
Spec:      .claude/specs/export-enrolled-students-csv.md
Title:     Export Enrolled Students CSV

📚 References read: Backend_Blueprint.md (§5.4, §6, §14, §15), API_Document.md (enrollment endpoints)

Owning service(s): enrollment-service
Layers affected:   application (new use case), http (new endpoint)
New endpoint(s):   GET /api/v1/admin/enrollments/export?courseId=&format=csv  (admin, super_admin)
Domain events:     none
Firestore index:   no (reuses existing enrollments index)
Outbox required:   no

Next steps:
  1. Review .claude/specs/export-enrolled-students-csv.md and edit as needed
  2. git add .claude/specs/export-enrolled-students-csv.md
  3. git commit -m "spec: Export Enrolled Students CSV"
  4. Implement following blueprint §4 layer order: domain → application → infrastructure → http
```

---

v2.0.0 — adapted for CMP (`slp-backend`) microservice architecture
