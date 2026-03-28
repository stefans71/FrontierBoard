---
name: project-init
description: Initialize a project with filing cabinet + lifecycle. Run when the user types /project init. Subsumes the old /project-init skill.
---

# Project Init — Filing Cabinet + Lifecycle

Single entry point for project initialization. Sets up the filing cabinet (settings, CLAUDE.md, SPEC.md) AND the lifecycle harness (tasks.json v2 with phases).

---

## Step 1: Detect State

Read the target project path. Check for existing files:

| Found | State | Action |
|-------|-------|--------|
| Nothing | Fresh | Full init: filing cabinet + lifecycle |
| `settings.json` / `CLAUDE.md` but no tasks.json v2 | Partial | Add lifecycle on top of existing setup |
| tasks.json exists but no `meta.version` field | Legacy v1 | Treat as v1 — offer migration (add phases, bump version, preserve tasks) |
| tasks.json v1 (`meta.version: 1`) | Migration | Offer upgrade: add phases, bump version, preserve existing tasks |
| tasks.json v2 (`meta.version: 2`) | Already initialized | Offer reset or continue from current state |

**FrontierBoard guard:** If board skills (setup, run, brief) exist at the path, stop — this is a FrontierBoard directory, not a project.

---

## Step 2: Filing Cabinet (fresh or partial)

If no Claude setup exists, run the filing cabinet interview:

**A: Stack Interview** — ask in one message:
1. What are you building?
2. What stack — language, framework, key libraries?
3. External services? (APIs, databases, auth providers)
4. Anything off-limits for Claude?
5. How do you want tests and lint?

**B: SPEC.md Interview** — go deeper. Keep asking until you can explain the project to a developer who's never heard of it. Cover: users, core loop, success criteria, biggest risks, non-goals, integrations. Minimum five exchanges.

**C: Write files:**
- **`.claude/settings.json`** — deny rules (rm -rf, force push, .env, secrets) + stack-specific rules. Add PostToolUse hook for `verify-lifecycle.cjs` on tasks.json writes.
- **`CLAUDE.md`** — under 150 lines. Project identity, stack, commands, structure, style rules, notes.
- **`SPEC.md`** — what, who, core flows, architecture, data model, integrations, v1 scope, out of scope, open questions.

If files already exist (State B/C), only write what's missing. Never overwrite without confirmation. Show diffs.

---

## Step 3: PRD Interview (Lifecycle)

Adaptive interview — no fixed exchange count. Cover:
1. What are the major phases of this project?
2. What does "done" look like for each phase?
3. What are the verification criteria — how do we prove each thing works?
4. What's the riskiest phase?
5. Are there external dependencies or blockers?

If `SPEC.md` already exists, read it first and pre-populate answers.

---

## Step 4: Generate tasks.json v2

Write `tasks.json` with v2 schema:

```json
{
  "meta": {
    "version": 2,
    "project": "{project-name}",
    "current_phase": 0,
    "created": "{today}",
    "last_modified": "{today}",
    "ship_rejections": 0
  },
  "phases": [
    {
      "id": 0,
      "name": "Pre-flight",
      "goal": "Requirements, architecture, board approval",
      "status": "active",
      "started": "{today}",
      "completed": null,
      "git_tag": null,
      "review_ref": null,
      "review_mode": "standard"
    }
  ],
  "tasks": []
}
```

Generate 4–8 tasks per phase. Each task has:
- `id`: `{PREFIX}-{NNN}` (derive prefix from project name)
- `type`: task | bug | debt | fix
- `phase`: phase ID
- `title`, `description`, `done_when`, `test_criteria`
- `status`: "open"
- `verification`: null (filled when task is closed)
- `test_spec`: null (filled by `/project tests`)
- `source`: "project-init"

**Migration (v1 → v2):** If tasks.json v1 exists:
1. Read existing tasks array
2. Add `meta` block with `version: 2`
3. Add `phases` array (generate from interview or infer from tasks)
4. Add lifecycle fields to existing tasks (`phase`, `verification`, `test_spec`, `test_criteria`, `done_when`)
5. Preserve all existing task data

---

## Step 5: Generate tasks.md

Filtered view of current phase tasks. Generated from tasks.json — not hand-edited.

---

## Step 6: Touchpoint 1 — Roadmap Review

> The filing cabinet and lifecycle are ready. Before we start building, the board should review the roadmap.
>
> Run `/project review` to trigger Touchpoint 1 (Roadmap Review) — Standard mode, full 4-round SOP.

---

## Step 7: Post-Review

After board signs off on the roadmap:
1. Set phase 0 `status: "complete"`, `completed: "{today}"`, `git_tag: "lifecycle/phase-0-complete"`
2. Set phase 1 `status: "active"`, `started: "{today}"`
3. Update `meta.current_phase: 1`
4. Create annotated git tag: `lifecycle/phase-0-complete`
5. Regenerate `tasks.md` for phase 1

> Phase 0 (Pre-flight) complete. Phase 1 is active.
> Run `/project status` to see your tasks, or `/project next` to pick one.

---

## Install Hook

Add the lifecycle validator hook to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "node .claude/hooks/verify-lifecycle.cjs \"$FILEPATH\""
      }
    ]
  }
}
```

Only fires when `$FILEPATH` matches `tasks.json`. The hook is advisory — real enforcement is the board at T5 and T6.

Append to the existing `hooks.PostToolUse` array if one exists. Do not replace other hooks.

### Configure Git Hooks Path

Run `git config --local core.hooksPath .githooks` in the project directory so the pre-commit hook activates. This enables the advisory validation on `tasks.json` commits.
