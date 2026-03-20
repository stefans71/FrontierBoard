# FrontierBoard — Install Instructions

**For Claude.** When a user gives you this URL or asks you to set up FrontierBoard:
- Do NOT explore the repo via GitHub API
- Do NOT fetch files with `gh api` or `base64 -d`
- Do NOT spawn agents to read skill files
- Just follow the four steps below, in order

## 1. Ask what they need (do this FIRST — before any other action)

Say exactly this:

> Are you using FrontierBoard with a new project or an existing one?
>
> 1. **New project** — I'll create the project folder and set everything up
> 2. **Existing project** — tell me the path and I'll add a review board
> 3. **Just review a GitHub repo** — no project needed
> 4. **Global install** — install once, review any project from anywhere

**Wait for their answer. Do not clone, fetch, or explore anything until they respond.**

## 2. Clone FrontierBoard (one command)

Clone as a neighboring directory in the same parent — never inside the project. AI CLIs walk up the
directory tree for settings files, so FrontierBoard must be a neighbor, not a child,
to keep agent settings isolated.

New project (e.g. user said "myapp" at `~/`):
```bash
mkdir -p ~/myapp
git clone https://github.com/stefans71/FrontierBoard ~/myapp-board/FrontierBoard
```

Existing project (e.g. at `~/myapp`):
```bash
git clone https://github.com/stefans71/FrontierBoard ~/myapp-board/FrontierBoard
```

Just reviewing (no project):
```bash
git clone https://github.com/stefans71/FrontierBoard /tmp/fb-review/FrontierBoard
```

Global install:
```bash
git clone https://github.com/stefans71/FrontierBoard ~/.frontierboard/FrontierBoard
```

## 3. Read the local skill file and follow it

Read from the clone you just created (not from GitHub):

- **New project** → read `[clone-path]/CLAUDE.md`, then follow `[clone-path]/.claude/skills/project-init/SKILL.md`
- **Existing project** → read `[clone-path]/CLAUDE.md`, then follow `[clone-path]/.claude/skills/setup/SKILL.md`
- **Review a repo** → read `[clone-path]/CLAUDE.md`, then follow `[clone-path]/.claude/skills/setup/SKILL.md` first (agents need to exist before reviewing). Once setup completes, follow `[clone-path]/.claude/skills/review-release/SKILL.md`
- **Global install** → read `[clone-path]/CLAUDE.md`, then follow `[clone-path]/.claude/skills/setup/SKILL.md` — setup detects global mode automatically and asks which project to review first

**IMPORTANT — working directory:** The skill files assume the FrontierBoard clone directory
is the working directory. When the skill references `$PROJ` or creates `.board/`, that means
the clone path (e.g. `~/myapp-board/FrontierBoard/`), NOT the user's project directory.
All board files — agents, contexts, briefs, reports — go inside the clone directory.
The user's project directory is never written to by the board.

## 4. Hand off

When done, tell the user:

> Your board is ready at `[board-path]`.
> To start a session: `cd [board-path] && claude`

For global installs, also install a global skill so the user can type `/frontierboard` from any project:

Create `~/.claude/skills/frontierboard/SKILL.md` that shells out to the global FrontierBoard install, passing the current working directory as the project path. This lets the user trigger board reviews from any Claude session without switching directories.
