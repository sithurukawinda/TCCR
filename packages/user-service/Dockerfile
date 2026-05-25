FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/user-service/package.json ./packages/user-service/package.json
COPY packages/user-service/tsconfig.json ./packages/user-service/tsconfig.json

RUN npm install --workspace=packages/shared/firebase \
                --workspace=packages/shared/logger \
                --workspace=packages/shared/errors \
                --workspace=packages/shared/auth-middleware \
                --workspace=packages/shared/events \
                --workspace=packages/shared/internal-http-client \
                --workspace=packages/shared/response \
                --workspace=packages/shared/health \
                --workspace=packages/shared/tracing \
                --workspace=packages/user-service

RUN npm run build --workspace=packages/shared/logger \
 && npm run build --workspace=packages/shared/firebase \
 && npm run build --workspace=packages/shared/errors \
 && npm run build --workspace=packages/shared/events \
 && npm run build --workspace=packages/shared/internal-http-client \
 && npm run build --workspace=packages/shared/auth-middleware \
 && npm run build --workspace=packages/shared/response \
 && npm run build --workspace=packages/shared/health \
 && npm run build --workspace=packages/shared/tracing

COPY packages/user-service/src ./packages/user-service/src

RUN npm run build --workspace=packages/user-service

# ── Production image ────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/packages/user-service/dist ./dist
COPY --from=builder /app/packages/shared            ./packages/shared
COPY --from=builder /app/node_modules               ./node_modules

ENV NODE_ENV=production

EXPOSE 3002
CMD ["node", "dist/server.js"]
