---
name: test-security
description: Audit a CMP service's routes for missing authenticate(), authorize(), ownership guards, and Zod validation — then report findings
argument-hint: Service name to audit (e.g. "enrollment-service")
allowed-tools: Read, Write, Glob, Bash
---

# Security Audit

You are auditing all routes in a **CMP (Course Management Portal)** service for common security gaps. Follow every step in order. Do NOT fix anything — report only. The developer reviews the report before making changes.

## 1. Parse `$ARGUMENTS`

Extract one value:

| Value | Example |
|-------|---------|
| **Service** | `enrollment-service` |

If missing, ask before continuing.

## 2. Load Context

Read:
- `.claude/blueprint/Backend_Blueprint.md` §10 (Auth & Authorization Flow — `authenticate()`, `authorize()`, `mustBeOwnerOrAdmin()` patterns)
- `.claude/blueprint/Backend_Blueprint.md` §15 (Security Implementation — OWASP mitigations, input validation rules)
- `.claude/APIdocument/API_Document.md` — find the declared role requirement for every endpoint in this service

Then read all route and controller files:
```bash
cat packages/<service-name>/src/http/routes/*.ts
cat packages/<service-name>/src/http/controllers/*.ts
cat packages/<service-name>/src/application/useCases/*.ts
cat packages/<service-name>/src/http/validators/*.ts
```

Also read the shared middleware to understand what each guard does:
```bash
cat packages/shared/auth-middleware/src/index.ts
```

## 3. Build the Route Inventory

List every registered route in the service in a table:

| Method | Path | authenticate() | authorize(role) | mustBeOwnerOrAdmin() | Zod validator | Expected role (API doc) |
|--------|------|:--------------:|:---------------:|:--------------------:|:-------------:|------------------------|
| GET | /api/v1/me/enrollments | ✓ | student | — | ✓ | student |
| POST | /api/v1/courses/:id/enroll | ✓ | student | — | ✓ | student |
| ... | ... | ... | ... | ... | ... | ... |

Fill this table by reading the actual route registrations.

## 4. Run Security Checks

For each route, check the following and flag any violations:

### Check A — Missing `authenticate()`

Any route that is not explicitly `public` in the API document must call `authenticate()`.

**Violation:** Route has no `authenticate()` and is not documented as public.

### Check B — Missing or Wrong `authorize()`

The role in `authorize()` must match the role declared in `API_Document.md` for that endpoint.

**Violation:** `authorize()` is absent, or the role is broader than required (e.g., `authorize('student')` when only admins should access it).

### Check C — Missing Ownership Guard

Routes that return or modify a resource owned by a specific user (e.g., `GET /me/*`, `PATCH /me/*`, accessing another user's data) must use `mustBeOwnerOrAdmin()`.

**Violation:** Route accesses a user-owned resource but has no `mustBeOwnerOrAdmin()` guard.

### Check D — Missing Zod Validator

Every route that accepts path params, query params, or a request body must parse them with a Zod schema before the controller business logic runs.

**Violation:** Controller reads `req.params`, `req.query`, or `req.body` without calling `.parse()` on a Zod schema first.

### Check E — Business Logic in Controller

Controllers must be thin — only parse input, call one use case, send response. Any `if`, loop, or Firestore call directly in a controller is a violation.

**Violation:** Controller contains conditional logic beyond input parsing.

### Check F — Error Not Forwarded to `next()`

Controller `catch` blocks must call `next(err)`. Any `res.status().json()` in a catch block bypasses the global error handler and may expose stack traces.

**Violation:** `catch (err) { res.status(500).json(...) }` — not delegated to `next`.

### Check G — Internal Routes Exposed Without Service Key Check

Routes under `/internal/*` must verify the `X-Internal-Service-Key` header. They must not use `authenticate()` (which validates Firebase tokens — internal callers don't have them).

**Violation:** `/internal/*` route missing service key validation, or using `authenticate()` instead.

### Check H — `super_admin` Inherits Admin Permissions

`authorize('admin')` must also grant access to `super_admin` (this is handled inside the shared `authorize()` middleware). Verify the middleware implementation does this correctly.

**Violation:** Service has a custom `authorize()` implementation that does not inherit `super_admin` → `admin`.

## 5. Rate Limiting Check (Gateway-Level)

Note: rate limiting is handled at the API Gateway, not per service. Flag this only if the service implements its own rate limiting that conflicts with gateway settings:
- Auth endpoints: 10 req/min per IP
- General endpoints: 200 req/min per IP

## 6. Produce the Audit Report

```
🔐 Security Audit — <service-name>
Date: <today>

Route inventory: <N> routes checked

─── Findings ────────────────────────────────────────────────────────

<For each finding>:
  ⚠️  [Check <Letter>] <METHOD> <path>
      Issue:    <description of the gap>
      Expected: <what should be there>
      Risk:     <what an attacker could do without this guard>

─── Summary ─────────────────────────────────────────────────────────

Total findings: <N>
  🔴 Critical (Check A, B, C, G): <N>   — auth/authz completely absent
  🟡 Medium   (Check D, F, H):    <N>   — input not validated or error leaks
  🟢 Low      (Check E):          <N>   — code quality / maintainability

─── Clean Routes ────────────────────────────────────────────────────

The following routes passed all checks:
  ✓ <METHOD> <path>
  ✓ ...

─── Recommended Fixes ───────────────────────────────────────────────

Priority 1 (fix before merge):
  1. <fix description for each Critical finding>

Priority 2 (fix in same sprint):
  2. <fix description for each Medium finding>

Priority 3 (next sprint):
  3. <fix description for each Low finding>
```

If no findings: report `✅ All routes passed security checks.`

## 7. Do Not Auto-Fix

This command reports only. Present the audit report and wait for the developer to confirm before making any changes.

---

v1.0.0 — CMP (`slp-backend`)
