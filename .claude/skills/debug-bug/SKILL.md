---
name: debug-bug
description: Bug fix lifecycle — investigate, classify severity, fix, test, ship. Severity determines process rigor (minor=lightweight, major/critical=board review). Run /debug-bug to start.
---

# /debug-bug — Bug Fix Lifecycle

Run `/debug-bug` to investigate and fix a bug with proper quality gates. The process adapts based on bug severity — minor bugs get a lightweight path, critical bugs get full board review.

## Phase 0: Preflight

### Read Architecture Context First

**CRITICAL:** Before touching any code, read these files to understand the system:

1. `CLAUDE.md` — routing, principles, review process
2. `docs/REVIEW-SOP.md` — 4-round SOP, severity levels
3. `.board/board/BOARD.md` — agent invocations, auth strategy, isolation mode
4. `.claude/skills/setup/SKILL.md` — Hard-Won Knowledge section (operational landmines)

**Key paths (commonly confused):**

- `.board/board/BOARD.md` — operational source of truth (invocations, auth, proxy)
- `.board/board/{agent}/` — agent dirs (inbox, outbox, contexts, settings)
- `.board/board/DEFERRED_WORK.md` — active deferred items (legacy, also check tasks.json status=deferred)
- `tasks.json` — master task index (bugs, features, deferred work)
- `docs/tasks/` — per-task YAML files with phase gates and checklists
- `.claude/skills/` — skill definitions (what the orchestrator follows)

### Run Diagnostic First

```bash
# Run /debug diagnostic script (Section 10)
# This catches 90% of common issues before investigation starts
```

Read `.claude/skills/debug/SKILL.md` Section 10 and run the quick diagnostic script.

### Clean Working Tree

```bash
git status --porcelain
```

If dirty, commit or stash first.

### Check for In-Progress Tasks

```bash
# Check tasks.json for in-progress bugs
cat tasks.json | grep '"status": "in-progress"'
# Check for existing task YAML files
ls docs/tasks/FB-*.yaml 2>/dev/null
```

If in-progress bugs exist, show them and ask: continue existing, or start new?

### Create Task Entry

Ask user for bug name. Assign the next available `FB-XXX` ID from `tasks.json`.

1. Add an entry to `tasks.json` with `status: open`, `type: bug`
2. Create `docs/tasks/{task-id}-{name}.yaml` from `docs/tasks/TEMPLATE.yaml`:

```yaml
bug: { name }
type: bug
severity: null # set in Phase 2
reported: { today }
status: pending

gates:
  investigation:
    status: pending
    root_cause: null
    files_affected: []
    touches_security: false
    date: null

  classification:
    status: pending
    severity: null
    escalated: false
    board_required: false
    date: null

  board_review:
    status: pending
    rounds: 0
    findings: []
    date: null

  fix:
    status: pending
    files_modified: []
    regression_test: false
    date: null

  smoke_test:
    status: pending
    method: null
    result: null
    all_agents_pass: false
    skipped_reason: null
    date: null

  code_review:
    status: pending
    rounds: 0
    findings: []
    date: null

  cleanup:
    status: pending
    artifacts_removed: []
    date: null

  final_signoff:
    status: pending
    date: null
```

## Phase 1: Investigate

### Run /debug Diagnostic

Start with the diagnostic script from `/debug` skill. This checks: BOARD.md exists, auth tokens, agent directories, lockfile, deferred items.

### Reproduce the Bug

1. Read the bug report / user description
2. Run a single-agent smoke test from `/debug` skill
3. Trace the execution path: BOARD.md invocation → `sudo -u $BOARD_USER` → CLI → agent reads CLAUDE.md → reads inbox → writes outbox

### Read Relevant Source Files

Don't guess — read the actual code. Follow the flow:
- **Bare mode:** BOARD.md command → `sudo -u $BOARD_USER bash -c 'unset CLAUDECODE && ...'` → CLI reads CLAUDE.md → reads inbox → writes outbox
- **Auth flow:** CLI reads credentials from board user's home directory → authenticates with upstream API

### Document Root Cause

Update task YAML:

```yaml
investigation:
  status: done
  root_cause: "description of what's wrong and why"
  files_affected: [list of files]
  touches_security: true/false # auth, permissions, blind review enforcement
```

## Phase 2: Classify Severity

Based on investigation, classify:

| Severity     | Criteria                                                                    | Board Review |
| ------------ | --------------------------------------------------------------------------- | ------------ |
| **Minor**    | UX issue, formatting, missing log output, cosmetic skill error              | Skip         |
| **Major**    | Auth failure, agent can't produce reports, wrong model                      | Recommended  |
| **Critical** | Credential leakage, cross-agent data access, review SOP bypass              | **Required** |

### Escalation Check

If the fix touches ANY of these, escalate severity by one level:

