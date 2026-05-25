FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/gateway/package.json ./packages/gateway/package.json
COPY packages/gateway/tsconfig.json ./packages/gateway/tsconfig.json

RUN npm install --workspace=packages/shared/health \
                --workspace=packages/shared/logger \
                --workspace=packages/gateway

RUN npm run build --workspace=packages/shared/logger \
 && npm run build --workspace=packages/shared/health

COPY packages/gateway/src ./packages/gateway/src

RUN npm run build --workspace=packages/gateway

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/packages/gateway/dist ./dist
COPY --from=builder /app/packages/shared       ./packages/shared
COPY --from=builder /app/node_modules          ./node_modules

ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/server.js"]
