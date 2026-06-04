# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

**CMP → TCCR (Course Management Portal / The Christian Center Rathmalana)** — `slp-backend`
Organisation: Future CX Lanka (Pvt) Ltd

Node.js 20 · TypeScript 5 · Express 4 · Microservice Architecture · Firebase (Firestore, Auth, Storage, FCM) · npm workspaces monorepo

**V2 (TCCR) is fully implemented.** V1 is CMP (single learning portal). V2 is TCCR — the same codebase extended with Cell Groups, Analytics, Scheduled Jobs, federated OAuth (Google/Apple), and an additive roles model. All V1 endpoints remain live; V2 adds on top. Read `.claude/Architecture/Version_02__Architecture_Overview.md` before modifying any V2 feature — it defines the full change set, migration strategy, and service boundaries.

**Git workflow:** Feature branches cut from `develop`; PRs target `develop`. `main` is the production branch — PRs to `main` come from `develop` only at release time.

---

## Commands

```bash
# V1 core dev startup (gateway + 9 services + outbox-worker; V2 services excluded — use docker-compose for full stack)
bash scripts/start.sh

# Install all workspace dependencies
npm install

# Run a single service in watch mode
npm run dev --workspace=packages/course-service

# Build a single service
npm run build --workspace=packages/course-service

# Type-check all workspaces
npm run type-check

# Lint all workspaces
npm run lint

# Format all workspaces
npm run format

# Run all unit tests
npm run test

# Run integration tests (requires Firebase emulators running)
npm run test:integration

# Run a single integration test file
npx jest --config jest.integration.config.ts packages/user-service/tests/integration/me.test.ts

# Run E2E tests (requires all services running via Docker Compose)
npm run test:e2e

# Run a single test file
npx jest packages/progress-service/tests/unit/application/ComputeCourseProgressUseCase.test.ts

# Alias for bash scripts/start.sh — starts V1 core services only (same as above)
npm run dev:all

# Start all services locally via Docker (connects to online Firebase)
docker-compose up --build

# Start all services via Docker against local Firebase emulators
# Prerequisites: npx firebase emulators:start && node scripts/seed-emulator.js
docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build

# Stop all services
docker-compose down

# Verify all 53 endpoints are reachable (requires all services running)
node scripts/smoke-test.js

# Deploy Firestore composite indexes to online Firebase (reads creds from .env.local)
node scripts/deploy-indexes-env.js

# Deploy Firestore composite indexes using GOOGLE_APPLICATION_CREDENTIALS env var
node scripts/deploy-indexes.js

# Seed online Firebase with test accounts (reads creds from .env.local)
node scripts/seed-online-env.js

# Seed emulator with test accounts (emulators must be running)
node scripts/seed-emulator.js

# Seed a single admin account in the emulator
node scripts/seed-admin.js

# Seed V2 role users (leader, g12) into emulators — run after seed-emulator.js
node scripts/seed-v2-roles.js

# Fix missing Firebase Auth account for the g12 seeded user in emulator (idempotent)
node scripts/seed-g12.js

# Seed an additional new G12 leader (newg12@cmp.com) into emulator
node scripts/seed-new-g12.js

# Seed an additional new G12 leader into online Firebase (reads creds from .env.local)
node scripts/seed-new-g12-online.js

# Regenerate the Postman collection from source (overwrites postman/CMP_Backend.postman_collection.json)
# Run this after adding new endpoints — generates 267 requests across 18 folders
node scripts/build-postman-collection.js

# Audit the Postman collection against implemented routes — reports missing/extra requests
# Compares collection URLs against actual service route files; useful after adding endpoints
node scripts/audit-postman.js

# One-time migration: backfill `roles` array on all users in online Firebase
# Usage: node scripts/migrate-roles.js path/to/serviceAccount.json
node scripts/migrate-roles.js

# V1→V2 data migrations (all idempotent — safe to re-run):
node scripts/migrations/001-backfill-roles-array.js        # role: string → roles: string[]
node scripts/migrations/002-backfill-firebase-claims.js    # Firebase custom claims → {roles[], preferredLanguage}
node scripts/migrations/003-backfill-notifications-locale.js  # set localeRendered='en' on existing notifications
node scripts/migrations/004-verify-migration.js            # validate migration results
node scripts/migrations/005-legacy-batches.js              # create 'Legacy' batch per course; backfill enrollments.batchId
node scripts/migrations/006-semester-dates.js              # set openDate=createdAt, endDate=null on semesters missing openDate
node scripts/migrations/007-backfill-leader-g12-firebase-auth.js --temp-password=Change@Me2026  # create missing Firebase Auth accounts for seeded leader/g12 users
node scripts/migrations/008-batch-semester-dates.js              # backfill batch_semesters collection for existing batches

# Live API tests — verify V2 registration behaviour (requires running services)
node scripts/test-phase1-apis.js

# Verify service endpoint availability
node scripts/verify-endpoints.js

# Seed online Firebase with test accounts (requires service account JSON path as argument)
# Usage: node scripts/seed-online.js path/to/serviceAccount.json
node scripts/seed-online.js

# Run full Postman collection automatically via Newman (clean-slate emulator run)
# Prerequisites: npx firebase emulators:start + docker-compose.local.yml stack running
# Generates HTML report at postman/newman-report.html
node scripts/newman-run.js

# Run only the Cell Service folder from the Postman collection via Newman (clean-slate emulator run)
# Prerequisites: npx firebase emulators:start + docker-compose.local.yml stack running
# Generates HTML report at postman/newman-cell-report.html
node scripts/newman-cell-service.js

# Run Postman collection via Newman directly against already-running services
# (no clean-slate setup — services must already be running)
npm run test:newman

# Run full Postman collection via Newman against local services connected to ONLINE Firebase
# (no emulator — restores seed accounts first via _restore-seeds.js, signs in against real Firebase Auth)
# Prerequisites: bash scripts/start.sh (+ cell-service + analytics-service running)
#                .env must have FIREBASE_WEB_API_KEY; FIRESTORE_EMULATOR_HOST must NOT be set
# Generates HTML report at postman/newman-report.html
node scripts/newman-run-online.js
# Run only the Analytics Service folder (21 requests) via Newman against running Docker services
# Signs in as admin/g12/leader seed accounts first; connects to online Firebase (not emulator)
# Prerequisites: docker-compose up (services running against online Firebase)
# Generates HTML report at postman/newman-analytics-filter-report.html
node scripts/newman-analytics-filter.js

# Restore all seed accounts (role, password, Firebase claims, Firestore doc) to their original state
# before running Newman against online Firebase — run once per Newman session
# Reads credentials from .env.local
node scripts/_restore-seeds.js

# Supplement smoke test — covers 10 endpoints not in smoke-test.js (lesson CRUD, password-reset verify,
# avatar upload, course restore, title search, make-admin, health probes)
# Requires all services running with online Firebase credentials
node scripts/gap-test.js

# Bash curl-based smoke test — 53 V1 endpoints including health probes for all 9 core services
# Requires bash (Git Bash / WSL on Windows) and all services running with online Firebase
bash scripts/api-test.sh

# Verify online Firebase connectivity (Firestore + Auth + outbox collection)
# Reads credentials from .env.local — run before seeding or deploying to confirm creds are valid
node scripts/check-firebase.js

# -- User management utilities (all read from .env.local for online Firebase) --

# Look up a user by email in Firebase Auth + Firestore -- shows status, roles, deletedAt
# Usage: node scripts/check-user.js <email>
node scripts/check-user.js

# Quick cross-collection search by email (users, loginAttempts, emailVerificationOtps)
# Usage: node scripts/find-user.js <email>
node scripts/find-user.js

# Soft-delete a user -- sets deletedAt + disables Firebase Auth (admin-level non-destructive disable)
# Usage: node scripts/delete-user.js <email>
node scripts/delete-user.js

# Restore a soft-deleted user -- re-enables Firebase Auth + clears deletedAt
# Usage: node scripts/restore-user.js <email>
node scripts/restore-user.js

# PERMANENT hard-delete -- purges user from ALL collections (GDPR / test cleanup). IRREVERSIBLE.
# Usage: node scripts/purge-user.js <email>
node scripts/purge-user.js

# One-shot fix: explicitly set deletedAt=null on a Firestore user doc by UID
# Usage: node scripts/fix-deleted-at.js <uid>
node scripts/fix-deleted-at.js

# -- Auth / infrastructure verification --

# SMTP smoke test -- verifies mail relay credentials and sends a test email
# Usage: node scripts/test-smtp.js [recipient@example.com]
node scripts/test-smtp.js

# Checks Google federated login backend readiness (GOOGLE_CLIENT_ID, Firebase Admin, live endpoint)
node scripts/_check-google-auth.js

# Full end-to-end login test for a uid -- marks email verified, exchanges a custom token, calls GET /me
# Usage: node scripts/test-login.js <uid>
node scripts/test-login.js

# Online system health test -- verifies key endpoints on the deployed backend (cms.api.bethelnet.au)
node scripts/test-online.js

# Live promote function test -- validates POST /users/:uid/promote role-based caller restrictions
# (g12/admin/super_admin → leader or g12; leader → g12 only; targeting admin/super_admin → 403)
# Requires all services running with online Firebase credentials
node scripts/test-promote.js

# Live demote function test -- validates POST /users/:uid/demote caller-role matrix
# (super_admin/admin → student/leader/g12; g12 → leader only; leader → g12 only)
# Requires all services running with online Firebase credentials
node scripts/test-demote.js

# -- Analytics --

# Manually trigger the analytics snapshotJob against online Firebase
# Use when analytics shows all zeros because scheduled-jobs weekly job (Sunday 02:00 UTC) has not fired yet
# Or when no cell groups have a g12LeaderUid assigned (see output warnings)
# Reads credentials from .env.local -- services do NOT need to be running
node scripts/trigger-snapshot.js

# Diagnostic: show all cell reports for a given month, grouped by cell + leader, with per-leader filter test
# Requires services running + online Firebase credentials hardcoded to seed accounts
node scripts/check-reports-data.js

# Check how many emails were sent today (outbox + notifications + OTP collections)
# Reads credentials from .env.local — useful for verifying Gmail daily quota (500/day free)
node scripts/check-emails-today.js

# -- One-time migrations / TCCR seeds --

# One-time: send email-verification links to all existing unverified Firebase Auth users
# Run ONCE after deploying the email-verification feature to production. Safe to re-run.
node scripts/send-verification-emails.js

# Seed g12leader@tccr.lk (g12) and leader@tccr.lk (leader) into online Firebase
node scripts/seed-tccr-leaders-online.js

# Verify that TCCR leader / g12 accounts exist in online Firebase Auth + Firestore
node scripts/check-tccr-users.js
```

---

## Architecture

### Monorepo Structure

```
packages/
  gateway/              # :3000  Single entry point; rate limiting, CORS, request ID, proxy
  auth-service/         # :3001  Token verification, registration, logout, lockout tracking
  user-service/         # :3002  User profiles, admin management, account lifecycle
  course-service/       # :3003  Courses → Semesters → Subjects → Lessons, course lifecycle state machine; V2: batches
  enrollment-service/   # :3004  Registration queue, enrollment approvals, bulk operations; V2: role_requests
  progress-service/     # :3005  Subject completion (idempotent), lesson completion (idempotent), course progress aggregates; V2: lesson-level tracking with auto subject rollup
  storage-service/      # :3006  File upload/download, signed URLs; attachments: PDF/DOC/DOCX max 25 MB; subject images: PNG/JPEG max 10 MB
  notification-service/ # :3007  In-app notifications, email (3-retry backoff), push (best-effort)
  audit-service/        # :3008  Append-only audit_log; purely event-driven
  outbox-worker/        #        Background worker — no HTTP port; polls outbox every 5 s
  cell-service/         # :3009  Cell groups, join requests, cell reports; V2
  analytics-service/    # :3011  Pre-aggregated weekly/monthly dashboards; V2
  scheduled-jobs/       #        Background worker — no HTTP port; batch/semester sweeps, analytics snapshots; V2
  shared/               # No Dockerfile — shared npm packages consumed by all services
k8s/                    # Kubernetes Deployment + HPA manifests (one folder per service)
postman/                # Postman collections for manual API testing
firebase.json           # Firebase CLI config — indexes, rules, emulator ports
firestore.indexes.json  # Composite indexes — required for any query combining where() + orderBy() on different fields, or filtering deletedAt + another field + ordering
firestore.rules         # Firestore security rules — update when adding new collections
storage.rules           # Firebase Storage security rules
```

