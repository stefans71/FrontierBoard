---
name: debug
description: Debug FrontierBoard issues — auth problems, agent errors, review failures. Use when things aren't working, agents fail to produce reports, authentication breaks, or to validate the full setup end-to-end.
---

# FrontierBoard Debugging

Systematic diagnosis of board issues. Don't guess — run the checks, read the output, fix what's broken.

**Strategy:** Start with the quick diagnostic script (Section 8). If that passes, move to the specific section matching the symptom. If you don't know what's wrong, run a single-agent smoke test (Section 7) to isolate the failure.

---

## 1. Architecture Overview

```
Orchestrator (Claude Code session)
    │
    ├── Reads BOARD.md for agent list, invocation commands
    ├── Reads/writes agent inboxes (brief.md, context.md, round2-brief.md, etc.)
    ├── Launches agents in parallel (per BOARD.md parallelism pattern)
    ├── Collects reports from outboxes
    └── Synthesises findings → REVIEW-LOG.md

Orchestrator (host)
    │
    ├── sudo -u $BOARD_USER
    │   (agents run as board user)
    │
    ├── unset CLAUDECODE
    │   (prevents nested session error)
    │
    └── claude/codex exec from agent dir
        (reads CLAUDE.md, inbox, writes outbox)
```

### Key Paths

| Path | Purpose |
|------|---------|
| `$BOARD` | FrontierBoard clone directory |
| `$BOARD/.board/` | Board runtime state |
| `$BOARD/.board/board/BOARD.md` | Operational source of truth (invocation commands) |
| `$BOARD/.board/board/{agent}/` | Agent directory (inbox, outbox, contexts, settings) |
| `$BOARD/.board/board/DEFERRED_WORK.md` | Active deferred items (included in every brief) |
| `$BOARD/.board/board/REVIEW-LOG.md` | Review history |
| `$BOARD/.board/.review-lock` | Prevents concurrent reviews |

---

## 2. Common Symptoms → Section Map

| Symptom | Go to |
|---------|-------|
| `401 authentication_error` | Section 3 (Auth) |
| `Please run /login` | Section 3.1 |
| Agent produces no report | Section 4 |
| Report is stale (from previous round) | Section 4.3 |
| `Cannot be launched inside another Claude Code session` | Section 3.3 |
| `Permission denied` writing to outbox | Section 5 |
| Review hangs / lockfile stuck | Section 6 |
| Codex agent fails silently | Section 3.5 |
| Wrong board used (global vs local) | Section 3.7 |

---

## 3. Agent Issues

### 3.1 Claude Code: "Please run /login" or 401

The board user doesn't have credentials.
```bash
# Check if board user has credentials
sudo -u llmuser cat ~/.claude/.credentials.json 2>&1 | head -3
# If missing, copy from current user:
sudo cp ~/.claude/.credentials.json ~llmuser/.claude/.credentials.json
sudo chown llmuser:llmuser ~llmuser/.claude/.credentials.json
```

### 3.2 Token Refresh Race Condition

Multiple parallel `claude` processes sharing `~/.claude/.credentials.json` race to refresh the OAuth token. The loser gets 401.

**Fix:** Use an API key instead of OAuth when running multiple agents in parallel, or stagger agent launches.

### 3.3 "Cannot be launched inside another Claude Code session"

The `CLAUDECODE` env var is set, preventing nested sessions.

**Fix:** All invocations must include `unset CLAUDECODE`:
```bash
sudo -u llmuser bash -c 'unset CLAUDECODE && cd $AGENT_DIR && claude ...'
```

### 3.4 "--dangerously-skip-permissions cannot be used with root"

Claude Code blocks YOLO mode for root users.

**Fix:** Must use a board user.

### 3.5 Codex Agent Fails Silently

The bare `codex` command opens a TUI and hangs. Must use `codex exec`:
```bash
# WRONG:
codex --dangerously-bypass-approvals-and-sandbox "prompt"

# RIGHT:
codex exec --dangerously-bypass-approvals-and-sandbox "prompt"
```

Also check `.codex/config.toml` has `approval_policy = "never"` (not "full-auto").

To capture Codex output when the report is missing:
```bash
codex exec ... > /tmp/codex-output.out 2>&1
if [ ! -s outbox/report.md ]; then cp /tmp/codex-output.out outbox/report.md; fi
```

### 3.6 Agent Doesn't Read CLAUDE.md

All invocation prompts must start with `read CLAUDE.md then ...`. Without this, agents lose their identity and produce generic output.

Check BOARD.md invocation commands contain:
```
"read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md"
```

### 3.7 Wrong Board Used (Global vs Local)

If Claude picks up the global install (`~/.frontierboard/`) instead of the local one, check:
- Which CLAUDE.md is being read (look at paths in the session)
- Whether `~/.claude/skills/frontierboard/SKILL.md` exists and is routing to global
- The orchestrator's working directory — it should be `$BOARD/.board/`, not `~/.frontierboard/`

