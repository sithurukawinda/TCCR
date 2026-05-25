---
name: new-use-case
description: Scaffold a use case with constructor injection, error handling, and optional outbox event publishing for the CMP backend
argument-hint: Service name and use case description (e.g. "course-service suspend course")
allowed-tools: Read, Write, Glob, Bash
---

# New Use Case

You are scaffolding a new application-layer use case for the **CMP (Course Management Portal)** backend. Follow every step in order.

## 1. Parse `$ARGUMENTS`

Extract two values:

| Value | Rule | Example |
|-------|------|---------|
| **Service** | Existing service directory name | `course-service` |
| **Description** | Short verb + noun phrase | `suspend course` |

Derive from the description:

| Value | Rule | Example |
|-------|------|---------|
| **Class name** | PascalCase verb + noun + `UseCase` | `SuspendCourseUseCase` |
| **File name** | `<ClassName>.ts` | `SuspendCourseUseCase.ts` |

If either value is missing, ask before continuing.

## 2. Load Context

Read:
- `.claude/blueprint/Backend_Blueprint.md` §4 (Clean Architecture layers — what belongs in application vs domain)
- `.claude/blueprint/Backend_Blueprint.md` §12 (Use case patterns — constructor injection, `createHttpError` usage)
- `.claude/blueprint/Backend_Blueprint.md` §13 (Outbox pattern — when to use `publishWithBatch`)
- `.claude/blueprint/Backend_Blueprint.md` §14 (Error handling — `createHttpError` signature and HTTP status policy)

Then read the target service to understand existing patterns:
```bash
ls packages/<service-name>/src/application/useCases/
ls packages/<service-name>/src/domain/repositories/
ls packages/<service-name>/src/application/events/
```

Read one existing use case in that service as a style reference.

## 3. Determine Dependencies

Before writing the file, state:

- Which **repository interfaces** from `domain/repositories/` this use case needs
- Whether it needs an **inter-service HTTP client** (from `application/clients/`)
- Whether it **publishes a domain event** via the outbox (if yes, which event type string)
- Whether the operation must be **idempotent** (already-completed state must be handled gracefully)

## 4. Create the Use Case File

Create `packages/<service-name>/src/application/useCases/<ClassName>.ts`:

### Template — no domain event

```typescript
import { I<Entity>Repository } from '@/domain/repositories/I<Entity>Repository';
import { createHttpError } from '@shared/errors';

interface <ClassName>Input {
  // all required inputs including actorUid for audit trail
  actorUid: string;
}

export class <ClassName> {
  constructor(
    private readonly <entityRepo>: I<Entity>Repository,
    // inject additional repos or clients
  ) {}

  async execute(input: <ClassName>Input): Promise</* return type or void */> {
    // 1. Load resource — 404 if not found
    const entity = await this.<entityRepo>.findById(input.<id>);
    if (!entity) throw createHttpError(404, '<ENTITY>_NOT_FOUND', '<Entity> not found.');

    // 2. Guard invalid state transitions — 409 for state conflicts, 422 for business rule violations
    // if (entity.state !== 'expected') throw createHttpError(409, 'INVALID_STATE', '...');

    // 3. Mutate domain entity via entity method (keep business logic in domain layer)
    entity.<action>();

    // 4. Persist
    await this.<entityRepo>.update(entity);

    return entity;
  }
}
```

### Template — with domain event (outbox)

```typescript
import { getFirestore } from 'firebase-admin/firestore';
import { I<Entity>Repository } from '@/domain/repositories/I<Entity>Repository';
import { <Service>EventPublisher } from '@/application/events/<Service>EventPublisher';
import { createHttpError } from '@shared/errors';

interface <ClassName>Input {
  actorUid: string;
}

export class <ClassName> {
  constructor(
    private readonly <entityRepo>:    I<Entity>Repository,
    private readonly eventPublisher:  <Service>EventPublisher,
  ) {}

  async execute(input: <ClassName>Input): Promise</* return type */> {
    const entity = await this.<entityRepo>.findById(input.<id>);
    if (!entity) throw createHttpError(404, '<ENTITY>_NOT_FOUND', '<Entity> not found.');

    // Business rule guards
    entity.<action>();

    // Write entity update + outbox event atomically
    const db    = getFirestore();
    const batch = db.batch();

    await this.<entityRepo>.updateWithBatch(entity, batch);
    await this.eventPublisher.publish(
      '<service>.<action>',
      { actorUid: input.actorUid, /* other payload fields */ },
      input.requestId,
      batch,
    );

    await batch.commit();

    return entity;
  }
}
```

### Template — idempotent operation

```typescript
export class <ClassName> {
  async execute(input: <ClassName>Input): Promise<Entity> {
    const existing = await this.repo.findBy<Key>(input.<key>);

    // Idempotent: already in target state — return unchanged
    if (existing?.state === '<targetState>') return existing;

    const entity = existing ?? Entity.createNew(/* ... */);
    entity.<action>();
    await this.repo.upsert(entity);

    return entity;
  }
}
```

Choose the template that matches the use case type. Merge patterns if needed (e.g., idempotent + domain event).

## 5. Wire into `container.ts`

Open `packages/<service-name>/src/container.ts` and add:

```typescript
import { <ClassName> } from './application/useCases/<ClassName>';

// After existing repo declarations:
const <instanceName> = new <ClassName>(existingRepo /*, other deps */);

// Export for use by controller:
export { <instanceName> };
```

## 6. Report

```
✅ Use case scaffolded!

File:       packages/<service-name>/src/application/useCases/<ClassName>.ts
Template:   <standard | with-event | idempotent>

Dependencies injected:
  - <list repos and clients>

Domain event: <event type string, or "none">
Idempotent:   <yes / no>

Next steps:
  1. Fill in business logic inside execute()
  2. Add the use case to container.ts
  3. Create a controller method that calls this use case
  4. Write unit tests: packages/<service-name>/tests/unit/<ClassName>.test.ts
  5. npm run type-check
```

## Errors

| Issue | Action |
|-------|--------|
| Service directory does not exist | Stop — run `/new-service` first |
| Repository interface not found in domain layer | Create the interface before the use case |
| Domain event published but no outbox batch used | Flag — event could be lost on crash; use batch commit |
| Business logic placed in controller | Move to use case — controllers must stay thin |

---

v1.0.0 — CMP (`slp-backend`)
