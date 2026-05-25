---
name: new-service
description: Scaffold a complete new microservice with all 4 Clean Architecture layers for the CMP backend
argument-hint: Service name and port (e.g. "analytics-service 3010")
allowed-tools: Read, Write, Glob, Bash
---

# New Service Scaffolder

You are scaffolding a brand-new microservice for the **CMP (Course Management Portal)** backend. Follow every step in order.

## 1. Parse `$ARGUMENTS`

Extract two values:

| Value | Rule | Example |
|-------|------|---------|
| **Service name** | kebab-case, ends with `-service` or `-worker` | `analytics-service` |
| **Port** | Integer, not already used by another service | `3010` |

Existing ports (do not reuse):

| Service | Port |
|---------|:----:|
| gateway | 3000 |
| auth-service | 3001 |
| user-service | 3002 |
| course-service | 3003 |
| enrollment-service | 3004 |
| progress-service | 3005 |
| storage-service | 3006 |
| notification-service | 3007 |
| audit-service | 3008 |
| outbox-worker | 3009 |

If either value is missing or the port is taken, ask before continuing.

## 2. Load Context

Read `.claude/blueprint/Backend_Blueprint.md` sections:
- §4 (Clean Architecture layers)
- §8 (Project Directory Structure)
- §12 (Service Implementation Patterns — `app.ts`, `container.ts`, controller pattern, DI)
- §18 (Environment Configuration)

## 3. Create Directory Structure

Create the following files under `packages/<service-name>/`:

```
packages/<service-name>/
  src/
    app.ts
    server.ts
    config.ts
    container.ts
    http/
      routes/
        index.ts
      controllers/
        .gitkeep
      validators/
        .gitkeep
    application/
      useCases/
        .gitkeep
      events/
        <ServiceName>EventPublisher.ts
    domain/
      entities/
        .gitkeep
      repositories/
        .gitkeep
    infrastructure/
      repositories/
        .gitkeep
  Dockerfile
  package.json
  tsconfig.json
```

### `src/app.ts`

```typescript
import express, { Application } from 'express';
import helmet from 'helmet';
import { json } from 'body-parser';
import { initFirebaseAdmin } from '@shared/firebase';
import { errorHandler } from '@shared/errors';
import { httpLogger } from '@shared/logger';
import { healthRouter } from '@shared/health';
import { serviceRouter } from './http/routes/index';

export function createApp(): Application {
  initFirebaseAdmin();

  const app = express();
  app.use(helmet());
  app.use(json({ limit: '1mb' }));
  app.use(httpLogger);
  app.use(healthRouter);
  app.use('/api/v1', serviceRouter);
  app.use(errorHandler);
  return app;
}
```

### `src/server.ts`

```typescript
import { createApp } from './app';
import { config } from './config';
import { logger } from '@shared/logger';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, service: config.serviceName }, 'Service started');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});
```

### `src/config.ts`

```typescript
export const config = {
  serviceName: process.env.SERVICE_NAME ?? '<service-name>',
  port:        parseInt(process.env.PORT ?? '<port>', 10),
  nodeEnv:     process.env.NODE_ENV ?? 'development',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY ?? '',
};
```

### `src/http/routes/index.ts`

```typescript
import { Router } from 'express';

const router = Router();

// TODO: mount route modules here

export { router as serviceRouter };
```

### `src/application/events/<ServiceName>EventPublisher.ts`

```typescript
import { OutboxEventPublisher } from '@shared/events';
import { WriteBatch } from 'firebase-admin/firestore';

export class <ServiceName>EventPublisher {
  private readonly outbox = new OutboxEventPublisher();

  async publish(
    type: string,
    payload: Record<string, unknown>,
    requestId: string,
    batch?: WriteBatch,
  ): Promise<void> {
    await this.outbox.publishWithBatch({ type, payload, requestId }, batch);
  }
}
```

### `src/container.ts`

```typescript
// Wire infrastructure → application → http here
// Example:
// const repo = new FirestoreExampleRepository();
// const useCase = new ExampleUseCase(repo);
// export const controller = new ExampleController(useCase);
```

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY packages/<service-name> ./packages/<service-name>

RUN npm ci --workspace=packages/<service-name> --include-workspace-root
RUN npm run build --workspace=packages/<service-name>

FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/<service-name>/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE <port>
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:<port>/healthz || exit 1

CMD ["node", "dist/server.js"]
```

### `package.json`

```json
{
  "name": "@slp/<service-name>",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev":   "ts-node-dev --respawn src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test":  "jest"
  },
  "dependencies": {
    "@shared/auth-middleware":     "*",
    "@shared/errors":              "*",
    "@shared/events":              "*",
    "@shared/firebase":            "*",
    "@shared/health":              "*",
    "@shared/logger":              "*",
    "@shared/response":            "*",
    "body-parser":                 "^1.20.0",
    "express":                     "^4.18.0",
    "firebase-admin":              "^12.0.0",
    "helmet":                      "^7.0.0",
    "uuid":                        "^9.0.0",
    "zod":                         "^3.22.0"
  }
}
```

### `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

## 4. Add to docker-compose.yml

Append to `docker-compose.yml`:

```yaml
  <service-name>:
    build: { context: ., dockerfile: packages/<service-name>/Dockerfile }
    ports: ['<port>:<port>']
    env_file: .env.local
```

## 5. Add Environment Variables

Append to `.env.example`:

```bash
# <Service Name>
SERVICE_<SERVICE_NAME_UPPER>_URL=http://localhost:<port>
```

## 6. Report

```
✅ Service scaffolded!

Service:   packages/<service-name>/
Port:      <port>

Files created:
  src/app.ts, server.ts, config.ts, container.ts
  src/http/routes/index.ts
  src/application/events/<ServiceName>EventPublisher.ts
  Dockerfile, package.json, tsconfig.json

Next steps:
  1. Add domain entities under src/domain/entities/
  2. Add repository interfaces under src/domain/repositories/
  3. Add Firestore repositories under src/infrastructure/repositories/
  4. Add use cases under src/application/useCases/
  5. Add routes + controllers under src/http/
  6. Wire everything in src/container.ts
  7. Run: npm install
  8. Run: npm run dev --workspace=packages/<service-name>
```

---

v1.0.0 — CMP (`slp-backend`)
