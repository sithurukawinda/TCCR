---
name: firestore-index
description: Generate the correct composite index entry for firestore.indexes.json from a query description for the CMP backend
argument-hint: Service name and query description (e.g. "enrollment-service enrollments where courseId and state ordered by createdAt desc")
allowed-tools: Read, Write, Glob, Bash
---

# Firestore Index Generator

You are generating a composite Firestore index entry for the **CMP (Course Management Portal)** backend. Follow every step in order.

## 1. Parse `$ARGUMENTS`

Extract the query intent from the description:

| Value | Example |
|-------|---------|
| **Service** | `enrollment-service` |
| **Collection** | `enrollments` |
| **Filter fields** (`where` clauses) | `courseId`, `state` |
| **Order field** | `createdAt` |
| **Order direction** | `desc` |
| **Query scope** | `COLLECTION` (default) or `COLLECTION_GROUP` (for sub-collections queried across parents) |

If the description is ambiguous, ask for the exact Firestore query before continuing.

## 2. Load Context

Read:
- `.claude/blueprint/Backend_Blueprint.md` §11 (Composite Indexes — existing `firestore.indexes.json` examples)

Then read the existing index file for the target service:
```bash
cat packages/<service-name>/firestore.indexes.json
```

If the file does not exist, it will be created in step 4.

Also read the relevant Firestore repository method to confirm the exact query fields and directions:
```bash
cat packages/<service-name>/src/infrastructure/repositories/Firestore<Entity>Repository.ts
```

## 3. Identify if an Index is Actually Required

Firestore requires a composite index when a query combines:
- Two or more `where()` clauses on **different fields**, OR
- A `where()` clause AND an `orderBy()` on a **different field**

Single-field queries and equality-only queries on one field do **not** need a composite index.

State whether an index is required and why.

## 4. Generate the Index Entry

```json
{
  "collectionGroup": "<collection_name>",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "<filterField1>", "order": "ASCENDING"  },
    { "fieldPath": "<filterField2>", "order": "ASCENDING"  },
    { "fieldPath": "<orderField>",   "order": "DESCENDING" }
  ]
}
```

### Field order rules (Firestore composite index requirements):

1. Equality filter fields first (`==` conditions)
2. Range/inequality filter fields next (`>`, `<`, `>=`, `<=`, `!=`)
3. `orderBy` field last — direction must match the query's `orderBy` direction
4. If querying sub-collections across all parents, use `"queryScope": "COLLECTION_GROUP"`

### Existing CMP indexes for reference:

```json
// courses: state + publishedAt + deletedAt
{ "fields": [
    { "fieldPath": "state",       "order": "ASCENDING"  },
    { "fieldPath": "publishedAt", "order": "DESCENDING" },
    { "fieldPath": "deletedAt",   "order": "ASCENDING"  }
]}

// enrollments: state + courseId + createdAt
{ "fields": [
    { "fieldPath": "state",     "order": "ASCENDING" },
    { "fieldPath": "courseId",  "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
]}

// progress: studentUid + courseId + state
{ "fields": [
    { "fieldPath": "studentUid", "order": "ASCENDING" },
    { "fieldPath": "courseId",   "order": "ASCENDING" },
    { "fieldPath": "state",      "order": "ASCENDING" }
]}

// notifications: userUid + createdAt
{ "fields": [
    { "fieldPath": "userUid",   "order": "ASCENDING"  },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
]}
```

## 5. Write or Update `firestore.indexes.json`

Read the current file and add the new index entry into the `"indexes"` array. Do not remove existing entries.

If the file does not exist, create it:

```json
{
  "indexes": [
    <new index entry>
  ],
  "fieldOverrides": []
}
```

Write the updated file to `packages/<service-name>/firestore.indexes.json`.

## 6. Check for Duplicate Index

Before writing, verify no existing entry already covers the same fields and directions. Firestore will reject duplicate indexes on deploy.

## 7. Report

```
✅ Firestore index generated!

Service:    packages/<service-name>/
Collection: <collection_name>
Scope:      <COLLECTION | COLLECTION_GROUP>

Index fields:
  <fieldPath1>  <ASCENDING | DESCENDING>
  <fieldPath2>  <ASCENDING | DESCENDING>
  ...

File updated: packages/<service-name>/firestore.indexes.json

Next steps:
  1. Deploy the index to your Firebase project:
     npx firebase deploy --only firestore:indexes --project <your-project-id>
  2. Wait for index build to complete (check Firebase Console → Firestore → Indexes)
  3. Indexes can take several minutes to build on large collections
  4. Queries using this index will fail with a Firestore error until the index is ready
```

## Errors

| Issue | Action |
|-------|--------|
| Index already exists for same fields | Do not add — return the existing entry |
| `orderBy` field not last in fields array | Reorder — Firestore requires equality filters first, then range filters, then orderBy |
| Sub-collection queried across multiple parents | Use `"queryScope": "COLLECTION_GROUP"` |
| Query uses only one `where()` with no `orderBy()` | No composite index needed — single-field indexes are automatic |

---

v1.0.0 — CMP (`slp-backend`)
