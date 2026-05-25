---
name: new-endpoint
description: Add a new REST endpoint to an existing CMP service — route, controller, use case, Zod validator, container wiring
argument-hint: Service name, HTTP method, path, and role (e.g. "enrollment-service POST /admin/enrollments/:id/cancel admin")
allowed-tools: Read, Write, Glob, Bash
---

# New Endpoint

You are adding a new REST endpoint to an existing service in the **CMP (Course Management Portal)** backend. Follow every step in order.

## 1. Parse `$ARGUMENTS`

Extract four values:

| Value | Example |
|-------|---------|
| **Service** | `enrollment-service` |
| **Method** | `POST` |
| **Path** | `/admin/enrollments/:id/cancel` |
| **Role(s)** | `admin` (one of: `student`, `admin`, `super_admin`, or `public`) |

If any value is missing, ask before continuing.

## 2. Load Context

Read these files:
- `.claude/blueprint/Backend_Blueprint.md` §12 (Controller Pattern, RBAC Route Definition, DI)
- `.claude/APIdocument/API_Document.md` — find if a similar endpoint already exists

Check the target service:
```bash
ls packages/<service-name>/src/http/routes/
ls packages/<service-name>/src/http/controllers/
ls packages/<service-name>/src/application/useCases/
ls packages/<service-name>/src/container.ts
```

## 3. Derive Names

From the path and method, derive:

| Value | Rule | Example |
|-------|------|---------|
| **Use case class** | PascalCase verb+noun + `UseCase` | `CancelEnrollmentUseCase` |
| **Controller method** | camelCase verb+noun | `cancelEnrollment` |
| **Route file** | existing route file that best matches the path prefix | `enrollment.routes.ts` |
| **Validator name** | PascalCase + `Schema` (Zod) | `CancelEnrollmentSchema` |

## 4. Create the Zod Validator

Create `packages/<service-name>/src/http/validators/<ValidatorName>.ts`:

```typescript
import { z } from 'zod';

// Params (path variables)
export const <ValidatorName>Params = z.object({
  id: z.string().min(1),
  // add other path params
});

// Body (for POST/PATCH only — omit for GET/DELETE)
export const <ValidatorName>Body = z.object({
  // add body fields
});

export type <ValidatorName>ParamsType = z.infer<typeof <ValidatorName>Params>;
export type <ValidatorName>BodyType  = z.infer<typeof <ValidatorName>Body>;
```

## 5. Create the Use Case

Create `packages/<service-name>/src/application/useCases/<UseCaseName>.ts`:

```typescript
import { IExampleRepository } from '@/domain/repositories/IExampleRepository';
import { createHttpError } from '@shared/errors';

interface <UseCaseName>Input {
  // define input fields
  actorUid: string;
}

export class <UseCaseName> {
  constructor(
    private readonly repo: IExampleRepository,
    // inject other dependencies
  ) {}

  async execute(input: <UseCaseName>Input): Promise<void> {
    // 1. Load resource
    // 2. Validate business rules — throw createHttpError on violations
    // 3. Mutate domain entity
    // 4. Persist
    // 5. Publish domain event via outbox (if side-effects needed)
  }
}
```

## 6. Create the Controller Method

Open `packages/<service-name>/src/http/controllers/<ControllerName>.ts` and add:

```typescript
<controllerMethod> = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = <ValidatorName>Params.parse(req.params);
    const body   = <ValidatorName>Body.parse(req.body);   // omit for GET/DELETE
    const { uid: actorUid } = (req as AuthenticatedRequest).principal;

    await this.<useCaseInstance>.execute({ ...params, ...body, actorUid });
    sendSuccess(res, null, /* 200 or 204 */);
  } catch (err) {
    next(err);
  }
};
```

If the controller file doesn't exist yet, create it with the full class structure:

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/auth-middleware';
import { sendSuccess } from '@shared/response';
import { <UseCaseName> } from '@/application/useCases/<UseCaseName>';

export class <ControllerName>Controller {
  constructor(private readonly <useCaseName>: <UseCaseName>) {}

  <controllerMethod> = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // ...
    } catch (err) {
      next(err);
    }
  };
}
```

## 7. Register the Route

Open the appropriate route file and add:

```typescript
import { authenticate, authorize } from '@shared/auth-middleware';
import { <ControllerName>Controller } from '../controllers/<ControllerName>Controller';

// Inside the router:
router.<method>('<path>',
  authenticate(),
  authorize('<role>'),
  controller.<controllerMethod>,
);
```

If `role` is `public`, omit `authenticate()` and `authorize()`.

## 8. Wire into `container.ts`

Open `packages/<service-name>/src/container.ts` and add:

```typescript
import { <UseCaseName> } from './application/useCases/<UseCaseName>';
import { <ControllerName>Controller } from './http/controllers/<ControllerName>Controller';

const <useCaseName> = new <UseCaseName>(existingRepo /*, other deps */);
export const <controllerName>Controller = new <ControllerName>Controller(<useCaseName>);
```

Then import and use `<controllerName>Controller` in the route file.

## 9. HTTP Status Code Check

Confirm the response status matches the policy:

| Case | Status |
|------|--------|
| Resource created | 201 |
| Update / action with response body | 200 |
| Delete or action with no body | 204 |
| Validation failure | 400 (thrown by Zod `parse`) |
| Unauthorized | 401 (thrown by `authenticate()`) |
| Forbidden | 403 (thrown by `authorize()`) |
| Not found | 404 |
| Business rule violation | 409 or 422 |

## 10. Report

```
✅ Endpoint added!

Service:    packages/<service-name>/
Endpoint:   <METHOD> /api/v1<path>
Role:       <role>

Files created / modified:
  + src/http/validators/<ValidatorName>.ts     (new)
  + src/application/useCases/<UseCaseName>.ts  (new)
  ~ src/http/controllers/<ControllerName>.ts   (modified)
  ~ src/http/routes/<routeFile>.ts             (modified)
  ~ src/container.ts                           (modified)

Next steps:
  1. Fill in the use case business logic
  2. Add unit tests: packages/<service-name>/tests/unit/<UseCaseName>.test.ts
  3. Add integration test: packages/<service-name>/tests/integration/<endpoint>.test.ts
  4. npm run type-check
```

---

v1.0.0 — CMP (`slp-backend`)
