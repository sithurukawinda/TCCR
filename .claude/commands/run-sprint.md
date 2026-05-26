---
name: run-sprint
description: Execute and track progress on a specific sprint
argument-hint: Sprint number, path, or folder (e.g., "1", "sprint-01.md", "@_sprints/project/")
allowed-tools: Read, Write, Bash, Glob
---

# Run Sprint

Execute and track progress on individual sprints with automated verification and status updates.

## Workflow

### 1. Identify Sprint(s)

**Parse `$ARGUMENTS`:**
- Sprint number: `run-sprint 1`
- Sprint file: `run-sprint sprint-01-configuration.md`
- Sprint folder (all sprints): `run-sprint @_sprints/project/` or `run-sprint _sprints/project/`
- Auto-detect: `run-sprint` (finds next incomplete)

**Folder Mode Detection:**
If argument starts with `@` or ends with `/` or is a directory path:
```bash
# Check if folder exists
if [ -d "$ARG" ]; then
    FOLDER_MODE=true
    SPRINT_FOLDER="$ARG"
fi
```

**In folder mode:**
1. List all sprint files in order: `sprint-01-*.md`, `sprint-02-*.md`, etc.
2. Find first incomplete sprint
3. Execute sprints sequentially with user confirmation between each

**Discovery order (single sprint mode):**
1. Use argument if provided
2. Find first incomplete sprint in `_sprints/*/`
3. If multiple projects, ask user to choose

### 2. Folder Mode: Sequential Execution

**When folder specified:**
```bash
# Find all sprint files
SPRINTS=($(ls _sprints/project/sprint-*.md | sort))
TOTAL=${#SPRINTS[@]}

echo "📂 Folder Mode: $TOTAL sprints found"
echo ""
for i in "${!SPRINTS[@]}"; do
    STATUS=$(grep "Status:" "${SPRINTS[$i]}" | head -1)
    echo "  $((i+1)). ${SPRINTS[$i]##*/} - $STATUS"
done
echo ""
echo "Run all incomplete sprints sequentially? (y/n):"
```

**Sequential flow:**
```
🏃 Sprint Queue: 5 sprints detected

1. sprint-01-configuration.md       🟢 Complete
2. sprint-02-source-contracts.md    🔵 In Progress (2/5 tasks)
3. sprint-03-scripts.md              🟡 Not Started
4. sprint-04-tests.md                🟡 Not Started
5. sprint-05-verification.md         🟡 Not Started

Starting from Sprint 2 (first incomplete)
Run all remaining sprints? (y/n):
```

**For each sprint in sequence:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sprint 2/5: Source Contracts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Execute sprint as normal...]

Sprint 2 complete! ✅

Next: Sprint 3/5 - Scripts

Continue to next sprint? (y/n):
```

**If user says "no":**
```
⏸️  Paused at Sprint 3

Resume later with:
  run-sprint @_sprints/project/
  
Or continue from Sprint 3:
  run-sprint 3
```

**When all sprints complete:**
```
🎉 All sprints complete!

Summary:
  Total sprints: 5
  Completed: 5/5 (100%)
  Total time: 18.5h estimated, 17.2h actual
  Efficiency: 93%

Project complete! 🚀
```

### 3. Load Sprint Context
```bash
cat _sprints/<project>/sprint-<N>-<slug>.md
```

**Extract:**
- Sprint number, name, status
- Tasks list with completion state
- Verification commands
- Time estimates and dependencies

**Display:**
```
🏃 Starting Sprint <N>: <Phase Name>

Status: 🟡 Not Started → 🔵 In Progress
Estimated: <X>h | Tasks: 0/<N> (0%)

Press Enter to begin...
```

### 4. Check Dependencies

**Verify previous sprint:**
```bash
grep "Status.*🟢 Complete" sprint-$(printf "%02d" $((N-1)))-*.md
```

**If incomplete:**
```
⚠️  Sprint <N-1> must be completed first.
Status: 🔵 In Progress (3/5 tasks)

Options: (1) Complete Sprint <N-1> (2) Continue anyway (3) Abort
```

**In folder mode, enforce strict ordering:**
```
❌ Cannot skip to Sprint <N>

Sprint <N-1> is incomplete. In folder mode, sprints must be completed sequentially.

