# Report Section Access Control — API Reference
## TCCR · `tccr-backend`
### REST API · Base URL: `https://cms.api.bethelnet.au/api/v1`

**Version:** 1.0.0  
**Date:** 03 June 2026

---

## Overview

This document covers the complete API reference for the Report Section access control system:

1. **`GET /cells/network/summary`** — aggregated reporting stats with `?role=` scoping
2. **`GET /cells/network/reports`** — individual cell reports with `?role=` scoping
3. **`POST /super-admin/g12/:uid/temp-master-access`** — grant Temporary Master Access
4. **`PATCH /super-admin/g12/:uid/temp-master-access`** — extend Temporary Master Access
5. **`DELETE /super-admin/g12/:uid/temp-master-access`** — revoke Temporary Master Access

---

## Role Access Summary

| Role | Network Summary | Network Reports |
|------|----------------|----------------|
| `master` | All cells org-wide | All cells org-wide |
| `admin` / `super_admin` | All cells org-wide | All cells org-wide |
| `g12` + active TMA | Org-wide via `?role=master` | Org-wide via `?role=master` |
| `g12` standard | Own network only | Own network only |
| `leader` | Own cell only | Own cell only |
| `member` / `student` | 403 | 403 |

---

## `?role=` Query Parameter

| Value | Who can call it | Scope returned |
|-------|----------------|----------------|
| `role=g12` | Any `g12` user | Own network (`g12LeaderUid === callerUid`) |
| `role=master` | `master` role OR `g12` with active TMA | Org-wide all cells |
| *(absent)* | All permitted roles | Auto-detected from caller's role (existing behavior) |
| Any other value | — | `400 VALIDATION_ERROR` |

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
| `from` | `YYYY-MM-DD` | If no `month` | Start of range |
| `to` | `YYYY-MM-DD` | If no `month` | End of range |
| `role` | `g12` \| `master` | Optional | Explicit scope selector |

### Request Examples

```http
### G12 — own network scope
GET /api/v1/cells/network/summary?month=2026-05&role=g12
Authorization: Bearer <g12_token>

### G12 with TMA — org-wide scope
GET /api/v1/cells/network/summary?month=2026-05&role=master
Authorization: Bearer <g12_token_with_active_TMA>

### Master — org-wide scope
GET /api/v1/cells/network/summary?month=2026-05&role=master
Authorization: Bearer <master_token>

### Auto-detect (no role param — existing behavior unchanged)
GET /api/v1/cells/network/summary?month=2026-05
Authorization: Bearer <any_permitted_token>
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

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid `?role=` value or missing `month`/`from`+`to` |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Role not permitted, or `?role=master` without master role / active TMA |

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
| `month` | `YYYY-MM` | — | Overrides `from`/`to` |
| `from` | `YYYY-MM-DD` | — | Start date filter |
| `to` | `YYYY-MM-DD` | — | End date filter |
| `limit` | `1–100` | `20` | Max reports per page |
| `cursor` | string | — | Pagination cursor |
| `leaderUid` | string | — | Filter to a specific leader |
| `type` | `g12\|care\|children\|outreach` | — | Filter by cell type |
| `cellId` | string | — | Filter to a single cell |
| `voided` | `true\|false` | — | Include/exclude voided reports |
| `role` | `g12` \| `master` | — | Explicit scope selector |

### Request Examples

```http
### G12 — own network reports
GET /api/v1/cells/network/reports?month=2026-05&role=g12
Authorization: Bearer <g12_token>

### G12 with TMA — all reports org-wide
GET /api/v1/cells/network/reports?month=2026-05&role=master
Authorization: Bearer <g12_token_with_active_TMA>

### Filtered by cell type + leader
GET /api/v1/cells/network/reports?month=2026-05&type=care&leaderUid=uid-leader-01&role=g12
Authorization: Bearer <g12_token>