### Gateway Path Rewriting

The gateway rewrites all proxied paths by stripping the `/api/v1` prefix before forwarding. A public request to `GET /api/v1/courses` becomes `GET /courses` at course-service:3003. **Routes inside each service must NOT include the `/api/v1` prefix.**

The gateway also blocks all `/api/v1/internal/*` paths with 404 before proxying — internal routes are never reachable from outside the cluster.

**Route ordering in `gateway/src/app.ts` is load-bearing.** More-specific prefixes must be registered before their broader siblings:
- `/api/v1/me/notifications/preferences` (userProxy) before `/api/v1/me/notifications` (notifyProxy); then `/api/v1/me/enrollments`, `/api/v1/me/progress`, `/api/v1/me/courses` each before `/api/v1/me`
- `/api/v1/users/:uid/audit-log` (auditProxy) before `/api/v1/users` (userProxy)
- `/api/v1/courses/:id/enroll` before `/api/v1/courses`
- `/api/v1/subjects/:id/lessons` (courseProxy), `/api/v1/subjects/:id/attachments` (storageProxy), and `/api/v1/subjects/:id/images` (storageProxy) each before `/api/v1/subjects`
- `/api/v1/lessons` after the subject sub-routes

Adding a new proxied route in the wrong order will silently send traffic to the wrong service.

**Complete route→service map** (in registration order — first match wins):

| Path prefix | Service |
|------------|---------|
| `/api/v1/auth` | auth-service (+ `authLimiter`) |
| `/api/v1/me/notifications/preferences` | user-service (must precede `/me/notifications`) |
| `/api/v1/me/notifications` | notification-service |
| `/api/v1/me/enrollments` | enrollment-service |
| `/api/v1/me/progress` | progress-service |
| `/api/v1/me/courses` | course-service (V2 — must precede `/api/v1/me` → user-service) |
| `/api/v1/me` | user-service |
| `/api/v1/users/:uid/audit-log` | audit-service (must precede `/api/v1/users`) |
| `/api/v1/users`, `/api/v1/super-admin` | user-service |
| `/api/v1/master` | user-service |
| `/api/v1/courses/:id/enroll` | enrollment-service |
| `/api/v1/courses`, `/api/v1/semesters` | course-service |
| `/api/v1/subjects/:id/lessons` | course-service |
| `/api/v1/subjects/:id/attachments` | storage-service |
| `/api/v1/subjects/:id/images` | storage-service |
| `/api/v1/subjects`, `/api/v1/lessons` | course-service |
| `/api/v1/role-requests` | enrollment-service (V2) |
| `/api/v1/batches` | course-service (V2) |
| `/api/v1/enrollments`, `/api/v1/admin/registrations`, `/api/v1/admin/enrollments` | enrollment-service |
| `/api/v1/progress`, `/api/v1/admin/progress` | progress-service |
| `/api/v1/attachments` | storage-service |
| `/api/v1/audit-log` | audit-service |
| `/api/v1/cells` | cell-service (V2) |
| `/api/v1/analytics` | analytics-service (V2) |

### Roles

