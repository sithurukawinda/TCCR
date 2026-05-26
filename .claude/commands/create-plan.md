---
name: create-plan
description: Save Claude's implementation plan to a markdown file in _plan/
argument-hint: Brief description of the plan
allowed-tools: Write, Bash
---

# Save Implementation Plan

Save Claude's implementation plan from the conversation to a markdown file in the `_plan/` directory.

## Workflow

### Step 1: Create _plan Directory
```bash
mkdir -p _plan
```

Ensure the directory exists before writing.

### Step 2: Extract Plan Content

Look for the most recent implementation plan in the conversation that contains:
- Context section
- Design Decisions table
- Implementation Steps (phases)
- Key Files table
- Test Helpers section
- Verification steps

### Step 3: Generate Filename

From `$ARGUMENTS`, create:
- **Format:** `YYYY-MM-DD-<feature-slug>.md`
- **Example:** `2024-02-16-userregistry-implementation.md`

**Slug rules:**
- Lowercase only
- Kebab-case
- Max 50 characters
- Current date prefix

### Step 4: Format Content

Structure the markdown file as:
```markdown
# Implementation Plan: <Title>

**Created:** <ISO DateTime>
**Status:** 🟡 Draft
**Author:** Claude
**Estimated Time:** <X hours>

---

## 📋 Context

<Extract context section>

---

## 🎯 Design Decisions

<Extract design decisions table>

---

## 🚀 Implementation Steps

<Extract all phases with numbered steps>

### Phase 1: <Name>
- [ ] Step 1
- [ ] Step 2

### Phase 2: <Name>
- [ ] Step 3
- [ ] Step 4

---

## 📁 Key Files

<Extract key files table>

---

## 🧪 Test Helpers

<Extract test helpers and patterns>

---

## ✅ Verification Checklist

- [ ] forge build (clean compilation)
- [ ] forge fmt (format all files)
- [ ] forge fmt --check (CI check passes)
- [ ] forge test -vvv (all tests pass)
- [ ] forge test --gas-report (gas within limits)
- [ ] All design decisions implemented
- [ ] All phases completed

---

## 📝 Progress Tracking

**Status Legend:**
- 🟡 Draft - Planning stage
- 🔵 In Progress - Implementation started
- 🟢 Complete - All phases done
- 🔴 Blocked - Waiting on dependency

**Current Phase:** Phase 1
**Completion:** 0%

---

## 📌 Notes

<Any additional notes, warnings, or considerations>
```

### Step 5: Save File

Write to: `_plan/<filename>.md`

### Step 6: Report Success

Output:
```
✅ Implementation plan saved!

File: _plan/<filename>.md
Lines: <count>
Sections: <count sections>
Phases: <count phases>

Next steps:
  1. Review the plan: cat _plan/<filename>.md
  2. Start with Phase 1
  3. Check off steps as you complete them
  4. Update status field when progressing

To view:
  cat _plan/<filename>.md
```

---

## Error Handling

### If _plan Directory Cannot Be Created
```
❌ Cannot create _plan directory
Please create it manually: mkdir _plan
```

### If No Plan Found in Conversation
```
❌ No implementation plan found in recent conversation
Please ask Claude to create an implementation plan first
```

### If File Already Exists
```
⚠️  File already exists: _plan/<filename>.md
Options:
  1. Append version: _plan/<filename>-v2.md
  2. Overwrite (requires confirmation)
  3. Abort
```

---

## Best Practices

1. **Date prefixes** - Makes chronological sorting easy
2. **Checkboxes** - Track progress inline
3. **Status emojis** - Visual progress indicators
4. **Phases** - Break work into manageable chunks
5. **Verification** - Always include verification steps