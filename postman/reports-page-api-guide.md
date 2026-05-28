# TCCR — Reports Page API Guide
## Page: `https://cms.bethelnet.au/en/g12/reports`

**Base URL:** `https://cms.api.bethelnet.au/api/v1`  
**Auth Header (all requests):** `Authorization: Bearer <firebase-id-token>`

---

## API Calls Summary

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/me` | Logged-in user profile (sidebar name/avatar) |
| 2 | GET | `/users/summary` | G12 + Leader dropdown data |
| 3 | GET | `/cells?limit=100` | Cell dropdown data |
| 4 | GET | `/cells/network/summary?from=YYYY-MM-DD` | Stat cards + charts |
| 5 | GET | `/cells/network/reports?from=YYYY-MM-DD&limit=100` | All Reports table |

> **⚠️ Breaking change (v2.30):** `?month=YYYY-MM` is no longer accepted.
> Both endpoints now require `?from=YYYY-MM-DD` (YYYY-MM-DD format).
> `to` is optional — omit it and the API defaults to today.

---

## 1. Get My Profile

```
Method:  GET
URL:     /me
Headers: Authorization: Bearer <token>
Body:    none
```

**Response fields used:** `firstName`, `lastName`, `profilePhotoUrl`, `roles`

---

## 2. Get All Users Summary *(for dropdowns)*

```
Method:  GET
URL:     /users/summary
Headers: Authorization: Bearer <token>
Body:    none
```

**Response fields used:** `g12[]`, `leaders[]` — each with `uid`, `firstName`, `lastName`, `displayName`

---

## 3. Get All Cells *(for cell dropdown)*

```
Method:  GET
URL:     /cells?limit=100
Headers: Authorization: Bearer <token>
Body:    none
```

**Response fields used:** `items[]` — each with `id`, `name`, `type`

---

## 4. Get Network Summary *(stat cards + charts)*

```
Method:  GET
URL:     /cells/network/summary?from=2026-05-01
Headers: Authorization: Bearer <token>
Body:    none
```

### Query Parameters

| Param | Required | Format | Example | Notes |
|-------|:--------:|--------|---------|-------|
| `from` | ✅ | `YYYY-MM-DD` | `2026-05-01` | Start date — **required** |
| `to` | ❌ | `YYYY-MM-DD` | `2026-05-31` | End date — defaults to today if omitted |
| `g12Uid` | ❌ | string | `uid-g12-1` | Filter by G12 supervisor |
| `leaderUid` | ❌ | string | `uid-leader-1` | Filter by cell leader |

### Date Range Examples

```
Default month view (1 May → today):
  ?from=2026-05-01

Exact month (1 May → 31 May):
  ?from=2026-05-01&to=2026-05-31

Custom range (20 May 2025 → 10 Apr 2026):
  ?from=2025-05-20&to=2026-04-10

With G12 filter:
  ?from=2026-05-01&g12Uid=uid-g12-1
