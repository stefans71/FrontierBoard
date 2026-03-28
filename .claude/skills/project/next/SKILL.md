---
name: project-next
description: Advance tasks and phases in the lifecycle. Run when the user types /project next, finishes a task, or needs to transition phases.
---

# Project Next — Task & Phase Advancement

Move tasks through the state machine and handle phase transitions. References the canonical state machine in `/project` router.

---

## Step 1: Read State

Read `tasks.json` v2. Identify:
- Current active phase
- Tasks in current phase by status
- Whether all tasks are closed

---

## Step 2: Determine Action

### If no task is in-progress

Show open tasks in the current phase and ask:

> Which task do you want to work on?
>
> 1. APP-003 — API route handlers
> 2. APP-004 — Error handling middleware
> 3. APP-005 — Input validation

Set chosen task to `status: "in-progress"`. Update `meta.last_modified`.

### If a task is in-progress

Ask what happened:

> **APP-003: API route handlers**
> Status: in-progress
>
> What's the update?
> 1. **Done** — I'll collect verification and close it
> 2. **Defer** — park it with a trigger condition
> 3. **Still working** — just checking in

### Closing a task (Done)

Collect the verification fields defined in the `/project` router's canonical state machine:

- `tests_passed`, `test_command`, `test_output_summary`, `verified_at` — required always
- `spec_coverage` — required ONLY when `test_spec` is non-null

If the user can't provide test evidence, explain:

> Verification is required to close a task. The board checks these fields at Phase Exit (T5). What test command validates this work?

Set `status: "closed"` and populate `verification` object.

### Deferring a task

Require a trigger condition:

> What condition should promote this back to active?
> (e.g., "when user count exceeds 100", "when auth provider is chosen")

Set `status: "deferred"`, populate `trigger` field.

---

## Step 3: Phase Transition Check

After closing a task, check: **are all tasks in the active phase closed (or deferred)?**

If yes:

> All tasks in Phase {N} are complete. Ready for Phase Exit review?
>
> This triggers Touchpoint 5 (Phase Exit) — Standard mode, full board review.
> The board will review the git diff from phase start to now, plus all verification fields.
>
> Run `/project review` to proceed.

If no: show remaining tasks and suggest picking the next one.

---

## Step 4: Phase Advancement (after board sign-off)

After the board signs off at T5:

1. Set phase `status: "complete"`, `completed: "{today}"`
2. Create annotated git tag:
   - Convention: `lifecycle/phase-{N}-complete`
   - Check for existing tag: if exists, append `-v2`, `-v3`, etc. (incrementing loop)
   - Annotation: phase goal + completion date
3. Activate next phase: `status: "active"`, `started: "{today}"`
4. Update `meta.current_phase`
5. Regenerate `tasks.md` for new phase

> Phase {N} complete! Tagged `lifecycle/phase-{N}-complete`.
> Phase {N+1}: {name} is now active.
>
> Run `/project review` for Phase Plan review (T2), or `/project next` to start picking tasks.

---

## Step 5: Phase Rejection Recovery

If the board rejects at T5:

1. Phase stays `active` — no git tag
2. Read FIX NOW findings from the review
3. Create new tasks in the same phase for each FIX NOW finding:
   - `source: "board-review-T5"`
   - `status: "open"`
   - `type: "fix"`
4. Already-closed tasks stay closed unless specifically named in a finding
5. Show the user what was added

> Board rejected Phase Exit. {N} new tasks added from FIX NOW findings:
> - APP-010: {finding title}
> - APP-011: {finding title}
>
> Work through these, then `/project next` will re-trigger T5 when all tasks are closed.
