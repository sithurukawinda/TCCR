---
name: new-event
description: Add a new domain event to the CMP event catalogue — publisher in source service, handler in notification/audit service, outbox entry
argument-hint: Source service and event type (e.g. "course-service course.archived")
allowed-tools: Read, Write, Glob, Bash
---

# New Domain Event

You are adding a new domain event to the **CMP (Course Management Portal)** transactional outbox event catalogue. Follow every step in order.

## 1. Parse `$ARGUMENTS`

Extract two values:

| Value | Rule | Example |
|-------|------|---------|
| **Source service** | Existing service that publishes the event | `course-service` |
| **Event type** | `<domain>.<action>` dot-notation, lowercase | `course.archived` |

If either is missing, ask before continuing.

## 2. Load Context

Read:
- `.claude/blueprint/Backend_Blueprint.md` §7 (Event Bus — Domain Events Catalogue, event schema, `DomainEvent` type)
- `.claude/blueprint/Backend_Blueprint.md` §13 (Transactional Outbox Pattern — `OutboxEventPublisher`, batch commit)
- `.claude/blueprint/Backend_Blueprint.md` §5.7 (Notification Service — event subscriptions and handler pattern)
- `.claude/blueprint/Backend_Blueprint.md` §5.8 (Audit Service — `AuditEventHandler`)

Then check existing event publishers in the source service:
```bash
ls packages/<source-service>/src/application/events/
```

And existing handlers in notification-service and audit-service:
```bash
ls packages/notification-service/src/application/handlers/
ls packages/audit-service/src/application/handlers/
```

## 3. Define the Event

State before writing any files:

| Field | Value |
|-------|-------|
| **Event type string** | `<domain>.<action>` |
| **Published by** | `<source-service>` |
| **Consumed by** | notification-service? audit-service? both? |
| **Key payload fields** | List all fields the event carries |
| **Notification needed?** | Yes / No — if yes, which actors receive it (student / admin / super_admin) and via which channel (in-app / email / push) |
| **Audit needed?** | Yes / No — always yes for admin/super_admin actions |

## 4. Add the Event Type to the Publisher

Open `packages/<source-service>/src/application/events/<Service>EventPublisher.ts`.

Add a typed publish method for the new event:

```typescript
async publish<EventAction>(
  payload: {
    actorUid:  string;
    // other event-specific fields
    requestId: string;
  },
  batch?: WriteBatch,
): Promise<void> {
  await this.outbox.publishWithBatch(
    {
      type:      '<domain>.<action>',
      payload,
      requestId: payload.requestId,
    },
    batch,
  );
}
```

If the publisher class does not exist yet, create it:

```typescript
// packages/<source-service>/src/application/events/<Service>EventPublisher.ts
import { OutboxEventPublisher } from '@shared/events';
import { WriteBatch } from 'firebase-admin/firestore';

export class <Service>EventPublisher {
  private readonly outbox = new OutboxEventPublisher();

  async publish(
    type:      string,
    payload:   Record<string, unknown>,
    requestId: string,
    batch?:    WriteBatch,
  ): Promise<void> {
    await this.outbox.publishWithBatch({ type, payload, requestId }, batch);
  }
}
```

## 5. Add Notification Handler (if needed)

Create `packages/notification-service/src/application/handlers/<EventAction>Handler.ts`:

```typescript
// packages/notification-service/src/application/handlers/<PascalEventAction>Handler.ts
import { INotificationRepository } from '@/domain/repositories/INotificationRepository';
import { NotificationDispatcher }  from '@/application/services/NotificationDispatcher';
import { logger } from '@shared/logger';

interface <EventAction>Payload {
  // match the payload fields from step 3
  actorUid:  string;
  requestId: string;
}

export class <PascalEventAction>Handler {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly dispatcher:       NotificationDispatcher,
  ) {}

  async handle(payload: <EventAction>Payload): Promise<void> {
    // 1. Persist in-app notification (authoritative)
    await this.notificationRepo.create({
      userUid:  payload.<recipientUid>,
      type:     '<domain>.<action>',
      title:    '<Notification Title>',
      body:     '<Notification body text>',
      read:     false,
    });

    // 2. Send email (3-retry exponential backoff — never throws)
    await this.dispatcher.dispatchEmail(
      payload.<recipientEmail>,
      '<Email Subject>',
      '<Email body HTML>',
      payload.requestId,
    );

    // 3. Send push if opted-in (best-effort — never throws)
    if (payload.<fcmToken>) {
      await this.dispatcher.dispatchPush(
        payload.<fcmToken>,
        '<Push title>',
        '<Push body>',
      );
    }

    logger.info({ eventType: '<domain>.<action>', requestId: payload.requestId },
      'Notification dispatched');
  }
}
```

## 6. Register the Handler in the Outbox Worker Dispatcher

Open `packages/outbox-worker/src/dispatcher/EventDispatcher.ts` and add a case:

```typescript
case '<domain>.<action>':
  await this.<handlerInstance>.handle(payload);
  break;
```

Also inject the new handler into the `EventDispatcher` constructor and `container.ts` of outbox-worker.

## 7. Add Audit Logging (if needed)

In the use case that publishes this event, also publish an `audit.action` event in the same batch:

```typescript
await this.eventPublisher.publish(
  'audit.action',
  {
    actorUid:   input.actorUid,
    action:     '<domain>.<action>',
    targetType: '<EntityType>',
    targetId:   input.<entityId>,
    payload:    { /* relevant context */ },
    requestId:  input.requestId,
  },
  input.requestId,
  batch,
);
```

The Audit Service's `AuditEventHandler` will pick this up automatically — no changes needed there.

## 8. Update the Event Catalogue in Blueprint

Append a row to the Domain Events Catalogue table in `.claude/blueprint/Backend_Blueprint.md` §7:

```
| `<domain>.<action>` | <source-service> | <consuming services> | <key payload fields> |
```

## 9. Report

```
✅ Domain event added!

Event type:   <domain>.<action>
Published by: <source-service>
Consumed by:  <notification-service / audit-service / both>

Files created / modified:
  ~ packages/<source-service>/src/application/events/<Service>EventPublisher.ts   (modified)
  + packages/notification-service/src/application/handlers/<EventAction>Handler.ts (new, if applicable)
  ~ packages/outbox-worker/src/dispatcher/EventDispatcher.ts                       (modified)
  ~ .claude/blueprint/Backend_Blueprint.md §7                                      (event catalogue updated)

Payload fields: <list>
Audit logged:   <yes / no>

Next steps:
  1. Call the publisher from the relevant use case (inside a batch commit)
  2. Inject the new handler into outbox-worker/src/container.ts
  3. Test with Firebase emulators: npx firebase emulators:start --only firestore
  4. Verify outbox-worker dispatches the event within 5 seconds
```

## Errors

| Issue | Action |
|-------|--------|
| Event published outside a Firestore batch | Flag — event can be lost on crash; always use `publishWithBatch` with the business data batch |
| Handler throws and blocks the outbox worker | Handler must catch and log — never re-throw from a notification handler |
| Push delivery failure treated as fatal | Push is best-effort (NFR-NOT-007); log as warn, do not throw |
| Email failure not retried | Must use `NotificationDispatcher.dispatchEmail` which handles 3-retry backoff |

---

v1.0.0 — CMP (`slp-backend`)
