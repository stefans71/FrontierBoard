---
name: teardown
description: Remove a FrontierBoard installation. Run when the user types /teardown or asks to uninstall, remove, or clean up the board.
---

# Board of Governance — Teardown

Remove a FrontierBoard installation cleanly. Confirm before each destructive action.

---

## Step 1: Detect What Exists

Read `.board/board/BOARD.md` to understand the installation:
- Board path and project path
- Board user (if created)
- Integration mode (fb-project-bridge, claude-project, standalone, global)
- Agent list

If no BOARD.md found, check if `.board/` exists at all. If nothing exists, tell the user there's nothing to tear down.

---

## Step 2: Determine Scope (Global Mode)

**If this is a global install** (`$BOARD` under `~/.frontierboard/`):

> This is a global install with shared agents. What do you want to remove?
>
> 1. **This project only** — remove per-project state at `.board/projects/{project-name}/` but keep shared agents and other projects intact
> 2. **Entire global install** — remove everything: all agents, all projects, the global skill

If "this project only": delete `.board/projects/{project-name}/` and any project-specific integration skill. Skip Steps 3-5 (shared agents stay). Go to Step 6.

If "entire install": continue with full teardown below.

**If not global:** continue normally.

---

## Step 3: Show What Will Be Removed

List everything that was created during setup:

> I'll remove the following. Confirm each group:
>
> **Board files:** `.board/` directory (agents, reports, review log, briefs)
> **Integration skill:** `$PROJ/.claude/skills/board-review/SKILL.md` (if exists)
> **Director skill:** `$PROJ/.claude/skills/director/SKILL.md` (if exists)
> **Global skill:** `~/.claude/skills/frontierboard/SKILL.md` (if global install)
> **Board user:** `$BOARD_USER` system account + sudoers entry (if created)
> **Gitignore entries:** FrontierBoard lines in `.gitignore`

---

## Step 4: Remove Board Files

After user confirms:

1. Delete `.board/` directory entirely
2. If integration skill exists at `$PROJ/.claude/skills/board-review/SKILL.md` or `$PROJ/.claude/skills/frontierboard-review/SKILL.md`, delete it
3. If global install, delete `~/.claude/skills/frontierboard/SKILL.md`
4. If director skill exists at `$PROJ/.claude/skills/director/SKILL.md`, delete it

---

## Step 5: Remove Board User (if exists)

Only if a board user was created during setup:

> A system user `$BOARD_USER` was created for agent isolation. Remove it?
> This will delete the user account and its sudoers entry. Home directory is NOT deleted.

If confirmed:
1. Remove sudoers file: `rm /etc/sudoers.d/$BOARD_USER`
2. Validate sudoers: `visudo -c` (safety check)
3. Remove user: `userdel $BOARD_USER` (without `-r` — leave home dir intact in case it has other data)

---

## Step 6: Clean Gitignore

Remove FrontierBoard entries from `$BOARD/.gitignore`. Only remove lines that match known FrontierBoard patterns (`.board/`, `board/*/inbox/`, etc.). Leave all other entries intact.

---

## Step 7: Lifecycle Cleanup

If lifecycle artifacts exist, offer to remove them:

- `.claude/hooks/verify-lifecycle.cjs` — lifecycle validator hook
- `.githooks/pre-commit` — git hook calling validator
- `docs/test-specs/` — Skeptic-generated test specifications
- `tasks.json` v2 phase/verification fields (revert to v1 if desired)
- `.claude/skills/project/` — lifecycle sub-skills (only if removing FrontierBoard entirely)

> Found lifecycle artifacts. Remove them too? (The tasks.json task data will be preserved — only lifecycle fields are stripped.)

Only remove if confirmed. The hook and test-specs are safe to delete; tasks.json should be downgraded rather than deleted.

---

## Step 8: Done

> FrontierBoard has been removed. The FrontierBoard repo clone at `$BOARD` still exists — delete it manually if you no longer need it.
>
> Your project at `$PROJ` was not modified (except the integration skill removal above).
