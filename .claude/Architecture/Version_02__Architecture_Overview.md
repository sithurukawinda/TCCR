# TCCR — Backend Architecture Overview
## The Christian Center Rathmalana · `tccr-backend`
**Version:** 2.0.0 | **Date:** 15 May 2026 | **Organisation:** Future CX Lanka (Pvt) Ltd
**Supersedes:** CMP Backend Blueprint v1.0.0

---

## 1. Purpose

This is the first document a new engineer reads. It answers:
1. How is V2 (TCCR) different from V1 (CMP)?
2. Which services exist, what do they own, how do they connect?
3. How do we migrate V1 data to V2 safely?

V2 is an **additive evolution** of V1. Every V1 service is preserved. Some are extended. Three new services are added (Cell Groups, Analytics, Scheduled Jobs). No V1 contract is broken — V1 endpoints serve until an explicit deprecation cycle removes them.

Companion documents:
- **TCCR Backend Blueprint v2.0** — service-by-service implementation guide with code patterns
- **TCCR API Reference v2.0** — complete endpoint contracts

---

## 2. V1 (CMP) → V2 (TCCR): Key Changes

| # | Area | V1 (CMP) | V2 (TCCR) | Architectural Impact |
|---|------|----------|-----------|---------------------|
| 1 | Product name | CMP — single learning portal | TCCR — Bible School module + Cell Groups module | Re-brand; CMP becomes the Bible School module |
| 2 | Roles model | `role: string` — one of `student / admin / super_admin` | `roles: string[]` — any combination of 6 additive roles: `member / student / leader / g12 / admin / super_admin` | Custom claim shape changes; `authorize()` middleware rewritten for union matching |
| 3 | Registration | Creates `pending_approval` Student awaiting Admin approval | Creates **active Member** that can log in immediately | Auth Service registration flow changes; old approval queue → new role_requests queue |
| 4 | Sign-in | Email + Password only | Email + Password + **Google OAuth** + **Apple Sign-In** | Two new federated sign-in endpoints; OAuth tokens discarded after Firebase exchange (NFR-SEC-006) |
| 5 | Course hierarchy | Course → Semester → Subject → Lesson | Course → **Batch** → Semester → Subject → Lesson | New `batches` sub-collection; enrollment keyed to batchId; curriculum stays on Course, not Batch |
| 6 | Semester lifecycle | Static `number` field only | Adds `openDate` + `endDate`; semester auto-disables after endDate | New scheduled job: semester end-date sweep |
| 7 | Subject content | Attachments: PDF/DOCX only | Attachments: PDF/DOCX + **PNG/JPG images** | Storage Service MIME allowlist extended |
| 8 | Enrollment | Linked to Course | Linked to Course **and** Batch; first-time enrollment coupled with role-grant atomically | Enrollment Service gains atomic approval transaction (role + enrollment in one Firestore txn) |
| 9 | Cell Groups | Did not exist | Full module: groups, members, cell reports, analytics | **NEW Cell Service** (:3010) |
| 10 | Analytics | None | Pre-aggregated weekly/monthly snapshots; dashboards | **NEW Analytics Service** (:3011) + **NEW Scheduled Jobs** (:3012) |
| 11 | Audit log | Global view — Super Admin only | Per-user timeline — Admin + Super Admin | New endpoint in Audit Service |
| 12 | Localisation | None | Sinhala + Tamil + English; per-user `preferredLanguage` | New `@shared/i18n` package; all notification templates localised |
| 13 | Provider linking | N/A | Link/unlink Google and Apple to existing email account (FR-AUTH-010) | New endpoints on User Service; `providers[]` field |
| 14 | FCM tokens | Not tracked per-device | `fcmTokens` map on user doc; per-device registration | New `POST /me/fcm-token` endpoint |
| 15 | Notification opt-out | None | Per-channel opt-out: `email` and `push` (FR-NOT-006) | `notificationPreferences` field on user doc |

---

## 3. V2 System Context

