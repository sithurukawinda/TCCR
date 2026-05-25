FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/analytics-service/package.json ./packages/analytics-service/package.json
COPY packages/analytics-service/tsconfig.json ./packages/analytics-service/tsconfig.json
RUN npm install --workspace=packages/shared/firebase --workspace=packages/shared/logger \
    --workspace=packages/shared/errors --workspace=packages/shared/auth-middleware \
    --workspace=packages/shared/response --workspace=packages/shared/health \
    --workspace=packages/shared/tracing --workspace=packages/analytics-service
RUN npm run build --workspace=packages/shared/logger \
 && npm run build --workspace=packages/shared/firebase \
 && npm run build --workspace=packages/shared/errors \
 && npm run build --workspace=packages/shared/auth-middleware \
 && npm run build --workspace=packages/shared/response \
 && npm run build --workspace=packages/shared/health \
 && npm run build --workspace=packages/shared/tracing
COPY packages/analytics-service/src ./packages/analytics-service/src
RUN npm run build --workspace=packages/analytics-service

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/analytics-service/dist ./dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3011
CMD ["node", "dist/server.js"]
