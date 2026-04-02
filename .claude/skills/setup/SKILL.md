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

### Global install mode

If `$BOARD` is under `~/.frontierboard/`, this is a global install. In global mode:
- Agents are built once and shared across all projects
- Per-project state lives in `$BOARD/.board/projects/{project-name}/` (briefs, contexts, reports, BOARD.md)
- Agent directories stay at `$BOARD/.board/board/{agent-name}/` (shared)
- Each project gets its own orchestrator CLAUDE.md at `$BOARD/.board/projects/{project-name}/CLAUDE.md`
- A global skill is installed at `~/.claude/skills/frontierboard/SKILL.md` so the user can type `/frontierboard` from any project session

**C1: Use absolute paths everywhere.** `~` resolves differently per user (`/root` vs `/home/llmuser`). All BOARD.md, CLAUDE.md, skill files, and invocation commands must use absolute paths (e.g., `/root/.frontierboard/FrontierBoard`), never tilde notation.

---

## Hard-Won Knowledge

These are operational facts Claude cannot derive from general training. Never remove them.

1. **`unset CLAUDECODE`** — All invocation commands for Claude Code agents must unset the `CLAUDECODE` env var. Without it, nested Claude sessions fail with "Cannot be launched inside another Claude Code session." Wrap in `bash -c 'unset CLAUDECODE && ...'`.

2. **`codex exec` not `codex`** — The bare `codex` command opens a TUI requiring an interactive terminal. It will silently fail as a subprocess. Always use `codex exec` for non-interactive invocation.

3. **Root always needs a board user** — Even in interactive mode, `--dangerously-skip-permissions` is blocked when running as root. If current user is root, ALWAYS create a board user regardless of mode choice.

4. **Sudoers validation** — Always validate with `visudo -c -f <file>` after writing. A bad sudoers file can brick sudo. Use `chmod 0440`. Remove the file if validation fails.

5. **Board user ownership** — After creating all agent directories, `chown -R $BOARD_USER:$BOARD_USER $BOARD/.board/`. Also ensure the board user can traverse parent directories.

6. **Billing warnings are mandatory** — Always warn users about pay-per-use billing (OpenAI API, Anthropic API) before accepting keys. Recommend spend limits. Claude Pro/Max subscriptions have no extra charges — mention this.

7. **Agent model must be high-reasoning** — Settings bubbles must set model to `claude-opus-4-6` (Claude Code). For Codex, let it default to its recommended model (currently `gpt-5.4`) or explicitly set `gpt-5.4` / `gpt-5.3-codex`. The old `o4-mini` name is retired and causes errors. Never use Sonnet — it lacks the reasoning depth for independent review.

8. **Codex approval_policy is `never`** — The Codex config.toml must use `approval_policy = "never"` (not "full-auto"). And Codex invocations in BOARD.md must include `--dangerously-bypass-approvals-and-sandbox`. Without this flag, Codex won't run as a subprocess.

9. **Agent invocation must read CLAUDE.md** — All invocation commands must tell the agent to read its CLAUDE.md first, then read inbox files. Example: `"read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md"`. Agents without CLAUDE.md instructions lose their identity.

10. **`claudeMdExcludes` blocks tree-walking leaks** — Claude Code walks UP the directory tree from CWD and loads EVERY `CLAUDE.md` it finds. Agents inside `$BOARD/.board/board/{agent}/` would pick up `$BOARD/CLAUDE.md` (orchestrator routing table) and potentially `$PROJ/CLAUDE.md` (project rules). This pollutes agent context with instructions meant for the orchestrator. Fix: every agent's `.claude/settings.json` must include `claudeMdExcludes` listing the absolute paths of all parent CLAUDE.md files to block. Note: `.claude/settings.json` does NOT walk up — only CLAUDE.md does.

---

## Step 1: Welcome and Detect

> Welcome to Board of Governance setup. I'll set up a board of independent AI reviewers for your project. I'll only pause when I genuinely need something from you.
>
> What's the path to the project this board will review?

Set `$PROJ` (project path) and `$BOARD` (FrontierBoard clone — current directory or clone path).