Options:
  (1) Resume Sprint <N-1>
  (2) Exit folder mode

Choose (1/2):
```

### 5. Execute Tasks Interactively

**For each unchecked task:**
```
Task <M>/<N>: <Task description>

Related files:
  • path/to/file.sol

Actions: [w] Work [s] Skip [d] Done [n] Notes [q] Quit
```

**If "Work" selected:**
```
📝 Working on: <Task description>

Ready to assist with:
  • Create/edit files
  • Run commands
  • Answer questions

Type "complete" when finished.
```

**On completion:**
```
✅ Task completed

Time spent: ___ minutes
Notes: [Optional]

Progress: <M>/<N> (XX%)
Continue? (y/n):
```

### 6. Update Sprint File

**Mark complete:**
```markdown
- [x] Task description ✅ (2024-02-16 14:30, 45min)
```

**Update metadata:**
```markdown
**Status:** 🔵 In Progress
**Actual Time:** 3.5 hours
**Started:** 2024-02-16 09:00
**Progress:** 3/5 (60%)
```

**Add time log:**
```markdown
| Date | Duration | Activity | Notes |
|------|----------|----------|-------|
| 2024-02-16 | 45min | Setup | Used pnpm |
```

### 7. Run Verification

**When all tasks complete:**
```
🧪 All tasks complete! Running verification...

Verification commands:
  1. forge build
  2. forge test -vvv
  3. forge fmt --check

Run all? (y/n):
```

**Execute and report:**
```bash
forge build && echo "✅ Build passed" || echo "❌ Build failed"
```

**Results:**
```
✅ forge build       PASSED
✅ forge test        PASSED (23 tests)
❌ forge fmt --check FAILED

Mark complete? (y/n):
```

### 8. Complete Sprint

**If verifications pass:**
```
🎉 Sprint <N> Complete!

Summary:
  Tasks: <N>/<N> (100%)
  Time: <X>h estimated, <Y>h actual
  
Next: Sprint <N+1> - <Phase Name>

Continue? (y/n):
```

**In folder mode:**
```
🎉 Sprint <N>/<TOTAL> Complete!

Summary:
  Tasks: <N>/<N> (100%)
  Time: <X>h estimated, <Y>h actual
  
Progress: <N>/<TOTAL> sprints complete
Next: Sprint <N+1> - <Phase Name>

Continue to next sprint? (y/n):
  [y] Continue   [n] Pause   [s] Skip next   [q] Quit folder mode
```

**Update sprint file:**
```markdown
**Status:** 🟢 Complete
**Completed:** 2024-02-16 16:45

## 📊 Sprint Retrospective
**What Went Well:**
- Item 1

**What Could Improve:**
- Item 1

**Action Items:**
- Item 1
```

**Update README.md:**
```markdown
| Sprint | Status | Time Est. | Actual | Completed |
|--------|--------|-----------|--------|-----------|
| 1 | 🟢 Complete | 2h | 2.5h | 2024-02-16 11:30 |
| 2 | 🟢 Complete | 4h | 3.8h | 2024-02-16 16:45 |
| 3 | 🔵 In Progress | 3h | 0h | ___ |

**Progress:** 2/5 sprints (40%)
```

### 9. Git Integration

**Prompt for commit:**
```
📦 Commit sprint work?

Changed files:
  M  src/Contract.sol
  A  test/Contract.t.sol

Create commit? (y/n):
```

**If yes:**
```bash
git add .
git commit -m "Complete Sprint <N>: <Phase Name>

- <N> tasks completed
- All verifications passed
- Time: <X>h"
```

**In folder mode, batch commits:**
```
📦 Git Strategy:

(1) Commit after each sprint (recommended)
(2) Commit only at the end
(3) No automatic commits

Choose (1/2/3):
```

**Next branch:**
```
🌿 Create branch for Sprint <N+1>?
Branch: sprint/<N+1>-<slug>

Create? (y/n):
```

## Commands
```bash
# Start next sprint
run-sprint

# Specific sprint
run-sprint 2

# Run all sprints in folder
run-sprint @_sprints/ierc1271-interface/
run-sprint _sprints/ierc1271-interface/

# Resume in-progress
run-sprint --resume

# Show status
run-sprint --status