**V2 additive roles model** — `roles: string[]` on every user (up from V1's single `role: string`). Users can hold multiple roles simultaneously (e.g. `["member", "student", "leader"]`). `authorize()` union-matches against the full `roles[]` array. The `role` scalar is kept for backward compatibility only — always use `roles[]` for authorization logic.

| Role | V2 Access |
|------|-----------|
| `member` | Base role all newly registered users receive; own profile, in-app notifications |
| `student` | `member` access + published courses, own enrollments, own progress |
| `leader` | Cell group leadership, cell reports |
| `g12` | G12 leader; Cell + Analytics dashboards |
| `admin` | All student access + user management, course management, enrollment approvals |
| `super_admin` | G12-level access + select admin operations (suspend users, admin account management); does NOT inherit general admin CRUD via `authorize()` |
| `master` | Cross-org G12-level access; org-wide cell and report visibility. Does NOT inherit `super_admin` or `admin`. Managed exclusively by `super_admin` via `/master/*` endpoints |

`super_admin` does **not** inherit `admin` inside `authorize()`. The effective-role expansion is: `super_admin → [super_admin, g12, leader, student, member]` — admin is excluded. Routes that super_admin must access must **explicitly list `super_admin`** alongside `admin` (e.g. `authorize('admin', 'super_admin')`). Routes guarded by only `authorize('admin')` are inaccessible to super_admin. `master` does **not** inherit `super_admin` — they are separate authorization tracks. `master` effective expansion in `authorize()` is `[master, g12, leader, student, member]` — super_admin is excluded.

**`mustBeOwnerOrAdmin()` ownership bypass:** only `admin` in the principal's `roles[]` triggers the bypass — `super_admin` is NOT treated as admin here and must be the actual resource owner to pass.

**Registration now creates an active Member (V2).** `POST /auth/register` sets `role: 'member'`, `roles: ['member']`, `status: 'approved'` — the `pending_approval` / registration-queue flow from V1 no longer applies to new registrations. The V1 registration table (`registrations` collection) and `POST /admin/registrations/*` routes remain for existing data; new users bypass it entirely.

**Pre-registration email validation:** Before any Firebase call, `RegisterUseCase` calls `isEmailReachable(email)` (`packages/auth-service/src/utils/emailValidator.ts`) which checks MX DNS records and a disposable domain blocklist. Disposable addresses return 422 `DISPOSABLE_EMAIL`; domains with no MX record return 422 `EMAIL_DOMAIN_UNREACHABLE`. This runs first so fake emails never enter Firebase Auth.

**Federated OAuth (V2).** `POST /auth/federated/:provider` (`google` or `apple`) accepts an OAuth token, exchanges it with Firebase Auth, and returns a Firebase ID token. The OAuth token is never stored — only the resulting Firebase session is kept (NFR-SEC-006). Providers supported: `google` and `apple`.

**Emulator bypass for federated OAuth testing:** When `FIREBASE_AUTH_EMULATOR_HOST` is set and `NODE_ENV` is not `production`, both `GoogleAuthClient` and `AppleAuthClient` accept a base64-encoded JSON payload in place of a real token. Encode `{ "email": "test@example.com", "sub": "uid123", "name": "Test User" }` as base64 and pass it as the `idToken` to exercise the federated flow without real Google/Apple credentials.

**Apple private relay fallback:** When a real Apple ID token does not include an `email` claim (users who chose to hide their email), `AppleAuthClient` synthesises a private relay address: `${sub}@privaterelay.appleid.com`. Downstream code that stores or compares emails must tolerate this format.

**Apple Web OAuth flow (V2) — distinct from the mobile SDK flow above.** Web clients that cannot use the Apple SDK directly use a server-side CSRF-protected redirect flow:
1. `GET /auth/apple/init` (public) — generates a CSRF state JWT (10-minute TTL, signed with `JWT_SECRET`; falls back to a plain UUID when `JWT_SECRET` is absent in non-production) and returns the full Apple authorisation URL. The frontend redirects the user there.
2. `POST /auth/apple/callback` (public) — Apple POSTs the auth code (and `id_token`) here after user consent. Accepts both `application/x-www-form-urlencoded` (raw Apple redirect) and `application/json` (when the frontend forwards the code itself). Exchanges the code for tokens and signs the user in.
3. `POST /auth/apple/refresh` (authenticated, any role) — verify the Apple session is still active; returns 401 if the Apple refresh token has been revoked.
4. `POST /auth/apple/revoke` (authenticated, any role) — revoke Apple tokens. **Required by Apple guidelines** when a user deletes their account — apps that miss this step fail App Store review.

All four routes are proxied via the `/api/v1/auth` → auth-service gateway rule (no separate gateway entry needed).

### Clean Architecture Layers (per service)

Each service enforces a strict one-way dependency chain:

```
http/          (routes, controllers, validators)      → application
application/   (use cases, event publishers, clients) → domain
domain/        (entities, value objects, repo interfaces — zero infrastructure)
infrastructure/(Firestore repos, Firebase SDK, email clients)
```

Controllers are thin — they call one use case and delegate errors with `next(err)`. All business rules live in use cases.

**Exception — notification-service, audit-service, analytics-service, outbox-worker, and scheduled-jobs do not follow this pattern in the same way.** They have no controllers or use cases driven by HTTP. Instead they receive domain events from the outbox-worker over internal HTTP and process them through handler classes:

- `notification-service` — has `src/application/handlers/` (e.g. `UserRegisteredHandler`) that call a `NotificationDispatcher` service. Email dispatch retries 3Ã— with exponential backoff (1 s → 2 s → 4 s); failure is logged but never thrown. Push notifications are best-effort — a failure logs a warning and is silently swallowed. The service still exposes `/notifications` read endpoints for the frontend via the standard route → controller path.
- `audit-service` — has `src/application/handlers/` that write append-only entries to `audit_log` via a repository. No HTTP creation endpoint exists; entries are only created by event handlers. `GET /audit-log` supports `?actorUid=:uid` for per-user timeline filtering; `GET /users/:uid/audit-log` is the per-user timeline endpoint. Both are `authorize('admin', 'super_admin')`.
- `cell-service` (:3009, V2) — full Clean Architecture stack. 25 endpoints for cell group CRUD, ownership transfer, network reports, network members, network summary, cell report edit, member management, join request workflow, and cell report filing. `GET /cells/mine` (any authenticated role) returns only cells where the caller is a member or leader. `GET /cells/network/summary` (leader/g12/admin/super_admin) returns aggregated stats for the Reports page (stat cards, charts, by-leader table) — must be registered before `/cells/:id` routes to avoid route parameter collision. **Cell types:** `g12 | care | children | outreach` (required on create; filterable on list). **Cell states:** `active | archived` (filterable on list). Cell report idempotency: the `X-Idempotency-Key` request header value is stored as `clientReqId` on the `cell_reports` Firestore document; a composite index enforces uniqueness and the controller returns the existing report on duplicate submission. **Cell report authorization:** only the owning leader or G12 leader may file a report — both `admin` and `super_admin` are excluded at the route level (`authorize('leader', 'g12')`). Photo pre-upload (`POST /cells/:id/report-photos`) and report edit (`PATCH /cells/:id/reports/:rid`) are also restricted to `leader, g12` only. Void report (`POST /cells/:id/reports/:rid/void`) allows `leader, g12, admin` — `super_admin` is excluded. Cell report photos can be pre-uploaded via `POST /cells/:id/report-photos` (returns URLs to pass in `photoUrls[]`) or submitted inline with `POST /cells/:id/reports` as `multipart/form-data` — both routes share the same multer middleware family (`handleReportPhotos` / `handleFileReport`). **Key cell-service behaviours:** `DELETE /cells/:id` is a **hard delete** (not soft-delete/archive); authorized for the cell leader, G12 leader, admin, or super_admin — archived cells cannot be deleted. `PATCH /cells/:id/reports/:rid` enforces a **24-hour edit window** from `createdAt`; only the original filer may edit; voided reports are immutable; `clientReqId` is immutable (cannot be changed on edit). `GET /cells` is role-scoped: **G12 and leader callers see all active cells** (`active` by default — pass `?state=archived` for archived); members/students see all active cells; admins see all cells across all states. (Note: network endpoints `GET /cells/network/reports` and `GET /cells/network/members` remain scoped to the G12 leader's own network.) `GET /cells/network/reports` follows the same G12 scoping rule and accepts an optional `?role=g12|master` query parameter: `role=g12` returns own-network scope; `role=master` returns org-wide scope and requires either the `master` role or an active TMA (`Principal.tempMasterAccess === true`) — any other value returns `400 VALIDATION_ERROR`. `GET /cells/network/summary` supports the same `?role=` parameter with the same rules. `GET /cells/network/members` follows the same scoping rule but returns member rosters grouped by cell — each entry has `cellId`, `cellName`, `cellType`, `area`, `leaderUid`, `memberCount`, and a `members[]` array enriched with live profiles from user-service (`GetNetworkMembersUseCase`). `POST /cells/:id/transfer-ownership` is restricted to `admin` only — leaders, G12s, and super_admin no longer have access. Admin may transfer the leader and/or G12 role independently; publishes `cell.ownership_transferred` to the outbox with `initiatedByOwner: false` (no auto-demotion — previous owner retains their role unless separately demoted). Cell domain events (join requests, approvals, rejections, reports filed, ownership transfer) are all wired to notify and audit handlers — see outbox table below. **External (unregistered) members:** `POST /cells/:id/members` accepts an optional `externalMembers[]` array (up to 50 entries, each `{ name: string, phone?: string }`) alongside `userUids[]`; at least one array must be non-empty. The server assigns a UUID `id` to each external member, stored on `CellGroup` as `externalMembers: ExternalMember[]`. `DELETE /cells/:id/members/:uid` disambiguates automatically — if `:uid` matches an `externalMembers[].id`, it calls `removeExternalMember()`; otherwise `removeMember()`. `memberCount` always equals `members.length + externalMembers.length`. `GET /cells/:id` returns a discriminated union in its `members[]` response: `{ type: 'registered', uid, firstName, lastName, ... }` or `{ type: 'external', id, name, phone? }`.
- `analytics-service` (:3011, V2) — reads `analytics_snapshots` written by scheduled-jobs. Exposes 6 read-only endpoints (weekly cells, attendance, meeting types, growth, participation, CSV export). No writes. Background workers (scheduled-jobs) are the sole writers to `analytics_snapshots`. **Filter params** — all 6 endpoints accept `?cellType=care|children|outreach|g12`, `?leaderUid=<uid>`, and `?g12Uid=<uid>` query params. Scope is resolved in `src/application/helpers/scope.ts` via `resolveScope(uid, roles, filters?)`: admin+`g12Uid` → `g12:<uid>` scope; admin/g12+`leaderUid` → `leader:<uid>` scope; `cellType` appends `|<type>` suffix (e.g. `org|care`, `g12:<uid>|children`). Unfiltered scope falls back to the caller's role as before. Invalid `cellType` values return `400 VALIDATION_ERROR`. `cellType`-scoped snapshots are written by the weekly `snapshotJob` — they return empty data until the next snapshot run. **Combined filter priority** — when multiple filters are passed together, `leaderUid` takes highest priority (overrides `g12Uid`), then `g12Uid`, then `cellType` is always appended as a scope suffix regardless of the base scope: `leaderUid`+`g12Uid` → `leader:<uid>`; `g12Uid`+`cellType` → `g12:<uid>|<type>`; `leaderUid`+`cellType` → `leader:<uid>|<type>`; `leaderUid`+`g12Uid`+`cellType` → `leader:<uid>|<type>`; `cellType` only → `org|<type>`.
- `scheduled-jobs` (no HTTP port, V2) — background worker running 3 `setInterval` loops: `batchSweepJob` (opens/closes batches by schedule), `semesterSweepJob` (disables semesters past `endDate`, runs once per day), `snapshotJob` (aggregates cell reports into `analytics_snapshots`, runs weekly; writes base scopes `org`, `leader:<uid>`, `g12:<uid>` **and** cellType-dimension scopes `org|care`, `org|children`, `org|outreach`, `org|g12`, plus the equivalent `leader:<uid>|<type>` and `g12:<uid>|<type>` variants — 5× more scope keys per week than before). All jobs are wrapped in `safeRun()` — failures log and continue. Direct Firestore reads (exempt from the cross-service HTTP rule, same as outbox-worker). **Job deduplication (in-memory, resets on restart):** `semesterSweepJob` uses a `YYYY-MM-DD` UTC date key so it runs at most once per UTC day regardless of restart; `snapshotJob` uses an ISO week key (`YYYY-WNN`, Monday-start) so restarting mid-week does not re-run the snapshot. `batchSweepJob` has no deduplication — it is safe to run repeatedly.

### Shared Packages

| Package | Key Exports |
|---------|------------|
| `@shared/auth-middleware` | `authenticate()`, `authorize()`, `mustBeOwnerOrAdmin()`, `AuthenticatedRequest`, `Principal`, `Role` |
| `@shared/errors` | `AppError`, `createHttpError()`, `fromZodError()`, `errorHandler` |
| `@shared/events` | `DomainEvent`, `OutboxEventPublisher` |
| `@shared/logger` | `logger` (Pino + redaction), `httpLogger` (pino-http) |
| `@shared/response` | `sendSuccess()`, `sendPaginated()` |
| `@shared/internal-http-client` | `createInternalClient()`, `runWithRequestId()`, `getRequestId()` |
| `@shared/health` | `healthRouter` (`/healthz`, `/readyz`) |
| `@shared/firebase` | `initFirebaseAdmin()` (idempotent) |
| `@shared/tracing` | `initTracing(serviceName)` |
| `@shared/i18n` | Locale resolver + template renderer; supports `en` / `si` / `ta` with English fallback — **package not yet created** (`packages/shared/i18n/` does not exist); do not import it until scaffolded |

**Request ID propagation:** The gateway's `requestId` middleware generates a UUID (or passes through an incoming `X-Request-Id`), stores it on `req.headers['x-request-id']`, and echoes it back on the response. Downstream services receive it as a plain HTTP header. `@shared/internal-http-client` also exports `runWithRequestId(id, fn)` / `getRequestId()` backed by `AsyncLocalStorage` — if a service wraps its request handler with `runWithRequestId`, the ID is stored in async context and `createInternalClient()`'s Axios interceptor will inject `X-Request-Id` automatically on every outbound call. This is why you never pass `requestId` through use case parameters.

### TypeScript Path Aliases

Two alias groups are in use, but they resolve differently:

- `@shared/*` — resolved at compile time via **npm workspace symlinks** (each service declares `"@shared/errors": "*"` etc. in its `package.json`). `tsconfig.base.json` has no `paths` for these. At test time, `jest.config.ts` maps them via `moduleNameMapper`.
- `@/*` → `src/*` — a TypeScript `paths` alias defined in each service's own `tsconfig.json` (not in `tsconfig.base.json`). Also mapped in `jest.config.ts` as `^@/(.*)$`.

### Service Entry Point Pattern

Every service follows the same two-file startup split:

- `src/index.ts` — calls `initFirebaseAdmin()`, `initTracing(serviceName)`, then starts the server. Excluded from coverage.
- `src/server.ts` — creates the Express app, binds to the port, attaches graceful shutdown on `SIGTERM`/`SIGINT`. Excluded from coverage.

`app.ts` is the testable unit — it wires middleware and routes without starting a server.

**Docker entrypoint:** HTTP service Dockerfiles use `CMD [“node”, “dist/server.js”]`, not `dist/index.js`. Worker services (`outbox-worker`, `scheduled-jobs`) use `CMD [“node”, “dist/worker.js”]` — they have no HTTP server. Firebase/tracing init (`index.ts`) runs first only in local dev; the Docker image entry point boots directly.

### Docker Compose Networking

When services communicate inside Docker Compose they use the service hostname, not `localhost`. The `SERVICE_*_URL` env vars in `docker-compose.yml` are set to service names (e.g., `http://course-service:3003`). In local dev (outside Docker) they resolve to `http://localhost:300X`.

**MailHog (local email capture):** `docker-compose.local.yml` adds a `mailhog` service. All outgoing emails are captured instead of being sent externally. View captured emails at `http://localhost:8025`. Services send to `mailhog:1025` (SMTP) inside Docker; this means `SMTP_HOST=mailhog` and no credentials are needed when using the local stack. The web UI is at `http://localhost:8025`.

### Dependency Injection

Manual constructor injection via a `container.ts` file per service. No DI framework. Instantiation order is always: repositories → infrastructure clients → use cases → controllers. Export a single `container` object.

### Per-Service config.ts

Every service reads environment variables in `src/config.ts` and exports a single `config` object typed `as const`. Never read `process.env` directly outside this file.

### Infrastructure Clients

Cross-service HTTP calls are wrapped in a client class under `src/infrastructure/clients/`. The class holds a private `createInternalClient()` instance and exposes typed methods. Instantiated in `container.ts` and injected into use cases.

### Controller Method Pattern

Controllers are classes with arrow-function methods (preserves `this`). Every method is `async`, accepts `(req, res, next)`, and wraps its body in `try/catch` forwarding to `next(err)`. Validate with `.safeParse()` before touching use cases.

```typescript
create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createCourseSchema.safeParse(req.body);
    if (!parsed.success) return next(fromZodError(parsed.error));
    const result = await this.createCourseUseCase.execute(parsed.data);
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
};
```

### Validator Pattern

Zod schemas live in `src/http/validators/`. Use `.safeParse()` in the controller and convert failures with `fromZodError()` from `@shared/errors` — never throw Zod errors directly.

### Value Objects

Domain-layer validation that isn't trivial belongs in a value object at `src/domain/value-objects/`. Use a private constructor and a static `from()` factory that throws `createHttpError` on invalid input. No services currently have value objects, but the pattern is:

```typescript
export class SlugValue {
  private constructor(readonly value: string) {}
  static from(input: string | null | undefined): SlugValue | null {
    if (!input) return null;
    if (!/^[a-z0-9-]+$/.test(input))
      throw createHttpError(400, 'INVALID_SLUG', 'Slug may only contain lowercase letters, digits, and hyphens.');
    return new SlugValue(input);
  }
}
```

---

## Key Patterns

### Authentication & Authorisation

- Every authenticated route applies `authenticate()` then `authorize(...roles)` from `@shared/auth-middleware`.
- `authenticate(options?)` calls `verifyIdToken(token, checkRevoked=true)` and attaches `req.principal = { uid, email, role, roles, tempReportAccess, reportsFullAccess, tempMasterAccess }` where `role` is the primary claim, `roles` is the full array (used by `authorize()` for effective-role checks), `tempReportAccess` is legacy org-wide report access, `reportsFullAccess` is permanent G12 full-org access granted by super_admin, and `tempMasterAccess` is time-limited master-level access (computed from the `tempMasterAccessExpiresAt` Firebase claim). Missing/malformed `Authorization` header returns `401 MISSING_TOKEN`; a missing `principal` inside `authorize()` (called without `authenticate()`) returns `401 UNAUTHENTICATED`.
- **Email-verification gate (V2):** After token validation, `authenticate()` rejects with **`403 EMAIL_NOT_VERIFIED`** if `decodedToken.email_verified === false`. Federated users (Google/Apple) are exempt. Use `authenticate({ allowUnverified: true })` on routes that must work before verification (`POST /auth/logout`, `POST /auth/apple/revoke`, `POST /auth/resend-verification`). New users verify via `POST /auth/verify-email` with the 6-digit OTP from their welcome email; if the OTP expires or is lost, `POST /auth/resend-verification` generates and emails a fresh one (max 5 attempts per OTP before it must be re-requested).
- `super_admin` does **not** inherit `admin` inside `authorize()` — effective expansion is `[super_admin, g12, leader, student, member]`. Routes that super_admin needs must list it explicitly. See the Roles section for full detail.
- Ownership-sensitive routes add `mustBeOwnerOrAdmin()` after `authorize()`. Only literal `admin` in `roles[]` bypasses ownership; `super_admin` does not.
- **`tryAuthenticate()`** — used on public routes where the response shape differs by role (e.g., `GET /courses` shows DRAFT courses to admins but not students). It attaches `req.principal` if a valid Bearer token is present but never rejects missing or invalid tokens. This is **not** in `@shared/auth-middleware` — copy it to `src/http/middleware/tryAuthenticate.ts` in any service that needs it (currently only course-service has one).

### Account Lockout

auth-service tracks failed sign-ins via the `loginAttempts` Firestore collection (keyed by email). After **10 failures within a 15-minute window**, the account is locked and further attempts return 403 `ACCOUNT_LOCKED`. The `POST /auth/track-failure` client-side call increments this counter after each failed Firebase sign-in. Locks clear automatically after the window expires — no admin action required.

### HTTP Status Code Policy

| Status | Trigger |
|--------|---------|
| 201 | Resource created (POST that returns the new resource) |
| 200 | Action endpoint that returns no resource — sends `{ message: '...' }` (e.g. logout, verify-email, resend-verification, approve/reject actions) |
| 204 | Successful DELETE, internal event-handler routes (`/internal/*`), and `POST /auth/password-reset` (email-enumeration prevention) |
| 400 | Zod validation failure |
| 401 | `MISSING_TOKEN` — missing/malformed `Authorization` header; `UNAUTHENTICATED` — `authorize()` called without preceding `authenticate()`; `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `INVALID_TOKEN` — Firebase verification failures |
| 403 | Valid token, wrong role or ownership |
| 404 | Resource not found (or DRAFT course accessed by student) |
| 409 | Duplicate email, duplicate enrollment, invalid state transition |
| 415 | Invalid attachment MIME type |
| 422 | Business rule violation (e.g., publish course with no subjects) |
| 429 | Rate limit exceeded |

### Logging

Never use `console.*` — the ESLint config treats it as an error (`no-console`). Unhandled promises are also a lint error (`no-floating-promises`) — always `await` or attach `.catch()`. Use `logger` from `@shared/logger` (Pino). Sensitive fields (`authorization`, `password`, `token`, `idToken`) are redacted automatically. Register `httpLogger` in `app.ts` for request/response logging.

### Middleware Order (app.ts)

Every service's `app.ts` must register middleware in this exact order or request logging and error propagation break:

```
helmet() → express.json() → httpLogger → routes → errorHandler (last)
```

The gateway additionally inserts `cors()`, `requestId`, and `generalLimiter` between `helmet()` and the route handlers. Note that `generalLimiter` is registered **after** `httpLogger` but **before** the health router, meaning health probes (`/healthz`, `/readyz`) are subject to rate limiting:

```
helmet() → cors() → requestId → httpLogger → generalLimiter → healthRouter → routes → errorHandler (last)
```

`errorHandler` must be the final middleware — Express identifies it by its four-argument signature `(err, req, res, next)`.

**Exception — the gateway does not register `errorHandler`.** It is a pure reverse proxy (`http-proxy-middleware`) with no business logic; all responses pass through from upstream services unchanged.

**Gateway CORS details:** Methods allowed: `GET, POST, PUT, PATCH, DELETE, OPTIONS`. Headers allowed: `Authorization, Content-Type, Accept-Language, X-Request-Id, X-Idempotency-Key`. Preflight OPTIONS requests return 204 and are handled entirely by `cors()` (`preflightContinue: false`). Any new request header used by a service must be added to this allowlist or browser preflight will fail silently.

### Error Handling

Always use `createHttpError(status, 'ERROR_CODE', 'Human message')` from `@shared/errors`. Never throw plain `Error`. Controllers catch and forward with `next(err)`. The global `errorHandler` (registered last in `app.ts`) sanitises 5xx responses — stack traces never reach clients.

**`AppError` property names** — `AppError` exposes `status` (number) and `errorCode` (string), **not** `statusCode` / `code`. Always use the correct names in unit-test assertions and any code that inspects a caught error:

```typescript
// ✅ correct
.rejects.toMatchObject({ status: 404, errorCode: 'USER_NOT_FOUND' })

// ❌ wrong — these properties do not exist on AppError
.rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' })
```

For multi-step operations that touch external systems (e.g., Firebase Auth then Firestore), clean up earlier writes on failure — e.g., delete the Firebase Auth user if the Firestore batch commit fails — to prevent orphaned records.

### Code Style

Prettier is configured in `.prettierrc` with non-default settings:

```
printWidth: 100        # not the common 80 — wrap at 100 chars
singleQuote: true
trailingComma: 'all'   # trailing commas on multi-line params, arrays, objects
arrowParens: 'avoid'   # omit parens for single-param arrow functions
```

### TypeScript Strictness

`tsconfig.base.json` enables `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, and `noFallthroughCasesInSwitch`. Unused imports or parameters are compile errors, not warnings.

The ESLint config enforces:
- `no-console` — error (use `logger` from `@shared/logger`)
- `no-floating-promises`, `await-thenable`, `no-misused-promises` — errors
- `no-explicit-any` — **warning** only (not an error)
- Unused variables prefixed with `_` are allowed (e.g., `_req`, `_next`)
- ESLint runs with TypeScript type-checking (`recommended-requiring-type-checking`), so type errors surface at lint time too

### Transactional Outbox Pattern

Domain events are never lost. Services write to the `outbox` Firestore collection atomically alongside primary data (using a `WriteBatch`). The outbox-worker polls every 5 seconds and dispatches to notification-service and audit-service via internal HTTP. Max 5 attempts; failed events stay as `status: 'failed'` for investigation.

`OutboxEventPublisher.publishWithBatch(event, batch?)` accepts an optional `WriteBatch`. Always pass the same batch used for the primary write so the outbox entry and the entity are committed in a single atomic operation.

**Outbox event status lifecycle:**
```
pending → processing → delivered
                  ↘ (on failure, retried up to 5Ã—, then) → failed
```
`processedAt` is set only on `delivered`. Within a single event, handlers are called **sequentially** (for-await loop) — a handler failure stops remaining handlers for that event and the event is retried on the next poll cycle. Failed events remain queryable for manual investigation.

Across a batch, the worker uses `Promise.allSettled()` so one event's failure does not abort processing of the remaining events in the same poll cycle.

The outbox-worker's `EventDispatcher` routes each event type to one or more handlers. The full event routing table. `audit.action` is the generic escape hatch for direct audit writes that don't fit a typed domain event — publish it with `actorUid`, `actorEmail`, `action`, `category`, `targetType`, `targetId`, and optional `ip` (used for operations like password changes that produce no other domain event). Extra fields pass through the `[key: string]: unknown` index on `AuditEventPayload`:

| Event type | Handlers |
|-----------|---------|
| `user.registered` | notify (`UserRegisteredHandler` — welcome email with credentials table (email + temporary password), change-password warning, `Log in to TCCR` button; in-app notification to admins "New Member Joined"; payload includes `password` and `appUrl` from `RegisterUseCase`), audit |
| `registration.approved` | user-service `/internal/users/approve`, notify, audit |
| `registration.rejected` | notify, audit |
| `enrollment.pending` | notify, audit |
| `enrollment.approved` | notify (`EnrollmentApprovedHandler` — rich HTML email with course name, optional admin note callout (omitted when blank), `Log in to TCCR` button; in-app notification mentions course title; payload enriched with student email/name + course title via fire-and-forget lookups in `ApproveEnrollmentUseCase`; optional `note` parsed from request body via `approveEnrollmentSchema`), audit |
| `enrollment.rejected` | notify (`EnrollmentRejectedHandler` — rich HTML email with course name, rejection reason callout ("No specific reason provided" when blank), encouragement to reapply, `Log in to TCCR` button; in-app notification; payload enriched same as approved; optional `reason` from request body), audit |
| `enrollment.withdrawn` | audit |
| `course.published` | notify (silently dropped — no handler in notification-service), audit |
| `progress.subjectCompleted` | audit |
| `admin.created` | notify, audit — fired by both `CreateAdminUseCase` and `CreateUserDirectlyUseCase`; payload fields: `uid`, `email`, `firstName`, `lastName`, `initialPassword?`, `promoted?`, `role?` (e.g. `'leader'`, `'g12'`, `'admin'`), `passwordResetUrl?` (Firebase reset link — generated at creation time, `null` on emulator quirk), `systemUrl?` (from `APP_URL` env var). `AdminCreatedHandler` has **three** branches: (1) `promoted: true` → short promotion email, no password; (2) `role === 'leader'` or `'g12'` → leader/g12 welcome email with credentials + "Set Your Password" button; (3) default → admin welcome email. |
| `admin.suspended` | notify, audit |
| `role.granted` | notify (`RoleGrantedHandler` — in-app notification + approval email with role label, optional admin note, next-steps, login link), audit |
| `audit.action` | audit |
| `cell.created` | audit |
| `cell.join_requested` | notify (`CellJoinRequestedHandler` — in-app notification to the cell leader that a member has requested to join), audit |
| `cell.join_approved` | notify (`CellJoinApprovedHandler` — in-app notification to the requesting member that their join request was approved), audit |
| `cell.join_rejected` | notify (`CellJoinRejectedHandler` — in-app notification to the requesting member that their join request was rejected), audit |
| `cell_report.filed` | notify (`CellReportFiledHandler` — in-app notification to the G12 leader that a cell report was filed), audit |
| `cell_report.voided` | audit |
| `cell.ownership_transferred` | notify (`CellOwnershipTransferredHandler` — in-app + email to new leader/G12; no auto-demotion — previous owner retains role unless separately demoted), audit |

**Unrouted events (published to outbox but not wired in EventDispatcher):** `role.requested` — silently skipped by the outbox-worker. Adding notify/audit coverage for role requests is a known gap.

### Firestore Collection Ownership

No service reads another service's Firestore collections directly. Cross-service data access is only via internal HTTP calls using `createInternalClient()`.

| Collection | Owning Service | Document ID |
|-----------|---------------|-------------|
| `users` | user-service | Firebase Auth UID |
| `loginAttempts` | auth-service | **email address** — unique among all collections; every other collection uses UID |
| `emailVerificationOtps` | auth-service | **email address** — stores `uid`, 6-digit `otp`, `expiresAt` (15 min TTL), `attempts` counter; consumed by POST /auth/verify-email |
| `passwordResetOtps` | auth-service | **email address** — **legacy, no longer written.** `RequestPasswordResetUseCase` now sends a direct Firebase reset link; `VerifyOtpAndResetUseCase` still reads from it but always returns `INVALID_OTP`. Kept for backward compatibility. |
| `courses` | course-service | auto UUID |
| `courses/{id}/semesters` | course-service | auto UUID |
| `courses/{id}/semesters/{id}/subjects` | course-service | auto UUID |
| `courses/{id}/batches` | course-service | auto UUID — V2; state machine: `draft → open → closed`; fields: `name`, `scheduledOpenAt`, `intakeStart`, `intakeEnd`, `capacity` (nullable int), `state` |
| `video_progress` | progress-service | `${studentUid}_${lessonId}` — V2; fields: `studentUid`, `lessonId`, `courseId`, `watchedSeconds` (int), `updatedAt`; upserted on every `POST /progress/lessons/:id/video-position` call |
| `batch_semesters` | course-service | flat collection (not sub-collection); composite key `batchId + semesterId`; fields: `batchId`, `courseId`, `semesterId`, `openDate` (YYYY-MM-DD or null), `endDate` (YYYY-MM-DD or null); written by `SetBatchSemesterDatesUseCase` / `PatchBatchSemesterDateUseCase`; read by `GetStudentCourseUseCase` to derive per-semester state |
| `lessons` | course-service | auto UUID — flat collection; fields: `title`, `description`, `youtubeVideoId` (nullable), `attachmentIds[]`, `subjectId`, `semesterId`, `courseId` foreign keys, `order` |
| `registrations` | enrollment-service | Firebase Auth UID (studentUid) — V1 legacy; new users bypass this via V2 registration |
| `role_requests` | enrollment-service | auto UUID — V2; tracks role grants for non-member roles; state machine: `pending → approved / rejected` |
| `enrollments` | enrollment-service | `${studentUid}_${courseId}` |
| `progress` | progress-service | `${studentUid}_${subjectId}` |
| `lesson_progress` | progress-service | `${studentUid}_${lessonId}` — V2; fields: `studentUid`, `lessonId`, `subjectId`, `courseId`, `semesterId`, `batchId?`, `completedAt`, `createdAt`, `updatedAt`; two composite indexes: `(courseId, studentUid)` and `(subjectId, studentUid)` |
| `notifications` | notification-service | auto UUID |
| `audit_log` | audit-service | auto UUID (append-only, immutable) |
| `outbox` | all services (write) / outbox-worker (read) | auto UUID |
| `cell_groups` | cell-service | auto UUID |
| `cell_groups/{id}/join_requests` | cell-service | auto UUID |
| `cell_groups/{id}/cell_reports` | cell-service | auto UUID; idempotency via `clientReqId` index |
| `analytics_snapshots` | analytics-service (written by scheduled-jobs) | auto UUID |

### User Entity: V2 Fields

The `User` domain entity (`packages/user-service/src/domain/entities/User.ts`) gained new fields in V2:

- `roles: UserRole[]` — mutable array replacing the immutable V1 `role` scalar for authorization logic.
- `preferredLanguage: string` — defaults to `'en'`; valid values are `'en' | 'si' | 'ta'`. Stored on the Firestore user doc and validated by `z.enum(['en','si','ta'])` in `meValidator.ts`. Updatable via `PATCH /me`.
- `providers: string[]` — sign-in providers attached to the account (e.g. `['password', 'google.com']`); populated from Firebase Auth and stored on the user doc.
- `fcmTokens: string[]` — device FCM tokens for push notifications; updated via `POST /me/fcm-token`.
- `notificationPreferences: { email: boolean; push: boolean }` — per-user notification opt-in flags; defaults `true` for both.
- `tempReportAccess: boolean` — defaults `false`; legacy flag for org-wide cell report visibility. Set/cleared by super_admin via `POST/DELETE /master/temp-access/:uid`. Propagated to `Principal.tempReportAccess` via the Firebase ID token custom claim.
- `reportsFullAccess: boolean` — defaults `false`; permanent org-wide report access granted to a G12 user by super_admin. Distinct from TMA — no expiry. Propagated to `Principal.reportsFullAccess` via Firebase custom claim.
- `tempMasterAccess: boolean` — computed at token-verification time from the `tempMasterAccessExpiresAt` Firebase custom claim. `true` when the claim exists and has not yet expired. Grants a G12 user master-level (org-wide) visibility on `GET /cells/network/summary` and `GET /cells/network/reports` when `?role=master` is passed. Managed via `POST /super-admin/g12/:uid/temp-master-access` (grant), `PATCH /super-admin/g12/:uid/temp-master-access` (extend), `DELETE /super-admin/g12/:uid/temp-master-access` (revoke) — all `authorize('super_admin')`.
- `dateOfBirth: string | null` — YYYY-MM-DD profile field used by the role-request flow.
- `gender: 'male' | 'female' | 'other' | null` — profile field.
- `address: string | null` — profile field.
- `qualifications: Qualification[]` — ordered list; `[0]` is sent with a role request. Each entry is `{ id: string; title: string; fileUrl?: string | null }`. Auto-syncs the legacy scalar fields `qualificationTitle` and `qualificationUrl` from `qualifications[0]` when updated via `PATCH /me`.

**Implemented V2 user-service endpoints:** `PATCH /me` (update profile — stores `firstName`, `lastName`, `profilePhotoUrl`, `phoneNumber`, `preferredLanguage` to Firestore), `POST /me/fcm-token` (register device FCM token — idempotent), `DELETE /me/fcm-token` (deregister), `PATCH /me/notifications/preferences` (opt-out per channel), `POST /me/providers/link` (link an OAuth provider), `DELETE /me/providers/:provider` (unlink an OAuth provider), `PATCH /users/:uid/roles` (admin/g12/super_admin direct role assignment, bypasses the role-request flow — `authorize('admin', 'g12', 'super_admin')`), `POST /users/:uid/promote` (elevate a member/leader to `leader` or `g12` — `authorize('leader', 'g12', 'admin', 'super_admin')`), `POST /users/:uid/demote` (remove a non-member role — `authorize('leader', 'g12', 'admin', 'super_admin')`; caller-role matrix enforced inside use case, see **Demote caller-role matrix** below), `GET /users/:uid` (get user by ID — `authorize('leader', 'g12', 'admin')`; leader/g12 receive 403 if the target is an admin or super_admin), `DELETE /users/:uid` (**permanently hard-deletes** Firestore doc + Firebase Auth account — `authorize('admin', 'super_admin')`; blocks self-delete and targeting admin/super_admin; admin accounts must use `DELETE /super-admin/admins/:uid` which requires `super_admin`), `POST /users/:uid/suspend` (`authorize('admin', 'super_admin')` — super_admin can both suspend and reactivate; `POST /users/:uid/reactivate` is `authorize('admin', 'super_admin')`), `POST /users` (create a leader/g12 user directly — g12/admin-initiated; always assigns `['member', <role>]` as the roles array — `authorize('g12', 'admin', 'super_admin')`), and `GET /users/summary` (all users grouped by highest role — `authorize('leader', 'g12', 'admin')`; non-admin callers are scoped to exclude admin/super_admin profiles; no pagination; response shape: `{ superAdmins[], admins[], g12[], leaders[], students[], members[], totals: { superAdmins, admins, g12, leaders, students, members, total } }` — each user includes `uid`, `firstName`, `lastName`, `displayName`, `email`, `roles[]`, `phoneNumber`, `profilePhotoUrl`, `createdAt`).

**Master role endpoints (`/master/*`) — user-service, all `authorize('super_admin')`:**

Master and super_admin are completely separate roles. Master cannot manage other masters. Only super_admin can perform master management. The gateway exposes `/api/v1/master` as its own independent route (not nested under `/api/v1/super-admin`).

- `GET /master` — returns the current active master user (`null` if none; prefers non-suspended).
- `POST /master/assign` — assign `master` role to an **existing Member, Student, or G12** user. Blocks leader/admin/super_admin targets (400 `INVALID_TARGET`). Singleton guard: 409 `MASTER_ALREADY_EXISTS` if an active master exists. Blocks self-assign.
- `POST /master/invite` — create a brand-new user with `['member', 'master']` roles and send a welcome email with credentials. Singleton guard applies; email uniqueness enforced.
- `POST /master/:uid/suspend` — suspend a master user account.
- `POST /master/:uid/reactivate` — reactivate a suspended master account. Singleton guard: 409 if another active master already exists.
- `DELETE /master/:uid` — **hard-delete** master user from Firestore + Firebase Auth (irreversible); target must hold the `master` role.
- `POST /master/temp-access/:uid` — set `tempReportAccess=true` on a user for temporary org-wide report access (no expiry). The user does NOT become a Master. Returns 400 `ALREADY_MASTER` if the user already holds master role.
- `DELETE /master/temp-access/:uid` — revoke `tempReportAccess` from a user.

**G12 report access endpoints (`/super-admin/g12/*`) — user-service, all `authorize('super_admin')`:**

- `POST /super-admin/g12/:uid/reports-full-access` — grant **permanent** org-wide report access to a G12 user (`reportsFullAccess=true`). No expiry — widened scope applies automatically on all network endpoints without a `?role=` param. Returns 400 `INVALID_TARGET` if target lacks `g12`, 400 `ALREADY_MASTER` if target is master.
- `DELETE /super-admin/g12/:uid/reports-full-access` — revoke permanent org-wide report access (`reportsFullAccess=false`).
- `POST /super-admin/g12/:uid/temp-master-access` — grant **Temporary Master Access (TMA)** with an `expiresAt` timestamp. G12 user can then pass `?role=master` on network endpoints after token refresh. Returns 400 `INVALID_TARGET` / `ALREADY_MASTER` / `INVALID_EXPIRY`.
- `PATCH /super-admin/g12/:uid/temp-master-access` — extend TMA expiry. Returns 400 `NO_TEMP_ACCESS` if no active grant.
- `DELETE /super-admin/g12/:uid/temp-master-access` — revoke TMA immediately; Firebase claim cleared; G12 reverts to own-network after token refresh.

**Access control comparison — three distinct G12 elevation mechanisms:**

| Permission | Endpoint | Expiry | Activates `?role=master` | Audit logged |
|-----------|----------|--------|--------------------------|-------------|
| `tempReportAccess` | `POST /master/temp-access/:uid` | None | No | No |
| `reportsFullAccess` | `POST /super-admin/g12/:uid/reports-full-access` | None | No | Yes |
| TMA (`tempMasterAccess`) | `POST /super-admin/g12/:uid/temp-master-access` | Yes — `expiresAt` required | **Yes** | Yes |

**Singleton invariant:** Only ONE active (non-suspended) master may exist at a time. `AssignMasterUseCase` and `InviteMasterUseCase` both check `findAll({ roleInArray: 'master' })` and reject with 409 if an active master is found.

All master role mutations dual-write to both Firestore and Firebase Auth custom claims (same rule as other role mutations).

**`GET /users` query filters:** `?limit`, `?cursor`, `?role=<UserRole>`, `?status=<UserStatus>`, `?name=<prefix>` (case-sensitive prefix search on `firstName` only — not lastName). Accessible to `leader`, `g12`, and `admin` (super_admin inherits). **Scoped access:** when the caller holds only `leader` or `g12` (no admin/super_admin), `GetUsersUseCase` filters results to approved non-admin users only. The list cache key includes the caller's roles to prevent cross-role data leakage.

**`GET /users/:uid` scoped access:** same role guard as `GET /users`. `GetUserByIdUseCase` throws 403 `FORBIDDEN` if a `leader` or `g12` caller attempts to fetch the profile of an `admin` or `super_admin` user.

**Promote endpoint caller-role rules (`POST /users/:uid/promote`):** The use case enforces caller permissions beyond the route guard — `callerRoles` is passed in from `req.principal.roles` and checked inside `PromoteMemberUseCase`:
- **g12 / admin / super_admin** callers: may promote to `leader` or `g12`
- **leader** callers: may only promote to `g12` (cannot create more leaders)
- Targeting an admin or super_admin always throws 403 regardless of caller.
- Idempotent — silently returns if the target already holds the requested role.

**Role mutation dual-write rule:** Any use case that adds or removes a role (`AddRoleUseCase`, `RemoveRoleUseCase`, `PromoteMemberUseCase`) must update **both** Firestore (via `userRepo.update(user)`) AND Firebase Auth custom claims (via `authClient.addRoleToUser` / `authClient.removeRoleFromUser`). Omitting the Firebase Auth write means the token's `roles` claim is stale and `authorize()` will fail on subsequent requests until the user refreshes their token. The `FirebaseAuthClient` methods do a read-modify-write on the claims object to preserve any existing claims.

**`User.removeRole()` invariant:** The `member` role is permanently protected — `removeRole('member')` is a no-op. Do not rely on removing `member` to revoke base access; use account suspension (`suspend()`) instead.

**Demote caller-role matrix:** `super_admin` / `admin` → can demote `student`, `leader`, `g12`. `g12` → can demote `leader` only (cannot demote another `g12`). `leader` → can demote `g12` only.

When writing new use cases or Firestore repository methods that touch the `users` collection, always read/write all V2 fields alongside existing fields.

### Profile Photo Upload

`POST /api/v1/me/avatar` — multipart `photo` field, `image/jpeg` or `image/png` only, max 2 MB. Handled entirely inside user-service (not storage-service): `UploadAvatarUseCase` saves to Firebase Storage under `avatars/{uid}.{ext}` and stores the resulting public URL on the user document as `profilePhotoUrl`. **Do not use `file.makePublic()`** — projects with Uniform Bucket-Level Access enabled silently ignore it. Instead, embed a UUID download token in the file's custom metadata (`firebaseStorageDownloadTokens`) and construct the URL as `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token={token}`. This pattern is used by both `UploadAvatarUseCase` and the cell-service report-photo upload helper. The `handleAvatarUpload` multer middleware lives at `packages/user-service/src/http/middleware/avatarUpload.ts`. `multer` is a dependency of user-service (avatar), cell-service (report photos), and enrollment-service (qualification PDF upload); all other services do not use it.

### Storage: Download Authorization

`GET /api/v1/attachments/:id/download` generates a **15-minute signed URL** via Firebase Admin SDK (no direct public file access). Students receive 403 `FORBIDDEN` unless they hold an `approved` enrollment for the attachment's parent course — this check calls enrollment-service internally. Admins bypass the enrollment check. The response includes both `downloadUrl` and `expiresAt` (ISO string).

### Enrollment-Service: Two Distinct Flows

enrollment-service manages two separate domain entities and state machines:

**Registration** — tracks a student's one-time account approval by an admin:
```
pending → approve() → approved
       → reject()  → rejected
```

**Enrollment** — tracks per-course enrollment after account is approved:
```
pending → approve()  → approved → withdraw() → withdrawn
       → reject()   → rejected
        (pending also withdrawable)
```

`POST /api/v1/admin/registrations/bulk-approve` accepts up to **100** registration IDs per call. Uses `Promise.allSettled` — partial success is possible; the response separates `approved[]` from `failed[{ id, reason }]`.

**V2 enrollment aliases:** `GET /enrollments/mine` (student/leader/g12) and `POST /enrollments` (student/leader/g12) are V2 aliases for `GET /me/enrollments` and `POST /courses/:id/enroll`. Similarly, `GET /enrollments` and `POST /enrollments/:id/approve|reject` are V2 aliases for the admin enrollment paths without the `/admin/` prefix.

**Enrollment rejection cooloff:** `ENROLLMENT_REJECTION_COOLOFF_HOURS` sets a mandatory waiting period before a student whose enrollment was rejected can re-enroll in the same course. A new enrollment attempt within the cooloff window returns 409 `ENROLLMENT_REJECTED_COOLOFF`.

**Role Request (V2)** — tracks a member's request to be granted a non-member role (student, leader, g12):
```
pending → approve() → approved
       → reject()  → rejected
```
Endpoints:
- `POST /role-requests` — `application/json` with `{ requestedRole: "student" | "leader" | "g12" }`. Profile data (`dateOfBirth`, `gender`, `address`, `qualificationTitle`, `qualificationUrl`) is automatically pulled from the member's existing Firestore profile via user-service — no file upload required at submission time. The route has no multer middleware; qualification storage paths (if any) must be set separately. `authorize('member')` only.
- `GET /role-requests/mine` (`member, student, leader, g12, admin`) — returns own requests
- `GET /role-requests` (admin) — list all pending/approved/rejected requests
- `GET /role-requests/:id` (admin/super_admin) — get single role request detail
- `GET /role-requests/:id/qualification` (admin) — download the qualification PDF as a 15-minute signed URL (response includes `downloadUrl` and `expiresAt`); returns 404 `ROLE_REQUEST_NOT_FOUND` if the request is missing or 404 `QUALIFICATION_NOT_FOUND` if no file was uploaded
- `POST /role-requests/:id/approve` (admin) — approve and grant role
- `POST /role-requests/:id/reject` (admin) — reject request

`CreateRoleRequestUseCase` uses `roleRequestRepo.createUnique()` to atomically check for existing pending/approved requests and create the new one in a single Firestore transaction — this closes the TOCTOU race condition that existed when the checks were separate reads before the write.

Creating a role request publishes `role.requested` to the outbox (not wired in EventDispatcher — silently skipped). Approval atomically grants the role on the user document via an internal call to user-service, enriches the outbox payload with student details (email, firstName, lastName via a fire-and-forget `getUser()` call), and publishes `role.granted` to the outbox — which IS wired to notify (`RoleGrantedHandler`) and audit.

`multer` is used by user-service (avatar upload) and cell-service (report photos). enrollment-service no longer mounts multer on the `POST /role-requests` route — qualification data is sourced from the user's profile, not uploaded at request time.

### Course Lifecycle State Machine

```
DRAFT → publish() → PUBLISHED → archive() → ARCHIVED
        ← unpublish() ←                      ↓ restore()
                                             DRAFT
```

`publish()` requires: ≥ 1 semester AND every semester has ≥ 1 subject. `restore()` transitions `archived → draft` — the course must then be re-published before it is visible again.

**Course list filtering:** `GET /courses` accepts `?state=draft|published|archived` (admin only) and `?title=<prefix>` (case-sensitive prefix search via Firestore range query `>=` / `<= + `). When `title` is supplied, results are ordered alphabetically by title instead of `createdAt`. Two composite indexes support this — `(deletedAt, title)` and `(deletedAt, state, title)` — both deployed to Firestore.

**Schema note:** `Course` has three user-defined fields: `title`, `description` (max 500 chars, default `""`), and `coverImageUrl` (URL or `null`, default `null`). `Semester` and `Subject` have only `title`. Richer per-lesson content (`description` max 2000 chars, `youtubeVideoId`, `attachmentIds`) lives on `Lesson`. There are no value objects in course-service at this time.

### Batch State Machine (V2 — course-service)

Batches are sub-documents under a course (`courses/{id}/batches`) that group enrollments by intake cohort:

```
DRAFT → open() → OPEN → close() → CLOSED
```

`CreateBatchUseCase` auto-transitions to `OPEN` if `scheduledOpenAt` is in the past at creation time. `scheduledOpenAt` cannot be changed once a batch leaves `DRAFT`. Batch fields: `name`, `scheduledOpenAt` (nullable), `intakeStart`, `intakeEnd` (ISO strings defining the enrollment window), `capacity` (nullable int). `isEnrollable()` returns `true` only when the batch is `open` AND `now` is between `intakeStart` and `intakeEnd`. Endpoints: `GET /courses/:id/batches`, `POST /courses/:id/batches`, `GET /batches/:id`, `PATCH /batches/:id`, `POST /batches/:id/open`, `POST /batches/:id/close`.

**Video position tracking (V2):** `POST /progress/lessons/:lessonId/video-position` saves `{ watchedSeconds }` to the `video_progress` collection and bumps the subject's `lastAccessedAt`. `GET /progress/lessons/:lessonId/video-position` returns the stored position so the player can resume. Both require `student`, `leader`, or `g12` role. The upsert is idempotent — subsequent POSTs overwrite `watchedSeconds` without creating new documents.

**Batch semester scheduling (V2):** Each batch can define its own open/end dates per semester via the `batch_semesters` flat collection. `PUT /courses/:courseId/batches/:batchId/semester-dates` sets all semester dates at once; `PATCH /courses/:courseId/batches/:batchId/semester-dates/:semesterId` updates one. Both are `admin` only. `GET /me/courses/:courseId` (proxied to course-service via `/api/v1/me/courses`) returns the authenticated student's course view with each semester's computed `state` — `unscheduled | upcoming | open | closed` — derived from the `batch_semesters` record for their enrolled batch. Semesters with no `batch_semesters` record return `state: "unscheduled"`.

**YouTube field validation:** The `youtubeVideoId` field on lessons accepts full YouTube URLs (not raw IDs) and extracts the 11-char ID at validation time. Supported formats: `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/embed/ID`. The extracted ID is what's stored in Firestore. Passing a raw ID directly will fail validation.

### Denormalized Counters & Ordering

`Course` carries `semesterCount` and `Semester` carries `subjectCount`. These are **not** computed on read — they are maintained by use cases:
- `CreateSemesterUseCase` increments `course.semesterCount` and saves the course in the same operation
- `DeleteSemesterUseCase` decrements it
- `CreateSubjectUseCase` increments `semester.subjectCount`; `DeleteSubjectUseCase` decrements it

Any new use case that adds or removes a semester/subject must also update the corresponding parent counter or the publish-validation counts will drift.

Both `Semester` and `Subject` have an `order` field assigned as `existing.length + 1` on create. Order is **not** resequenced after deletion — gaps are expected and callers should sort by `order` rather than treating it as a dense sequence.

### List Response Caching

course-service, user-service, audit-service, cell-service, and enrollment-service each hold an in-process `TtlCache<T>` instance (at `src/infrastructure/cache/TtlCache.ts`) that caches list responses by serialised query key:

| Service / list | TTL | Invalidation |
|----------------|-----|-------------|
| course list | 30 s | cleared on every create / update / delete / state change |
| user list | 30 s | TTL expiry only |
| audit list | 60 s | TTL expiry only (append-only collection) |
| cell list (`GET /cells`) | 30 s | cleared on create / update / delete / archive / transfer-ownership; cache key includes `uid + roles + queryParams` to prevent cross-role leakage |
| enrollment — student own (`GET /me/enrollments`) | 15 s | cleared on enroll / approve / reject / withdraw |
| enrollment — admin list (`GET /enrollments`) | 30 s | cleared on enroll / approve / reject / withdraw |
| role-request list (`GET /role-requests`) | 30 s | cleared on create / approve / reject |

No external cache (Redis) is required. The cache lives on the static property `listCache` (or `myCache`/`adminCache` for enrollment-service) of each controller class — it is shared across all requests but scoped to the process.

### Progress Idempotency

`MarkSubjectCompleteUseCase` is idempotent — if a subject is already `completed`, it returns the existing record unchanged. `completedAt` is immutable once set.

`MarkLessonCompleteUseCase` (V2) is idempotent — if the lesson is already complete, returns the existing `lesson_progress` record unchanged. On first completion it checks whether every lesson in the parent subject is now done; if so, it calls `MarkSubjectCompleteUseCase` directly (auto-rollup) — the frontend does not need a second request. Requires an approved enrollment (`EnrollmentServiceClient.isEnrolled`) and validates that the `lessonId` belongs to the stated `subjectId`/`courseId` via an internal call to course-service (`GET /internal/lessons/:id`).

`UnmarkLessonCompleteUseCase` (V2) deletes the `lesson_progress` record and, if the parent subject was previously auto-completed, reverts it to `in_progress` via `IProgressRepository.revertCompletion()` — but only when the remaining completed lessons are fewer than the total (`getLessonCount` from course-service).

`ComputeCourseProgressUseCase` calculates `completionPercent` as `Math.round((completedCount / totalSubjects) * 1000) / 10` — one decimal place (e.g. 66.7%). Returns `0` when `totalSubjects === 0`. The response also includes `lastAccessedSubjectId`, `lastAccessedAt` (the most-recently touched subject by ISO sort on `lastAccessedAt`), and three new V2 fields: `completedLessonIds[]` (IDs of all completed lessons for this student+course), `totalLessons` (total non-deleted lessons in the course via `getCourseLessonCount`), and `lessonCompletionPercent` (`Math.round(completedLessons / totalLessons * 100)` — integer, used by the course-viewer progress bar; Dashboard continues to use `completionPercent` subject-weighted).

### Login is Client-Side

There is no `/auth/login` endpoint. Login is performed client-side using the Firebase SDK — the client exchanges credentials for an ID token directly with Firebase. The backend only receives and verifies those tokens via `authenticate()`. The only server-side auth write is `POST /auth/track-failure`, which the client calls after a failed sign-in to enforce account lockout.

### Firebase Identity Toolkit REST Calls

Some Firebase Auth operations (password verification, password reset email) are not available in the Admin SDK and must be called directly via the Firebase Identity Toolkit REST API. `FirebaseAuthClient.verifyPassword` (user-service) uses this for sign-in.

The emulator branch is selected via `FIREBASE_AUTH_EMULATOR_HOST` (set automatically by `docker-compose.local.yml`). `FIREBASE_WEB_API_KEY` (client key, not service account) is required — set it in `.env`.

### Password Reset

`POST /auth/password-reset { email }` — single-step flow. `RequestPasswordResetUseCase` calls Firebase Admin `generatePasswordResetLink(email)`, then emails the link via `emailClient.sendPasswordResetEmail(email, resetLink)`. Always returns 204 regardless of whether the email exists (email enumeration prevention). If the Firebase call fails (user not found, etc.) the error is silently swallowed and no email is sent.

`POST /auth/password-reset/verify` — **deprecated, always returns `400 INVALID_OTP`**. The route is still registered for backward compatibility but `VerifyOtpAndResetUseCase` reads from `passwordResetOtps` which is never written to anymore. Safe to call — harmless no-op.

### Deletes

All content entities (courses, semesters, subjects, lessons) are now **permanently hard-deleted** — documents are removed immediately with no recovery window. The `deletedAt` field still exists in Firestore documents and queries still filter `where('deletedAt', '==', null)` for backward compatibility with any legacy soft-deleted data. `DeleteCourseUseCase` cascades: it calls `courseRepo.hardDelete(id)` which removes the course document plus all flat-collection documents for that course (semesters, subjects, lessons, batch_semesters) in a single Firestore operation.

**Course deletion has two endpoints:**
- `DELETE /courses/:id` (admin) — hard-deletes the course with cascade via `DeleteCourseUseCase`.
- `DELETE /courses/:id/hard` (super_admin) — same cascade hard-delete via `HardDeleteCourseUseCase`; requires `super_admin`. Both use `courseRepo.hardDelete()` internally.

**User deletion — all deletion endpoints are now hard deletes:**
- `DELETE /users/:uid` (admin/super_admin) — **permanently hard-deletes** a regular user from Firestore and Firebase Auth (irreversible). Blocks self-delete and targeting admin/super_admin.
- `DELETE /super-admin/admins/:uid` (super_admin) — **permanently hard-deletes** an admin account from Firestore and Firebase Auth (irreversible).

### Internal Service Communication

Synchronous calls use `createInternalClient(serviceUrl, INTERNAL_SERVICE_KEY)`, which automatically propagates `X-Request-Id`, applies a 5-second timeout, and retries once on 5xx with a 500 ms delay. The retry is tracked via a `_retried` flag on the Axios config to prevent infinite loops — a second failure surfaces immediately to the caller.

| Caller | Callee | Purpose |
|--------|--------|---------|
| auth-service | user-service | Email uniqueness check on registration |
| auth-service | enrollment-service | Create registration record after user creation (fire-and-forget) |
| enrollment-service | user-service | Update account status on approve/reject |
| enrollment-service | course-service | Verify course is PUBLISHED before enrollment |
| progress-service | course-service | Get total subject count for progress % — `GET /internal/courses/:id/subject-count` |
| progress-service | course-service | Validate lesson exists + get its subjectId/courseId/semesterId — `GET /internal/lessons/:id` (V2) |
| progress-service | course-service | Get lesson count per subject for auto-rollup threshold — `GET /internal/subjects/:id/lesson-count` (V2) |
| progress-service | course-service | Get total lesson count in course for `lessonCompletionPercent` — `GET /internal/courses/:id/lesson-count` (V2) |
| progress-service | enrollment-service | Check approved enrollment before marking lesson complete — `GET /internal/enrollments/status` (V2) |
| storage-service | course-service | Verify subject exists before upload |
| outbox-worker | user-service | Approve user account on `registration.approved` event |
| enrollment-service | user-service | Grant role on `role_requests/:id/approve` via `POST /internal/users/add-role` (V2) |
| enrollment-service | user-service | Fetch student profile (email, firstName, lastName) to enrich `enrollment.approved` / `enrollment.rejected` outbox payload via `GET /internal/users/:uid` (fire-and-forget; failure never blocks approval) |
| user-service | auth-service | Verify federated token on `POST /me/providers/link` via `POST /internal/auth/verify-token` (V2) |
| analytics-service | cell-service (Firestore direct) | Reads `cell_groups` and `cell_reports` — analytics-service is exempt from the cross-service HTTP rule (same as scheduled-jobs and outbox-worker background workers) |

### Repository Pagination Pattern

All list repository methods return `{ items, nextCursor, total }`. Cursor is the last document ID (or `null` when exhausted). Pass `cursor` to Firestore `.startAfter()` for the next page. Repository interfaces live in `src/domain/repositories/I*Repository.ts`; implementations in `src/infrastructure/repositories/Firestore*Repository.ts`. Each implementation uses a private `toEntity(id, data)` helper to convert Firestore `DocumentSnapshot` data to domain entities.

### Internal Route Auth Pattern

Every service protects its `/internal/*` routes with a local `internalAuth` middleware (`src/http/middleware/internalAuth.ts`) that validates the `X-Internal-Service-Key` header against `INTERNAL_SERVICE_KEY`. Each service has its own copy — there is no shared version. Callers use `createInternalClient()` which attaches the key automatically.

### Response Envelope Shapes

Success and error responses have **asymmetric shapes** — this is intentional:

- `sendSuccess(res, data, status?)` — sends `data` **directly** with no wrapper (e.g., `{ id, name, ... }`)
- `sendPaginated(res, items, nextCursor, total)` — wraps as `{ items, nextCursor, total }`
- Error responses always use `{ error: { code: 'ERROR_CODE', message: '...' }, requestId: '...' }`

The `requestId` is at the root of error responses (not nested inside `error`) so clients can correlate failures with server logs via `X-Request-Id`.

---

## Environment

Copy `.env.example` to `.env` (gitignored). Required variables:

> **Gateway port override:** The gateway has its own env file at `.env.gateway` (loaded by `npm run dev --workspace=packages/gateway` via the `dotenv -e` flag). It must contain `PORT=3000`. If this file is missing or has a different port the gateway binds to the wrong port and all API traffic fails silently. Firebase emulator UI also uses port 4000 — do not set `PORT=4000` in `.env.gateway`.

```
# Service identity
SERVICE_NAME, SERVICE_VERSION, PORT, NODE_ENV, LOG_LEVEL

# Firebase Admin SDK (all services)
FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
FIREBASE_STORAGE_BUCKET
FIREBASE_WEB_API_KEY                    # Firebase web client key (auth-service password reset + user-service change-password)

# Inter-service URLs (set all even if unused by a given service)
SERVICE_AUTH_URL … SERVICE_AUDIT_URL
SERVICE_CELL_URL, SERVICE_ANALYTICS_URL  # V2 services (cell-service :3009, analytics-service :3011)

# Internal service authentication
INTERNAL_SERVICE_KEY                    # shared secret for /internal/* routes

# Email (notification-service)
EMAIL_PROVIDER                          # "sendgrid" | "console" | "smtp"
SENDGRID_API_KEY, EMAIL_FROM

# Email (auth-service — OTP delivery)
SMTP_HOST, SMTP_PORT                    # defaults: smtp.gmail.com / 587
SMTP_USER, SMTP_PASS                    # SMTP credentials for password-reset and OTP emails

# Federated OAuth (auth-service — V2)
GOOGLE_CLIENT_ID                        # Google OAuth client ID for POST /auth/federated/google
APPLE_CLIENT_ID                         # Apple OAuth client ID for POST /auth/federated/apple

# Gateway
ALLOWED_ORIGINS                         # comma-separated CORS allowlist
RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX    # global rate limit (default: 200 req/min); error code RATE_LIMIT_EXCEEDED; returns RFC 6585 RateLimit-* headers
AUTH_RATE_LIMIT_MAX                     # stricter limit for /auth/* routes (default: 10 req/min); error code AUTH_RATE_LIMIT_EXCEEDED

# Service-specific
ATTACHMENT_MAX_SIZE_BYTES               # storage-service (default: 26214400)
OUTBOX_POLL_INTERVAL_SECONDS            # outbox-worker (default: 5)
OUTBOX_BATCH_SIZE                       # outbox-worker (default: 20)
APP_URL                                 # auth-service + user-service — login page link in all welcome emails (default: 'https://cms.bethelnet.au/login')
ENROLLMENT_REJECTION_COOLOFF_HOURS      # enrollment-service
BATCH_SWEEP_INTERVAL_MS                 # scheduled-jobs batchSweepJob interval (default: 60000)
SEMESTER_SWEEP_INTERVAL_MS              # scheduled-jobs semesterSweepJob interval (default: 86400000)
SNAPSHOT_CHECK_INTERVAL_MS             # scheduled-jobs snapshotJob poll interval
SNAPSHOT_HOUR_UTC                       # UTC hour to run weekly snapshot (default: 0)
SNAPSHOT_WEEKDAY                        # Day of week for snapshot (0=Sun … 6=Sat, default: 0)

# Observability
OTEL_SERVICE_NAME                       # OpenTelemetry service name for tracing
```

---

## Testing

Two Jest configs exist in the repo. A third (`jest.e2e.config.ts`) is referenced in `package.json` but has not been created yet.

| Config | Command | Scope | Timeout |
|--------|---------|-------|---------|
| `jest.config.ts` | `npm run test` | `tests/unit/**/*.test.ts` | default |
| `jest.integration.config.ts` | `npm run test:integration` | `tests/integration/**/*.test.ts` | 30 s |
| *(missing)* `jest.e2e.config.ts` | `npm run test:e2e` | `tests/e2e/**/*.test.ts` | — |

- **Unit tests** — No I/O. Mock repositories and service clients. Files live at `packages/<service>/tests/unit/application/` and `packages/<service>/tests/unit/domain/`.
- **Integration tests** — Jest + Firestore emulator. Test use cases + repositories end-to-end. Files live at `packages/<service>/tests/integration/`. Run serially (`maxWorkers: 1`) because all tests share a single emulator instance. `jest.integration.config.ts` loads `tests/integration/setup.ts` via `setupFiles` to initialise emulator environment variables before tests run.
- **E2E tests** — Supertest + all services running via Docker Compose. `jest.e2e.config.ts` must be created before `npm run test:e2e` works.
- **Firestore Security Rules** — `@firebase/rules-unit-testing`. Verify that client-side writes to `audit_log` are denied and that each service's collections enforce expected rules.

**Local seed accounts** (created by `node scripts/seed-emulator.js`, emulators must be running):

| Role | Email | Password | Status |
|------|-------|----------|--------|
| `super_admin` | `superadmin@cmp.com` | `SuperAdmin@123` | approved |
| `admin` | `admin@cmp.com` | `Admin@12345` | approved |
| `student` | `student1@cmp.com` | `Student1@123` | pending_approval |
| `student` | `student2@cmp.com` | `Student2@123` | approved |
| `leader` | `leader@cmp.com` | `Leader@12345` | approved |
| `g12` | `g12leader@cmp.com` | `G12Lead@123` | approved |

**Firebase emulator ports** (from `firebase.json`): Auth `9099`, Firestore `8080`, Storage `9199`, UI `4000` (`http://localhost:4000`).

**Postman:** Import `postman/CMP_Backend.postman_collection.json` (267 requests across 18 folders) with one of the two environment files:

| Environment file | `baseUrl` | `authBaseUrl` | `firebaseWebApiKey` |
|-----------------|-----------|--------------|-------------------|
| `CMP_Local.postman_environment.json` | `http://localhost:3000/api/v1` | `http://127.0.0.1:9099/…` | `fake-key` |
| `CMP_Online.postman_environment.json` | `https://cms.api.bethelnet.au/api/v1` | `https://identitytoolkit.googleapis.com/v1` | real key |

**Folder breakdown** (run in order — each folder's pre-request scripts set variables consumed by later folders):

| # | Folder | Requests |
|---|--------|----------|
| 0 | 🔐 Sign In (**run first** — populates all `*Token` and `*Id` vars) | 6 |
| 1 | 1️⃣ Auth Service | 16 |
| 2 | 2️⃣ User Service — Me | 11 |
| 3 | 3️⃣ User Service — Admin Manage Users | 30 |
| 4 | 4️⃣ User Service — Super Admin | 7 |
| 5 | 5️⃣ Course Service — Build a Course | 18 |
| 6 | 6️⃣ Batches (V2) | 6 |
| 7 | 7️⃣ Enrollment | 15 |
| 8 | 8️⃣ Role Requests (V2) | 9 |
| 9 | 9️⃣ Progress Service | 10 |
| 10 | 🔔 Notifications | 4 |
| 11 | 📎 Storage Service | 4 |
| 12 | 📋 Audit Log | 3 |
| 13 | ⚡ Course Lifecycle | 6 |
| 14 | 🏘 V2 — Cell Service (sub-folders: Member Search, Cell CRUD, Members, Join Requests, Cell Reports, Archive) | 42 |
| 15 | 📊 V2 — Analytics Service | 21 |
| 16 | 🏥 Health Checks | 12 |

**Collection-managed variables** (auto-set by test scripts, do not set manually): `superAdminToken`, `superAdminId`, `adminToken`, `adminId`, `leaderToken`, `leaderId`, `g12Token`, `g12Id`, `studentToken`, `student2Token`, `student2Id`, `student1Token`, `student1Id`, `userId`, `runId`, `registeredUid`, `tempMemberToken`, `federatedToken`, `adminUserId`, `promotedAdminId`, `createdLeaderId`, `createdG12Id`, `courseId`, `semesterId`, `subjectId`, `subjectId2`, `lessonId`, `batchId`, `draftBatchId`, `enrollmentId`, `enrollmentId2`, `registrationId`, `roleRequestId`, `notificationId`, `attachmentId`, `imageAttachmentId`, `cellId`, `joinRequestId`, `cellReportId`, `reportPhotoUrls`, `foundMemberUid`.

The collection is generated by `scripts/build-postman-collection.js` — rerun it after adding endpoints. The `smoke-test.js` script covers a subset of 53 endpoints; the Newman run (`node scripts/newman-run.js`) exercises the full collection against the local stack. See `postman/README.md` for full usage guide.

Use `jest.clearAllMocks()` in `beforeEach` to prevent test bleed. When typing test-fixture arrays that will be passed to use-case inputs (e.g. `callerRoles`), use `as UserRole[]` instead of `as const` — `as const` creates a `readonly` tuple that is incompatible with mutable array parameters and causes a TypeScript compile error that silently drops the entire test suite (0 tests run, no failures reported). Integration tests use the Firebase emulator — `tests/integration/setup.ts` automatically sets `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` with fake credentials, so no real Firebase project credentials are needed. Just ensure the emulators are running before `npm run test:integration`.

Coverage thresholds enforced by `jest.config.ts`: branches 70%, functions/lines/statements 80%. Coverage is **not collected** from: `index.ts`, `server.ts`, `src/infrastructure/**`, `src/http/**`, `src/app.ts`, `src/container.ts`, `src/config.ts`. Unit tests therefore live exclusively under `tests/unit/application/` and `tests/unit/domain/`.

**Unit test baseline:** 355+ tests across 80+ suites — every use case, handler, domain entity, validator, and infrastructure utility across all services (including cell-service, analytics-service, scheduled-jobs) has test coverage. Integration test suite: 99+ tests across 13+ suites.

**Gap test script** (`scripts/gap-test.js`) — supplements the smoke test by covering the 10 API doc endpoints not exercised by `smoke-test.js` (lesson CRUD, password-reset verify, avatar upload, course restore, title search, make-admin, health probes). Run with: `node scripts/gap-test.js` (requires all services running with `--online` credentials).

---

## Custom Slash Commands

Project-specific commands live in `.claude/commands/`. Use them with `/command-name` in Claude Code.

| Command | File | What it does |
|---------|------|-------------|
| `/git` | `git.md` | Create a feature spec file + git branch from a short description |
| `/new-service` | `new-service.md` | Scaffold a complete microservice (all 4 layers, Dockerfile, package.json) |
| `/new-endpoint` | `new-endpoint.md` | Add a route + controller + use case + Zod validator + container wiring |
| `/new-use-case` | `new-use-case.md` | Scaffold a use case (standard / with-event / idempotent templates) |
| `/new-event` | `new-event.md` | Add a domain event — publisher, notification handler, outbox dispatcher wiring |
| `/new-repository` | `new-repository.md` | Scaffold a Firestore repository with interface, implementation, and cursor pagination |
| `/firestore-index` | `firestore-index.md` | Generate a composite index entry for `firestore.indexes.json` |
| `/test-unit` | `test-unit.md` | Generate Jest unit tests for a use case |
| `/test-integration` | `test-integration.md` | Generate Supertest + Firestore emulator integration tests for an endpoint |
| `/test-security` | `test-security.md` | Audit a service's routes for missing auth guards and Zod validators (report only) |
| `/run-check` | `run-check.md` | Run type-check + lint + unit tests for one service or all workspaces |
| `/spec` | `spec.md` | Create feature spec file and branch from a short idea |
| `/commit-message` | `commit-message.md` | Guided git commit workflow: branch strategy, change scope, message with emoji type |
| `/create-plan` | `create-plan.md` | Save Claude's implementation plan to a dated markdown file in `_plan/` |
| `/create-sprints` | `create-sprints.md` | Break a `_plan/` file into individual sprint files under `_sprints/<name>/` |
| `/run-sprint` | `run-sprint.md` | Execute and track progress on a specific sprint (single or folder-mode batch) |

---

## Specification Files

All specification files live in `.claude/specs/`. Read the relevant spec before implementing any feature — it defines acceptance criteria, endpoints, domain events, Firestore changes, and security constraints that the implementation must satisfy.

| File | Scope | Contents |
|------|-------|----------|
| `cmp-backend.md` | Entire project | Master spec: ~60 acceptance criteria across all 10 services, endpoint inventory, domain events, Firestore schema, security constraints, NFRs, out-of-scope |
| `requirements.md` | Entire project | Full functional requirements (FR-AUTH, FR-SADM, FR-ADM, FR-STU, FR-CRS, FR-ENR, FR-LRN, FR-NOT), non-functional requirements (NFR-SEC, NFR-SCL, NFR-AVL, NFR-PRF), architectural constraints, SRS traceability table |
| `authentication-spec.md` | auth-service, shared/auth-middleware | Registration flow, login flow, logout flow, password reset, `authenticate()` middleware, `authorize()` RBAC, ownership guard, account lockout (10 attempts / 15 min), public endpoints, internal service auth |
| `deployment-spec.md` | All services | Local dev setup, environment variables reference, Dockerfile pattern, Docker Compose ports, Kubernetes Deployment + HPA config, CI/CD pipeline stages, Firebase index + rules deployment, backup/recovery targets, observability (logging, tracing, metrics, alerts) |
| `api-spec.md` | All services (via gateway) | API conventions, all 45+ endpoints with request/response schemas, HTTP status code policy, full error code reference, domain events reference |

**Feature specs** (generated by `/feature-spec-creator`) are also saved here as `<slug>.md`. When a new feature is specced, its file appears in this folder before any code is written.

When reading a spec to implement a feature:
- **Acceptance Criteria** defines what must be true — write tests against these
- **Security Constraints** defines auth/authz/validation rules — these are non-negotiable
- **Firestore Changes** lists any new composite indexes needed in `firestore.indexes.json`
- **Domain Events** lists what the outbox must publish and who consumes it
- **Out of Scope** tells you what NOT to build — do not add features listed there

---

## Known Gaps

These items are intentionally incomplete. Do not assume they are implemented.

| Item | Location | Notes |
|------|----------|-------|
| `@shared/i18n` package | `packages/shared/` | **Not created.** Do not import until scaffolded. Locale resolver + template renderer for `en`/`si`/`ta` was designed but never built. |
| `jest.e2e.config.ts` | repo root | **Missing.** `npm run test:e2e` will fail until this config is created. E2E tests under `tests/e2e/` cannot run. |
| `role.requested` outbox event | `outbox-worker/src/EventDispatcher` | Published to `outbox` by enrollment-service but **not wired** in the dispatcher — silently skipped. No notify/audit coverage for role requests. (`role.granted` is fully wired — notify + audit.) |
| `course.published` notification handler | `notification-service/src/application/handlers/` | Event fires and is delivered to notification-service but **no handler exists** — silently dropped. Students are not notified when a course is published. |

---

## Reference Documents

- **`.claude/Architecture/Version_02__Architecture_Overview.md`** — First read for any V2 work. Defines what changed from V1 to V2, service catalogue, migration strategy.
- **`.claude/blueprint/Backend_Blueprint.md`** — V1 architecture specification, implementation patterns, all use case code samples, security requirements traceability.
- **`.claude/blueprint/Version_02__Backend_Blueprint.md`** — V2 companion blueprint covering cell-service, analytics-service, scheduled-jobs, and extended service patterns.
- **`.claude/APIdocument/API_Document.md`** — Complete V1 REST API reference (all endpoints, request/response schemas, error codes). Audited and corrected to match the actual implementation.
- **`.claude/APIdocument/Version_02__API_Reference.md`** — V2 API reference covering role-requests, batches, cells, analytics, and other V2-only endpoints. Current version: 2.44.0.
- **`.claude/APIdocument/g12_master_report.md`** — G12 & Master report access API reference: `GET /cells/network/summary`, `GET /cells/network/reports` with `?role=` scoping, and all five TMA + reports-full-access super-admin endpoints. Includes role access matrix, response field reference, workflows, and error codes.
- **`.claude/tracker/tracker.md`** — Phase-by-phase implementation checklist (Phases 0—21). Update `[ ]` → `[x]` as work completes. Check this before starting any phase to understand what’s done and what’s blocked.
- **`.claude/plan/implementation-plan.md`** — Detailed implementation plan with phase dependencies and sequencing.
- **`.claude/sprints/`** — Per-sprint breakdown (`sprint-1-*.md` through `sprint-7-*.md`) with user stories and acceptance criteria.
- **`.claude/settings.local.json`** — Pre-approved PowerShell/Bash permission patterns so Claude Code does not prompt for common `npm run *`, `node *`, `docker-compose *`, and `git` operations. Edit this file (via `/update-config`) when new command patterns need approval.
- **`_plan/`** — Dated implementation plan files (e.g. `_plan/2026-05-26-action-endpoints-response-bodies.md`). Created by `/create-plan`.
- **`_sprints/`** — Per-sprint markdown files broken down from a `_plan/` file. Each subdirectory contains individual phase files and a `next-sprint.sh` automation helper. Created by `/create-sprints`, executed by `/run-sprint`.


---

## API Documentation Updates

When creating a new API endpoint or modifying an existing one, update **only the affected endpoint's section** in `.claude/APIdocument/Version_02__API_Reference.md`.

- For a **new endpoint**: add a new section for it in the appropriate place. Do not modify unrelated sections.
- For an **updated endpoint**: edit only that endpoint's existing section (path, method, parameters, request/response schema, examples, status codes, error responses).
- Do **not** rewrite, reformat, or "clean up" other endpoints' documentation, even if they look inconsistent or outdated.
- Do **not** restructure the document's overall layout, table of contents, or section ordering.
- Do **not** touch other files in `.claude/APIdocument/` (e.g. older version files like `Version_01_*`). Only `Version_02__API_Reference.md` is the active reference.
- If a change affects a shared schema or type used by multiple endpoints, update the shared definition once and reference it from the affected endpoint's section — but still do not rewrite the other endpoints that also use it.

Preserve the existing tone, heading style, and formatting conventions of the surrounding document.