```
┌────────────────────────────────────────────────────────────────┐
│                          CLIENTS                               │
│  tccr-web (Next.js · Admin/Super Admin)                        │
│  tccr-mobile (React Native · Member/Student/Leader/G12)        │
└──────────────────────────┬─────────────────────────────────────┘
                           │  HTTPS/REST · TLS · Bearer Token
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    API GATEWAY  :3000                            │
│   Rate Limit · CORS · Request-ID · Token Forwarding             │
└──┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────────────────┘
   │    │    │    │    │    │    │    │    │    │
 :3001 :3002 :3003 :3004 :3005 :3006 :3007 :3008 :3010 :3011
 Auth  User  Crs  Enrl Prog  Stor Notif Audit Cell  Anlyt
  EXT  EXT   EXT   EXT  EXT  EXT  EXT   EXT   NEW   NEW
   │    │    │    │    │    │    │    │    │     │
   └────┴────┴────┴────┴────┴────┴────┴────┘     │
                    │                             │
                    ▼                             │
         ┌──────────────────┐         ┌───────────┘
         │  Outbox Worker   │         │  Scheduled Jobs :3012 (NEW)
         │      :3009       │         │  cron: sweep, snapshots
         └────────┬─────────┘         │
                  │                   │
   ┌──────────────▼───────────────────▼─────────────┐
   │              FIREBASE PLATFORM                  │
   │  Firestore · Auth (Pwd/Google/Apple)            │
   │  Cloud Storage · FCM + APNs                     │
   └─────────────────────────────────────────────────┘
```

**Legend:** EXT = Extended from V1 | NEW = New in V2

---

## 4. Service Catalogue

### 4.1 Extended Services (V1 → V2)

| Service | Port | Status | Key V2 Changes |
|---------|:----:|:------:|---------------|
| API Gateway | 3000 | Extended | New route prefixes: `/auth/federated/*`, `/role-requests/*`, `/batches/*`, `/cells/*`, `/analytics/*` |
| Auth Service | 3001 | Extended | Google + Apple federated sign-in; registration creates active Member; claims → `roles[]` |
| User Service | 3002 | Extended | `role:string` → `roles:string[]`; adds `preferredLanguage`, `providers[]`, `fcmTokens`, `notificationPreferences`; new `PATCH /users/:uid/roles` |
| Course Service | 3003 | Extended | Batches sub-collection; semester `openDate`/`endDate`; subject `imageUrls[]` |
| Enrollment Service | 3004 | Extended | `role_requests` collection; atomic approval (role + enrollment in one txn); `batchId` on enrollments |
| Progress Service | 3005 | Extended | `batchId` on progress records; semester `endDate` gate |
| Storage Service | 3006 | Extended | PNG/JPG MIME support; new paths for images and cell-report photos |
| Notification Service | 3007 | Extended | Localised templates (si/ta/en); new Cell module event subscriptions; respects `notificationPreferences` |
| Audit Service | 3008 | Extended | Per-user audit timeline endpoint |
| Outbox Worker | 3009 | Carry-forward | V2 event-type constants added to dispatch table |

### 4.2 New Services (V2 Only)

| Service | Port | Owns | Why Separate Service |
|---------|:----:|------|---------------------|
| Cell Service | 3010 | `cell_groups`, `cell_groups/{id}/cell_reports` | Cell Groups is a new bounded context; mobile-first, write-heavy, needs independent deployability |
| Analytics Service | 3011 | `analytics_snapshots` | Dashboard reads must complete <2s (NFR-PER-003); snapshot reads isolated from live write traffic |
| Scheduled Jobs | 3012 | No Firestore ownership; runs cron jobs | Decouples time-based work (semester sweep, snapshot generation) from request-serving services |

---

## 5. Module → Service Map

| SRS Module | Primary Service | Supporting Services |
|-----------|-----------------|---------------------|
| Auth & Account Lifecycle | Auth Service | User Service |
| Super Admin | User Service | Audit Service |
| Admin | User Service | Course, Enrollment, Audit |
| Member | User Service | Enrollment, Cell |
| Student | User Service | Course, Progress |
| Leader | User Service | Cell Service |
| G12 Leader | User Service | Cell, Analytics |
| Course Management | Course Service | Storage Service |
| Batch Management | Course Service | Enrollment Service |
| Enrollment & Role Requests | Enrollment Service | User, Course |
| Learning Experience | Progress Service | Course, Storage |
| Cell Groups | Cell Service | User Service |
| Cell Reports | Cell Service | Notification Service |
| Analytics & Dashboards | Analytics Service | Cell Service, Jobs |
| Notifications | Notification Service | All services (publish events) |
| Localisation | All services via `@shared/i18n` | Notification Service |

