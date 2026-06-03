# G12 & Master Report Access — API Reference
## TCCR · `tccr-backend`
### REST API · Base URL: `https://cms.api.bethelnet.au/api/v1`

**Version:** 1.0.0
**Date:** 03 June 2026
**Organisation:** Future CX Lanka (Pvt) Ltd

---

## Overview

This document covers the Report Section access control system for G12 leaders and Master users.

### Endpoints

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | `GET` | `/cells/network/summary` | Aggregated stats — stat cards, charts, by-leader table |
| 2 | `GET` | `/cells/network/reports` | Individual cell reports — filterable, paginated |
| 3 | `POST` | `/super-admin/g12/:uid/temp-master-access` | Grant Temporary Master Access to a G12 user |
| 4 | `PATCH` | `/super-admin/g12/:uid/temp-master-access` | Extend an existing TMA grant |
| 5 | `DELETE` | `/super-admin/g12/:uid/temp-master-access` | Revoke TMA immediately |

---

## Role Access Summary

| Role | Network Summary | Network Reports |
|------|----------------|----------------|
| `master` | All cells org-wide | All cells org-wide |
| `admin` / `super_admin` | All cells org-wide | All cells org-wide |
| `g12` + active TMA | Org-wide via `?role=master` | Org-wide via `?role=master` |
| `g12` standard | Own network only | Own network only |
| `leader` | Own cell only | Own cell only |
| `member` / `student` | `403 FORBIDDEN` | `403 FORBIDDEN` |

---

## `?role=` Query Parameter

Applies to both `GET /cells/network/summary` and `GET /cells/network/reports`.

| Value | Who can use it | Scope returned |
|-------|---------------|----------------|
| `role=g12` | Any `g12` user | Own network (`g12LeaderUid === callerUid`) |
| `role=master` | `master` role **or** `g12` with active TMA | Org-wide — all cells |
| *(absent)* | All permitted roles | Auto-detected from caller's role |
| Any other value | — | `400 VALIDATION_ERROR` |

> **TMA check:** `?role=master` is evaluated against the `tempMasterAccessExpiresAt` Firebase custom
> claim at token-verification time. If the claim is missing or past its expiry the request returns
> `403 FORBIDDEN` even if TMA was previously granted.

---

## 1. GET /cells/network/summary

Returns aggregated reporting stats for the Reports page dashboard.

```
GET /api/v1/cells/network/summary
```

**Auth:** Bearer token required
**Allowed roles:** `leader` `g12` `admin` `super_admin` `master`

### Query Parameters

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `month` | `YYYY-MM` | One of `month` **or** `from`+`to` | e.g. `2026-05` |
| `from` | `YYYY-MM-DD` | If no `month` | Start of range (inclusive) |
| `to` | `YYYY-MM-DD` | If no `month` | End of range (inclusive) |
| `role` | `g12` \| `master` | Optional | Explicit scope override |

### Request Examples

```http
### G12 — own network scope (explicit)
GET /api/v1/cells/network/summary?month=2026-05&role=g12
Authorization: Bearer <g12_token>

### G12 with active TMA — org-wide scope
GET /api/v1/cells/network/summary?month=2026-05&role=master
Authorization: Bearer <g12_token_with_active_TMA>

### Master — org-wide scope
GET /api/v1/cells/network/summary?month=2026-05&role=master
Authorization: Bearer <master_token>

### No ?role= — scope auto-detected from token (unchanged behaviour)
GET /api/v1/cells/network/summary?month=2026-05
Authorization: Bearer <any_permitted_token>

### Date range instead of month
GET /api/v1/cells/network/summary?from=2026-05-01&to=2026-05-31
Authorization: Bearer <g12_token>
```

### Response (200)