```

### Full Response

```json
{
  "period": "May 2026",
  "from":   "2026-05-01",
  "to":     "2026-05-28",
  "scope": {
    "totalCells":   18,
    "totalLeaders": 6
  },
  "summary": {
    "cellsHeld":     9,
    "reportsFiled":  12,
    "activeLeaders": 4,
    "g12Active":     1
  },
  "attendance": {
    "present":         55,
    "roster":          52,
    "rate":            1.058,
    "visitors":        7,
    "avgSatisfaction": 4.1
  },
  "unreportedCells": [
    {
      "id":         "cell-001",
      "name":       "Care Cell A",
      "type":       "care",
      "leaderUid":  "uid-leader-1",
      "leaderName": "Saman S."
    }
  ],
  "weeklyBreakdown": [
    { "weekLabel": "W1", "reportCount": 2, "attendance": 10 },
    { "weekLabel": "W2", "reportCount": 3, "attendance": 15 },
    { "weekLabel": "W3", "reportCount": 4, "attendance": 20 },
    { "weekLabel": "W4", "reportCount": 3, "attendance": 7  }
  ],
  "meetingTypeBreakdown": {
    "g12":      0,
    "care":     9,
    "children": 3,
    "outreach": 0
  },
  "byLeader": [
    {
      "leaderUid":       "uid-leader-1",
      "leaderName":      "Saman S.",
      "g12Uid":          "uid-g12-1",
      "g12Name":         "G12 Leader Name",
      "cellCount":       2,
      "reportCount":     3,
      "attendance":      15,
      "avgSatisfaction": 4.2
    }
  ]
}
```

### Response Field → UI Mapping

| Field | Type | Reports Page UI |
|-------|------|----------------|
| `period` | string | Page heading — *"May 2026"* or *"20 May 2025 – 10 Apr 2026"* |
| `from` | string | Start date picker value |
| `to` | string | End date picker value |
| `scope.totalCells` | number | *"X of Y cells in scope"* sub-label |
| `scope.totalLeaders` | number | Leader count denominator |
| `summary.cellsHeld` | number | **Cells Held** stat card |
| `summary.reportsFiled` | number | **Reports Filed** stat card |
| `summary.activeLeaders` | number | **Active Leaders** stat card |
| `summary.g12Active` | number | **G12 Active** stat card |
| `attendance.present` | number | **Present** stat card |
| `attendance.roster` | number | **Total Roster** stat card |
| `attendance.rate` | number | **Attendance Rate** — multiply × 100 for `%` (e.g. `1.058` → `105.8%`) |
| `attendance.visitors` | number | **Visitors** stat card |
| `attendance.avgSatisfaction` | number | **Avg Satisfaction** stat card (1–6 scale) |
| `unreportedCells[]` | array | Alert banner — *"N cells haven't filed a report"*; each as a chip |
| `weeklyBreakdown[]` | array | Bar chart — `weekLabel` on X-axis, `reportCount` as bar height |
| `meetingTypeBreakdown` | object | Donut chart — keys are the four cell types |
| `byLeader[]` | array | **By Cell Leader** table |

---

## 5. Get Network Reports *(All Reports table)*

```
Method:  GET
URL:     /cells/network/reports?from=2026-05-01&limit=100
Headers: Authorization: Bearer <token>
Body:    none
```

### Query Parameters

| Param | Required | Format | Example | Notes |
|-------|:--------:|--------|---------|-------|
| `from` | ✅ | `YYYY-MM-DD` | `2026-05-01` | Start date — **required** |
| `to` | ❌ | `YYYY-MM-DD` | `2026-05-31` | End date — defaults to today if omitted |
| `limit` | ❌ | number | `100` | Max results (default 20, max 100) |
| `type` | ❌ | string | `care` | Cell type tab: `g12` \| `care` \| `children` \| `outreach` |
| `g12Uid` | ❌ | string | `uid-g12-1` | Filter by G12 supervisor |
| `leaderUid` | ❌ | string | `uid-leader-1` | Filter by cell leader |
| `cellId` | ❌ | string | `cell-001` | Filter by specific cell |

### Full Response

```json
{
  "items": [
    {
      "id":                  "report-001",
      "cellId":              "cell-001",
      "cellName":            "FCX Cell",
      "date":                "2026-05-27",
      "didMeet":             true,
      "noMeetReason":        null,
      "leaderPresent":       true,
      "conductedByIfAbsent": null,
      "location":            "Church Hall",
      "timeStarted":         "2026-05-27T09:00:00.000Z",
      "timeEnded":           "2026-05-27T11:00:00.000Z",
      "language":            "en",
      "subjectDiscussed":    "sunday_sermon",
      "otherSubjectReason":  null,
      "cellType":            "care",
      "g12LeaderUid":        "uid-g12-1",
      "attendance": [
        { "userUid": "uid-1", "name": "Saman S.", "status": "present", "isNew": false },
        { "userUid": "uid-2", "name": "Nimal P.", "status": "absent",  "isNew": false }
      ],
      "contactedAbsentees":  "yes",
      "absenteeNotes":       null,
      "additionalVisitors":  2,
      "childrenCount":       0,
      "satisfactionRate":    4,
      "photoUrls":           [],
      "additionalInfo":      null,
      "voided":              false,
      "clientReqId":         "550e8400-e29b-41d4-a716-446655440000",
      "filledByUid":         "uid-leader-1",
      "createdAt":           "2026-05-27T11:30:00.000Z"
    }
  ],
  "totalCells": 4
}
```

### Response Field → UI Mapping

| Field | Type | Reports Page UI |
|-------|------|----------------|
| `items[]` | array | One row per report in the All Reports table |
| `items[].cellName` | string | Cell column |
| `items[].date` | string | Date column (`YYYY-MM-DD`) |
| `items[].didMeet` | boolean | `false` = no-meet row (show differently) |
| `items[].cellType` | string | Cell Type tab filter chip |
| `items[].attendance[]` | array | `status: present/absent`, `isNew: true` = walk-in |
| `items[].additionalVisitors` | number | Visitor count badge |
| `items[].satisfactionRate` | number | Star rating display (1–6) |
| `items[].filledByUid` | string | Leader who filed |
| `items[].g12LeaderUid` | string | G12 supervisor UID |
| `items[].voided` | boolean | `true` = strike-through / grey row |
| `totalCells` | number | *"Showing reports from N cells"* |

---

## Call Flow

### Page Load (default: start of current month → today)

```
1. POST Firebase Auth (identitytoolkit)     → idToken
2. GET /me                                  → sidebar user name + avatar
3. GET /users/summary                       → G12 dropdown + Leader dropdown
4. GET /cells?limit=100                     → Cell dropdown
5. GET /cells/network/summary?from=2026-05-01          → stat cards + charts
6. GET /cells/network/reports?from=2026-05-01&limit=100 → reports table
```

### On Date Range Change

```
from only (start date → today):
  GET /cells/network/summary?from=<startDate>
  GET /cells/network/reports?from=<startDate>&limit=100

from + to (exact range):
  GET /cells/network/summary?from=<startDate>&to=<endDate>
  GET /cells/network/reports?from=<startDate>&to=<endDate>&limit=100
```

### On Filter Dropdown Change (G12 / Leader / Cell)

```
GET /cells/network/summary?from=<date>&g12Uid=<uid>
GET /cells/network/reports?from=<date>&g12Uid=<uid>&leaderUid=<uid>&cellId=<id>&limit=100
```

### On Cell Type Tab Click (Care / Outreach / Children / G12)

```
Server-side (recommended):
  GET /cells/network/reports?from=<date>&type=care&limit=100

Note: Summary stats are NOT re-fetched on tab click —
      they always show all-type totals.
```

---

## Error Responses

**`400`** — `from` param missing
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "from must be YYYY-MM-DD"
  },
  "requestId": "..."
}
```

**`403`** — wrong role (member or student)
```json
{
  "error": { "code": "FORBIDDEN", "message": "..." },
  "requestId": "..."
}
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

Use the returned `idToken` as the `Bearer` token on all backend requests.  
Firebase ID tokens expire after **1 hour** — call `user.getIdToken(true)` before each request.
