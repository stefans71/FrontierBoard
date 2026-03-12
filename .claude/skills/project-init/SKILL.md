---
name: project-init
description: Initialize the filing cabinet for a project — settings.json, CLAUDE.md, SPEC.md, and tasks.md. Run when the user types /project-init, or asks to set up a new project, initialize their Claude setup, scaffold a project structure, or get started with a codebase. Use this skill whenever someone wants to bootstrap Claude configuration for a project they're about to build or one that already exists.
---

# Project Init

Set up the filing cabinet for a project. This is a conversation, not a form. Get the project path, detect what's already there, confirm with the user, ask what you genuinely need to know, then write the files.

When something can be inferred — infer it, then confirm. Don't ask questions you can answer yourself.

---

## Step 1: Get the Project Path

First thing, before anything else:

> What's the path to the project you want to set up? (e.g. `~/projects/my-app`)
>
> If the directory doesn't exist yet, tell me where you want it and I'll create it.

Once you have the path, resolve it to an absolute path:

```bash
PROJ=$(eval echo [path])
echo "$PROJ"
```

If the directory doesn't exist, create it:

```bash
mkdir -p "$PROJ"
```

Note `$PROJ`. Every file operation in this skill targets this path. Never write to the current directory.

---

## Step 2: Detect Project State

Run these checks silently before saying anything else:

```bash
# Claude setup
ls "$PROJ/CLAUDE.md" 2>/dev/null
ls "$PROJ/.claude/settings.json" 2>/dev/null
ls "$PROJ/SPEC.md" 2>/dev/null
ls "$PROJ/tasks.md" 2>/dev/null

# Existing code
ls "$PROJ/package.json" "$PROJ/pyproject.toml" "$PROJ/Gemfile" "$PROJ/go.mod" "$PROJ/Cargo.toml" 2>/dev/null
ls "$PROJ/src/" "$PROJ/app/" "$PROJ/lib/" 2>/dev/null

# FrontierBoard guard — don't run project-init if this IS a FrontierBoard repo
ls "$PROJ/.claude/skills/setup/SKILL.md" "$PROJ/.claude/skills/run/SKILL.md" "$PROJ/.claude/skills/brief/SKILL.md" 2>/dev/null

# Git
ls "$PROJ/.git" 2>/dev/null

# Existing board
ls "$PROJ/.board/" 2>/dev/null
```

**FrontierBoard guard:** If all three board skills (setup, run, brief) exist at the project path, stop:

> That path looks like a FrontierBoard directory itself. `/project-init` sets up the filing cabinet for the project the board will *review* — not FrontierBoard's own directory.
>
> Point me at your actual project instead.

Otherwise, classify the project:

**State A — New project:** No CLAUDE.md, no code, no package manifests.

**State B — Existing project, no Claude setup:** Code or package manifests exist, but no CLAUDE.md and no `.claude/`.

**State C — Existing project, Claude setup present:** CLAUDE.md and/or `.claude/` already exist.

---

## Step 3: Confirm State with User

Tell the user what you found and what you're about to do:

**State A:**
> `[path]` looks empty — nothing there yet. I'm going to interview you, write a spec, and build the filing cabinet so Claude has what it needs from session one. Should take about 5 minutes.

**State B:**
> Found an existing [Node/Python/Ruby/Go] project at `[path]` but no Claude setup. I'll read what's here, confirm with you, and fill in the filing cabinet without touching your code. Sound right?

**State C:**
> Found some Claude configuration already at `[path]` — [CLAUDE.md / settings.json / both]. I'll audit what's here and add what's missing rather than overwriting anything. Want to proceed?

If the user corrects your read of the situation, update and continue.

---

## Step 4: Run the Appropriate Path

---

### Path A — New Project

#### A1: Stack Interview

Ask in one message — don't fire questions one at a time like a form:

