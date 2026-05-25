FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/scheduled-jobs/package.json ./packages/scheduled-jobs/package.json
COPY packages/scheduled-jobs/tsconfig.json ./packages/scheduled-jobs/tsconfig.json
RUN npm install --workspace=packages/shared/firebase --workspace=packages/shared/logger \
    --workspace=packages/shared/events \
    --workspace=packages/scheduled-jobs
RUN npm run build --workspace=packages/shared/logger \
 && npm run build --workspace=packages/shared/firebase \
 && npm run build --workspace=packages/shared/events
COPY packages/scheduled-jobs/src ./packages/scheduled-jobs/src
RUN npm run build --workspace=packages/scheduled-jobs

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/scheduled-jobs/dist ./dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
CMD ["node", "dist/worker.js"]