```json
{
  "period": "May 2026",
  "month": "2026-05",
  "scope": {
    "totalCells": 12,
    "totalLeaders": 10
  },
  "summary": {
    "cellsHeld": 9,
    "reportsFiled": 14,
    "activeLeaders": 8,
    "g12Active": 3
  },
  "attendance": {
    "present": 120,
    "roster": 180,
    "rate": 0.667,
    "visitors": 22,
    "avgSatisfaction": 4.2
  },
  "unreportedCells": [
    {
      "id": "cell-uuid-001",
      "name": "Hope Cell",
      "type": "care",
      "leaderUid": "uid-leader-01",
      "leaderName": "Amal Perera"
    }
  ],
  "weeklyBreakdown": [
    { "weekLabel": "W1", "reportCount": 4, "attendance": 30 },
    { "weekLabel": "W2", "reportCount": 5, "attendance": 42 },
    { "weekLabel": "W3", "reportCount": 3, "attendance": 28 },
    { "weekLabel": "W4", "reportCount": 2, "attendance": 20 }
  ],
  "meetingTypeBreakdown": {
    "g12": 3,
    "care": 5,
    "children": 4,
    "outreach": 2
  },
  "byLeader": [
    {
      "leaderUid": "uid-leader-01",
      "leaderName": "Amal Perera",
      "g12Uid": "uid-g12-01",
      "g12Name": "Nimal Silva",
      "cellCount": 2,
      "reportCount": 3,
      "attendance": 40,
      "avgSatisfaction": 4.5
    },
    {
      "leaderUid": "uid-leader-02",
      "leaderName": "Kumari Fernando",
      "g12Uid": "uid-g12-01",
      "g12Name": "Nimal Silva",
      "cellCount": 1,
      "reportCount": 2,
      "attendance": 18,
      "avgSatisfaction": 4.0
    }
  ]
}
```

### Response Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `period` | string | Human-readable period label, e.g. `"May 2026"` |
| `month` | string | Period key — `YYYY-MM` or `from/to` |
| `scope.totalCells` | number | Cells in scope for this caller |
| `scope.totalLeaders` | number | Unique leaders across scoped cells |
| `summary.cellsHeld` | number | Cells that filed at least one `didMeet: true` report |
| `summary.reportsFiled` | number | Total reports filed (includes `didMeet: false`) |
| `summary.activeLeaders` | number | Leaders who filed at least one report |
| `summary.g12Active` | number | G12 leaders whose cells filed at least one report |
| `attendance.present` | number | Sum of `present` attendance entries across meet reports |
| `attendance.roster` | number | Sum of `memberCount` across all scoped cells |
| `attendance.rate` | number | `present / roster`, 3 decimal places (0–1) |
| `attendance.visitors` | number | Sum of `additionalVisitors` across meet reports |
| `attendance.avgSatisfaction` | number | Average `satisfactionRate` (1–6), 1 decimal place |
| `unreportedCells` | array | Cells with no reports filed in the period |
| `weeklyBreakdown` | array | Per-week aggregates; `weekLabel` = `W1`–`W5` |
| `meetingTypeBreakdown` | object | Report counts per cell type (`g12`, `care`, `children`, `outreach`) |
| `byLeader` | array | Per-leader aggregates with G12 association |

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid `?role=` value, or missing `month` / `from`+`to` |
| 401 | `MISSING_TOKEN` | Missing or malformed `Authorization` header |
| 401 | `TOKEN_EXPIRED` | Bearer token has expired |
| 403 | `EMAIL_NOT_VERIFIED` | Caller's email not yet verified |
| 403 | `FORBIDDEN` | Role not in allowed list, or `?role=master` without authority |

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "?role=master requires the Master role or active Temporary Master Access."
  },
  "requestId": "req-uuid-here"
}
```

---

## 2. GET /cells/network/reports

Returns individual cell reports from the caller's accessible network, sorted by date descending.

```
GET /api/v1/cells/network/reports
```

**Auth:** Bearer token required
**Allowed roles:** `leader` `g12` `admin` `super_admin` `master`

### Query Parameters

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `month` | `YYYY-MM` | — | Overrides `from`/`to` when present |
| `from` | `YYYY-MM-DD` | — | Start date filter (inclusive) |
| `to` | `YYYY-MM-DD` | — | End date filter (inclusive) |
| `limit` | `1–100` | `20` | Max reports per page |
| `cursor` | string | — | Pagination cursor (last report ID from previous page) |
| `leaderUid` | string | — | Filter to a specific leader's cells |
| `type` | `g12\|care\|children\|outreach` | — | Filter by cell type |
| `cellId` | string | — | Filter to a single cell |
| `voided` | `true\|false` | — | `true` = include only voided; `false` = exclude voided |
| `role` | `g12\|master` | — | Explicit scope override |

### Request Examples

```http
### G12 — own network reports (explicit scope)
GET /api/v1/cells/network/reports?month=2026-05&role=g12
Authorization: Bearer <g12_token>

### G12 with active TMA — org-wide reports
GET /api/v1/cells/network/reports?month=2026-05&role=master
Authorization: Bearer <g12_token_with_active_TMA>

### Filtered: care cells for a specific leader
GET /api/v1/cells/network/reports?month=2026-05&type=care&leaderUid=uid-leader-01&role=g12
Authorization: Bearer <g12_token>