- Agent invocation pattern (BOARD.md commands, parallelism, timeout)
- Review SOP (4-round process, lockfile, deferred items, blind review)
- Setup skill templates (invocation commands that get written to BOARD.md)

Update task YAML: `classification.status: done`, `severity: minor|major|critical`

## Phase 3: Board Review (Major/Critical only)

For **minor** bugs: set `board_review.status: skipped` and proceed to Phase 4.

For **major/critical** bugs: submit investigation + proposed fix to the board.

**Brief must include:**

- Bug description and reproduction steps
- Root cause analysis
- Proposed fix with code snippets
- Files affected
- Why the bug matters (auth impact, agent failure, data risk)

**Round structure:** Same as review SOP (blind → consolidation → deliberation → confirmation).

**Retry enforcement:** If any agent fails to produce a report in any round, retry that agent at least once before proceeding. If the retry also fails, do NOT silently continue — inform the user and get explicit approval to proceed with reduced coverage. With 3 agents, losing one means the tiebreaker is gone. Log all failures and retries in the task YAML.

Update task YAML: `board_review.status: done`, `rounds: N`

## Phase 4: Fix

Implement the fix. For each change, document what file was modified and why.

**Verification during fix (not after):**
- Run `/debug` diagnostic after each significant change
- Single-agent smoke test after auth changes
- Check BOARD.md invocation commands match actual bare-mode commands being tested

Update task YAML: `fix.status: done`, `files_modified: [...]`

## Phase 5: Smoke Test

**DO NOT skip this. ALL agents must pass.**

### Full Smoke Test (Bare Mode)

```bash
BOARD=/path/to/FrontierBoard/.board
BOARD_USER=llmuser  # or whatever board user was created during setup

# Write test brief to all agents
for agent in pragmatist systems-thinker skeptic; do
  echo "Smoke test: Confirm identity. Write one sentence to outbox/report.md." > $BOARD/board/$agent/inbox/brief.md
  echo "Smoke test context." > $BOARD/board/$agent/inbox/context.md
  rm -f $BOARD/board/$agent/outbox/report.md
done

# Run each agent (copy parallelism pattern from BOARD.md)
for agent in pragmatist systems-thinker skeptic; do
  AGENT_DIR="$BOARD/board/$agent"
  sudo -u $BOARD_USER bash -c "unset CLAUDECODE && cd $AGENT_DIR && claude --dangerously-skip-permissions -p 'Read inbox/brief.md. Follow its instructions. Write your response to outbox/report.md.'" &
done
wait

# Verify ALL reports
for agent in pragmatist systems-thinker skeptic; do
  [ -s "$BOARD/board/$agent/outbox/report.md" ] && echo "PASS: $agent" || echo "FAIL: $agent"
done
```

**Every agent must produce a report. If any agent fails, the bug is not fixed.**

Update task YAML:

```yaml
smoke_test:
  status: done
  method: 'all 3 agents in parallel, bare mode'
  result: 'all passed / agent X failed with ...'
  all_agents_pass: true/false
```

## Phase 6: Code Review (Major/Critical only)

For **minor** bugs: set `code_review.status: skipped` and proceed to Phase 7.

For **major/critical** bugs: send `git diff` to the board.

Update task YAML: `code_review.status: done`, `rounds: N`

## Phase 7: Ship

1. Commit with bug reference: `git add -A && git commit -m "fix: {description}"`
2. Update task YAML: `final_signoff.status: approved`, `status: approved`

## Phase 8: Cleanup

Remove temporary artifacts created during debugging. **The bug checklist stays** (it's the audit trail).

### Artifacts to Remove

```bash
BOARD=/path/to/FrontierBoard/.board

# Smoke test briefs and reports (not real review artifacts)
for agent in $BOARD/board/*/; do
  name=$(basename "$agent")
  # Only clean if brief is a smoke test
  grep -q "Smoke test" "$agent/inbox/brief.md" 2>/dev/null && rm -f "$agent/inbox/brief.md" "$agent/inbox/context.md" "$agent/outbox/report.md"
done

# Stale review lockfile (if left from crashed test)
rm -f $BOARD/.review-lock
```

Update task YAML: `cleanup.status: done`, `artifacts_removed: [list]`

---

## Severity Examples

**Minor:**

- Agent report formatting inconsistent
- Diagnostic script false positive on a directory
- Skill documentation typo

**Major:**

- Agent auth fails (OAuth token race condition, expired credentials)
- Codex config format incompatible with new CLI version
- Agent model not supported with ChatGPT account

**Critical:**

- Credential leakage to unauthorized processes
- Agent reads sibling agent's outbox (blind review violation)
- OAuth token written to shared location accessible by all agents
- Review lockfile bypass allows concurrent reviews corrupting reports
