---
name: project-ship
description: Final ship review and maintenance transition. Run when the user types /project ship or all phases are complete.
---

# Project Ship — Final Review & Maintenance Transition

Touchpoint 6 (mandatory) + transition to maintenance mode.

---

## Step 1: Pre-Ship Validation

Read `tasks.json` v2. Verify ALL of:

- [ ] All phases have `status: "complete"`
- [ ] No tasks with `status: "open"` or `status: "in-progress"`
- [ ] All closed tasks have complete `verification` fields
- [ ] No deferred tasks with triggered conditions (check trigger fields against current state)

If any fail:

> Can't ship yet:
> - Phase 2 still has 2 open tasks
> - APP-007 is closed but missing `test_command`
> - APP-006 (deferred) trigger "when user count exceeds 100" may be met — check and resolve
>
> Run `/project status` to see the full picture.

---

## Step 2: Touchpoint 6 — Ship Review (Mandatory)

This is a mandatory Standard review — no Quick mode, no skip.

Trigger `/project review` which will:
1. Detect T6 (all phases complete)
2. Compose brief with full project diff + all verification
3. Write inboxes and invoke `/run` in Standard mode
4. Full 4-round SOP

**The board must sign off before shipping.** If any agent blocks:

> Board is blocking ship on: {concern}
>
> This cannot be overridden — ship requires full sign-off.
> Fix the concern and run `/project ship` again.

---

## Step 3: Ship It

After board signs off:

1. Create annotated git tag: `lifecycle/ship-v{version}`
   - Version: derive from `meta` or ask user (e.g., "1.0.0")
   - Check for existing tag; if exists, increment suffix
   - Annotation: "Ship v{version} — board approved {date}"

2. Update `tasks.json`:
   - Set `meta.shipped: true`
   - Set `meta.shipped_at: "{today}"`
   - Set `meta.ship_tag: "lifecycle/ship-v{version}"`

3. Update `CLAUDE.md` to maintenance template:
   - Add maintenance mode header
   - Note: this project is shipped, changes go through Post-Ship review (T7)
   - Preserve project identity and commands

> Shipped! Tagged `lifecycle/ship-v{version}`.
>
> The project is now in maintenance mode. Future changes will trigger Post-Ship review (T7) via `/project review`.

---

## Circuit Breakers

These conditions halt the ship process:

- **2 consecutive ship rejections** → halt, require human re-scope
- **>5 deferred items** → force Standard review of deferred items before ship
- **Stale phases (>30 days active with no completions)** → warn and require acknowledgment
