---
name: debug
description: Debug FrontierBoard issues — container failures, auth problems, agent errors, proxy issues, review failures. Use when things aren't working, agents fail to produce reports, authentication breaks, or to validate the full setup end-to-end.
---

# FrontierBoard Debugging

Systematic diagnosis of board issues. Don't guess — run the checks, read the output, fix what's broken.

**Strategy:** Start with the quick diagnostic script (Section 10). If that passes, move to the specific section matching the symptom. If you don't know what's wrong, run a single-agent smoke test (Section 9) to isolate the failure.

---

## 1. Architecture Overview

```
Orchestrator (Claude Code session)
    │
    ├── Reads BOARD.md for agent list, invocation commands, isolation mode
    ├── Reads/writes agent inboxes (brief.md, context.md, round2-brief.md, etc.)
    ├── Launches agents in parallel (per BOARD.md parallelism pattern)
    ├── Collects reports from outboxes
    └── Synthesises findings → REVIEW-LOG.md

Container Mode                              Bare Mode
─────────────────────────────────           ─────────────────────────────
Orchestrator (host)                         Orchestrator (host)
    │                                           │
    ├── Starts credential proxy                 ├── sudo -u $BOARD_USER
    ├── Extracts OAuth token                    │   (agents run as board user)
    ├── docker run per agent                    │
    │   ├── CLAUDE_CODE_OAUTH_TOKEN env var     ├── unset CLAUDECODE
    │   ├── OPENAI_BASE_URL → proxy             │   (prevents nested session error)
    │   ├── Project mounted :ro                 │
    │   ├── Inbox mounted :ro                   └── claude/codex exec from agent dir
    │   ├── Outbox mounted :rw                      (reads CLAUDE.md, inbox, writes outbox)
    │   └── .claude settings mounted
    │
    └── Proxy (host, Docker bridge IP)
        ├── Anthropic: reads ~/.claude/.credentials.json per-request
        ├── OpenAI: reads ~/.codex/auth.json per-request
        └── Injects real creds, forwards upstream
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
| `$BOARD/container/fb-credential-proxy.cjs` | Credential proxy (container mode) |
| `$BOARD/container/.fb-proxy.pid` | Proxy PID file |

---

## 2. Common Symptoms → Section Map

| Symptom | Go to |
|---------|-------|
| `401 authentication_error` | Section 3 (Auth) |
| `OAuth authentication is currently not supported` | Section 3.3 |
| `Please run /login` | Section 3.1 |
| Agent produces no report | Section 5 |
| Report is stale (from previous round) | Section 5.3 |
| `Cannot be launched inside another Claude Code session` | Section 4.1 |
| Proxy won't start / port in use | Section 6 |
| Container can't reach proxy | Section 6.4 |
| `Permission denied` writing to outbox | Section 7 |
| Review hangs / lockfile stuck | Section 8 |
| Codex agent fails silently | Section 4.3 |
| Wrong board used (global vs local) | Section 4.5 |

---

## 3. Authentication Issues

### 3.1 Claude Code: "Please run /login" or 401

**In container mode:** The container's Claude Code can't find credentials. Check:

```bash
# Is the OAuth token being passed?
# The orchestrator should extract it before each round:
python3 -c "import json; d=json.load(open('$HOME/.claude/.credentials.json')); print('Token length:', len(d['claudeAiOauth']['accessToken'])); print('Expires in:', round((d['claudeAiOauth']['expiresAt'] - __import__('time').time()*1000) / 60000), 'minutes')"
```

If the token exists and isn't expired, verify the container receives it:
```bash
docker run --rm --entrypoint bash \
  -e CLAUDE_CODE_OAUTH_TOKEN="test-token" \
  frontierboard-agent:latest \
  -c 'echo "Token length: ${#CLAUDE_CODE_OAUTH_TOKEN}"'
