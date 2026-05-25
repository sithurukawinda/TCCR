FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/outbox-worker/package.json ./packages/outbox-worker/package.json
COPY packages/outbox-worker/tsconfig.json ./packages/outbox-worker/tsconfig.json
RUN npm install --workspace=packages/shared/firebase --workspace=packages/shared/logger \
    --workspace=packages/shared/internal-http-client \
    --workspace=packages/outbox-worker
RUN npm run build --workspace=packages/shared/logger \
 && npm run build --workspace=packages/shared/firebase \
 && npm run build --workspace=packages/shared/internal-http-client
COPY packages/outbox-worker/src ./packages/outbox-worker/src
RUN npm run build --workspace=packages/outbox-worker

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/outbox-worker/dist ./dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
CMD ["node", "dist/worker.js"]
