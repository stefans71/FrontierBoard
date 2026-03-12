---
name: setup
description: Set up the Board of Governance. Run when the user types /setup or asks to set up, install, or configure the board for the first time.
---

# Board of Governance — Setup

Walk the user through setting up their board. This is a conversation — ask questions, listen, do the work. Only pause when you genuinely need the user to act (paste a key, scan a QR code, open a browser). When something is broken, fix it yourself.

**Output formatting:** Use markdown headings for each step (`## Step 3: Autonomous Mode`) and per-agent (`### Agent 1`).

---

## Paths

- **`$BOARD`** — the FrontierBoard clone directory. All board files go here: `.board/`, agents, reports. The board NEVER writes `.board/` inside the user's project.
- **`$PROJ`** — the user's project. Read-only, except: you may append to `$PROJ/.gitignore` and create new files in `$PROJ/.claude/skills/`.

---

## Hard-Won Knowledge

These are operational facts Claude cannot derive from general training. Never remove them.

1. **`unset CLAUDECODE`** — All invocation commands for Claude Code agents must unset the `CLAUDECODE` env var. Without it, nested Claude sessions fail with "Cannot be launched inside another Claude Code session." Wrap in `bash -c 'unset CLAUDECODE && ...'`.

2. **`codex exec` not `codex`** — The bare `codex` command opens a TUI requiring an interactive terminal. It will silently fail as a subprocess. Always use `codex exec` for non-interactive invocation.

3. **Root always needs a board user** — Even in interactive mode, `--dangerously-skip-permissions` is blocked when running as root. If current user is root, ALWAYS create a board user regardless of mode choice.

4. **Sudoers validation** — Always validate with `visudo -c -f <file>` after writing. A bad sudoers file can brick sudo. Use `chmod 0440`. Remove the file if validation fails.

5. **Board user ownership** — After creating all agent directories, `chown -R $BOARD_USER:$BOARD_USER $BOARD/.board/`. Also ensure the board user can traverse parent directories.

6. **Billing warnings are mandatory** — Always warn users about pay-per-use billing (OpenAI API, Anthropic API) before accepting keys. Recommend spend limits. Claude Pro/Max subscriptions have no extra charges — mention this.

---

## Step 1: Welcome and Detect

> Welcome to Board of Governance setup. I'll set up a board of independent AI reviewers for your project. I'll only pause when I genuinely need something from you.
>
> What's the path to the project this board will review?

Set `$PROJ` (project path) and `$BOARD` (FrontierBoard clone — current directory or clone path).

Silently detect integration mode by checking `$PROJ`:
- **nanoclaw** — has `src/index.ts` + `container/build.sh` + `groups/`
- **claude-project** — has `.claude/` but not NanoClaw
- **standalone** — no AI tooling found

Scan the project: read README, CLAUDE.md, SPEC.md, package manifests. Build a mental model of the stack for use in Step 5 (agent contexts).

---

## Step 2: Autonomous Mode

> Do you want agents to run unattended in the background, or pause and ask before each action?

If **not root**: note the choice and move on.

