---
name: test-unit
description: Generate Jest unit tests for a CMP use case — mocks repos and clients, covers happy path, error cases, and edge cases
argument-hint: Service name and use case class name (e.g. "course-service PublishCourseUseCase")
allowed-tools: Read, Write, Glob, Bash
---

# Unit Test Generator

You are generating Jest unit tests for a use case in the **CMP (Course Management Portal)** backend. Follow every step in order.

## 1. Parse `$ARGUMENTS`

Extract two values:

| Value | Example |
|-------|---------|
| **Service** | `course-service` |
| **Use case class** | `PublishCourseUseCase` |

Derive:

| Value | Rule | Example |
|-------|------|---------|
| **Test file** | `tests/unit/<ClassName>.test.ts` | `tests/unit/PublishCourseUseCase.test.ts` |
| **Source file** | `src/application/useCases/<ClassName>.ts` | `src/application/useCases/PublishCourseUseCase.ts` |

If either value is missing, ask before continuing.

## 2. Load Context

Read the use case source file:
```bash
cat packages/<service-name>/src/application/useCases/<ClassName>.ts
```

Read the domain entity it operates on:
```bash
cat packages/<service-name>/src/domain/entities/<Entity>.ts
```

Read one existing unit test in the service for style reference:
```bash
ls packages/<service-name>/tests/unit/
```

Read `.claude/blueprint/Backend_Blueprint.md` §19 (Testing Strategy — unit test pattern, `jest.clearAllMocks()` in `beforeEach`).

## 3. Analyse the Use Case

Before writing tests, identify:

- **Input interface** — what fields does `execute()` accept?
- **Dependencies** — which repositories and clients are constructor-injected?
- **Happy path** — what does a successful execution return?
- **Error cases** — what `createHttpError` calls exist? (404, 409, 422, etc.)
- **Idempotent?** — does it return early when already in target state?
- **Publishes event?** — does it call `eventPublisher.publish`?
- **Batch commit?** — does it use `db.batch()`?

## 4. Generate the Test File

Create `packages/<service-name>/tests/unit/<ClassName>.test.ts`:

```typescript
import { <ClassName> } from '@/application/useCases/<ClassName>';
import { <Entity> } from '@/domain/entities/<Entity>';
// import other entities and value objects as needed

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mock<Repo> = {
  findById:   jest.fn(),
  create:     jest.fn(),
  update:     jest.fn(),
  softDelete: jest.fn(),
  // add only methods the use case actually calls
};

const mockEventPublisher = {
  publish: jest.fn(),
};

// ─── System Under Test ───────────────────────────────────────────────────────

const useCase = new <ClassName>(
  mock<Repo> as any,
  mockEventPublisher as any,
  // other injected deps
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function make<Entity>(overrides: Partial<any> = {}): <Entity> {
  return new <Entity>({
    id:        'entity-1',
    // fill in minimal valid fields
    ...overrides,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('<ClassName>', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    it('<describes expected successful outcome>', async () => {
      mock<Repo>.findById.mockResolvedValue(make<Entity>());
      mock<Repo>.update.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      const result = await useCase.execute({
        <id>:     'entity-1',
        actorUid: 'actor-uid-1',
        // other required inputs
      });

      expect(result.<field>).toBe(<expectedValue>);
      expect(mock<Repo>.update).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        '<domain>.<action>',
        expect.objectContaining({ actorUid: 'actor-uid-1' }),
        expect.any(String),
        expect.anything(),
      );
    });
  });

  // ── 404 — resource not found ───────────────────────────────────────────────

  describe('execute — not found', () => {
    it('throws 404 when <entity> does not exist', async () => {
      mock<Repo>.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ <id>: 'missing-id', actorUid: 'actor-1' })
      ).rejects.toMatchObject({
        status:    404,
        errorCode: '<ENTITY>_NOT_FOUND',
      });

      expect(mock<Repo>.update).not.toHaveBeenCalled();
    });
  });

  // ── 409 — invalid state transition ────────────────────────────────────────

  describe('execute — invalid state', () => {
    it('throws 409 when <entity> is already in <state>', async () => {
      mock<Repo>.findById.mockResolvedValue(make<Entity>({ state: '<invalidState>' }));

      await expect(
        useCase.execute({ <id>: 'entity-1', actorUid: 'actor-1' })
      ).rejects.toMatchObject({
        status:    409,
        errorCode: 'INVALID_STATE',
      });
    });
  });

  // ── 422 — business rule violation ─────────────────────────────────────────

  describe('execute — business rule violation', () => {
    it('throws 422 when <business rule is violated>', async () => {
      mock<Repo>.findById.mockResolvedValue(make<Entity>({ <field>: <invalidValue> }));

      await expect(
        useCase.execute({ <id>: 'entity-1', actorUid: 'actor-1' })
      ).rejects.toMatchObject({
        status:    422,
        errorCode: '<RULE_VIOLATED>',
      });
    });
  });

  // ── Idempotency (include only if use case is idempotent) ──────────────────

  describe('execute — idempotency', () => {
    it('returns existing record unchanged when already in target state', async () => {
      const alreadyDone = make<Entity>({ state: '<targetState>', completedAt: '2026-05-01T10:00:00Z' });
      mock<Repo>.findById.mockResolvedValue(alreadyDone);

      const result = await useCase.execute({ <id>: 'entity-1', actorUid: 'actor-1' });

      expect(result.completedAt).toBe('2026-05-01T10:00:00Z');   // unchanged
      expect(mock<Repo>.update).not.toHaveBeenCalled();           // no write
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();  // no event
    });
  });

  // ── No event on failure ───────────────────────────────────────────────────

  describe('execute — no side effects on failure', () => {
    it('does not publish event when use case throws', async () => {
      mock<Repo>.findById.mockResolvedValue(null);

      await expect(useCase.execute({ <id>: 'x', actorUid: 'a' })).rejects.toThrow();
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
    });
  });
});
```

Remove sections that don't apply (e.g., remove idempotency block if the use case is not idempotent, remove event assertions if no event is published).

Add additional `it()` blocks for any other error branches found in the use case source.

## 5. Create the `tests/unit/` Directory if Missing

```bash
mkdir -p packages/<service-name>/tests/unit
```

## 6. Report

```
✅ Unit tests generated!

File: packages/<service-name>/tests/unit/<ClassName>.test.ts

Test cases written:
  ✓ Happy path — <describe outcome>
  ✓ 404 — <entity> not found
  ✓ 409 — invalid state (if applicable)
  ✓ 422 — business rule violation (if applicable)
  ✓ Idempotency — no write on already-completed (if applicable)
  ✓ No side effects on failure

Mocks:
  <list mocked dependencies>

Run tests:
  npx jest packages/<service-name>/tests/unit/<ClassName>.test.ts
```

## Errors

| Issue | Action |
|-------|--------|
| Use case source file not found | Stop — create the use case first with `/new-use-case` |
| Mock missing a method the use case calls | Add the method to the mock object |
| `jest.clearAllMocks()` missing from `beforeEach` | Always add — prevents mock state bleeding between tests |
| Test asserts on implementation detail (e.g. internal variable) | Test observable outputs only — return values, thrown errors, mock call args |

---

v1.0.0 — CMP (`slp-backend`)
