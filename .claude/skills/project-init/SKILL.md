---
name: project-init
description: Initialize the filing cabinet for a project — settings.json, CLAUDE.md, SPEC.md, and tasks.md. Run when the user types /project-init, or asks to set up a new project, initialize their Claude setup, scaffold a project structure, or get started with a codebase. Use this skill whenever someone wants to bootstrap Claude configuration for a project they're about to build or one that already exists.
---

# Project Init

Set up the filing cabinet for a project. This is a conversation, not a form. Get the project path, detect what's there, confirm with the user, ask what you genuinely need to know, then write the files.

When something can be inferred — infer it, then confirm. Don't ask questions you can answer yourself.

---

## Step 1: Get the Project Path

> What's the path to the project you want to set up? (e.g. `~/projects/my-app`)
>
> If the directory doesn't exist yet, tell me where you want it and I'll create it.

Resolve to absolute path. Create with `mkdir -p` if it doesn't exist. Note as `$PROJ` — every file operation targets this path.

---

## Step 2: Detect Project State

Silently check for: CLAUDE.md, `.claude/settings.json`, SPEC.md, tasks.md, package manifests (package.json, pyproject.toml, etc.), source directories, git, `.board/`.

**FrontierBoard guard:** If board skills (setup, run, brief) exist at the path, stop — this is a FrontierBoard directory, not a project. Tell the user to point at their actual project instead.

Classify:
- **State A** — New project: no CLAUDE.md, no code
- **State B** — Existing project, no Claude setup: code exists, no CLAUDE.md
- **State C** — Existing Claude setup: CLAUDE.md and/or `.claude/` present

---

## Step 3: Confirm State

Tell the user what you found and what you'll do:

**A:** > `[path]` looks empty. I'll interview you, write a spec, and build the filing cabinet. ~5 minutes.

**B:** > Found a [stack] project at `[path]` but no Claude setup. I'll read what's here, confirm with you, and fill in the filing cabinet without touching your code.

**C:** > Found Claude configuration at `[path]`. I'll audit what's here and add what's missing rather than overwriting.

---

## Step 4: Run the Appropriate Path

### Path A — New Project

**A1: Stack Interview** — Ask in one message, not one at a time:
1. What are you building?
2. What stack — language, framework, key libraries?
3. External services? (APIs, databases, auth providers)
4. Anything off-limits for Claude?
5. How do you want tests and lint? (Or should I pick defaults?)

**A2: SPEC.md Interview** — Go deeper. Keep asking until you can explain the project to a developer who's never heard of it. Cover: users, core loop, success criteria, biggest risks, explicit non-goals, integrations. Minimum five exchanges before writing.

**A3: Write the Files** — Write all four to `$PROJ/`:

- **`.claude/settings.json`** — Base deny rules: `rm -rf *`, `git push --force*`, `.env` reads, secrets/credentials reads. Add stack-specific rules (npm publish, pip install --user, DB drop/truncate, user's off-limits files). Add PostToolUse hooks if appropriate (e.g. prettier on file writes).

- **`CLAUDE.md`** — Under 150 lines. Project identity: what it is, stack, commands (install/dev/test/lint), structure (5–8 lines), style rules (3–5 project-specific), notes (intentional decisions, gotchas).

- **`SPEC.md`** — What we're building, users, core flows, architecture, data model, integrations, in-scope v1, explicitly out of scope, open questions (with priority), decisions log. Fill every section.

- **`tasks.md`** — Phase 1 should prove the core architecture works, not build the full product. 6–10 tasks, each completable in one session. Clear exit criterion.

### Path B — Existing Project, No Claude Setup

**B1:** Read package manifests, README, source dirs, recent git log. Build a picture of the project.

**B2:** Confirm findings with user — project name, stack, commands, structure. Ask only what you couldn't determine from files.

**B3:** Write the same four files, but CLAUDE.md is built from your scan + user confirmation, SPEC.md is retrospective ("here's what I understand — correct me"), tasks.md starts with "What are you working on right now?"

### Path C — Existing Claude Setup

**C1:** Read all existing files. Check CLAUDE.md line count, settings.json deny rules, SPEC.md presence, tasks.md presence.

**C2:** Report the audit:
> **CLAUDE.md** — [X lines / under/over 150]
> **settings.json** — [present with deny rules / missing / present but no deny rules]
> **SPEC.md** — [present / missing]
> **tasks.md** — [present / missing]

If CLAUDE.md is over 150 lines, offer to refactor: move domain knowledge into skills, keep CLAUDE.md as thin identity.

**C3:** Only write files that are missing or broken. Never overwrite without explicit confirmation. Show diffs before writing.

---

## Step 5: Ask About FrontierBoard

> One last thing — do you want to add a Board of Governance to this project?
>
> The board runs parallel AI agents that independently review your work and give you a synthesis. It installs as a **neighboring directory in the same parent** — completely outside the project tree so agent settings never collide with yours.

If **yes:** Derive board path from project path (e.g. `~/myapp` → `~/myapp-board`). Look for an existing FrontierBoard clone. If found, copy board runtime (CLAUDE.md, skills: setup/brief/run/new-agent) into the board path. Update `$BOARD/CLAUDE.md` with project identity and bridge command. Tell the user how to configure agents (`cd [board-path] && claude` then `/setup`).

If FrontierBoard not found, tell the user to clone it first.

If **no:** Skip entirely.

---

## Step 6: Close and Hand Off

> Done. Here's what I wrote to `[path]`:
> - `.claude/settings.json` — guardrails and hooks
> - `CLAUDE.md` — project identity (~[X] lines)
> - `SPEC.md` — architecture spec
> - `tasks.md` — Phase 1: [N] tasks
> [- `[project-name]-board/` — board wired in]
>
> Start building in a fresh Claude session from `[path]` — this session has interview context that will pollute the context window.

---

## Notes on Writing Quality

**settings.json:** More deny rules is better. Easy to remove; painful to recover from missing one.

**CLAUDE.md:** If tempted to add a sixth rule, fourth directory, or second paragraph — stop. Put it elsewhere or cut it.

**SPEC.md:** Open questions need priorities. More than five means the interview wasn't thorough enough — go back and ask.

**tasks.md:** Tasks complete in one session. "Build auth" is not a task. "Wire Supabase auth, protect /dashboard, add login page" is.
