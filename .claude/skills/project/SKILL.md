---
name: project
description: Project lifecycle router. Run when the user types /project or any /project subcommand. Routes to sub-skills and defines the canonical state machine.
---

# Project Lifecycle — Router

Route `/project` subcommands and define the canonical state machine that all sub-skills follow.

---

## Routing

| Command | Action |
|---------|--------|
| `/project` (bare) | Show available commands + current lifecycle state |
| `/project init` | `.claude/skills/project/init/SKILL.md` |
| `/project status` | `.claude/skills/project/status/SKILL.md` |
| `/project next` | `.claude/skills/project/next/SKILL.md` |
| `/project review` | `.claude/skills/project/review/SKILL.md` |
| `/project tests` | `.claude/skills/project/tests/SKILL.md` |
| `/project ship` | `.claude/skills/project/ship/SKILL.md` |

**Bare `/project`:** Read `tasks.json`. If no v2 schema → suggest `/project init`. If v2 exists → show current phase, open tasks, and suggest next action.

---

## State Machine (canonical — all skills import from here)

### Phase States

```
planned  → active     (previous phase complete + board approves plan via T2)
active   → complete   (all tasks closed + board approves exit via T5)
active   → blocked    (board rejects exit OR blocker identified)
blocked  → active     (blocker resolved, user confirms)
```

### Task States

```
open        → in-progress  (user picks task via /project next)
in-progress → closed       (verification fields filled: tests_passed, test_command, verified_at)
in-progress → deferred     (trigger condition required)
open        → deferred     (trigger condition required)
closed      → open         (board FIX NOW finding reopens — verification cleared)
```

### Verification Requirements for Closing a Task

- `verification.tests_passed` — required always
- `verification.test_command` — required always
- `verification.test_output_summary` — required always
- `verification.verified_at` — required always
- `verification.spec_coverage` — required ONLY when `test_spec` is non-null

---

## Touchpoint Detection Table

Used by `/project review` to determine which board touchpoint to trigger.

| Condition | Touchpoint | Mode |
|-----------|-----------|------|
| `phases` exist, no phase has `status: complete`, no `review_ref` on phase 0 | T1: Roadmap Review | Standard |
| Phase N just became `active`, has no `review_ref` | T2: Phase Plan | Quick (Standard if arch/auth/security) |
| User runs `/project tests` | T3: Test Specs | Quick, Skeptic only |
| User runs `/project tests --verify` | T4: Test Code Review | Quick, Skeptic only |
| All tasks in active phase are `closed` with verification | T5: Phase Exit | Standard |
| All phases `complete` | T6: Ship | Standard, mandatory |
| `meta.shipped: true` exists | T7: Post-Ship | Quick or Standard |
| Ambiguous / user override | **ALWAYS ask user** | — |

**Rule:** When auto-detection is ambiguous, ALWAYS ask the user. Never silently pick the wrong touchpoint.

---

## Phase Rejection Recovery

When board rejects at T5 (Phase Exit):
1. Phase stays `active` — NO git tag until board signs off
2. FIX NOW findings become new tasks in same phase (`status: "open"`)
3. Already-closed tasks stay closed UNLESS specifically named in a finding
4. `/project next` re-triggers T5 when all tasks (including new ones) are closed