If **root** (see Hard-Won Knowledge #3): explain that AI tools block autonomous mode for root, and a separate user account is needed. Ask for a name (default: `llmuser`).

Create the board user: idempotent useradd, sudoers entry with visudo validation (see Hard-Won Knowledge #4). Do this yourself — don't ask the user to run commands.

---

## Step 3: Review Domain

> What will your board primarily review?
> 1. Software  2. Business  3. HR/Hiring  4. Finance  5. Mix of everything

If "mix" — explain that agents have stable thinking styles and you'll load domain-specific context automatically per review.

---

## Step 4: Compose the Board

Explain the concept briefly:

> Each board member is an AI agent with a **thinking style** — how they approach any question. That stays stable. I load domain context per review. Think about *how* you want things questioned, not what domain.
>
> How many agents? Two minimum, three gives a tiebreaker, more than four gets noisy.

For each agent, ask:
1. **Thinking style** — offer domain-relevant suggestions (skeptic, systems thinker, pragmatist, contrarian, or custom)
2. **CLI** — Claude Code, Codex, or Qwen. If unsure, suggest Claude Code (no extra charges with Pro/Max subscription). Mention Qwen has a free tier. Warn that Codex uses pay-per-use API billing.

---

## Step 5: CLI Setup

For each unique CLI across all agents, check if installed and authenticated. Report findings, then fix what's missing.

**Auth guidance per CLI:**
- **Claude Code**: Subscription (browser login) or API key (console.anthropic.com). Recommend subscription path.
- **Codex**: Clarify ChatGPT subscription ≠ API access. API is separate pay-per-use at platform.openai.com. Strongly recommend spend limits.
- **Qwen**: DashScope API key from bailian.console.aliyun.com. Has a free tier (Bailian Coding Plan).

Explain once: credentials are global (one login per machine), settings are per-agent.

If a board user was created, copy credential files from current user's home to board user's home.

---

## Step 6: Build the Agents

For each agent, create their directory at `$BOARD/.board/board/{agent-name}/` with:
- `inbox/`, `outbox/`, `learnings/`, `contexts/`
- Settings bubble for their CLI (Claude: `.claude/settings.json` allowing all tools + model. Codex: `.codex/config.toml` with approval=never + project doc pointing to CLAUDE.md. Qwen: `.qwen/settings.json` with yolo mode.)
- `CLAUDE.md` — agent identity. Domain-agnostic thinking style, NOT domain knowledge. Cover: who they are, how they think, what they're reviewing (one sentence naming the project), output format (structured findings with severity/location/finding/scenario/recommendation), rules (blind review, write report first, load context from inbox).

**Context files** go in `contexts/{domain}.md`. This is where ALL domain-specific knowledge lives — architecture, tech stack, key files, threat models. Tailor to each agent's thinking style. Write one context per domain chosen in Step 3, or three (software, business, general) if they chose "mix."

---

## Step 6b: Fix Ownership

If a board user exists, chown all of `.board/` to that user and ensure parent directory traversal (see Hard-Won Knowledge #5).

---

## Step 7: Board Identity and Integration

### Board orchestrator CLAUDE.md

Write `$BOARD/.board/CLAUDE.md` — the orchestrator identity. Include: project name/path/stack, agent table (name, dir, CLI, style), how reviews work (detect domain → copy context → write brief → run agents → synthesise → write to REVIEW-LOG.md), available commands (/new-agent, /brief, /run).

### BOARD.md

Write `$BOARD/.board/board/BOARD.md` — operational source of truth. Include: project path, autonomous mode, board user, per-agent invocation commands, parallelism pattern (run all agents in parallel, wait for all).

**All Claude Code invocation commands MUST include `unset CLAUDECODE`** (see Hard-Won Knowledge #1). **All Codex invocations MUST use `codex exec`** (see Hard-Won Knowledge #2).

### Integration bridge

**nanoclaw:** Create `$BOARD/.board/bridge/run-review.sh` (executable) that accepts a brief, writes to board inbox, switches to board user if root, runs the orchestrator. Create a NanoClaw skill at `$PROJ/.claude/skills/board-review/SKILL.md` that tells NanoClaw Claude how to invoke the bridge with timing estimates and a polling pattern. Add bridge section to BOARD.md.

**claude-project:** Create a skill at `$PROJ/.claude/skills/board-review/SKILL.md` (or `frontierboard-review` if name is taken) that triggers the board from any Claude session. Include timing estimates, background launch with nohup, polling, and cleanup. Check for existing skill — if it's a previous FrontierBoard install, offer to update; if unrelated, use alternate name. Add integration section to BOARD.md. Tell the user what was created and how to use it.

**standalone:** Add a "Running a Review" section to BOARD.md with the direct command.

---

## Step 8: Update .gitignore

Append FrontierBoard entries to `$BOARD/.gitignore` (NOT `$PROJ/.gitignore`). Append-only — never modify existing lines. Gitignore: agent working directories (contexts, inbox, outbox, learnings), BOARD.md, REVIEW-LOG.md, DEFERRED_WORK.md, CONSOLIDATION.md, bridge/.

---

## Step 9: Smoke Test

Write a minimal brief asking each agent to confirm their identity and write to their outbox. Run each agent from their directory. Confirm every agent produced a report before declaring success. If any fail, diagnose and fix.

---

## Step 10: Contribute Back (Optional)

If you discovered workarounds or fixes during setup that aren't in upstream, ask the user if they want to send a PR to `stefans71/FrontierBoard`. Show what changed in plain language. Only submit after explicit confirmation. Skip entirely if nothing was discovered.

---

## Step 11: Done

Name each agent, their CLI, and role. Show `$PROJ` and `$BOARD/.board/` paths. Give concrete next steps matching the integration mode:

- **nanoclaw**: "Message NanoClaw: 'Review the auth code I just wrote.'" — it happens in the background.
- **claude-project**: "Type `/board-review` or describe what to review."
- **standalone**: "`cd $BOARD/.board && claude` then describe what to review or `/brief` then `/run`."

> What would you like the board to look at first?
