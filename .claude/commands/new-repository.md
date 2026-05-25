---
name: new-repository
description: Scaffold a Firestore repository implementing a domain interface for the CMP backend — findById, create, update, softDelete, cursor pagination
argument-hint: Service name and entity name (e.g. "course-service Course")
allowed-tools: Read, Write, Glob, Bash
---

# New Firestore Repository

You are scaffolding a Firestore repository for the **CMP (Course Management Portal)** backend. Follow every step in order.

## 1. Parse `$ARGUMENTS`

Extract two values:

| Value | Rule | Example |
|-------|------|---------|
| **Service** | Existing service directory name | `course-service` |
| **Entity** | PascalCase entity name | `Course` |

Derive from these:

| Value | Rule | Example |
|-------|------|---------|
| **Collection name** | snake_case plural | `courses` |
| **Interface file** | `I<Entity>Repository.ts` | `ICourseRepository.ts` |
| **Implementation file** | `Firestore<Entity>Repository.ts` | `FirestoreCourseRepository.ts` |
| **Document ID** | See step 3 | auto UUID or composite key |

If any value is missing, ask before continuing.

## 2. Load Context

Read:
- `.claude/blueprint/Backend_Blueprint.md` §11 (Data Architecture — Collection Ownership Map, Firestore Repository Pattern, cursor pagination, soft deletes)
- `.claude/blueprint/Backend_Blueprint.md` §12 (`toDomain` / `toFirestore` mapping pattern)

Check if the entity already has a domain interface:
```bash
ls packages/<service-name>/src/domain/repositories/
ls packages/<service-name>/src/domain/entities/
```

Read the entity class to understand its fields.

## 3. Determine Document ID Strategy

| Entity | Document ID |
|--------|-------------|
| Most entities | Auto UUID — generated in use case before `repo.create()` |
| `enrollments` | `${studentUid}_${courseId}` — composite |
| `progress` | `${studentUid}_${subjectId}` — composite |
| `users` | Firebase Auth UID — set externally |

State which strategy applies to this entity.

## 4. Create the Domain Interface

Create `packages/<service-name>/src/domain/repositories/I<Entity>Repository.ts`:

```typescript
import { <Entity> } from '@/domain/entities/<Entity>';

export interface I<Entity>Repository {
  findById(id: string): Promise<<Entity> | null>;
  findAll(opts: { limit: number; cursor?: string }): Promise<{
    items:      <Entity>[];
    nextCursor: string | null;
  }>;
  create(entity: <Entity>): Promise<void>;
  update(entity: <Entity>): Promise<void>;
  softDelete(id: string): Promise<void>;
}
```

Add or remove methods to match what the use cases actually need. Include only methods that have callers — do not add speculative methods.

## 5. Create the Firestore Implementation

Create `packages/<service-name>/src/infrastructure/repositories/Firestore<Entity>Repository.ts`:

```typescript
import { getFirestore, FieldValue, WriteBatch } from 'firebase-admin/firestore';
import { I<Entity>Repository } from '@/domain/repositories/I<Entity>Repository';
import { <Entity> } from '@/domain/entities/<Entity>';

const db = getFirestore();
const COLLECTION = '<collection_name>';

export class Firestore<Entity>Repository implements I<Entity>Repository {

  async findById(id: string): Promise<<Entity> | null> {
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return this.toDomain(doc.id, doc.data()!);
  }

  async findAll(opts: {
    limit:   number;
    cursor?: string;
    // add filter params as needed (e.g. state, courseId)
  }): Promise<{ items: <Entity>[]; nextCursor: string | null }> {
    let query = db.collection(COLLECTION)
      .where('deletedAt', '==', null)   // exclude soft-deleted (omit if entity has no deletedAt)
      .orderBy('createdAt', 'desc')
      .limit(opts.limit + 1);

    if (opts.cursor) {
      const cursorDoc = await db.collection(COLLECTION).doc(opts.cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snapshot = await query.get();
    const items      = snapshot.docs.slice(0, opts.limit).map(d => this.toDomain(d.id, d.data()));
    const nextCursor = snapshot.docs.length > opts.limit
      ? snapshot.docs[opts.limit - 1].id
      : null;

    return { items, nextCursor };
  }

  async create(entity: <Entity>): Promise<void> {
    await db.collection(COLLECTION).doc(entity.id).set({
      ...this.toFirestore(entity),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async update(entity: <Entity>): Promise<void> {
    await db.collection(COLLECTION).doc(entity.id).update({
      ...this.toFirestore(entity),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async updateWithBatch(entity: <Entity>, batch: WriteBatch): Promise<void> {
    const ref = db.collection(COLLECTION).doc(entity.id);
    batch.update(ref, {
      ...this.toFirestore(entity),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async softDelete(id: string): Promise<void> {
    await db.collection(COLLECTION).doc(id).update({
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Maps Firestore document data → domain entity
  private toDomain(id: string, data: FirebaseFirestore.DocumentData): <Entity> {
    return new <Entity>({
      id,
      // map each field — convert Firestore Timestamp to ISO string:
      // createdAt: data.createdAt?.toDate().toISOString() ?? null,
    });
  }

  // Maps domain entity → plain Firestore-writable object (no timestamps)
  private toFirestore(entity: <Entity>): Record<string, unknown> {
    return {
      // list all persisted fields
    };
  }
}
```

Remove methods that are not in the interface. Add `updateWithBatch` only if the use case needs atomic outbox writes.

## 6. Add Composite Index (if needed)

If any query uses multiple `where()` filters or `orderBy()` on different fields, add an entry to `packages/<service-name>/firestore.indexes.json`:

```json
{
  "collectionGroup": "<collection_name>",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "<filterField>", "order": "ASCENDING" },
    { "fieldPath": "<orderField>",  "order": "DESCENDING" }
  ]
}
```

## 7. Wire into `container.ts`

Open `packages/<service-name>/src/container.ts` and add:

```typescript
import { Firestore<Entity>Repository } from './infrastructure/repositories/Firestore<Entity>Repository';

const <entityRepo> = new Firestore<Entity>Repository();
```

Then pass `<entityRepo>` to any use cases that depend on `I<Entity>Repository`.

## 8. Report

```
✅ Repository scaffolded!

Entity:     <Entity>
Collection: <collection_name>
Document ID strategy: <auto UUID | composite | external UID>

Files created:
  + packages/<service-name>/src/domain/repositories/I<Entity>Repository.ts
  + packages/<service-name>/src/infrastructure/repositories/Firestore<Entity>Repository.ts

Composite index needed: <yes / no>

Next steps:
  1. Fill in toDomain() and toFirestore() field mappings
  2. Add the repository to container.ts
  3. Inject into use cases via I<Entity>Repository interface
  4. If composite index needed, run: npx firebase deploy --only firestore:indexes
  5. npm run type-check
```

## Errors

| Issue | Action |
|-------|--------|
| Cross-service collection access | Stop — each service must only read its own collections; use internal HTTP for cross-service data |
| Missing composite index for multi-field query | Add to `firestore.indexes.json` — Firestore will reject the query at runtime without it |
| `toDomain` uses raw string field paths | Use typed field access only; no string interpolation in queries |
| Soft-delete filter missing from `findAll` | Add `where('deletedAt', '==', null)` — omitting it leaks deleted records |

---

v1.0.0 — CMP (`slp-backend`)
