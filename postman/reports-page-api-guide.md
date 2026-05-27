# TCCR — Reports Page API Guide

**Base URL:** `http://localhost:3000/api/v1`  
**Auth Header (all requests):** `Authorization: Bearer <firebase-id-token>`

---

## API Calls Summary

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/me` | Logged-in user profile (sidebar name/avatar) |
| 2 | GET | `/users/summary` | G12 + Leader dropdown data |
| 3 | GET | `/cells?limit=100` | Cell dropdown data |
| 4 | GET | `/cells/network/summary?month=YYYY-MM` | Stat cards + charts |
| 5 | GET | `/cells/network/reports?month=YYYY-MM&limit=100` | All Reports table |

---

## 1. Get My Profile

```
Method:  GET
URL:     /me
Headers: Authorization: Bearer <token>
Body:    none
```

**Response fields used:** `firstName`, `lastName`

---

## 2. Get All Users Summary *(for dropdowns)*

```
Method:  GET
URL:     /users/summary
Headers: Authorization: Bearer <token>
Body:    none
```

**Response fields used:** `g12[]`, `leaders[]` — each with `uid`, `firstName`, `lastName`

---

## 3. Get All Cells *(for cell dropdown)*

```
Method:  GET
URL:     /cells?limit=100
Headers: Authorization: Bearer <token>
Body:    none
```

**Response fields used:** `items[]` — each with `id`, `name`

---

## 4. Get Network Summary *(stat cards + charts)*

```
Method:  GET
URL:     /cells/network/summary?month=2026-05
Headers: Authorization: Bearer <token>
Body:    none
```

### Query Parameters

| Param | Required | Example | Notes |
|-------|:--------:|---------|-------|
| `month` | ✅ | `2026-05` | `YYYY-MM` format |

### Full Response

```json
{
  "period": "May 2026",
  "month": "2026-05",
  "scope": {
    "totalCells": 18,
    "totalLeaders": 6
  },
  "summary": {
    "cellsHeld": 9,
    "reportsFiled": 12,
    "activeLeaders": 4,
    "g12Active": 1
  },
  "attendance": {
    "present": 55,
    "roster": 52,
    "rate": 1.058,
    "visitors": 7,
    "avgSatisfaction": 4.1
  },
  "unreportedCells": [
    {
      "id": "cell-001",
      "name": "Care Cell A",
      "type": "care",
      "leaderUid": "uid-leader-1",
      "leaderName": "Saman S."
    }
  ],
  "weeklyBreakdown": [
    { "weekLabel": "W1", "reportCount": 2, "attendance": 10 },
    { "weekLabel": "W2", "reportCount": 3, "attendance": 15 },
    { "weekLabel": "W3", "reportCount": 4, "attendance": 20 },
    { "weekLabel": "W4", "reportCount": 3, "attendance": 7 }
  ],
  "meetingTypeBreakdown": {
    "g12": 0,
    "care": 9,
    "children": 3,
    "outreach": 0
  },
  "byLeader": [
    {
      "leaderUid": "uid-leader-1",
      "leaderName": "Saman S.",
      "g12Uid": "uid-g12-1",
      "g12Name": "G12 Leader Name",
      "cellCount": 2,
      "reportCount": 3,
      "attendance": 15,
      "avgSatisfaction": 4.2
    }
  ]
}
```

### Response Field Reference

| Field | Type | Frontend Use |
|-------|------|-------------|
| `period` | string | Page heading — *"May 2026"* |
| `month` | string | Pass back on month-picker change |
| `scope.totalCells` | number | Denominator for *"X of Y in scope"* |
| `scope.totalLeaders` | number | Leader count denominator |
| `summary.cellsHeld` | number | **Cells held** stat card |
| `summary.reportsFiled` | number | **Reports filed** stat card |
| `summary.activeLeaders` | number | **Active leaders** stat card |
| `summary.g12Active` | number | **G12 supervisors active** stat card |
| `attendance.present` | number | **Attendance** stat card |
| `attendance.roster` | number | **Total roster** stat card |
| `attendance.rate` | number | **Attendance rate** — multiply × 100 for `%` display |
| `attendance.visitors` | number | **Visitors** stat card |
| `attendance.avgSatisfaction` | number | **Avg. satisfaction** stat card (1–6 scale) |
| `unreportedCells[]` | array | Alert banner — *"N cells haven't filed a report"* |
| `weeklyBreakdown[]` | array | Bar chart — `weekLabel` X-axis, `reportCount` bar height |
| `meetingTypeBreakdown` | object | Donut chart — keys are the four cell types |
| `byLeader[]` | array | By cell leader table |

---

## 5. Get Network Reports *(All Reports table)*

```
Method:  GET
URL:     /cells/network/reports?month=2026-05&limit=100
Headers: Authorization: Bearer <token>
Body:    none
```

### Query Parameters

| Param | Required | Example | Notes |
|-------|:--------:|---------|-------|
| `month` | ✅ | `2026-05` | `YYYY-MM` format |
| `limit` | ✅ | `100` | Max per page |
| `g12Uid` | ❌ | `uid-g12-1` | Filter by G12 supervisor |
| `leaderUid` | ❌ | `uid-leader-1` | Filter by cell leader |
| `cellId` | ❌ | `cell-001` | Filter by specific cell |
| `type` | ❌ | `care` | Filter by cell type: `g12` \| `care` \| `children` \| `outreach` |

> **Cell type filter note:** The current HTML page applies `type` filtering **client-side** after the API returns. Pass `&type=care` as a query param to filter server-side instead — both approaches return the same result.

### Full Response

```json
{
  "items": [
    {
      "id": "report-001",
      "cellId": "cell-001",
      "cellName": "FCX Cell",
      "date": "2026-05-27",
      "didMeet": true,
      "noMeetReason": null,
      "leaderPresent": true,
      "conductedByIfAbsent": null,
      "location": "Church Hall",
      "timeStarted": "2026-05-27T09:00:00.000Z",
      "timeEnded": "2026-05-27T11:00:00.000Z",
      "language": "en",
      "subjectDiscussed": "sunday_sermon",
      "otherSubjectReason": null,
      "cellType": "care",
      "g12LeaderUid": "uid-g12-1",
      "attendance": [
        { "userUid": "uid-1", "name": "Saman S.", "status": "present", "isNew": false },
        { "userUid": "uid-2", "name": "Nimal P.", "status": "absent",  "isNew": false }
      ],
      "contactedAbsentees": "yes",
      "absenteeNotes": null,
      "additionalVisitors": 2,
      "childrenCount": 0,
      "satisfactionRate": 4,
      "photoUrls": [],
      "additionalInfo": null,
      "voided": false,
      "clientReqId": "550e8400-e29b-41d4-a716-446655440000",
      "filledByUid": "uid-leader-1",
      "createdAt": "2026-05-27T11:30:00.000Z"
    }
  ],
  "totalCells": 4
}
```

### Response Field Reference

| Field | Type | Frontend Use |
|-------|------|-------------|
| `items[]` | array | One entry per report |
| `items[].cellName` | string | Display name of the cell |
| `items[].date` | string | `YYYY-MM-DD` — use `.getDate()` for day number |
| `items[].didMeet` | boolean | `false` = no-meet report; skip for attendance stats |
| `items[].cellType` | string | `g12` \| `care` \| `children` \| `outreach` |
| `items[].attendance[]` | array | `status`: `present` \| `absent`; `isNew: true` = walk-in |
| `items[].additionalVisitors` | number | Unregistered visitors count |
| `items[].satisfactionRate` | number | 1–6 scale |
| `items[].filledByUid` | string | UID of the leader who filed the report |
| `items[].g12LeaderUid` | string | UID of the G12 supervisor |
| `items[].voided` | boolean | `true` = ignore for stats |
| `totalCells` | number | Number of cells with reports in scope |

---

## Call Flow

### Page Load

```
1. POST Firebase Auth              → get idToken
2. GET /me                         → sidebar name + avatar initials
3. GET /users/summary              → populate G12 dropdown + Leader dropdown
4. GET /cells?limit=100            → populate Cell dropdown
5. GET /cells/network/summary?month=2026-05        → stat cards + charts
6. GET /cells/network/reports?month=2026-05&limit=100  → reports table
```

### On Filter Change (month / G12 / Leader / Cell dropdowns)

```
GET /cells/network/summary?month=<month>
GET /cells/network/reports?month=<month>&g12Uid=<uid>&leaderUid=<uid>&cellId=<id>
```

### On Cell Type Tab Click (Care / Outreach / Children / G12)

```
Option A — client-side (current):
  Filter already-loaded items[] where r.cellType === selectedType

Option B — server-side (recommended):
  GET /cells/network/reports?month=<month>&type=care
```

---

## Default Test Credentials

| Field | Value |
|-------|-------|
| Email | `g12leader@cmp.com` |
| Password | `G12Lead@123` |
| Role | `g12` |

---

## Firebase Auth (Login)

```
Method:  POST
URL:     https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<FIREBASE_WEB_API_KEY>
Headers: Content-Type: application/json
Body:
{
  "email": "g12leader@cmp.com",
  "password": "G12Lead@123",
  "returnSecureToken": true
}

Response: { "idToken": "...", "email": "...", ... }
```

Use the returned `idToken` as the `Bearer` token on all backend requests. Firebase ID tokens expire after **1 hour** — call `user.getIdToken(true)` before each request in production.