**Global mode detection:** If `$BOARD` is under `~/.frontierboard/`, this is a global install. Check if agents already exist at `$BOARD/.board/board/`. If they do, skip Steps 2–6 (board already built) and jump to Step 7 to wire up the new project. If agents don't exist yet, this is a first-time global setup — run all steps normally, then wire the project.

Silently detect integration mode by checking `$PROJ`:
- **fb-project-bridge** — has its own AI agent system (`src/index.ts` + `container/build.sh` + `groups/`, or similar multi-agent project structure). Needs a bridge script to trigger FB reviews from within the project.
- **claude-project** — has `.claude/` but no agent system of its own
- **standalone** — no AI tooling found
- **global** — `$BOARD` is under `~/.frontierboard/` (detected above)

Scan the project: read README, CLAUDE.md, SPEC.md, package manifests. Build a mental model of the stack for use in Step 5 (agent contexts).

---

## Step 2: Autonomous Mode

> Do you want agents in **YOLO mode** or **supervised mode**?
>
> **YOLO mode** — Full autonomy. Agents run unattended with read/write/bash. No permission prompts. They can use browser tools, run commands, explore freely. **Risk:** YOLO agents can read/write any file accessible to the board user, execute arbitrary commands, and access the network. Blind review between agents is enforced by instructions only — not by technical isolation. Use on machines where you trust the agents with everything the board user can access.
>
> **Supervised mode** — Agents pause before actions. Good for first-time setup or shared/untrusted environments.

Record the choice. Write `yolo_mode: true` or `yolo_mode: false` in BOARD.md (Step 7). If YOLO, agent invocations include `--dangerously-skip-permissions` (Claude Code) or `--dangerously-bypass-approvals-and-sandbox` (Codex). If supervised, omit those flags.

---

## Step 2b: Board User

Agents run directly on the host as a dedicated board user. Blind review is enforced by agent instructions and directory permissions.

