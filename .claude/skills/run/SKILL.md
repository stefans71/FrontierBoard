---
name: run
description: Run the board agents and synthesise their reports. Run when the user types /run, asks to run the board, or after /brief when the user confirms they're ready to go.
---

# Board of Governance — Run

Execute a board review following the 4-round SOP. The full SOP is in `docs/REVIEW-SOP.md` — this skill implements it.

---

## Step 0: Review Mode Selection

If the user hasn't already specified the depth, ask:

> How deep should this review go?
> 1. **Quick** — 1 agent, single round, fast answer (~5 min)
> 2. **Standard** — full board, 4-round SOP (default)
> 3. **Custom** — pick which agents and how many rounds

Default to **Standard** with the board's configured agent count. Don't ask if the user already specified depth (e.g., "have the board do a full review" → Standard, "quick take on this" → Quick).

**Quick mode:** Pick the agent whose lens best matches the question. Run Round 1 only. Synthesise that single report and present it. Skip Rounds 2-4.

**Standard mode:** All agents, all applicable rounds (Round 3 skipped if unanimous after Round 2).

**Custom mode:** User picks agents and round count.

---

## Step 1: Read the Board

Read `board/BOARD.md` to get the current agent list, invocation commands, board user (if any), and parallelism pattern.

Read `board/DEFERRED_WORK.md` if it exists — deferred items from prior reviews must be included in every brief so agents know what's already been flagged.

---

## Step 2: Round 1 — Blind Review

Check that each agent's inbox contains a review brief and context file. If any inbox is empty, ask the user whether to run `/brief` first.

Launch all agents simultaneously using the parallelism pattern from `board/BOARD.md`. Each agent runs from their own directory so their settings bubble is active.

Tell the user which agents are running and roughly how long to expect.

Wait for all agents to complete. Check each agent's `outbox/report.md`.

If any agent failed to produce a report:
- Auth error → credentials may need refreshing
- Permissions error → fix directory permissions, rerun that agent
- CLI not found → check install, update BOARD.md
- Root error → board user wasn't set up correctly

Do NOT share reports between agents. Do NOT synthesise yet. Proceed to Round 2.

---

## Step 3: Round 2 — Consolidation

**This round is done by the orchestrator (you), not the agents.**

1. Read all Round 1 reports
2. Group findings by theme across all agents
3. Assign consolidated IDs: C1, C2, C3...
4. For each consolidated item, note:
   - Which agents raised it (use names — anonymization is for the agents' brief, not for the user)
   - Whether agents agree on severity
   - Whether agents have different proposed fixes
5. Classify each item: **FIX NOW** / **DEFER** / **INFO** / **REJECT**
   - FIX NOW: must be addressed before shipping
   - DEFER: real issue with a trigger condition for when it becomes FIX NOW
   - INFO: observation, no action needed
   - REJECT: proposed change that should not be made
6. For every DEFER item, define a **trigger condition** — a specific observable event that promotes it to FIX NOW
7. Apply any owner directives the user has given

**Write the Round 2 brief.** This goes to all agents' inboxes. It contains:
- All consolidated items with anonymized agent positions (Agent A said X, Agent B said Y)
- Each item's proposed classification
- Owner directives clearly marked
- Deferred items from prior reviews (from `board/DEFERRED_WORK.md`)

**Present the consolidation to the user** before running agents. Ask if they have directives:

> Here's the consolidation from Round 1. Do you have any directives before the agents respond?
> (Owner directives override agent positions — use them to settle scope debates or accept/reject specific findings.)

Run all agents again. Each agent responds per item: **AGREE**, **DISAGREE** (with rationale), or **MODIFY** (with alternative).

Collect Round 2 reports.

---

## Step 4: Round 3 — Deliberation

**Check if needed:** If Round 2 is unanimous (all agents AGREE on all items), skip to Step 5 (Confirmation). Tell the user:

> Round 2 was unanimous — all agents agree on all findings. Skipping deliberation, moving to confirmation.

**If disagreements exist:**

1. Extract only the disputed items
2. Show each agent's Round 2 position **with names visible** — deliberation is not blind
3. Write the Round 3 brief with disputed items and each agent's position
4. Run agents — each states **AGREE** or **BLOCK** per disputed item

This is the debate round. Agents can see each other's reasoning and must converge or explicitly block.

Collect Round 3 reports.

---

## Step 5: Round 4 — Confirmation

Write the final brief containing:
- Complete list: all FIX NOW items with implementation notes
- All DEFER items with trigger conditions
- All INFO and REJECT items
- Resolution of any Round 3 disputes

Run all agents. Each states: **SIGN OFF** or **BLOCK** (with specific concern).

**If all agents SIGN OFF:** Review is complete.

**If any agent BLOCKs:** Present the block to the user:

> [Agent] is blocking on: [concern]. Do you want to:
> 1. Address the concern and rerun confirmation
> 2. Override the block with documented rationale (owner authority)
> 3. Go back to deliberation on this item

---

## Step 6: Post-Review

### Write the Review Log

Append to `board/REVIEW-LOG.md`:

```markdown
# Review: [What was reviewed]

**Date:** [date]
**Mode:** [Quick/Standard/Custom]
**Rounds:** [how many ran]
**Agents:** [list with CLIs and models]

## FIX NOW
[table of items]

## DEFERRED
[table with trigger conditions]

## INFO
[notable observations]

## Key Decisions
[owner directives, deliberation outcomes]
```

### Update Deferred Work

Create or update `board/DEFERRED_WORK.md`:

```markdown
# Deferred Work

| ID | Item | Trigger Condition | Origin | Status |
|----|------|-------------------|--------|--------|
| C8 | [Description] | [When this becomes FIX NOW] | Review [date] | ACTIVE |
```

Items from prior reviews stay in this file. New items are appended. Items that were promoted to FIX NOW in this review get their status updated to RESOLVED.

### Present Summary

Give the user:
1. Final FIX NOW list (what to do now)
2. DEFER list (what to watch for)
3. Whether all agents signed off or if there are overrides

---

## Step 7: Ask About Next Steps

> Do you want to:
> 1. Work through the FIX NOW items now
> 2. Submit findings as GitHub PRs
> 3. Save for later — reports are in each agent's outbox and the synthesis is in the review log

If submitting PRs, follow the PR format from `board/BOARD.md`:

```bash
gh pr create \
  --repo [owner/repo] \
  --title "[fix/feat/docs]: [summary]" \
  --body "$(cat <<'EOF'
## Summary
[What and why]

## Changes
[What was changed]

---
*Reviewed by [FrontierBoard](https://github.com/stefans71/FrontierBoard) — multi-LLM board of frontier model agents.*
*Agents: [list each agent with CLI and model]*
*Review mode: [Quick/Standard] | Rounds: [N] | All agents signed off: [yes/no]*
EOF
)"
```

Rules:
- Show proposed PR body to user before submitting
- Always include FrontierBoard signature
- If finding was raised by only one agent, note it
- Check for existing PRs/issues before duplicating
