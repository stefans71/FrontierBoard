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
5. `container/fb-credential-proxy.cjs` — proxy logic (if credential/container issue)
6. `container/entrypoint.sh` — agent startup routing

**Key paths (commonly confused):**

- `.board/board/BOARD.md` — operational source of truth (invocations, auth, proxy)
- `.board/board/{agent}/` — agent dirs (inbox, outbox, contexts, settings)
- `.board/board/DEFERRED_WORK.md` — active deferred items
- `container/` — Dockerfile, entrypoint, proxy, build script
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

### Check for In-Progress Bugs

```bash
ls docs/bug-checklists/*.yaml 2>/dev/null
```

If pending checklists exist, show them and ask: continue existing, or start new?

### Create Checklist

Ask user for bug name. Create `docs/bug-checklists/{name}.yaml`:

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

Start with the diagnostic script from `/debug` skill Section 10. This checks: BOARD.md exists, isolation mode, Docker running, container image, auth tokens, agent directories, proxy status, firewall, lockfile, deferred items.

### Reproduce the Bug

1. Read the bug report / user description
2. Check proxy logs: `cat /tmp/proxy.log` or restart proxy with `> /tmp/proxy.log 2>&1 &`
3. Check container exit codes: `docker ps -a | grep fb-`
4. Run a single-agent smoke test (Section 9.1 of `/debug` skill)
5. Trace the execution path: BOARD.md invocation → docker run → entrypoint.sh → CLI → agent → outbox

### Read Relevant Source Files

Don't guess — read the actual code. Follow the flow:
- **Container mode:** BOARD.md command → `docker run` → `entrypoint.sh` → CLI exec → agent reads CLAUDE.md → reads inbox → writes outbox
- **Proxy flow:** Container request → proxy `detectUpstream()` → `injectCredentials()` → upstream API → response back
- **Auth flow:** Token extraction → env var or file copy → container starts → CLI authenticates

### Document Root Cause

Update checklist:

```yaml
investigation:
  status: done
  root_cause: "description of what's wrong and why"
  files_affected: [list of files]
  touches_security: true/false # credential proxy, container isolation, auth, permissions
```

## Phase 2: Classify Severity

Based on investigation, classify:

| Severity     | Criteria                                                                    | Board Review |
| ------------ | --------------------------------------------------------------------------- | ------------ |
| **Minor**    | UX issue, formatting, missing log output, cosmetic skill error              | Skip         |
| **Major**    | Auth failure, agent can't produce reports, proxy routing error, wrong model | Recommended  |
| **Critical** | Credential leakage, container escape, cross-agent data, review SOP bypass   | **Required** |

### Escalation Check

If the fix touches ANY of these, escalate severity by one level:

- Credential proxy (`fb-credential-proxy.cjs` — credential injection, upstream routing)
- Container isolation boundary (Dockerfile, entrypoint, mounts, env vars)
- Agent invocation pattern (BOARD.md commands, parallelism, timeout)
- Review SOP (4-round process, lockfile, deferred items, blind review)
- Setup skill templates (invocation commands that get written to BOARD.md)

Update checklist: `classification.status: done`, `severity: minor|major|critical`

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

Update checklist: `board_review.status: done`, `rounds: N`

## Phase 4: Fix

Implement the fix. For each change, document what file was modified and why.

**Verification during fix (not after):**
- Run `/debug` diagnostic after each significant change
- Single-agent smoke test after auth changes
- Check BOARD.md invocation commands match actual `docker run` being tested

Update checklist: `fix.status: done`, `files_modified: [...]`

## Phase 5: Smoke Test

**DO NOT skip this. ALL agents must pass.**

### Full Smoke Test (Container Mode)

```bash
BOARD=/path/to/FrontierBoard/.board
PROJ=/path/to/project

# Pre-round setup
CLAUDE_TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.claude/.credentials.json'))['claudeAiOauth']['accessToken'])")
# Copy Codex auth (prefer board user's fresh token)
if [ -f /home/llmuser/.codex/auth.json ]; then
  cp /home/llmuser/.codex/auth.json "$BOARD/board/systems-thinker/.codex/auth.json"
elif [ -f ~/.codex/auth.json ]; then
  cp ~/.codex/auth.json "$BOARD/board/systems-thinker/.codex/auth.json"
fi
chmod 644 "$BOARD/board/systems-thinker/.codex/auth.json" 2>/dev/null

# Write test brief to all agents
for agent in pragmatist systems-thinker skeptic; do
  echo "Smoke test: Confirm identity. Write one sentence to outbox/report.md." > $BOARD/board/$agent/inbox/brief.md
  echo "Smoke test context." > $BOARD/board/$agent/inbox/context.md
  rm -f $BOARD/board/$agent/outbox/report.md
done

# Run all agents in parallel (copy parallelism pattern from BOARD.md)
# ... (use exact commands from BOARD.md)

# Verify ALL reports
for agent in pragmatist systems-thinker skeptic; do
  [ -s "$BOARD/board/$agent/outbox/report.md" ] && echo "PASS: $agent" || echo "FAIL: $agent"
done
```

**Every agent must produce a report. If any agent fails, the bug is not fixed.**

Update checklist:

```yaml
smoke_test:
  status: done
  method: 'all 3 agents in parallel, container mode'
  result: 'all passed / agent X failed with ...'
  all_agents_pass: true/false
```

## Phase 6: Code Review (Major/Critical only)

For **minor** bugs: set `code_review.status: skipped` and proceed to Phase 7.

For **major/critical** bugs: send `git diff` to the board.

Update checklist: `code_review.status: done`, `rounds: N`

## Phase 7: Ship

1. Commit with bug reference: `git add -A && git commit -m "fix: {description}"`
2. Update checklist: `final_signoff.status: approved`, `status: approved`

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

# Copied auth files (contain credentials — always clean up)
rm -f $BOARD/board/systems-thinker/.codex/auth.json

# Proxy artifacts
rm -f /tmp/proxy.log
rm -f $BOARD/../container/.fb-proxy.pid

# Stale review lockfile (if left from crashed test)
rm -f $BOARD/.review-lock

# Docker test containers (usually auto-removed with --rm, but check)
docker rm $(docker ps -a --filter "name=fb-.*-smoke" -q) 2>/dev/null

# Temp credential copies
rm -f /tmp/.fb-claude-creds.json /tmp/.fb-*
```

Update checklist: `cleanup.status: done`, `artifacts_removed: [list]`

---

## Severity Examples

**Minor:**

- Agent report formatting inconsistent
- Diagnostic script false positive on a directory
- Skill documentation typo

**Major:**

- Agent auth fails in container mode (like OAuth token race condition)
- Proxy doesn't route requests correctly (wrong upstream detection)
- Codex config format incompatible with new CLI version
- Agent model not supported with ChatGPT account

**Critical:**

- Credential proxy leaks API keys to containers
- Container agent can read sibling agent's outbox
- OAuth token written to shared location accessible by all agents
- Review lockfile bypass allows concurrent reviews corrupting reports
