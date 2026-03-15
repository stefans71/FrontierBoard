---
name: run
description: Run the board agents and synthesise their reports. Run when the user types /run, asks to run the board, or after /brief when the user confirms they're ready to go.
---

# Board of Governance — Run

Execute a board review following the 4-round SOP in `docs/REVIEW-SOP.md`.

---

## Step 0: Review Mode

If the user hasn't specified depth:

> How deep should this review go?
> 1. **Quick** — 1 agent, single round (~5 min)
> 2. **Standard** — full board, 4-round SOP (default)
> 3. **Custom** — pick agents and rounds

**Quick:** Best-matching agent, Round 1 only, synthesise and present. **Standard:** All agents, all applicable rounds. **Custom:** User picks.

---

## Step 1: Read the Board

Read `.board/board/BOARD.md` for agent list, invocation commands, isolation mode (`container` or `bare`), board user, parallelism pattern.

**Deferred items are active context.** Read `.board/board/DEFERRED_WORK.md` if it exists and include the FULL contents in every agent brief. Frame them as: "Evaluate whether your review triggers any of these deferred items. If a trigger condition is met, promote to FIX NOW with evidence." Do NOT tell agents "do not re-raise" — that causes them to ignore deferred items entirely.

### C3: Review lockfile

Before starting, check for `$BOARD/.board/.review-lock`. If it exists:
1. Read its contents (project name, PID, timestamp)
2. Check if the PID is still alive (`kill -0 $PID`)
3. If alive → error: "Review in progress for {project} (PID {pid}, started {timestamp}). Wait or kill it."
4. If dead → remove stale lock and continue

Create the lock at start: `echo "{project}|$$|$(date -Iseconds)" > $BOARD/.board/.review-lock`
Remove the lock in Step 6 (Post-Review) — **including on error/cancel paths**.

### Container mode setup

If `isolation: container`:
1. Verify the `frontierboard-agent` Docker image exists (`docker images frontierboard-agent`). If missing, build it: `$BOARD/container/build.sh`.
2. **C8: Stale proxy handling** — Check PID file at `$BOARD/container/.fb-proxy.pid`. If it exists:
   - Read the PID and validate it's actually a proxy process (check `/proc/$PID/cmdline` for `fb-credential-proxy`)
   - If valid proxy running → reuse it
   - If stale PID (process dead or not a proxy) → remove PID file, start fresh
   - If no PID file → start fresh
3. Start proxy if needed: `node $BOARD/container/fb-credential-proxy.cjs &`. Wait 1 second, verify PID file exists and process is alive. If startup fails, surface the error before launching agents.
4. **C7: Verify proxy health** — `curl -sf http://$PROXY_HOST:$PROXY_PORT/health` and confirm response contains `"service":"fb-credential-proxy"` and the expected port. If verification fails, abort with a clear error. Note: proxy binds to Docker bridge IP (e.g., 10.0.0.1), not localhost.
5. The proxy **must stay running across all review rounds** (Steps 2-5). Do NOT stop it between rounds.
6. Stop the proxy in Step 6 (Post-Review) after all reports are collected: `node $BOARD/container/fb-credential-proxy.cjs --stop`. If the review is cancelled or fails partway, still stop the proxy.

---

## Step 2: Round 1 — Blind Review

**Agents are ephemeral.** Every invocation is a fresh session with zero memory. All context — identity, domain context, brief, prior round artifacts — must be in their inbox. If you don't give it to them, they don't have it.

Verify each agent's inbox has `brief.md` and `context.md`. If empty, ask about running `/brief` first.

Generate a run ID (e.g., `run-$(date +%s)`) and write it to each agent's `outbox/.run-id` before launching. This sentinel prevents stale report confusion.

Launch all agents simultaneously per BOARD.md parallelism pattern. Each runs from their own directory. Tell the user which agents are running and rough timing.

Wait for all to complete. For each agent:
1. Check exit code — non-zero or timeout (exit 124) means failure
2. Verify `outbox/report.md` exists and was modified after the run started
3. If Codex: check whether `outbox/report.md` contains CLI error output (starts with `OpenAI Codex v` or contains `ERROR:`) — if so, the agent failed, do not treat the error text as findings
4. Report failed agents explicitly before proceeding

Do NOT share reports between agents. Do NOT synthesize error output as findings.

---

## Step 3: Round 2 — Consolidation

**Done by you (orchestrator), not agents.**

1. Read all Round 1 reports
2. Group findings by theme, assign IDs (C1, C2...)
3. Note agent agreement/disagreement per item
4. Classify: FIX NOW / DEFER / INFO / REJECT
5. Every DEFER gets a trigger condition
6. Apply owner directives

Present consolidation to user before running agents:

> Here's the consolidation. Do you have any directives before agents respond?

**Prepare Round 2 inboxes** (agents are ephemeral — fresh session):
- `context.md` — same domain context
- `brief.md` — original Round 1 brief (agents need source material)
- `consolidation.md` — your consolidated findings
- `round2-brief.md` — instructions (AGREE/DISAGREE/MODIFY per item), owner directives

Run all agents. Collect Round 2 reports.

---

## Step 4: Round 3 — Deliberation

If Round 2 is unanimous, skip to Step 5:

> Round 2 unanimous — skipping to confirmation.

If disagreements exist: extract disputed items, show each agent's position with names visible, write Round 3 brief. Inboxes need everything from prior rounds plus `round3-brief.md`. Agents state AGREE or BLOCK per item.

---

## Step 5: Round 4 — Confirmation

Final brief: all items with classifications, implementation notes, dispute resolutions. Inboxes need all prior context plus `round4-brief.md`.

Agents state SIGN OFF or BLOCK.

If all sign off → complete. If any block:

> [Agent] is blocking on: [concern]. Do you want to:
> 1. Address the concern and rerun confirmation
> 2. Override with documented rationale (owner authority)
> 3. Go back to deliberation

---

## Step 6: Post-Review

**Always run this step, even on error/cancel.**

Remove the review lockfile: `rm -f $BOARD/.board/.review-lock`

If `isolation: container`, stop the credential proxy: `node $BOARD/container/fb-credential-proxy.cjs --stop`.

Append to `.board/board/REVIEW-LOG.md`: what was reviewed, date, mode, rounds, agents, FIX NOW table, DEFER table with triggers, INFO items, key decisions.

Create/update `.board/board/DEFERRED_WORK.md` with any new DEFER items. Update resolved items.

Present summary: FIX NOW list, DEFER list, sign-off status.

---

## Step 7: Next Steps

> Do you want to:
> 1. Work through the FIX NOW items now
> 2. Submit findings as GitHub PRs
> 3. Save for later — reports are in outboxes, synthesis in the review log

For PRs: show proposed body to user before submitting. Always include FrontierBoard signature. Check for existing PRs before duplicating.
