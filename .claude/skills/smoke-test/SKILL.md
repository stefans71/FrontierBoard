---
name: smoke-test
description: Validate a board installation works end-to-end. Run when the user types /smoke-test or asks to test, validate, or verify the board setup.
---

# Board of Governance — Smoke Test

Validate that all agents can read their identity, receive a brief, and produce a report. This is the canonical way to verify a board installation works.

---

## Step 1: Read the Board

Read `.board/board/BOARD.md` for agent list, invocation commands, and board user. If BOARD.md does not exist, error: "No board found. Run /setup first."

---

## Step 2: Pre-flight Checks

Before running agents, verify the environment is functional:

1. **Board user exists:** `id $BOARD_USER` — error if missing
2. **Agent directories complete:** Each agent has CLAUDE.md, inbox/, outbox/
3. **Outbox writable by board user:** `sudo -u $BOARD_USER test -w $AGENT_DIR/outbox`
4. **CLIs on PATH for board user:** `sudo -u $BOARD_USER bash -c 'which claude'` (or codex)
5. **Credentials exist:** Claude: `~$BOARD_USER/.claude/.credentials.json`. Codex: `~$BOARD_USER/.codex/auth.json`

If any check fails, stop and report the specific failure with a fix suggestion.

---

## Step 3: Prepare Agents

For each agent listed in BOARD.md:

1. Write test brief to `inbox/brief.md`:
   > Smoke test: confirm your identity. State your name, thinking style, and which CLI you are running on. Write your response to outbox/report.md.

2. Write minimal context to `inbox/context.md`:
   > This is a smoke test. No domain context needed.

3. Clear stale reports: `rm -f $AGENT_DIR/outbox/report.md`

---

## Step 4: Sequential Test

Run each agent **one at a time** using its invocation command from BOARD.md. Sequential execution isolates failures — if agent 1 fails, you know it's not a parallelism issue.

For each agent:
1. Record start time
2. Run the invocation command (with a shorter timeout — 120s instead of 900s)
3. Record end time
4. Check exit code
5. Verify `outbox/report.md` exists and is non-empty (`[ -s ... ]`)
6. Read first 3 lines of the report
7. Record: PASS or FAIL with timing

If any agent fails:
- Report the failure with exit code and any error output
- Point to `/debug` for troubleshooting
- Continue testing remaining agents (don't stop at first failure)

---

## Step 5: Parallel Test

**Only if all agents passed sequential.** If any failed, skip this step.

1. Clear all outbox reports again
2. Rewrite test briefs (same content)
3. Run all agents simultaneously using the parallelism pattern from BOARD.md (shorter timeout — 120s)
4. Wait for all to complete
5. Verify all reports exist and are non-empty
6. Record wall-clock time for the parallel run

---

## Step 6: Report Results

Present a summary table:

```
## Smoke Test Results

| Agent | CLI | Sequential | Parallel | Time (seq/par) |
|-------|-----|-----------|----------|----------------|
| pragmatist | claude | PASS | PASS | 15s / 14s |
| systems-thinker | codex | PASS | PASS | 25s / 22s |
| skeptic | claude | PASS | PASS | 16s / 15s |

**Board status:** All agents operational ✓
```

If any failures, include error details and `/debug` references.

---

## Step 7: Cleanup

Remove smoke test briefs and reports (they're not real review artifacts):

```bash
for agent in $BOARD/board/*/; do
  name=$(basename "$agent")
  grep -q "Smoke test" "$agent/inbox/brief.md" 2>/dev/null && rm -f "$agent/inbox/brief.md" "$agent/inbox/context.md" "$agent/outbox/report.md"
done
```
