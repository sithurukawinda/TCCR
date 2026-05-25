#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# CMP — single-command startup (connects to online Firebase)
# Usage:  bash scripts/start.sh
# ─────────────────────────────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "▶  Starting all services..."
echo ""

npx concurrently \
  --kill-others-on-fail \
  --prefix-colors "bgBlue.bold,bgGreen.bold,bgYellow.bold,bgCyan.bold,bgMagenta.bold,bgRed.bold,bgWhite.bold,blue.bold,green.bold,yellow.bold" \
  --names          "GATEWAY,AUTH   ,USER   ,COURSE ,ENROLL ,PROGRES,STORAGE,NOTIFY ,AUDIT  ,OUTBOX " \
  "npm run dev --workspace=packages/gateway" \
  "npm run dev --workspace=packages/auth-service" \
  "npm run dev --workspace=packages/user-service" \
  "npm run dev --workspace=packages/course-service" \
  "npm run dev --workspace=packages/enrollment-service" \
  "npm run dev --workspace=packages/progress-service" \
  "npm run dev --workspace=packages/storage-service" \
  "npm run dev --workspace=packages/notification-service" \
  "npm run dev --workspace=packages/audit-service" \
  "npm run dev --workspace=packages/outbox-worker"
