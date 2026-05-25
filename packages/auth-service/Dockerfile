FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/auth-service/package.json ./packages/auth-service/package.json
COPY packages/auth-service/tsconfig.json ./packages/auth-service/tsconfig.json

RUN npm install --workspace=packages/shared/firebase \
                --workspace=packages/shared/logger \
                --workspace=packages/shared/errors \
                --workspace=packages/shared/auth-middleware \
                --workspace=packages/shared/events \
                --workspace=packages/shared/internal-http-client \
                --workspace=packages/shared/response \
                --workspace=packages/shared/health \
                --workspace=packages/shared/tracing \
                --workspace=packages/auth-service

RUN npm run build --workspace=packages/shared/logger \
 && npm run build --workspace=packages/shared/firebase \
 && npm run build --workspace=packages/shared/errors \
 && npm run build --workspace=packages/shared/events \
 && npm run build --workspace=packages/shared/internal-http-client \
 && npm run build --workspace=packages/shared/auth-middleware \
 && npm run build --workspace=packages/shared/response \
 && npm run build --workspace=packages/shared/health \
 && npm run build --workspace=packages/shared/tracing

COPY packages/auth-service/src ./packages/auth-service/src

RUN npm run build --workspace=packages/auth-service

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/packages/auth-service/dist ./dist
COPY --from=builder /app/packages/shared            ./packages/shared
COPY --from=builder /app/node_modules               ./node_modules

ENV NODE_ENV=production

EXPOSE 3001
CMD ["node", "dist/server.js"]