> A few questions to get started:
>
> 1. What are you building? (One or two sentences is fine.)
> 2. What stack — language, framework, any key libraries you already know you want?
> 3. Will this connect to external services? (APIs, databases, auth providers, etc.)
> 4. Anything off-limits — files Claude shouldn't touch, commands it shouldn't run?
> 5. How do you want to run tests and lint? (Or should I pick sensible defaults for the stack?)

Listen carefully. Some answers will be multi-part.

#### A2: SPEC.md Interview

Go deeper. Keep asking until you understand the thing well enough to explain it to a developer who's never heard of it.

Good questions to work through (adapt based on what you've heard):

- Who are the users? What do they actually do in the product?
- What's the core loop — the thing someone does every time they open it?
- What does success look like in three months?
- What are the biggest unknowns or risks right now?
- Anything you've decided you won't build?
- Any existing systems this needs to integrate with or replace?

Minimum five exchanges before writing the spec. If answers are vague, push for specifics. If the user says "not sure yet," note it as an open question in the spec.

#### A3: Write the Files

Write all four files to `$PROJ/`. Do them in order. Show a summary when done.

**`$PROJ/.claude/settings.json`**

```bash
mkdir -p "$PROJ/.claude"
```

Base deny rules that always apply:

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force*)",
      "Read(**/.env)",
      "Read(**/.env.*)",
      "Read(**/secrets*)",
      "Read(**/credentials*)"
    ]
  },
  "hooks": {
    "PostToolUse": []
  }
}
```

Add stack-specific rules:
- **Node/npm:** Add `"Bash(npm publish*)"`. If prettier is in package.json, add a PostToolUse hook to run `prettier --write` on file writes.
- **Python:** Add `"Bash(pip install * --user)"` if using a venv.
- **Any database:** Add deny rules for drop/truncate commands.
- **Off-limits files named by user:** Add them to the deny list.

**`$PROJ/CLAUDE.md`**

Keep it under 150 lines. Project identity, not a knowledge dump.

```markdown
# [Project Name]