- If **not root**: note the choice and move on.
- If **root** (see Hard-Won Knowledge #3): explain that AI tools block autonomous mode for root, and a separate user account is needed. Ask for a name (default: `llmuser`).
- Create the board user: idempotent useradd, sudoers entry with visudo validation (see Hard-Won Knowledge #4). Do this yourself — don't ask the user to run commands.

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

**C10: Validate credentials before proceeding.** After auth setup, verify that each configured credential source actually exists and is usable:
- **Claude OAuth:** Check `~/.claude/.credentials.json` exists, is parseable JSON, and contains a non-empty `claudeAiOauth.accessToken`. If missing or empty: "Run `claude /login` to authenticate, then re-run `/setup`." (Runtime extraction in `/run` is the authoritative freshness check — setup validates obvious misconfigurations only.)
- **Codex ChatGPT OAuth:** Check `~/.codex/auth.json` exists. If missing: "Run `codex` to authenticate, then re-run `/setup`."
- **API keys:** Verify the relevant env var (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) is set and non-empty.

Do NOT continue to Step 6 if validation fails — the generated invocation templates will be correct but unusable. Fail early with an actionable message.

---

## Step 6: Build the Agents

For each agent, create their directory at `$BOARD/.board/board/{agent-name}/` with:
- `inbox/`, `outbox/`, `learnings/`, `contexts/`
- Settings bubble for their CLI (Claude: `.claude/settings.json` allowing all tools + model. Codex: `.codex/config.toml` with approval=never + project doc pointing to CLAUDE.md. Qwen: `.qwen/settings.json` with yolo mode.)
- **`claudeMdExcludes` (critical):** Claude Code walks up the directory tree and loads every CLAUDE.md it finds. Agents must NOT pick up the FrontierBoard orchestrator's CLAUDE.md or the user's project CLAUDE.md — only their own agent identity. Add `claudeMdExcludes` to each agent's `.claude/settings.json` listing the absolute paths of all CLAUDE.md files above the agent directory. At minimum, exclude `$BOARD/CLAUDE.md`. If `$PROJ/CLAUDE.md` exists and the board is inside or near the project, exclude that too.

  **Claude agent `.claude/settings.json` template:**
  ```json
  {
    "permissions": {
      "allow": ["Read", "Glob", "Grep", "Write", "Edit", "Bash"]
    },
    "model": "claude-opus-4-6",
    "claudeMdExcludes": [
      "{$BOARD}/CLAUDE.md"
    ]
  }
  ```
  Replace `{$BOARD}` with the resolved absolute path. Add `"{$PROJ}/CLAUDE.md"` to the array if `$PROJ` has a CLAUDE.md. For supervised mode, restrict the permissions list.
- `CLAUDE.md` — agent identity. Domain-agnostic thinking style, NOT domain knowledge. Cover: who they are, how they think, what they're reviewing (one sentence naming the project), output format (structured findings using the SOP severity levels: FIX NOW / DEFER / INFO / REJECT, with location/finding/scenario/recommendation), rules (blind review, write report first, load context from inbox).

**Context files** go in `contexts/{domain}.md`. This is where ALL domain-specific knowledge lives — architecture, tech stack, key files, threat models. Tailor to each agent's thinking style. Write one context per domain chosen in Step 3, or three (software, business, general) if they chose "mix."

---

## Step 6b: Fix Ownership

If a board user exists, chown all of `.board/` to that user and ensure parent directory traversal (see Hard-Won Knowledge #5). Also chown `$BOARD/tasks.json` to the board user — it lives outside `.board/` but agents need write access to update task status after reviews.

---

## Step 7: Board Identity and Integration

### Board orchestrator CLAUDE.md

Write `$BOARD/.board/CLAUDE.md` — the orchestrator identity. Include: project name/path/stack, agent table (name, dir, CLI, style), how reviews work (detect domain → copy context → write brief → run agents → synthesise → write to REVIEW-LOG.md), available commands (/new-agent, /brief, /run).

### BOARD.md

Write `$BOARD/.board/board/BOARD.md` — operational source of truth. Include: project path, autonomous mode (`yolo_mode: true/false`), board user, per-agent invocation commands with `timeout 900` wrapper, parallelism pattern (run all agents in parallel, wait for all, check exit codes, verify report freshness).

**All Claude Code invocation commands MUST include `unset CLAUDECODE`** (see Hard-Won Knowledge #1). **All Codex invocations MUST use `codex exec`** (see Hard-Won Knowledge #2).

### Invocation templates

**Claude Code (bare):**
```bash
timeout 900 sudo -u $BOARD_USER bash -c 'unset CLAUDECODE && cd $AGENT_DIR && claude --dangerously-skip-permissions -p "read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md"'
```

**Codex (bare):**
```bash
timeout 900 sudo -u $BOARD_USER bash -c 'cd $AGENT_DIR && codex exec --dangerously-bypass-approvals-and-sandbox "read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md"'
```

If no board user, omit `sudo -u`. If supervised mode, omit `--dangerously-skip-permissions` / `--dangerously-bypass-approvals-and-sandbox`.

### Integration bridge

**fb-project-bridge:** Create `$BOARD/.board/bridge/run-review.sh` (executable) that accepts a brief, populates each agent's `inbox/brief.md` (not a dead `board/inbox/` path), switches to board user if root, runs the orchestrator. The bridge must include `unset CLAUDECODE` before any Claude invocation. Create a skill at `$PROJ/.claude/skills/board-review/SKILL.md` that tells the project's Claude how to invoke the bridge with timing estimates and a polling pattern. Add bridge section to BOARD.md.

**claude-project:** Create a skill at `$PROJ/.claude/skills/board-review/SKILL.md` that triggers the board from any Claude session. Check for existing skill first — if it's a previous FrontierBoard install, offer to update; if unrelated, use alternate name (`frontierboard-review`).

Write the following template to `$PROJ/.claude/skills/board-review/SKILL.md`, replacing all `{$BOARD}`, `{$PROJ}`, and `{$BOARD_USER}` with resolved absolute paths (no tilde). If no board user exists (non-root), omit `sudo -u {$BOARD_USER}` from the launch command.

```markdown
---
name: board-review
description: Trigger a FrontierBoard governance review from this project session. Type /board-review or describe what you want reviewed.
---

# Board Review

Trigger a board review without leaving this session.

## Board Location

- **Board:** {$BOARD}
- **Board state:** {$BOARD}/.board
- **Board user:** {$BOARD_USER}
- **Project:** {$PROJ}

## Behavior

When the user types `/board-review` or describes something to review:

### 1. Accept the review request

Ask what to review if not already specified. Capture the full description.

### 2. Pre-flight checks

Run these before launching. Stop with a clear message if any fail:

1. **Board exists:** `[ -f "{$BOARD}/.board/board/BOARD.md" ]` — if not: "Board not found at {$BOARD}. Run /setup first."
2. **No review in progress:** Check `{$BOARD}/.board/.review-lock` — if it exists, read the PID. If PID is alive: "Review already in progress (PID {pid}). Wait or kill it." If PID is dead: remove stale lock and continue.
3. **Agents ready:** Verify at least one agent directory exists under `{$BOARD}/.board/board/` with inbox/ and outbox/.

### 3. Stage the review description

Write the description to a staging file to avoid shell escaping issues:

```bash
mkdir -p {$BOARD}/.board/bridge
cat > {$BOARD}/.board/bridge/pending-review.md << 'BRIEF'
[user's review description here]
BRIEF
```

### 4. Launch the orchestrator

Run in background so the user's session isn't blocked (reviews take 8–15 minutes):

```bash
nohup sudo -u {$BOARD_USER} bash -c 'unset CLAUDECODE && cd {$BOARD} && claude --dangerously-skip-permissions -p "Read .board/CLAUDE.md for your identity. Read .board/bridge/pending-review.md for the review request. The project is at {$PROJ}. Run /brief with this context, then /run."' > /tmp/fb-review-$$.log 2>&1 &
echo $! > /tmp/fb-review-$$.pid
```

Tell the user:
> Board review launched. Standard reviews take 8–15 minutes. I'll check every 60 seconds and report back.

### 5. Poll for completion

Check every 60 seconds:
- Is the orchestrator PID still alive? (`kill -0 $(cat /tmp/fb-review-$$.pid)`)
- Has `{$BOARD}/.board/board/REVIEW-LOG.md` been modified since launch?

On completion (PID exits):
1. Read `{$BOARD}/.board/board/REVIEW-LOG.md` — find the most recent review entry
2. Present: FIX NOW items, DEFER items with trigger conditions, INFO items
3. Show agent agreement/disagreement per finding
4. Ask: "Want to work through the FIX NOW items now, or save for later?"

On failure (non-zero exit or no new REVIEW-LOG entry):
1. Read `/tmp/fb-review-$$.log` for error output
2. Present the error and suggest: "Run /debug from {$BOARD} to diagnose."

### 6. Cleanup

```bash
rm -f /tmp/fb-review-$$.pid /tmp/fb-review-$$.log {$BOARD}/.board/bridge/pending-review.md
```

## Notes

- The orchestrator handles /brief and /run — this skill just triggers and reports
- For planning help before a review, use /director
- Reviews run agents in parallel as {$BOARD_USER} (bare mode)
- Agents are ephemeral — zero memory between rounds, everything via inbox
```

Also add an "Integration" section to BOARD.md:

```markdown
## Integration

**Project:** {$PROJ}
**Skill:** {$PROJ}/.claude/skills/board-review/SKILL.md

From the project's Claude session, type `/board-review` or describe what to review.
```

Tell the user:
> Created `/board-review` skill in your project. From your project session, type `/board-review` or just describe what you want reviewed.

**standalone:** Add a "Running a Review" section to BOARD.md with the direct command.

**global:** Create per-project state at `$BOARD/.board/projects/{project-name}/`:
- `CLAUDE.md` — project-specific orchestrator identity (project name, path, stack, pointer to shared agents)
- `BOARD.md` — project-specific operational reference (same agents, but project-specific paths for briefs/reports)
- `briefs/`, `reports/`, `contexts/` — per-project review artifacts

Also create a global skill at `~/.claude/skills/frontierboard/SKILL.md` that lets the user type `/frontierboard` from any Claude session. The skill should:
1. Detect the current working directory as the project path (use `$PWD`, passed explicitly — C6)
2. Use **absolute paths** to the board install (e.g., `/root/.frontierboard/FrontierBoard`, NOT `~/.frontierboard/...`) — C1
3. Shell out with `unset CLAUDECODE` before nested Claude invocation — C5: `bash -c 'unset CLAUDECODE && cd /absolute/path/to/FrontierBoard && claude --dangerously-skip-permissions -p "review project at /absolute/project/path"'`
4. Pass the project path so the orchestrator can resolve `projects/{name}/` for per-project state — C6
5. Report back the synthesis
6. If agents don't exist yet, tell the user to run setup first

When the user returns to review another project, `/setup` detects existing agents and only creates the new project entry — no need to rebuild the board.

---

## Step 7b: Director Setup

Create the Director — a separate Claude session for review planning.

### Director session directory

Create `$BOARD/.board/director/` with:

**CLAUDE.md** — The director persona. Write this file with resolved absolute paths:

```markdown
# FrontierBoard Director — Review Planning Consultant

You are the Director — a planning consultant for FrontierBoard reviews. You help the human owner think through what to review, how to frame it, and what the findings mean.

You are NOT the orchestrator. You do NOT run agents. You read, advise, and help plan.

## Your Knowledge Sources

Read these to understand the current state:
- `$PROJ/CLAUDE.md` — project identity
- `$PROJ/SPEC.md` — project architecture (if exists)
- `$BOARD/.board/board/BOARD.md` — board composition and agent invocations
- `$BOARD/docs/REVIEW-SOP.md` — how reviews work (4-round SOP)
- `$BOARD/.board/board/REVIEW-LOG.md` — prior review history (if exists)
- `$BOARD/tasks.json` — task tracker including deferred items
- `$BOARD/.board/board/DEFERRED_WORK.md` — legacy deferred items (if exists)

Replace $PROJ and $BOARD with the actual absolute paths.

## What You Do

- **Plan reviews:** Help decide what to put in front of the board and frame the right questions
- **Advise on depth:** Quick (1 agent, fast) vs Standard (full board, thorough) vs Custom
- **Draft briefs:** Help formulate evaluation criteria, broader context, specific questions for agents
- **Interpret findings:** After a review, help understand the synthesis, prioritize FIX NOW items
- **Track deferred work:** Review deferred items, assess trigger conditions, recommend promotions to FIX NOW
- **Draft owner directives:** Help write directives for mid-review steering (between rounds)
- **Suggest agent composition:** Advise whether current agents cover the review domain or if /new-agent is needed

## What You Do NOT Do

- You do NOT run agents — that is the orchestrator's job (user runs /run from their project session)
- You do NOT write to agent inboxes or outboxes
- You do NOT modify BOARD.md or agent configurations
- You are advisory — read-only with respect to the board infrastructure

## Session Start

When the user arrives, say:

> What are you thinking about reviewing? Or would you like me to look at the recent review history and suggest what needs attention?

Then read the knowledge sources above and help them plan.
```

**`.claude/settings.json`** — Read-only advisory permissions for the director session:
```json
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep"],
    "deny": ["Write", "Edit", "Bash"]
  }
}
```

### Director skill in user's project

Create `$PROJ/.claude/skills/director/SKILL.md` with the content from the template at `$BOARD/.claude/skills/director/SKILL.md`, replacing `$BOARD` with the resolved absolute path.

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

- **fb-project-bridge**: "Your project can now trigger board reviews. Run the bridge or use the `/board-review` skill from within your project's Claude session."
- **claude-project**: "Type `/board-review` or describe what to review."
- **standalone**: "`cd $BOARD/.board && claude` then describe what to review or `/brief` then `/run`."
- **global**: "Type `/frontierboard` from any project session, or `cd ~/.frontierboard/FrontierBoard && claude` and tell it which project to review."

> What would you like the board to look at first?