```

**Common causes:**
- Token not extracted before `docker run` — check BOARD.md parallelism pattern has the token extraction step
- Token expired — orchestrator session needs to refresh (open a new Claude session on host)
- Wrong env var name — must be `CLAUDE_CODE_OAUTH_TOKEN`, not `ANTHROPIC_API_KEY` for OAuth

**In bare mode:** The board user doesn't have credentials.
```bash
# Check if board user has credentials
sudo -u llmuser cat ~/.claude/.credentials.json 2>&1 | head -3
# If missing, copy from current user:
sudo cp ~/.claude/.credentials.json ~llmuser/.claude/.credentials.json
sudo chown llmuser:llmuser ~llmuser/.claude/.credentials.json
```

### 3.2 Codex: 401 through proxy

The proxy reads from `~/.codex/auth.json`. Check:

```bash
# Is the Codex auth file present and has a token?
python3 -c "
import json
d = json.load(open('$HOME/.codex/auth.json'))
t = d.get('tokens', {})
print('auth_mode:', d.get('auth_mode'))
print('has access_token:', bool(t.get('access_token')))
print('token length:', len(t.get('access_token', '')))
"

# Is the proxy picking it up?
curl -sf http://$(ip addr show docker0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1):3002/health | python3 -m json.tool
# Should show "openai" in credentials list
```

**Common causes:**
- Codex not authenticated — run `codex` interactively once to authenticate
- ChatGPT OAuth token missing `api.responses.write` scope — re-authenticate with `codex` or use an OpenAI API key (`OPENAI_API_KEY`) instead of ChatGPT OAuth
- Codex 0.115+ sends `/responses` without `/v1/` prefix — the proxy normalizes this automatically

### 3.3 "OAuth authentication is currently not supported"

This happens when the proxy injects an OAuth Bearer token into a request to `api.anthropic.com`. The Anthropic API rejects third-party OAuth token injection.

**Fix:** Don't use the proxy for Claude agents with OAuth. Use `CLAUDE_CODE_OAUTH_TOKEN` env var instead:
```bash
# WRONG (proxy mode with OAuth):
-e ANTHROPIC_BASE_URL=http://host.docker.internal:3002
-e ANTHROPIC_API_KEY=placeholder

# RIGHT (direct OAuth):
-e CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_TOKEN"
```

The proxy is only needed for:
- Claude agents with `ANTHROPIC_API_KEY` (not OAuth)
- Codex agents (always — OpenAI API accepts proxied tokens)

### 3.4 Token Refresh Race Condition (Bare Mode)

Multiple parallel `claude` processes sharing `~/.claude/.credentials.json` race to refresh the OAuth token. The loser gets 401.

**Fix:** Switch to container mode (each container gets a snapshot of the token via env var, no shared file) or use an API key.

---

## 4. Agent Invocation Issues

### 4.1 "Cannot be launched inside another Claude Code session"

The `CLAUDECODE` env var is set, preventing nested sessions.

**Bare mode fix:** All invocations must include `unset CLAUDECODE`:
```bash
sudo -u llmuser bash -c 'unset CLAUDECODE && cd $AGENT_DIR && claude ...'
```

**Container mode:** This shouldn't happen — containers start fresh. If it does, check that the orchestrator isn't passing `CLAUDECODE` via `-e`.

### 4.2 "--dangerously-skip-permissions cannot be used with root"

Claude Code blocks YOLO mode for root users.

**Fix:** Must use a board user (bare mode) or containers (which run as `node` uid 1000).

### 4.3 Codex Agent Fails Silently

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

### 4.4 Agent Doesn't Read CLAUDE.md

All invocation prompts must start with `read CLAUDE.md then ...`. Without this, agents lose their identity and produce generic output.

Check BOARD.md invocation commands contain:
```
"read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md"
```

### 4.5 Wrong Board Used (Global vs Local)

If Claude picks up the global install (`~/.frontierboard/`) instead of the local one, check:
- Which CLAUDE.md is being read (look at paths in the session)
- Whether `~/.claude/skills/frontierboard/SKILL.md` exists and is routing to global
- The orchestrator's working directory — it should be `$BOARD/.board/`, not `~/.frontierboard/`

**Fix:** Run from the local board directory explicitly:
```bash
cd /path/to/FrontierBoard/.board && claude --dangerously-skip-permissions -p "read CLAUDE.md then /run"
```

---

## 5. Report Issues

### 5.1 Agent Produces No Report

Check in order:
1. **Did the container start?** `docker ps -a | grep fb-` — look for exited containers
2. **What was the exit code?** `docker inspect --format='{{.State.ExitCode}}' <container>` — 0=success, 124=timeout, 1=error
3. **Is the outbox writable?** See Section 7
4. **Is the inbox populated?** Check `inbox/brief.md` and `inbox/context.md` exist and are non-empty
5. **Did the agent read the prompt?** The `FB_PROMPT` env var must be set (container mode)

### 5.2 Report is Empty or Generic

- Agent didn't get its CLAUDE.md (identity lost) — check mount
- Brief was empty or too vague — check `inbox/brief.md`
- Context file missing — check `inbox/context.md` and `contexts/{domain}.md`
- Model too weak — must be `claude-opus-4-6` or `o4-mini`, never Sonnet

### 5.3 Report is Stale (From Previous Round)

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

## 6. Credential Proxy Issues (Container Mode)

### 6.1 Proxy Won't Start

```bash
# Check if already running
cat $BOARD/container/.fb-proxy.pid 2>/dev/null && echo "PID file exists"
curl -sf http://$(ip addr show docker0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1):3002/health