---

## 6. Data Ownership Map

No service reads another service's Firestore collections directly. All cross-service data flows go through HTTP or domain events.

| Collection | Owning Service | New V2? |
|-----------|---------------|:-------:|
| `users` | User Service | — |
| `role_requests` | Enrollment Service | ✅ |
| `audit_log` | Audit Service | — |
| `courses` | Course Service | — |
| `courses/{id}/batches` | Course Service | ✅ |
| `courses/{id}/semesters` | Course Service | — |
| `courses/{id}/semesters/{id}/subjects` | Course Service | — |
| `enrollments` | Enrollment Service | — |
| `progress` | Progress Service | — |
| `notifications` | Notification Service | — |
| `cell_groups` | Cell Service | ✅ |
| `cell_groups/{id}/cell_reports` | Cell Service | ✅ |
| `analytics_snapshots` | Analytics Service | ✅ |
| `outbox` | All services write; Outbox Worker reads | — |

---

## 7. Shared Packages Summary

| Package | V2 Status | Key Change |
|---------|:---------:|-----------|
| `@shared/auth-middleware` | **Amended** | `authorize()` rewritten: union match on `roles[]`; super_admin inherits admin |
| `@shared/i18n` | **NEW** | Locale resolver + template renderer (si/ta/en with English fallback) |
| `@shared/events` | **Amended** | New V2 event-type constants |
| `@shared/errors` | Carry-forward | — |
| `@shared/internal-http-client` | Carry-forward | — |
| `@shared/logger` | Carry-forward | — |
| `@shared/response` | Carry-forward | — |
| `@shared/health` | Carry-forward | — |
| `@shared/firebase` | Carry-forward | — |
| `@shared/tracing` | Carry-forward | — |

---

## 8. V1 → V2 Migration Strategy

### Phase 1 — Schema Migration (before code deploy; all scripts idempotent)

| ID | Script | Action |
|----|--------|--------|
| M1 | `001-roles-array.ts` | `users.role:string` → `users.roles:string[]`; add `member` to every user |
| M2 | `002-custom-claims.ts` | Firebase custom claims `{role}` → `{roles:[], preferredLanguage:'en'}` |
| M3 | `003-language-backfill.ts` | Set `preferredLanguage='en'` where missing |
| M4 | `004-providers-backfill.ts` | Set `providers:['password']` for all existing users |
| M5 | `005-legacy-batches.ts` | Create `Legacy` batch per course; backfill `enrollments.batchId` |
| M6 | `006-semester-dates.ts` | Set `openDate=createdAt`, `endDate=null` on all semesters |
| M7 | `007-notification-locale.ts` | Set `localeRendered='en'` on all existing notifications |

### Phase 2 — Service Deploy (rolling, health-check gated)

Deploy in dependency order: shared packages → User Service → Auth Service → Course Service → Enrollment Service → Progress/Storage/Audit/Notification (parallel) → Cell Service → Analytics + Jobs → Gateway route table update.

### Phase 3 — Deprecate V1 Paths (4–6 weeks post Phase 2)

- `POST /auth/register` (old — created pending student) → `410 Gone`
- `GET /admin/registrations` → `410 Gone`; use `GET /role-requests`
- `POST /admin/registrations/:id/approve` → `410 Gone`; use `POST /role-requests/:id/approve`
- Drop legacy `role` scalar field from user documents after all clients migrated to `roles[]`

---

## 9. Architectural Principles (V2)

| Principle | Statement |
|-----------|-----------|
| Single Responsibility | Each microservice owns exactly one bounded domain context |
| Database per Service | No cross-service direct Firestore reads |
| API-first | Inter-service: HTTP contracts or domain events only |
| Stateless | Identity from Firebase ID token; no server-side sessions |
| Fail fast | All inputs validated at boundary; internal errors never leak |
| Event-driven side effects | Notifications, emails, audit writes decoupled via outbox |
| Observability by default | Structured logs + metrics + traces from every service |
| Additive evolution | New features ship as new endpoints or additive fields; deprecation cycle for removals |
| Locale-aware by default | Every user-facing string through i18n resolver; English is fallback, never assumption |
| Mobile-first write paths | Cell-report and profile endpoints accept idempotent retries; `clientReqId` for offline drafts |

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*
*Paired with TCCR SRS v2.0 dated 15 May 2026*
