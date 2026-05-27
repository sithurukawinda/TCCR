---
name: feature-spec-creator
description: Create feature spec file and branch from short idea
argument-hint: Short feature description
allowed-tools: Read, Write, Glob, Bash
---

# Feature Spec Creator

## Workflow

### 1. Git Check
```bash
git status
```
Abort if dirty: `❌ Uncommitted changes. Commit/stash first.`

### 2. Parse $ARGUMENTS
- **Title**: Title Case → "Card Component for Dashboard Stats"
- **Slug**: kebab-case, a-z0-9-, ≤40 chars → "card-component-dashboard"
- **Branch**: `feature/<slug>`

Unclear? Ask user.

### 3. Create Branch
```bash
git switch -c feature/<slug>
```
Branch exists? Append `-01`, `-02`…

### 4. Load Context

**Core (always):**
- `.claude/commands/blue-print.md`
- `.claude/skills/node/SKILL.md`
- `_specs/template.md`

**References** from `.claude/skills/node/references/` by type:

### 5. Write `_specs/<slug>.md`

Follow `template.md` exactly:

```markdown
# <Title>

## Overview
[Brief description]

## User Stories
- As a [user], I want [goal], so that [benefit]

## Requirements
### Functional
- [ ] ...

### Non-Functional
- [ ] Performance · Security · Gas efficiency · Accessibility

## Acceptance Criteria
- [ ] Testable criterion

## Testing Requirements
- [ ] Unit · Integration · Edge cases

## Out of Scope
- ...

## Design Considerations
- UI/UX · User flows

## References Used
- [list]
```

Rules: WHAT not HOW · Non-technical language · No code/jargon · Use references for NFRs.

### 6. Report
```
✅ Feature spec created!

Branch:    feature/<slug>
Spec:      _specs/<slug>.md
Title:     <title>

📚 References: <files>

Next: review → edit → git add . && git commit -m "Add spec: <title>"
```

## Errors

| Issue | Action |
|-------|--------|
| Dirty working dir | Abort, commit/stash |
| Unclear description | Ask: goal, users, functionality |
| Branch exists | Append -01, -02… |
| Missing refs | Warn, continue |

## Example

Input: `"Implement IERC1271 interface for smart contract signature validation"`

```
✅ Feature spec created!
Branch:    feature/ierc1271-interface
Spec:      _specs/ierc1271-interface.md
Title:     IERC1271 Interface for Signature Validation
📚 References: patterns.md, security.md, solidity-modern.md, gas-optimization.md
Next: review → edit → git commit -m "Add spec: IERC1271 Interface"
```

---
v2.2.0