### Paginated — second page
GET /api/v1/cells/network/reports?month=2026-05&role=g12&cursor=report-uuid-20&limit=20
Authorization: Bearer <g12_token>
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
        {
          "userUid": "uid-member-01",
          "name": "Kasun Perera",
          "status": "present",
          "isNew": false
        },
        {
          "userUid": "uid-member-02",
          "name": "Dilani Fernando",
          "status": "absent",
          "isNew": false
        },
        {
          "userUid": null,
          "name": "New Visitor",
          "status": "new",
          "isNew": true
        }
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

### Voided Report (didMeet: false example)

```json
{
  "id": "report-uuid-002",
  "cellId": "cell-uuid-002",
  "cellName": "Grace Cell",
  "date": "2026-05-11",
  "didMeet": false,
  "noMeetReason": "Leader was ill",
  "leaderPresent": false,
  "attendance": [],
  "voided": false,
  "voidReason": null,
  "satisfactionRate": 3,
  "createdAt": "2026-05-11T10:00:00.000Z",
  "updatedAt": "2026-05-11T10:00:00.000Z"
}
```

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid `?role=` value |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Role not permitted, or `?role=master` without authority |

---

## 3. POST /super-admin/g12/:uid/temp-master-access

Grants Temporary Master Access (TMA) to a G12 user. The user can then call
`?role=master` on both network endpoints until the access expires or is revoked.

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expiresAt` | ISO 8601 datetime | Yes | When access expires — must be a future timestamp |

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

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| 400 | `INVALID_TARGET` | Target does not have the `g12` role |
| 400 | `ALREADY_MASTER` | Target already holds the `master` role |
| 400 | `INVALID_EXPIRY` | `expiresAt` is in the past |
| 400 | `VALIDATION_ERROR` | Missing or malformed `expiresAt` field |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Caller is not `super_admin` |
| 404 | `USER_NOT_FOUND` | Target UID does not exist |

```json
{
  "error": {
    "code": "INVALID_EXPIRY",
    "message": "expiresAt must be a future date."
  },
  "requestId": "req-uuid-here"
}
```

---

## 4. PATCH /super-admin/g12/:uid/temp-master-access

Extends the expiry of an existing TMA grant. The previous expiry timestamp is
recorded in the audit log.

```
PATCH /api/v1/super-admin/g12/:uid/temp-master-access
```

**Auth:** `super_admin` Bearer token required

### Path Parameters

| Param | Description |
|-------|-------------|
| `uid` | Firebase UID of the G12 user whose TMA is being extended |

### Request Body

```json
{
  "expiresAt": "2026-06-20T23:59:59.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expiresAt` | ISO 8601 datetime | Yes | New expiry — must be a future timestamp |

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
| 400 | `INVALID_EXPIRY` | New `expiresAt` is in the past |
| 400 | `VALIDATION_ERROR` | Missing or malformed `expiresAt` field |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Caller is not `super_admin` |
| 404 | `USER_NOT_FOUND` | Target UID does not exist |

```json
{
  "error": {
    "code": "NO_TEMP_ACCESS",
    "message": "This user has no active Temporary Master Access to extend."
  },
  "requestId": "req-uuid-here"
}
```

---

## 5. DELETE /super-admin/g12/:uid/temp-master-access

Revokes TMA immediately. The G12 user reverts to standard own-network access after
their Firebase token refreshes (within ~1 hour).

```
DELETE /api/v1/super-admin/g12/:uid/temp-master-access
```

**Auth:** `super_admin` Bearer token required

### Path Parameters

| Param | Description |
|-------|-------------|
| `uid` | Firebase UID of the G12 user whose TMA is being revoked |

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
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Caller is not `super_admin` |
| 404 | `USER_NOT_FOUND` | Target UID does not exist |

```json
{
  "error": {
    "code": "NO_TEMP_ACCESS",
    "message": "This user has no active Temporary Master Access to revoke."
  },
  "requestId": "req-uuid-here"
}
```

---

## End-to-End Workflows

### Workflow 1 — Grant TMA and test access

```http
### Step 1: Grant TMA
POST /api/v1/super-admin/g12/uid-g12-01/temp-master-access
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{ "expiresAt": "2026-06-10T23:59:59.000Z" }

--- Response (200) ---
{
  "message": "Temporary Master Access granted.",
  "uid": "uid-g12-01",
  "expiresAt": "2026-06-10T23:59:59.000Z"
}

### Step 2: G12 user signs out and signs back in to refresh token

### Step 3: G12 user calls org-wide summary
GET /api/v1/cells/network/summary?month=2026-05&role=master
Authorization: Bearer <refreshed_g12_token>

--- Response (200): org-wide data returned ---

### Step 4: Standard G12 scope still works
GET /api/v1/cells/network/reports?month=2026-05&role=g12
Authorization: Bearer <refreshed_g12_token>

--- Response (200): own network only ---
```

### Workflow 2 — Extend active TMA

```http
PATCH /api/v1/super-admin/g12/uid-g12-01/temp-master-access
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{ "expiresAt": "2026-06-20T23:59:59.000Z" }

--- Response (200) ---
{
  "message": "Temporary Master Access extended.",
  "uid": "uid-g12-01",
  "expiresAt": "2026-06-20T23:59:59.000Z"
}
```

### Workflow 3 — Revoke TMA

```http
### Step 1: Revoke
DELETE /api/v1/super-admin/g12/uid-g12-01/temp-master-access
Authorization: Bearer <super_admin_token>

--- Response (200) ---
{
  "message": "Temporary Master Access revoked.",
  "uid": "uid-g12-01"
}

### Step 2: After G12 user's token refreshes — role=master is blocked
GET /api/v1/cells/network/reports?month=2026-05&role=master
Authorization: Bearer <g12_token_after_refresh>

--- Response (403) ---
{
  "error": {
    "code": "FORBIDDEN",
    "message": "?role=master requires the Master role or active Temporary Master Access."
  },
  "requestId": "req-uuid-here"
}

### G12 standard scope still works
GET /api/v1/cells/network/reports?month=2026-05&role=g12
--- Response (200): own network only ---
```

### Workflow 4 — Master user (no TMA needed)

```http
GET /api/v1/cells/network/summary?month=2026-05&role=master
Authorization: Bearer <master_token>

--- Response (200): org-wide data ---
```

---

## Audit Log Reference

All TMA operations write an entry to the `audit_log` Firestore collection.
Query via `GET /api/v1/audit-log` (requires `admin` or `super_admin` role).

### GRANT_TEMP_MASTER_ACCESS

```json
{
  "action": "GRANT_TEMP_MASTER_ACCESS",
  "category": "user",
  "actorUid": "uid-super-admin",
  "targetType": "user",
  "targetId": "uid-g12-01",
  "grantedAt": "2026-06-03T11:00:00.000Z",
  "expiresAt": "2026-06-10T23:59:59.000Z",
  "requestId": "req-uuid-here",
  "createdAt": "2026-06-03T11:00:00.000Z"
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
  "extendedAt": "2026-06-08T09:00:00.000Z",
  "requestId": "req-uuid-here",
  "createdAt": "2026-06-08T09:00:00.000Z"
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
  "originalExpiresAt": "2026-06-10T23:59:59.000Z",
  "requestId": "req-uuid-here",
  "createdAt": "2026-06-05T14:00:00.000Z"
}
```

---

## Error Code Reference

| Error Code | HTTP | Description |
|-----------|------|-------------|
| `VALIDATION_ERROR` | 400 | Missing field, invalid format, or invalid `?role=` value |
| `INVALID_TARGET` | 400 | TMA target is not a G12 user |
| `ALREADY_MASTER` | 400 | TMA target already holds the master role |
| `INVALID_EXPIRY` | 400 | `expiresAt` is in the past |
| `NO_TEMP_ACCESS` | 400 | No existing TMA to extend or revoke |
| `UNAUTHORIZED` | 401 | Missing or expired Bearer token |
| `FORBIDDEN` | 403 | Valid token but insufficient permissions |
| `USER_NOT_FOUND` | 404 | Target UID does not exist |