# If PID file exists but proxy is dead, clean up:
node $BOARD/container/fb-credential-proxy.cjs --stop
# Then restart:
node $BOARD/container/fb-credential-proxy.cjs &
```

### 6.2 Port Already In Use (EADDRINUSE)

```bash
# Find what's using the port
lsof -i :3002
# Kill stale proxy or choose different port:
FB_PROXY_PORT=3005 node $BOARD/container/fb-credential-proxy.cjs &
```

### 6.3 Proxy Has No Credentials

```bash
curl -sf http://10.0.0.1:3002/health | python3 -m json.tool
# Check "credentials" array in response
```

If empty, the proxy couldn't find any credentials. It checks (in order):
1. `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env vars
2. `~/.claude/.credentials.json` (Claude OAuth)
3. `~/.codex/auth.json` (Codex OAuth)

Run `claude /login` or `codex` to authenticate.

### 6.4 Container Can't Reach Proxy

```bash
# Test from inside a container
docker run --rm --entrypoint bash --add-host=host.docker.internal:host-gateway \
  frontierboard-agent:latest \
  -c 'curl -sf http://host.docker.internal:3002/health || echo "UNREACHABLE"'
```

**Common causes:**
- Missing `--add-host=host.docker.internal:host-gateway` in docker run
- Proxy bound to wrong IP (should be Docker bridge, not localhost)
- UFW blocking Docker → host traffic

**Firewall fix:**
```bash
# Check Docker bridge subnet
ip addr show docker0 | grep 'inet '
# Allow it
ufw allow from 10.0.0.0/24 to any port 3002 comment "FrontierBoard credential proxy"
```

### 6.5 Proxy Auto-Shutdown During Long Review

Default idle timeout is 30 minutes. If no requests for 30 min (e.g., during consolidation), the proxy shuts down.

**Fix:** Increase timeout or disable:
```bash
FB_PROXY_MAX_IDLE=7200 node $BOARD/container/fb-credential-proxy.cjs &  # 2 hours
# or
FB_PROXY_MAX_IDLE=0 node $BOARD/container/fb-credential-proxy.cjs &     # no auto-shutdown
```

---

## 7. Permission Issues

### 7.1 Container Can't Write to Outbox

Container runs as `node` (uid 1000). Outbox must be writable:

```bash
# Check current permissions
ls -la $BOARD/.board/board/*/outbox/

# Fix: make writable by container user
chmod 777 $BOARD/.board/board/*/outbox $BOARD/.board/board/*/learnings
# Or set ownership to uid 1000:
chown -R 1000:1000 $BOARD/.board/board/*/outbox $BOARD/.board/board/*/learnings
# Also chown CLI settings dirs that agents need write access to
chown -R 1000:1000 $BOARD/.board/board/*/.codex $BOARD/.board/board/*/.claude 2>/dev/null
```