**Fix:** Run from the local board directory explicitly:
```bash
cd /path/to/FrontierBoard/.board && claude --dangerously-skip-permissions -p "read CLAUDE.md then /run"
```

---

## 4. Report Issues

### 4.1 Agent Produces No Report

Check in order:
1. **Is the outbox writable?** See Section 5
2. **Is the inbox populated?** Check `inbox/brief.md` and `inbox/context.md` exist and are non-empty
3. **Did the agent read the prompt?** Check the invocation command in BOARD.md

### 4.2 Report is Empty or Generic

- Agent didn't get its CLAUDE.md (identity lost) — check agent directory
- Brief was empty or too vague — check `inbox/brief.md`
- Context file missing — check `inbox/context.md` and `contexts/{domain}.md`
- Model too weak — must be `claude-opus-4-6` (Claude) or `gpt-5.4` / `gpt-5.3-codex` (Codex), never Sonnet

### 4.3 Report is Stale (From Previous Round)

The `/run` skill writes a `.run-id` sentinel to each outbox before launching agents. After agents finish, it checks that `report.md` was modified after the sentinel.

To check manually:
```bash
BOARD=/path/to/.board
for agent in pragmatist systems-thinker skeptic; do
  echo "=== $agent ==="
  stat -c '%Y %n' "$BOARD/board/$agent/outbox/.run-id" "$BOARD/board/$agent/outbox/report.md" 2>/dev/null
done
# report.md timestamp should be AFTER .run-id timestamp
```

**Fix:** Clear stale reports before each round: `rm -f $BOARD/board/*/outbox/report.md`

---

## 5. Permission Issues

### 5.1 Board User Can't Access Agent Dirs

```bash
# Check ownership
ls -la $BOARD/.board/board/

# Fix: chown entire .board to board user
chown -R llmuser:llmuser $BOARD/.board/

# Also ensure parent directory is traversable
chmod o+x $BOARD $BOARD/.board $BOARD/.board/board
```

---

## 6. Review Lockfile Issues

The lockfile at `$BOARD/.board/.review-lock` prevents concurrent reviews.

```bash
# Check if locked
cat $BOARD/.board/.review-lock 2>/dev/null
# Format: project|PID|timestamp

# If stuck (review crashed without cleanup):
rm $BOARD/.board/.review-lock
```

**Warning:** Only remove if you're sure no review is running. Check the PID:
```bash
LOCK_PID=$(cat $BOARD/.board/.review-lock 2>/dev/null | cut -d'|' -f2)
ps -p $LOCK_PID &>/dev/null && echo "Review still running (PID $LOCK_PID)" || echo "Stale lock — safe to remove"
```

---

## 7. Smoke Tests

### 7.1 All Agents in Parallel

Tests: full parallelism pattern, all CLIs.

Run the parallelism pattern from BOARD.md with a simple "confirm identity" brief. All reports should appear within ~2 minutes.

### 7.2 Single Agent (Bare Mode)

```bash
AGENT_DIR=$BOARD/board/pragmatist
echo "Smoke test: confirm identity." > $AGENT_DIR/inbox/brief.md
echo "Context." > $AGENT_DIR/inbox/context.md
rm -f $AGENT_DIR/outbox/report.md

sudo -u llmuser bash -c "unset CLAUDECODE && cd $AGENT_DIR && claude --dangerously-skip-permissions -p 'read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md'"

[ -s "$AGENT_DIR/outbox/report.md" ] && echo "PASS" || echo "FAIL"
```

---

## 8. Quick Diagnostic Script

Run this to check all common setup issues at once:

