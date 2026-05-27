#!/bin/bash
# Find and display the next incomplete sprint

SPRINT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SPRINT_DIR" || exit 1

echo "🔍 Finding next sprint..."
echo ""

for sprint in sprint-*.md; do
    if grep -q "Status:** 🟡 Not Started" "$sprint" || grep -q "Status:** 🔵 In Progress" "$sprint"; then
        echo "📋 Next Sprint: $sprint"
        echo "──────────────────────────────"
        cat "$sprint"
        exit 0
    fi
done

echo "🎉 All sprints complete! Run the final checklist:"
echo ""
echo "  npm run type-check --workspace=packages/auth-service"
echo "  npm run type-check --workspace=packages/user-service"
echo "  npm run type-check --workspace=packages/notification-service"
echo "  npx jest packages/auth-service/tests/unit --no-coverage"
echo "  npx jest packages/user-service/tests/unit --no-coverage"
echo "  npx jest packages/notification-service/tests/unit --no-coverage"
