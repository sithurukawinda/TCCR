---
description: Advanced git workflow assistant for commits, branching, and change management
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git branch:*), Bash(git checkout:*), Bash(git commit:*), Bash(git log:*)
---

## Context:

- Current branch: !`git branch --show-current`
- Current git status: !`git status`
- Staged changes: !`git diff --staged`
- Unstaged changes: !`git diff`
- Recent commits: !`git log --oneline -5`

## Workflow Analysis:

Analyze the git workspace and intelligently suggest:

1. **Branch Strategy**: 
   - If changes are significant, suggest creating a feature/fix branch
   - Recommend branch naming: `feature/<description>`, `fix/<description>`, `refactor/<description>`, etc.
   - Warn if committing directly to `main`/`master`

2. **Change Scope**:
   - Identify if changes should be split into multiple commits
   - Detect unrelated changes that should be committed separately
   - Suggest staging specific files if needed

3. **Commit Message Quality**:
   - Analyze WHY changes were made (not just WHAT changed)
   - Suggest meaningful descriptions based on code patterns
   - Include context about business logic or technical decisions

## Commit Types with Emojis:

- ✨ `feat:` - New feature or functionality
- 🐛 `fix:` - Bug fix or error correction
- 🔨 `refactor:` - Code restructuring without behavior change
- 📝 `docs:` - Documentation updates
- 🎨 `style:` - Code formatting, whitespace, styling
- ✅ `test:` - Adding or updating tests
- ⚡ `perf:` - Performance improvements
- 🔧 `chore:` - Build process, dependencies, tooling
- 🚀 `ci:` - CI/CD configuration changes
- 🔒 `security:` - Security improvements
- ⬆️ `upgrade:` - Dependency upgrades
- ⬇️ `downgrade:` - Dependency downgrades

## Commit Message Format:
```
<emoji> <type>(<scope>): <concise_description>

<why_explanation>
- Why this change was necessary
- What problem it solves
- Any important context or trade-offs

<optional_breaking_changes>
```

## Interactive Workflow:

### Step 1: Analyze Current State
- Show current branch
- Summarize staged vs unstaged changes
- Identify change categories

### Step 2: Suggest Branch Strategy
- If on `main`/`master` with significant changes → suggest creating feature branch
- Propose branch name based on change type
- Ask: "Create new branch or commit to current branch?"

### Step 3: Review Changes
- Group related changes
- Highlight if multiple logical changes exist
- Suggest splitting into multiple commits if needed

### Step 4: Generate Commit Message
- Analyze code diffs to understand WHY
- Propose meaningful commit message
- Include scope (affected module/component)

### Step 5: Confirmation
Present options:
```
📋 Summary: <brief description>
🌿 Branch: <current or proposed new branch>
💬 Commit Message:
<proposed message>

Options:
1. ✅ Approve and commit
2. 🌿 Create branch first, then commit
3. ✏️ Edit commit message
4. 🔀 Split into multiple commits
5. ❌ Cancel
```

## Advanced Features:

- **Smart Scope Detection**: Automatically detect affected modules/files for scope
- **Multi-Commit Planning**: If changes are complex, suggest a commit sequence
- **Branch Cleanup**: After commit, ask if branch should be pushed
- **Commit Templates**: Learn from past commits to maintain consistent style
- **Breaking Change Detection**: Warn if changes might break existing functionality

## Safety Rules:

⚠️ **NEVER auto-commit** - Always require explicit user approval
⚠️ **Branch Protection** - Warn before committing to protected branches
⚠️ **Unstaged Changes** - Alert if important changes are unstaged
⚠️ **Empty Commits** - Prevent commits with no staged changes

## Output Flow:

1. **Analyze** repository state
2. **Suggest** branch strategy if needed
3. **Propose** commit message with context
4. **Present** options clearly
5. **Execute** only on explicit approval
6. **Confirm** action completed

Always explain your reasoning and help the user make informed decisions about their git workflow.