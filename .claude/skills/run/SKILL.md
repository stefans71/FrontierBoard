---
name: run
description: Run the board agents and synthesise their reports. Run when the user types /run, asks to run the board, or after /brief when the user confirms they're ready to go.
---

# Board of Governance — Run

Run the board agents in parallel, wait for all reports, then synthesise the findings.

---

## Step 1: Read the Board

Read `board/BOARD.md` to get the current agent list, invocation commands, board user (if any), and parallelism pattern.

---

## Step 2: Confirm Inboxes Are Ready

Check that each agent's inbox contains a review brief. If any inbox is empty, ask the user whether they want to run `/brief` first or whether the brief is coming separately.

---

## Step 3: Run All Agents in Parallel

Launch all agents simultaneously using the parallelism pattern from `board/BOARD.md`. Each agent runs from their own directory so their settings bubble is active.

Tell the user which agents are running and roughly how long to expect. Mention that agents are running independently — no coordination between them.

Wait for all agents to complete before moving on.

---

## Step 4: Collect Reports

Check each agent's outbox for the report file. If any agent failed to produce a report, read their error output and diagnose.

Common causes of failure and what to do:
- Auth error — credentials may not have been copied to the board user, or a token expired. Walk the user through re-authenticating that CLI.
- Permissions error on outbox — fix the directory permissions and rerun that agent.
- CLI not found — the CLI may have been updated or moved. Check the install and update the invocation command in BOARD.md.
- Root permissions error on full-auto flag — this means the board user wasn't set up correctly, or the agent is running as root. Go back to the board user setup from `/setup` Step 2.

Don't synthesise until all agents have produced reports. A partial synthesis is worse than waiting.

---

## Step 5: Synthesise

Read all reports. Produce a synthesis for the user covering:

**Consensus findings** — issues or observations that appeared in multiple reports. These carry high confidence. List them with the severity agreed across reports.

**Divergent findings** — issues that appeared in only one report. These are still valid but note which agent raised them and flag that they warrant closer scrutiny before acting on them.

**Conflicts** — cases where agents reached opposite conclusions about the same thing. Surface these explicitly. A conflict is often more informative than agreement — it reveals where the real uncertainty lives.

**Overall picture** — two or three sentences on the overall health or quality of what was reviewed. Is it ready to proceed? What's the most important thing to address first?

---

## Step 6: Log the Review

Append a summary entry to `board/REVIEW-LOG.md` (create it if it doesn't exist). Include the date, what was reviewed, which agents ran, the consensus findings, and the overall picture.

This gives the board memory across sessions. Future reviews can reference past findings.

---

## Step 7: Ask About Findings Resolution

Ask the user how they want to handle the findings:

> Do you want to work through the findings now, or save them for later? For each finding you can mark it as FIXED, DEFERRED, or DISPUTED.

If they want to work through them now, go finding by finding. For each one ask what they want to do with it and note their decision in the review log.

If they want to save it, tell them the reports are in each agent's outbox and the synthesis is in the review log whenever they're ready.

---

## Step 8: Submit Findings as GitHub PRs (Optional)

If the review produced actionable findings that the user wants submitted to a GitHub repo, submit them as PRs. Always show the exact content before submitting — never send a PR without the user seeing it first.

For each PR:

```bash
gh pr create \
  --repo [owner/repo] \
  --title "[fix/feat/docs]: [plain-language summary]" \
  --body "$(cat <<'EOF'
## Summary

[What the finding was and why it matters]

## Changes

[What was changed and why]

---
*Reviewed by [FrontierBoard](https://github.com/stefans71/FrontierBoard) — a multi-LLM board of frontier model agents.*

*Agents: [list each agent that ran, with their CLI and model — e.g. "Skeptic (Claude Code / claude-opus-4-6)", "Systems Thinker (Codex / o4-mini)"]*
EOF
)"
```

**Rules for PR submission:**
- Show the proposed PR body to the user before running `gh pr create`
- Always include the FrontierBoard signature at the bottom of every PR body
- Always list which agents contributed to the finding
- If the finding was raised by only one agent, note it: "Raised by [agent] — not corroborated by other agents; verify before merging."
- Check for an existing open PR or issue covering the same ground before submitting: `gh pr list --repo [owner/repo] --search "[keyword]"`. If one exists, link to it rather than duplicating.