### Paginated — second page
GET /api/v1/cells/network/reports?month=2026-05&role=g12&cursor=report-uuid-20&limit=20
Authorization: Bearer <g12_token>

### Single cell reports — all time
GET /api/v1/cells/network/reports?cellId=cell-uuid-001
Authorization: Bearer <admin_token>
```

### Response (200)

```json
{
  "items": [
    {
      "id": "report-uuid-001",
      "cellId": "cell-uuid-001",
      "cellName": "Hope Cell",
      "date": "2026-05-18",
      "didMeet": true,
      "noMeetReason": null,
      "leaderPresent": true,
      "conductedByIfAbsent": null,
      "location": "Colombo 07",
      "timeStarted": "18:00",
      "timeEnded": "19:30",
      "language": "si",
      "subjectDiscussed": "sunday_sermon",
      "otherSubjectReason": null,
      "cellType": "care",
      "g12LeaderUid": "uid-g12-01",
      "immediateG12LeaderText": null,
      "attendance": [
        { "userUid": "uid-member-01", "name": "Kasun Perera",   "status": "present", "isNew": false },
        { "userUid": "uid-member-02", "name": "Dilani Fernando", "status": "absent",  "isNew": false },
        { "userUid": null,            "name": "New Visitor",     "status": "new",     "isNew": true  }
      ],
      "contactedAbsentees": "yes",
      "absenteeNotes": "Called Dilani — will attend next week",
      "additionalVisitors": 2,
      "childrenCount": 0,
      "satisfactionRate": 5,
      "additionalInfo": null,
      "photoUrls": [
        "https://firebasestorage.googleapis.com/v0/b/bucket/o/cells%2F...?alt=media&token=..."
      ],
      "clientReqId": "550e8400-e29b-41d4-a716-446655440000",
      "filledByUid": "uid-leader-01",
      "voided": false,
      "voidReason": null,
      "createdAt": "2026-05-18T14:30:00.000Z",
      "updatedAt": "2026-05-18T14:30:00.000Z"
    }
  ],
  "totalCells": 12
}
```

**Pagination:** pass the last `items[].id` as `?cursor=` to fetch the next page. When `items` length is less than `limit`, you are on the last page.

**`didMeet: false` report:** `attendance` is `[]`; `noMeetReason` explains why the cell did not meet; all attendance/visitor fields are zero/null.

### Response Field Reference

| Field | Type | Notes |
|-------|------|-------|
| `items` | array | Reports sorted by `date` descending |
| `items[].cellName` | string | Cell name injected server-side — not stored on the report document |
| `items[].contactedAbsentees` | `"yes"\|"no"\|"future"` | Whether the leader followed up with absentees |
| `items[].satisfactionRate` | `1–6` | 1 = very low, 6 = very high |
| `items[].clientReqId` | string | Idempotency key — UUID submitted by the client |
| `items[].filledByUid` | string | UID of the leader who filed the report |
| `totalCells` | number | Number of cells in scope after all filters applied |

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid `?role=` or `?type=` value |
| 401 | `MISSING_TOKEN` | Missing or malformed `Authorization` header |
| 401 | `TOKEN_EXPIRED` | Bearer token has expired |
| 403 | `FORBIDDEN` | Role not permitted, or `?role=master` without authority |

---

## 3. POST /super-admin/g12/:uid/temp-master-access

Grants Temporary Master Access (TMA) to a G12 user. Once granted and after the user
refreshes their Firebase token, they can call `?role=master` on both network endpoints
to get org-wide data until the access expires or is revoked.

```
POST /api/v1/super-admin/g12/:uid/temp-master-access
```

**Auth:** `super_admin` Bearer token required

### Path Parameters

| Param | Description |
|-------|-------------|
| `uid` | Firebase UID of the target G12 user |

### Request Body

```json
{
  "expiresAt": "2026-06-10T23:59:59.000Z"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `expiresAt` | ISO 8601 datetime string | Yes | Must be a future timestamp |

### Request Example

```http
POST /api/v1/super-admin/g12/uid-g12-01/temp-master-access
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "expiresAt": "2026-06-10T23:59:59.000Z"
}
```

### Response (200)

```json
{
  "message": "Temporary Master Access granted.",
  "uid": "uid-g12-01",
  "expiresAt": "2026-06-10T23:59:59.000Z"
}
```

### What happens internally

1. Target user loaded from Firestore — must have `g12` in `roles[]` and must NOT have `master`.
2. `user.temporaryMasterAccess` written to Firestore: `{ grantedBy, grantedAt, expiresAt }`.
3. `tempMasterAccessExpiresAt` custom claim set on Firebase Auth token via Admin SDK.
4. `audit.action` (`GRANT_TEMP_MASTER_ACCESS`) published to the outbox.
5. G12 user must **sign out and sign back in** to receive a token with the updated claim.

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| 400 | `INVALID_TARGET` | Target does not hold the `g12` role |
| 400 | `ALREADY_MASTER` | Target already holds the `master` role — TMA not needed |
| 400 | `INVALID_EXPIRY` | `expiresAt` is in the past |
| 400 | `VALIDATION_ERROR` | Missing or malformed `expiresAt` |
| 401 | `MISSING_TOKEN` | Missing or malformed `Authorization` header |
| 403 | `FORBIDDEN` | Caller does not hold `super_admin` |
| 404 | `USER_NOT_FOUND` | No user with that UID |

---

## 4. PATCH /super-admin/g12/:uid/temp-master-access

Extends the expiry of an existing TMA grant. The previous expiry is recorded in the audit log.

```
PATCH /api/v1/super-admin/g12/:uid/temp-master-access
```

**Auth:** `super_admin` Bearer token required

### Request Body

```json
{
  "expiresAt": "2026-06-20T23:59:59.000Z"
}
```

Same validation as POST — `expiresAt` must be a future ISO 8601 datetime.

### Request Example

```http
PATCH /api/v1/super-admin/g12/uid-g12-01/temp-master-access
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "expiresAt": "2026-06-20T23:59:59.000Z"
}
```

### Response (200)

```json
{
  "message": "Temporary Master Access extended.",
  "uid": "uid-g12-01",
  "expiresAt": "2026-06-20T23:59:59.000Z"
}
```

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| 400 | `NO_TEMP_ACCESS` | User has no existing TMA grant to extend |
| 400 | `INVALID_EXPIRY` | `expiresAt` is in the past |
| 400 | `VALIDATION_ERROR` | Missing or malformed `expiresAt` |
| 401 | `MISSING_TOKEN` | Missing or malformed `Authorization` header |
| 403 | `FORBIDDEN` | Caller does not hold `super_admin` |
| 404 | `USER_NOT_FOUND` | No user with that UID |

---

## 5. DELETE /super-admin/g12/:uid/temp-master-access

Revokes TMA immediately. The Firebase custom claim is cleared; the G12 user loses
`?role=master` access once their token refreshes (up to ~1 hour).

```
DELETE /api/v1/super-admin/g12/:uid/temp-master-access
```

**Auth:** `super_admin` Bearer token required

### Request Body

None.

### Request Example

```http
DELETE /api/v1/super-admin/g12/uid-g12-01/temp-master-access
Authorization: Bearer <super_admin_token>
```

### Response (200)

```json
{
  "message": "Temporary Master Access revoked.",
  "uid": "uid-g12-01"
}
```

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| 400 | `NO_TEMP_ACCESS` | User has no active TMA to revoke |
| 401 | `MISSING_TOKEN` | Missing or malformed `Authorization` header |
| 403 | `FORBIDDEN` | Caller does not hold `super_admin` |
| 404 | `USER_NOT_FOUND` | No user with that UID |

---

## End-to-End Workflows

### Workflow 1 — Grant TMA and use it

```http
### Step 1: Super admin grants TMA to a G12 user
POST /api/v1/super-admin/g12/uid-g12-01/temp-master-access
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{ "expiresAt": "2026-06-10T23:59:59.000Z" }

--- 200 OK ---
{ "message": "Temporary Master Access granted.", "uid": "uid-g12-01", "expiresAt": "2026-06-10T23:59:59.000Z" }


### Step 2: G12 user signs out and signs back in to refresh their Firebase token


### Step 3: G12 calls org-wide summary with ?role=master
GET /api/v1/cells/network/summary?month=2026-05&role=master
Authorization: Bearer <refreshed_g12_token>

--- 200 OK: org-wide data ---


### Step 4: G12 can still use their own-network scope at any time
GET /api/v1/cells/network/reports?month=2026-05&role=g12
Authorization: Bearer <refreshed_g12_token>

--- 200 OK: own network only ---
```

### Workflow 2 — Extend active TMA

```http
PATCH /api/v1/super-admin/g12/uid-g12-01/temp-master-access
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{ "expiresAt": "2026-06-20T23:59:59.000Z" }

--- 200 OK ---
{ "message": "Temporary Master Access extended.", "uid": "uid-g12-01", "expiresAt": "2026-06-20T23:59:59.000Z" }
```

### Workflow 3 — Revoke TMA and verify it takes effect

```http
### Step 1: Revoke
DELETE /api/v1/super-admin/g12/uid-g12-01/temp-master-access
Authorization: Bearer <super_admin_token>

--- 200 OK ---
{ "message": "Temporary Master Access revoked.", "uid": "uid-g12-01" }


### Step 2: After G12 user's token refreshes — ?role=master is blocked
GET /api/v1/cells/network/reports?month=2026-05&role=master
Authorization: Bearer <g12_token_after_refresh>

--- 403 FORBIDDEN ---
{
  "error": {
    "code": "FORBIDDEN",
    "message": "?role=master requires the Master role or active Temporary Master Access."
  },
  "requestId": "req-uuid-here"
}


### ?role=g12 (own-network scope) still works normally
GET /api/v1/cells/network/reports?month=2026-05&role=g12
Authorization: Bearer <g12_token_after_refresh>

--- 200 OK: own network only ---
```

### Workflow 4 — Master user (no TMA needed)

```http
GET /api/v1/cells/network/summary?month=2026-05&role=master
Authorization: Bearer <master_token>

--- 200 OK: org-wide data ---
```

---

## Audit Log Reference

All TMA operations are written to the `audit_log` Firestore collection via the outbox.
Query via `GET /api/v1/audit-log` (requires `admin` or `super_admin`).

### GRANT_TEMP_MASTER_ACCESS

```json
{
  "action": "GRANT_TEMP_MASTER_ACCESS",
  "category": "user",
  "actorUid": "uid-super-admin",
  "targetType": "user",
  "targetId": "uid-g12-01",
  "grantedAt": "2026-06-03T11:00:00.000Z",
  "expiresAt": "2026-06-10T23:59:59.000Z"
}
```

### EXTEND_TEMP_MASTER_ACCESS

```json
{
  "action": "EXTEND_TEMP_MASTER_ACCESS",
  "category": "user",
  "actorUid": "uid-super-admin",
  "targetType": "user",
  "targetId": "uid-g12-01",
  "previousExpiresAt": "2026-06-10T23:59:59.000Z",
  "newExpiresAt": "2026-06-20T23:59:59.000Z",
  "extendedAt": "2026-06-08T09:00:00.000Z"
}
```

### REVOKE_TEMP_MASTER_ACCESS

```json
{
  "action": "REVOKE_TEMP_MASTER_ACCESS",
  "category": "user",
  "actorUid": "uid-super-admin",
  "targetType": "user",
  "targetId": "uid-g12-01",
  "revokedAt": "2026-06-05T14:00:00.000Z",
  "originalExpiresAt": "2026-06-10T23:59:59.000Z"
}
```

---

## Error Code Reference

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Missing field, invalid format, or invalid `?role=` / `?type=` value |
| `INVALID_TARGET` | 400 | TMA grant target is not a G12 user |
| `ALREADY_MASTER` | 400 | TMA grant target already holds the `master` role |
| `INVALID_EXPIRY` | 400 | `expiresAt` is in the past |
| `NO_TEMP_ACCESS` | 400 | No existing TMA grant to extend or revoke |
| `MISSING_TOKEN` | 401 | `Authorization` header absent or malformed |
| `TOKEN_EXPIRED` | 401 | Bearer token has expired — client must refresh |
| `TOKEN_REVOKED` | 401 | Bearer token has been revoked |
| `INVALID_TOKEN` | 401 | Token could not be verified by Firebase |
| `EMAIL_NOT_VERIFIED` | 403 | Caller's email address is not yet verified |
| `FORBIDDEN` | 403 | Valid token but insufficient role, or `?role=master` without TMA/master role |
| `USER_NOT_FOUND` | 404 | Target UID does not exist in Firestore |

---

## Implementation Notes

### Token refresh requirement

Firebase custom claims are embedded in the ID token at issue time. After `POST` or `DELETE`
`/super-admin/g12/:uid/temp-master-access`, the G12 user must **sign out and sign back in**
(or force-refresh their token via the Firebase SDK) before the change takes effect.
Until then, their old token still carries the previous `tempMasterAccessExpiresAt` value.

### `?role=` is always optional

Omitting `?role=` preserves the existing auto-detect behaviour:
- `admin` / `super_admin` / `master` → org-wide
- `g12` → own network (`g12LeaderUid === callerUid`)
- `leader` → own cell only

`?role=` only overrides when explicitly provided.

### Scope isolation

`?role=g12` always scopes to the **calling user's own network** regardless of who holds `master`.
A master user cannot call `?role=g12` to impersonate a G12 — the `?role=g12` check enforces
`isG12 === true` and uses `callerUid` for the filter.