### 7.2 Bare Mode: Board User Can't Access Agent Dirs

```bash
# Check ownership
ls -la $BOARD/.board/board/

# Fix: chown entire .board to board user
chown -R llmuser:llmuser $BOARD/.board/

# Also ensure parent directory is traversable
chmod o+x $BOARD $BOARD/.board $BOARD/.board/board
```

### 7.3 Credential File Not Readable

`~/.claude/.credentials.json` is owned by root with mode 600. Containers (uid 1000) can't read it.

**This is why we use `CLAUDE_CODE_OAUTH_TOKEN` env var instead of mounting the file.**

If you see `Permission denied` on `.credentials.json` inside a container, switch to the env var approach (see Section 3.1).

---

## 8. Review Lockfile Issues

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

## 9. Smoke Tests

### 9.1 Single Agent (Container Mode)

Tests: token extraction, docker run, agent auth, inbox reading, outbox writing.

```bash
BOARD=/path/to/FrontierBoard/.board
PROJ=/path/to/project
AGENT=pragmatist
AGENT_DIR=$BOARD/board/$AGENT

# Prep
echo "Smoke test: confirm your identity. Write one sentence to outbox/report.md." > $AGENT_DIR/inbox/brief.md
echo "Smoke test context." > $AGENT_DIR/inbox/context.md
rm -f $AGENT_DIR/outbox/report.md

# Extract token
CLAUDE_TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.claude/.credentials.json'))['claudeAiOauth']['accessToken'])")

# Run
timeout 120 docker run -i --rm --name fb-smoke-test \
  -e FB_CLI=claude -e FB_YOLO=true \
  -e FB_PROMPT="read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md" \
  -e CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_TOKEN" \
  --add-host=host.docker.internal:host-gateway \
  -v $PROJ:/workspace/project:ro \
  $( [ -f "$PROJ/.env" ] && echo "-v /dev/null:/workspace/project/.env:ro" ) \
  -v $AGENT_DIR/CLAUDE.md:/workspace/agent/CLAUDE.md:ro \
  -v $AGENT_DIR/inbox:/workspace/agent/inbox:ro \
  -v $AGENT_DIR/outbox:/workspace/agent/outbox \
  -v $AGENT_DIR/contexts:/workspace/agent/contexts:ro \
  -v $AGENT_DIR/learnings:/workspace/agent/learnings \
  -v $AGENT_DIR/.claude:/home/node/.claude \
  frontierboard-agent:latest

# Verify
[ -s "$AGENT_DIR/outbox/report.md" ] && echo "PASS: Report written" || echo "FAIL: No report"
cat "$AGENT_DIR/outbox/report.md"
```

### 9.2 Proxy + Codex Agent

Tests: proxy startup, credential reading, container→proxy connectivity, Codex auth.

```bash
BOARD=/path/to/FrontierBoard/.board
AGENT_DIR=$BOARD/board/systems-thinker

# Start proxy
node $BOARD/../container/fb-credential-proxy.cjs &
sleep 2

# Check health
PROXY_IP=$(ip addr show docker0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
curl -sf http://$PROXY_IP:3002/health | python3 -m json.tool

# Prep
echo "Smoke test: confirm your identity. Write one sentence to outbox/report.md." > $AGENT_DIR/inbox/brief.md
echo "Smoke test context." > $AGENT_DIR/inbox/context.md
rm -f $AGENT_DIR/outbox/report.md

# Run Codex agent through proxy
timeout 120 docker run -i --rm --name fb-smoke-codex \
  -e FB_CLI=codex -e FB_YOLO=true \
  -e FB_PROMPT="read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md" \
  -e OPENAI_BASE_URL=http://host.docker.internal:3002 \
  -e OPENAI_API_KEY=placeholder \
  --add-host=host.docker.internal:host-gateway \
  -v $AGENT_DIR/CLAUDE.md:/workspace/agent/CLAUDE.md:ro \
  -v $AGENT_DIR/inbox:/workspace/agent/inbox:ro \
  -v $AGENT_DIR/outbox:/workspace/agent/outbox \
  -v $AGENT_DIR/.codex:/home/node/.codex:ro \
  frontierboard-agent:latest

# Verify
[ -s "$AGENT_DIR/outbox/report.md" ] && echo "PASS" || echo "FAIL"

# Cleanup
node $BOARD/../container/fb-credential-proxy.cjs --stop
```

