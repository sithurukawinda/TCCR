FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/notification-service/package.json ./packages/notification-service/package.json
COPY packages/notification-service/tsconfig.json ./packages/notification-service/tsconfig.json
RUN npm install --workspace=packages/shared/firebase --workspace=packages/shared/logger \
    --workspace=packages/shared/errors --workspace=packages/shared/auth-middleware \
    --workspace=packages/shared/internal-http-client --workspace=packages/shared/response \
    --workspace=packages/shared/health --workspace=packages/notification-service
RUN npm run build --workspace=packages/shared/logger \
 && npm run build --workspace=packages/shared/firebase \
 && npm run build --workspace=packages/shared/errors \
 && npm run build --workspace=packages/shared/internal-http-client \
 && npm run build --workspace=packages/shared/auth-middleware \
 && npm run build --workspace=packages/shared/response \
 && npm run build --workspace=packages/shared/health
COPY packages/notification-service/src ./packages/notification-service/src
RUN npm run build --workspace=packages/notification-service

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/notification-service/dist ./dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3007
CMD ["node", "dist/server.js"]