# Mark task complete
run-sprint --complete-task 3
```

## Folder Mode Features

### Progress Tracking
```
📊 Overall Progress

Completed: 2/5 sprints (40%)
Time spent: 6.3h / 18h estimated
Remaining: ~11.7h

Sprint 3: 🔵 In Progress
Sprint 4: 🟡 Queued
Sprint 5: 🟡 Queued
```

### Skip Sprint Option
```
⏭️  Skip Sprint 3?

This will mark Sprint 3 as skipped, not complete.
Skipped sprints can be resumed later.

Skip? (y/n):
```

### Pause and Resume
```
⏸️  Paused at Sprint 3/5

Progress saved. Resume with:
  run-sprint @_sprints/ierc1271-interface/

Or continue specific sprint:
  run-sprint 3
```

### Completion Summary
```
🎉 All Sprints Complete!

Project: IERC1271 Interface
Sprints: 5/5 (100%)

Time Analysis:
  Estimated: 18h
  Actual: 17.2h
  Efficiency: 95.6%

Sprint Breakdown:
  Sprint 1: 2.5h (2h est.) - 125%
  Sprint 2: 3.8h (4h est.) - 95%
  Sprint 3: 2.9h (3h est.) - 97%
  Sprint 4: 4.5h (5h est.) - 90%
  Sprint 5: 3.5h (4h est.) - 88%

Average velocity: 1.2 tasks/hour

All verifications passed ✅
All commits created ✅

Next steps:
  • Review project documentation
  • Run final integration tests
  • Deploy if ready
```

## Error Handling

| Issue | Response |
|-------|----------|
| No sprints found | Prompt to run `create-sprints` |
| Already complete | Offer view summary / reopen / continue next |
| Verification failed | View errors / mark incomplete / add to issues / abort |
| Git conflicts | Commit / stash / continue without committing |
| Folder not found | List available sprint folders |
| Skip in folder mode | Mark skipped, continue to next |

## Advanced Features

### Auto-save Progress
Save state every N minutes with timestamp and current task.

### Time Tracking
```bash
START_TIME=$(date +%s)
END_TIME=$(date +%s)
DURATION=$(( (END_TIME - START_TIME) / 60 ))
```

### Batch Mode (Non-interactive)
```bash
# Run all sprints without prompts (CI/CD)
run-sprint @_sprints/project/ --batch --auto-commit
```

### Parallel Tasks
```
📋 Independent tasks detected:
  - Task 2: Write tests
  - Task 4: Update docs

Work on: (1) Both (2) One at a time (3) Skip
```

## Output Example

### Single Sprint
```
🏃 Starting Sprint 2: Source Contracts

Status: 🟡 → 🔵 In Progress
Tasks: 5 | Estimate: 4h
Dependencies: ✅ Sprint 1 complete

Files: src/UserRegistry.sol (new)

Goal: Implement core UserRegistry with CRUD

Ready? (y/n):
```

### Folder Mode
```
🏃 Sprint Queue: _sprints/ierc1271-interface/

Found 5 sprints:
  1. ✅ Configuration (Complete)
  2. 🔵 Source Contracts (2/5 tasks)
  3. 🟡 Scripts (Not Started)
  4. 🟡 Tests (Not Started)
  5. 🟡 Verification (Not Started)

Starting from Sprint 2 (first incomplete)
Estimated remaining time: ~9h

Run all? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sprint 2/5: Source Contracts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task 3/5: Implement isValidSignature function
[w] Work [s] Skip [d] Done [q] Quit > w

...

✅ Sprint 2 Complete! (3.8h)

Continue to Sprint 3/5? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sprint 3/5: Scripts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

...
```

## Best Practices

1. Use folder mode for end-to-end sprint execution
2. Commit after each sprint for clean history
3. Don't skip sprints unless absolutely necessary
4. Track time accurately for better future estimates
5. Run all verifications before marking complete
6. Review retrospective at end of each sprint
7. Pause if blocked rather than skipping

## Integration Examples
```bash
# Full workflow
claude create-sprints userregistry-plan
claude run-sprint @_sprints/userregistry-implementation/

# Resume paused sprints
claude run-sprint @_sprints/ierc1271-interface/

# Single sprint from folder project
claude run-sprint 3
```

---

**Version:** 1.1.0 (Token Optimized + Folder Mode)