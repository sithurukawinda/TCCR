---
name: run-check
description: Run type-check, lint, and unit tests for a specific CMP service workspace and report a pass/fail summary
argument-hint: Service name (e.g. "course-service") — omit to run across all workspaces
allowed-tools: Read, Bash
---

# Run Check

You are running the quality gate for the **CMP (Course Management Portal)** backend. This runs type-check, lint, and unit tests — in that order — and reports a clear pass/fail for each step.

## 1. Parse `$ARGUMENTS`

| Value | Rule | Example |
|-------|------|---------|
| **Service** (optional) | Existing service or `all` | `course-service` |

If no argument is provided, run checks across all workspaces.

## 2. Confirm the Service Exists

```bash
ls packages/
```

If the named service directory does not exist, stop and report:

> ❌ `packages/<service-name>/` not found. Check the service name and try again.

## 3. Run Type Check

```bash
# Single service
npm run type-check --workspace=packages/<service-name>

# All workspaces
npm run type-check
```

Capture output. Note every TypeScript error with its file path and line number.

## 4. Run Lint

```bash
# Single service
npx eslint packages/<service-name>/src --max-warnings=0

# All workspaces
npm run lint
```

Capture output. Note every lint error and warning.

## 5. Run Unit Tests

```bash
# Single service
npx jest packages/<service-name>/tests/unit --coverage --passWithNoTests

# All workspaces
npm run test -- --coverage --passWithNoTests
```

Capture:
- Number of test suites passed / failed
- Number of tests passed / failed / skipped
- Coverage summary (statements, branches, functions, lines)

## 6. Report

```
🔍 Quality Gate — <service-name | all workspaces>
Date: <today>

──────────────────────────────────────────────────────────

Type Check    <✅ PASS | ❌ FAIL>
  <if FAIL — list each error:>
  • packages/<service>/src/<file>.ts:<line>  <error message>

Lint          <✅ PASS | ❌ FAIL>
  <if FAIL — list each error:>
  • packages/<service>/src/<file>.ts:<line>  <rule>: <message>

Unit Tests    <✅ PASS | ❌ FAIL>
  Suites:   <passed>/<total> passed
  Tests:    <passed>/<total> passed  (<skipped> skipped)
  Coverage: Statements <N>%  |  Branches <N>%  |  Functions <N>%  |  Lines <N>%
  <if FAIL — list failing test names:>
  • <TestSuiteName> > <test description>

──────────────────────────────────────────────────────────

Overall:  <✅ ALL PASS | ❌ <N> step(s) failed>

<if any failures>
Next steps:
  1. Fix TypeScript errors first — they block compilation
  2. Fix lint errors — run `npm run lint -- --fix` for auto-fixable rules
  3. Fix failing tests — run a single test file:
     npx jest packages/<service-name>/tests/unit/<FileName>.test.ts --watch
```

## 7. Stop on First Critical Failure

If type-check fails with errors that would prevent compilation (not just `noUnusedLocals` warnings), do not proceed to lint or tests — report the type errors and stop.

```
⛔ Type check failed with compilation errors. Fix these before running lint and tests.
```

## Errors

| Issue | Action |
|-------|--------|
| `npm run type-check` not found in root `package.json` | Run `npx tsc --noEmit` from the workspace root |
| `jest` not found | Check `package.json` — run `npm install` first |
| Integration tests accidentally run | Ensure test pattern targets `tests/unit/**` only |
| Coverage below threshold | Report the gap but do not fail the gate — thresholds are set in `jest.config.ts` |

---

v1.0.0 — CMP (`slp-backend`)