### 9.3 All Agents in Parallel

Tests: full parallelism pattern, all CLIs, proxy under load.

Run the parallelism pattern from BOARD.md with a simple "confirm identity" brief. All 3 reports should appear within ~2 minutes.

### 9.4 Single Agent (Bare Mode)

```bash
AGENT_DIR=$BOARD/board/pragmatist
echo "Smoke test: confirm identity." > $AGENT_DIR/inbox/brief.md
echo "Context." > $AGENT_DIR/inbox/context.md
rm -f $AGENT_DIR/outbox/report.md

sudo -u llmuser bash -c "unset CLAUDECODE && cd $AGENT_DIR && claude --dangerously-skip-permissions -p 'read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md'"

[ -s "$AGENT_DIR/outbox/report.md" ] && echo "PASS" || echo "FAIL"
```

---

## 10. Quick Diagnostic Script

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

echo -e "\n3. Docker available?"
docker info &>/dev/null && echo "  OK: Docker running" || echo "  FAIL: Docker not running"

echo -e "\n4. Container image exists?"
docker images frontierboard-agent:latest --format '{{.Repository}}:{{.Tag}} ({{.Size}}, built {{.CreatedSince}})' 2>/dev/null || echo "  MISSING: Run $BOARD/container/build.sh"

echo -e "\n5. Claude Code authenticated?"
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

echo -e "\n6. Codex authenticated?"
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

