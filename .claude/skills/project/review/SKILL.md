---
name: project-review
description: Touchpoint adapter — detects which board review to trigger, writes agent inboxes, and invokes /run. The core lifecycle skill.
---

# Project Review — Touchpoint Adapter

Detect the correct touchpoint, compose the brief, write agent inboxes directly, and trigger `/run`. This is the bridge between the lifecycle and the board.

**Integration contract:** This skill writes `inbox/brief.md` and `inbox/context.md` directly to each agent's inbox directory. It does NOT call `/brief` as a conversational skill. Then it invokes `/run` which reads those inboxes and launches agents.

---

## Step 1: Detect Touchpoint

Read `tasks.json` v2. Apply the touchpoint detection table from the `/project` router:

| Condition | Touchpoint | Mode |
|-----------|-----------|------|
| Phases exist, no phase complete, no review_ref on phase 0 | T1: Roadmap | Standard |
| Phase N just became active, no review_ref | T2: Phase Plan | Quick (Standard if arch/auth/security) |
| User ran `/project tests` | T3: Test Specs | Quick, Skeptic only |
| User ran `/project tests --verify` | T4: Test Code Review | Quick, Skeptic only |
| All tasks in active phase closed with verification | T5: Phase Exit | Standard |
| All phases complete | T6: Ship | Standard, mandatory |
| `meta.shipped: true` | T7: Post-Ship | Quick or Standard |

**When ambiguous:** Show detected state and ask the user:

> I'm not sure which review to trigger. Current state:
> - Phase {N}: {status}, {X}/{Y} tasks closed
> - Last review: {ref}
>
> Which touchpoint?
> 1. T2: Phase Plan
> 2. T5: Phase Exit
> 3. Something else — describe it

---

## Step 2: Compose Brief

Build the brief content based on touchpoint:

### T1: Roadmap Review
- Full `tasks.json` (all phases + all tasks)
- `SPEC.md` contents
- Evaluation: "Is the plan sound? Are phases well-scoped? Are done criteria verifiable?"

### T2: Phase Plan
- Phase tasks + goals for the newly active phase
- `SPEC.md` relevant sections
- Evaluation: "Are tasks well-scoped? Are test criteria sufficient? Anything missing?"

### T3: Test Specs (Skeptic only)
- Task `test_criteria` and `done_when` for current phase
- `SPEC.md` relevant sections
- Evaluation: "Write test specifications as structured prose. Cover happy paths, edge cases, error conditions."

### T4: Test Code Review (Skeptic only)
- Implemented test files (read from filesystem)
- Skeptic's original specs from `docs/test-specs/`
- Evaluation: "Review this test code against your spec. Flag weak tests, missing edge cases, trivial assertions like expect(true).toBe(true)."

### T5: Phase Exit
- `git diff` from phase start tag (or initial commit) to HEAD
- Verification fields for all closed tasks
- Test results summary
- Evaluation: "Is this phase done? Do verification fields match actual work? Any gaps?"

### T6: Ship
- Full project diff (all phases)
- All verification fields across all tasks
- Evaluation: "Ship or not? Is the project complete and verified?"

### T7: Post-Ship
- Change diff since ship tag
- Impact assessment
- Evaluation: "Does this change break shipped functionality?"

---

## Step 3: Write Inboxes

Read `.board/board/BOARD.md` for agent list and directories.

**Check lockfile first:** Before clearing any outboxes, check for `.board/.review-lock`. If a review is already in progress, abort with a message — do NOT clear outboxes of an in-progress review.

For each agent (or Skeptic only for T3/T4):

1. Write `inbox/context.md` — domain context from agent's `contexts/` directory
2. Write `inbox/brief.md` — composed brief from Step 2
3. Clear previous `outbox/report.md`

Include deferred items from `tasks.json` (status=deferred) in every brief:
> "Evaluate whether your review triggers any of these deferred items. If a trigger condition is met, promote to FIX NOW with evidence."

---

## Step 4: Invoke /run

Trigger the board review by following `/run` (`.claude/skills/run/SKILL.md`):
- Pass the detected mode (Quick/Standard)
- For Quick (T3/T4): single agent (Skeptic), 1 round
- For Standard (T1/T2/T5/T6): full board, 4-round SOP

---

## Step 5: Post-Review — Finding → Task Flow

After `/run` completes, convert findings to tasks.json entries:

**Only runs when `tasks.json` v2 exists with active phases.** Non-lifecycle reviews are unaffected.

| Finding Severity | Action |
|-----------------|--------|
| FIX NOW | New task in current phase: `status: "open"`, `type: "fix"`, `source: "board-review-T{N}"` |
| DEFER | New task: `status: "deferred"`, `trigger` from finding |
| INFO | Log to REVIEW-LOG.md only — no task created |

**Deduplication:** Before creating a task, check if a task with matching title AND phase already exists in `tasks.json`. If so, link the finding to the existing task (update `source`) instead of creating a duplicate.

---

## Step 6: Update Review Reference

After review completes, update the phase or task with a review reference:
- Phase: `review_ref: "review-{timestamp}"`
- This prevents the touchpoint detection table from re-triggering the same review