[One paragraph: what this is, who it's for, what it does.]

## Stack

[Language, framework, key libraries. One line each.]

## Commands

```bash
# Install
[install command]

# Dev server / run
[run command]

# Test
[test command]

# Lint / format
[lint command]
```

## Structure

[Top-level directories. What lives where. 5–8 lines max.]

## Style

[Key code style rules specific to this project. 3–5 rules max. Not generic advice.]

## Notes

[Anything important that doesn't fit above — intentional architectural decisions, things that look weird but aren't, known gotchas. If you're writing more than 5 points here, move it to a skill instead.]
```

**`$PROJ/SPEC.md`**

```markdown
# [Project Name] — Spec

_Last updated: [date]_

## What We're Building

[2–3 paragraphs. Clear enough that someone unfamiliar with the domain understands the problem and the solution.]

## Users

[Who they are. What they want. What frustrates them about alternatives.]

## Core Flows

[The 2–4 things users do most. Step by step. Behavioral level, not UI level.]

## Architecture

[How the pieces fit together. Key decisions and why. ASCII diagrams if helpful.]

## Data Model

[Key entities and relationships. Conceptual level, not full schema.]

## Integrations

[External systems, APIs, services. What data moves where.]

## Scope

### In scope for v1
[What's being built now.]

### Explicitly out of scope
[What's not being built, and why.]

## Open Questions

[Things not decided yet. Each with priority: [HIGH] [MED] [LOW]]

## Decisions Log

[Decisions already made and why. Append here as the project evolves.]
```

Fill every section. If something is genuinely unknown, write it as an open question.

**`$PROJ/tasks.md`**

Phase 1 should be the smallest thing that proves the core architecture works — not the full product.

```markdown
# Tasks

## Phase 1 — [Name: what this phase proves]

- [ ] [Task: specific, completable, one session]
- [ ] [Task]
- [ ] [Task]
...

_Phase 1 complete when: [clear exit criterion]_

---

## Phase 2 — [Placeholder]

_(Define when Phase 1 is complete.)_
```

Aim for 6–10 tasks. If a task would take more than a day, split it.

---

### Path B — Existing Project, No Claude Setup

#### B1: Read the Project

```bash
cat "$PROJ/package.json" 2>/dev/null | head -40
cat "$PROJ/pyproject.toml" 2>/dev/null | head -40
cat "$PROJ/README.md" 2>/dev/null | head -60
ls "$PROJ/src/" "$PROJ/app/" "$PROJ/lib/" 2>/dev/null
git -C "$PROJ" log --oneline -10 2>/dev/null
```

Build a picture of: what this project is, what stack, how mature.

#### B2: Confirm Findings

> Here's what I can see:
>
> - **Project:** [name]
> - **Stack:** [detected]
> - **Commands:** `[install]`, `[test]`, `[lint]` — I'll verify these before writing
> - **Structure:** [top-level dirs]
>
> What I couldn't determine: [gaps]
>
> Does this look right? Anything I've got wrong?

Ask only what you couldn't determine from the files.

#### B3: Write the Files

Same four files as Path A, but:
- `CLAUDE.md` is built from your scan + user confirmation
- `SPEC.md` is retrospective — "here's what I understand this project to be, correct me"
- For `tasks.md`: ask "What are you working on right now?" and make that the current phase

---

### Path C — Existing Claude Setup

#### C1: Audit What's Here

```bash
cat "$PROJ/CLAUDE.md"
wc -l "$PROJ/CLAUDE.md"
cat "$PROJ/.claude/settings.json" 2>/dev/null
cat "$PROJ/SPEC.md" 2>/dev/null
cat "$PROJ/tasks.md" 2>/dev/null
ls "$PROJ/.claude/skills/" 2>/dev/null
```

Check for:
- **CLAUDE.md line count:** Over 150 is a problem
- **settings.json:** Present? Has deny rules?
- **SPEC.md:** Present?
- **tasks.md:** Present?

#### C2: Report the Audit

> Here's what you've got:
>
> **CLAUDE.md** — [X lines / ✓ under 150 | ⚠️ over 150]
> **settings.json** — [✓ present with deny rules | ✗ missing | ⚠️ present but no deny rules]
> **SPEC.md** — [✓ present | ✗ missing]
> **tasks.md** — [✓ present | ✗ missing]
>
> **Recommended additions:** [only what's missing]

If CLAUDE.md is over 150 lines:

> Your CLAUDE.md is [X] lines — that's likely hurting recall. I can refactor it: move domain knowledge into skills, keep CLAUDE.md as a thin identity file. Want me to?

#### C3: Fill the Gaps

Only write files that are missing or broken. Never overwrite a file that exists without explicit confirmation.

If merging into settings.json: read it, add deny rules that aren't there, preserve everything else. Show a diff before writing.

If refactoring CLAUDE.md: show the proposed split before touching anything.

---

## Step 5: Ask About FrontierBoard

After all files are written:

> One last thing — do you want to add a Board of Governance to this project?
>
> The board runs parallel AI agents (skeptic, optimist, security reviewer, etc.) that independently review your work and give you a synthesis. It installs as a **neighboring directory in the same parent** — completely outside the project tree so the board's skills never collide with your project's skills.
>
> It's useful for architecture reviews, security checks before releases, or any decision you want a second opinion on.

If **yes:**

Derive the board path from the project path — neighboring directory in the same parent:

```bash
# Board lives next to the project, not inside it
PROJ_NAME=$(basename "$PROJ")
BOARD=$(dirname "$PROJ")/${PROJ_NAME}-board
echo "Board will install at: $BOARD"
```

Check if FrontierBoard is available:

```bash
ls ~/frontier-board/.claude/skills/setup/SKILL.md 2>/dev/null
ls ~/.claude/frontier-board/.claude/skills/setup/SKILL.md 2>/dev/null
```

If found, copy the board runtime into `$BOARD`:

```bash
mkdir -p "$BOARD/.claude/skills"
mkdir -p "$BOARD/board"

# Copy board identity and all runtime skills — including setup (needed to configure agents)
# Do NOT copy project-init (bootstrap tool, not runtime)
cp [fb-path]/CLAUDE.md "$BOARD/CLAUDE.md"
cp -r [fb-path]/.claude/skills/setup "$BOARD/.claude/skills/"
cp -r [fb-path]/.claude/skills/brief "$BOARD/.claude/skills/"
cp -r [fb-path]/.claude/skills/run "$BOARD/.claude/skills/"
cp -r [fb-path]/.claude/skills/new-agent "$BOARD/.claude/skills/"
ls [fb-path]/.claude/skills/add-isolation 2>/dev/null && cp -r [fb-path]/.claude/skills/add-isolation "$BOARD/.claude/skills/" || true
```

No settings.json fence needed — the board is outside the project tree entirely, so there is no tree-walk collision.

Update `$BOARD/CLAUDE.md` — prepend the project identity block before the existing FrontierBoard orchestrator content:

```markdown
# Board of Governance — [project name]

You are the orchestrator of a Board of Governance for [project name].

**Project path:** [absolute project path]

## Bridge

To request a review from the project session:

```bash
cd [absolute board path] && claude --dangerously-skip-permissions -p "read CLAUDE.md then /run"
```

Synthesis is written to `board/REVIEW-LOG.md`.

---

[rest of existing FrontierBoard CLAUDE.md content follows unchanged]
```

Tell the user:

> Board is at `[board path]/`. To configure your agents:
>
> ```
> cd [absolute board path]
> claude
> /setup
> ```
>
> Once set up, you can request a board review from your project session by writing a brief to `[board path]/board/inbox/[topic].md` and asking me to run the board. Agents run in parallel, synthesis comes back to `board/REVIEW-LOG.md`.

If FrontierBoard is not found:

> FrontierBoard isn't installed yet. Clone it from [repo URL], then point me to where it landed and I'll wire it in. Or run `/project-init` again once it's cloned.

If **no:** Skip entirely.

---

## Step 6: Close and Hand Off

> Done. Here's what I wrote to `[path]`:
>
> - `.claude/settings.json` — guardrails and hooks
> - `CLAUDE.md` — project identity (~[X] lines)
> - `SPEC.md` — architecture spec
> - `tasks.md` — Phase 1: [N] tasks
> [- `[project-name]-board/` — board wired in at neighboring path]
>
> **Do these steps in order:**
>
> **1. Commit the files:**
> ```
> cd [path]
> git add .claude/settings.json SPEC.md tasks.md LEARNING.md
> git commit -m "chore: add filing cabinet and project scaffold"
> git push
> ```
>
> [If board was wired:]
> **2. Configure your board agents** (separate terminal session):
> ```
> cd [absolute .board path]
> claude
> /setup
> ```
>
> **3. Start building** — open a fresh Claude session from `[path]`:
> ```
> cd [path]
> claude
> ```
> This session loads only the filing cabinet. The current session has interview context that will pollute the context window — don't build from here.
>
> Phase 1 complete when: [repeat exit criterion from tasks.md]

Done. Don't ask if they have questions. Don't offer to keep talking.

---

## Notes on Writing Quality

**settings.json:** More deny rules is better than fewer. Easy to remove a rule; painful to recover from a missing one.

**CLAUDE.md:** If you're tempted to add a sixth rule, a fourth directory entry, or a second paragraph in any section — stop. Put it somewhere else or cut it.

**SPEC.md:** Open questions are not a dumping ground. Every item needs a priority. More than five open questions means the interview wasn't thorough enough — go back and ask.

**tasks.md:** Tasks should complete in one focused session. "Build auth" is not a task. "Wire Supabase auth, protect /dashboard route, add login page with email/password" is a task.