echo -e "\n7. Agent directories?"
for agent in $BOARD_STATE/board/*/; do
  name=$(basename "$agent")
  [ "$name" = "*" ] && continue
  [ -f "$agent/CLAUDE.md" ] || { echo "  FAIL: $name missing CLAUDE.md"; continue; }
  [ -d "$agent/inbox" ] || { echo "  FAIL: $name missing inbox/"; continue; }
  [ -d "$agent/outbox" ] || { echo "  FAIL: $name missing outbox/"; continue; }
  # Check outbox writable by uid 1000 (container mode)
  outbox_perms=$(stat -c '%a' "$agent/outbox" 2>/dev/null)
  [ "$outbox_perms" = "777" ] || [ "$(stat -c '%u' "$agent/outbox" 2>/dev/null)" = "1000" ] && \
    echo "  OK: $name (inbox, outbox[w], CLAUDE.md)" || \
    echo "  WARN: $name outbox may not be writable by container (perms: $outbox_perms, uid: $(stat -c '%u' "$agent/outbox"))"
done

echo -e "\n8. Proxy status?"
PROXY_IP=$(ip addr show docker0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
if [ -n "$PROXY_IP" ]; then
  HEALTH=$(curl -sf "http://$PROXY_IP:3002/health" 2>/dev/null)
  if [ -n "$HEALTH" ]; then
    echo "  OK: Proxy running at $PROXY_IP:3002"
    echo "  Credentials: $(echo $HEALTH | python3 -c 'import json,sys; print(", ".join(json.load(sys.stdin).get("credentials",[])))' 2>/dev/null)"
  else
    echo "  INFO: Proxy not running (start with: node $BOARD/container/fb-credential-proxy.cjs &)"
  fi
else
  echo "  WARN: No docker0 interface found"
fi

echo -e "\n9. Firewall (UFW)?"
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw status 2>/dev/null | grep 3002 && echo "  OK" || echo "  WARN: No UFW rule for port 3002. Run: ufw allow from 10.0.0.0/24 to any port 3002"
else
  echo "  INFO: UFW not active (no firewall check needed)"
fi

echo -e "\n10. Review lockfile?"
if [ -f "$BOARD_STATE/.review-lock" ]; then
  LOCK=$(cat "$BOARD_STATE/.review-lock")
  LOCK_PID=$(echo "$LOCK" | cut -d'|' -f2)
  ps -p "$LOCK_PID" &>/dev/null && echo "  ACTIVE: Review in progress ($LOCK)" || echo "  STALE: Lock exists but PID $LOCK_PID is dead. Safe to remove: rm $BOARD_STATE/.review-lock"
else
  echo "  OK: No lock"
fi

echo -e "\n11. Deferred items?"
[ -f "$BOARD_STATE/board/DEFERRED_WORK.md" ] && {
  count=$(grep -c '^\*\*\|^### \|^- \*\*' "$BOARD_STATE/board/DEFERRED_WORK.md" 2>/dev/null)
  echo "  Found: ~$count items in DEFERRED_WORK.md"
} || echo "  INFO: No deferred items file (normal for first review)"

echo -e "\n=== Done ==="
```

---

## 11. Container Image Issues

### Check image contents
```bash
docker run --rm --entrypoint bash frontierboard-agent:latest -c '
  echo "=== Node ===" && node --version
  echo "=== Claude Code ===" && claude --version
  echo "=== Codex ===" && codex --version 2>/dev/null || echo "not found"
  echo "=== User ===" && whoami && id
  echo "=== Workspace ===" && ls -la /workspace/
'
```

### Rebuild image
```bash
# Normal rebuild
$BOARD/container/build.sh

# Force clean rebuild (clears Docker build cache)
docker builder prune -af
$BOARD/container/build.sh
```

**Note:** `--no-cache` alone does NOT invalidate COPY steps — the builder's volume retains stale files. Use `docker builder prune -af` for a truly clean rebuild.

---

## 12. SOP Compliance Checks

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

## 13. Hard-Won Knowledge Reference

These are operational facts that have caused real failures. Memorize them.

| # | Rule | Why |
|---|------|-----|
| 1 | `unset CLAUDECODE` in all bare-mode invocations | Nested Claude sessions fail without it |
| 2 | `codex exec` not `codex` | Bare `codex` opens TUI, hangs as subprocess |
| 3 | Root always needs a board user (bare mode) | YOLO mode blocked for root |
| 4 | Validate sudoers with `visudo -c` | Bad sudoers file bricks sudo |
| 5 | Board user must own `.board/` | Permission denied on agent dirs |
| 6 | Billing warnings before API keys | Pay-per-use costs surprise users |
| 7 | Agent model: Opus+ or o4-mini | Sonnet lacks reasoning depth |
| 8 | Codex: `approval_policy = "never"` | "full-auto" doesn't work as subprocess |
| 9 | Invocation must read CLAUDE.md first | Agents lose identity without it |
| 10 | Don't proxy OAuth tokens for Anthropic | API rejects third-party Bearer injection |
| 11 | Don't mount ~/.claude/.credentials.json | Root-owned mode 600, container uid 1000 can't read |
| 12 | Use `CLAUDE_CODE_OAUTH_TOKEN` env var | Works in containers, no file permission issues |
| 13 | Codex config.toml: `model` is top-level string | `[model]` table causes "invalid type: map, expected a string" |
| 14 | Codex `.codex/` dir must be writable (not `:ro`) | Codex writes session state; read-only mount causes "Read-only file system" |
| 15 | Codex 0.115+: `OPENAI_BASE_URL` deprecated | Use `openai_base_url` in config.toml instead |
| 16 | Codex 0.115+ sends `/responses` not `/v1/responses` | Proxy normalizes path automatically; if using a different proxy, add `/v1` prefix |
| 17 | Codex ChatGPT OAuth may lack `api.responses.write` scope | Use `OPENAI_API_KEY` or re-authenticate with `codex` for full scopes |