```bash
echo "=== FrontierBoard Diagnostic ==="
BOARD="${BOARD:-$(pwd)}"
# Auto-detect: are we in .board/ or the clone root?
[ -f "$BOARD/.board/board/BOARD.md" ] && BOARD_STATE="$BOARD/.board" || BOARD_STATE="$BOARD"
[ -f "$BOARD_STATE/board/BOARD.md" ] || { echo "ERROR: Can't find BOARD.md. Set BOARD= to FrontierBoard clone dir."; exit 1; }

echo -e "\n1. Board file exists?"
[ -f "$BOARD_STATE/board/BOARD.md" ] && echo "  OK: $(head -1 $BOARD_STATE/board/BOARD.md)" || echo "  FAIL: No BOARD.md"

echo -e "\n2. Isolation mode?"
grep -m1 'Isolation\|isolation' "$BOARD_STATE/board/BOARD.md" 2>/dev/null || echo "  UNKNOWN"

echo -e "\n3. Claude Code authenticated?"
[ -f "$HOME/.claude/.credentials.json" ] && {
  python3 -c "
import json, time
d = json.load(open('$HOME/.claude/.credentials.json'))
o = d.get('claudeAiOauth', {})
if o.get('accessToken'):
    remaining = (o['expiresAt'] - time.time()*1000) / 60000
    print(f'  OK: OAuth token valid ({remaining:.0f} min remaining, {o.get(\"subscriptionType\",\"?\")} plan)')
else:
    print('  FAIL: No access token in credentials file')
" 2>/dev/null
} || echo "  FAIL: No credentials file. Run: claude /login"

echo -e "\n4. Codex authenticated?"
[ -f "$HOME/.codex/auth.json" ] && {
  python3 -c "
import json
d = json.load(open('$HOME/.codex/auth.json'))
t = d.get('tokens', {})
if t.get('access_token'):
    print(f'  OK: Codex auth ({d.get(\"auth_mode\",\"?\")} mode, token length {len(t[\"access_token\"])})')
else:
    print('  FAIL: No access token. Run codex interactively to authenticate.')
" 2>/dev/null
} || echo "  WARN: No Codex auth file (only needed if you have a Codex agent)"

echo -e "\n5. Agent directories?"
for agent in $BOARD_STATE/board/*/; do
  name=$(basename "$agent")
  [ "$name" = "*" ] && continue
  [ -f "$agent/CLAUDE.md" ] || { echo "  FAIL: $name missing CLAUDE.md"; continue; }
  [ -d "$agent/inbox" ] || { echo "  FAIL: $name missing inbox/"; continue; }
  [ -d "$agent/outbox" ] || { echo "  FAIL: $name missing outbox/"; continue; }
  echo "  OK: $name (inbox, outbox, CLAUDE.md)"
done

echo -e "\n6. Review lockfile?"
if [ -f "$BOARD_STATE/.review-lock" ]; then
  LOCK=$(cat "$BOARD_STATE/.review-lock")
  LOCK_PID=$(echo "$LOCK" | cut -d'|' -f2)
  ps -p "$LOCK_PID" &>/dev/null && echo "  ACTIVE: Review in progress ($LOCK)" || echo "  STALE: Lock exists but PID $LOCK_PID is dead. Safe to remove: rm $BOARD_STATE/.review-lock"
else
  echo "  OK: No lock"
fi

echo -e "\n7. Deferred items?"
[ -f "$BOARD_STATE/board/DEFERRED_WORK.md" ] && {
  count=$(grep -c '^\*\*\|^### \|^- \*\*' "$BOARD_STATE/board/DEFERRED_WORK.md" 2>/dev/null)
  echo "  Found: ~$count items in DEFERRED_WORK.md"
} || echo "  INFO: No deferred items file (normal for first review)"

echo -e "\n=== Done ==="
```

---

## 9. SOP Compliance Checks

The 4-round SOP (docs/REVIEW-SOP.md) has specific requirements. If reviews produce poor results:

### Round 1 (Blind Review)
- Each agent must work independently — no agent sees another's report
- Agents must have: `CLAUDE.md` (identity), `inbox/context.md` (domain), `inbox/brief.md` (what to review)
- Deferred items from `DEFERRED_WORK.md` must be included in the brief

### Round 2 (Consolidation)
- Orchestrator (not agents) reads all reports, groups findings, assigns IDs (C1, C2, ...)
- Fresh inboxes: `context.md`, `brief.md` (original), `consolidation.md`, `round2-brief.md`
- Agents review the consolidated findings, not each other's raw reports

### Round 3 (Deliberation) — only if disputes exist
- Agent names become visible (Round 1-2 are anonymous)
- Each agent's position on disputed items is shared

### Round 4 (Confirmation)
- Final brief with all classifications (FIX NOW / DEFER / INFO / REJECT)
- Agents state SIGN OFF or BLOCK
- Blocks escalate to the user

### Severity Levels
- **FIX NOW** — must address before shipping
- **DEFER** — real issue + trigger condition for promotion
- **INFO** — observation, no action required
- **REJECT** — should not be made

---

## 10. Hard-Won Knowledge Reference

These are operational facts that have caused real failures. Memorize them.

| # | Rule | Why |
|---|------|-----|
| 1 | `unset CLAUDECODE` in all bare-mode invocations | Nested Claude sessions fail without it |
| 2 | `codex exec` not `codex` | Bare `codex` opens TUI, hangs as subprocess |
| 3 | Root always needs a board user | YOLO mode blocked for root |
| 4 | Validate sudoers with `visudo -c` | Bad sudoers file bricks sudo |
| 5 | Board user must own `.board/` | Permission denied on agent dirs |
| 6 | Billing warnings before API keys | Pay-per-use costs surprise users |
| 7 | Agent model: Opus+ or gpt-5.4/gpt-5.3-codex | Sonnet lacks reasoning depth |
| 8 | Codex: `approval_policy = "never"` | "full-auto" doesn't work as subprocess |
| 9 | Invocation must read CLAUDE.md first | Agents lose identity without it |
