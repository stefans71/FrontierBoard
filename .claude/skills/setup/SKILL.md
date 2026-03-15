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

7. **Agent model must be opus or higher** — Settings bubbles must set model to `claude-opus-4-6` (Claude Code) or `o4-mini` (Codex). Never use Sonnet — it lacks the reasoning depth for independent review.

8. **Codex approval_policy is `never`** — The Codex config.toml must use `approval_policy = "never"` (not "full-auto"). And Codex invocations in BOARD.md must include `--dangerously-bypass-approvals-and-sandbox`. Without this flag, Codex won't run as a subprocess.

9. **Agent invocation must read CLAUDE.md** — All invocation commands must tell the agent to read its CLAUDE.md first, then read inbox files. Example: `"read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md"`. Agents without CLAUDE.md instructions lose their identity.

---

## Step 1: Welcome and Detect

> Welcome to Board of Governance setup. I'll set up a board of independent AI reviewers for your project. I'll only pause when I genuinely need something from you.
>
> What's the path to the project this board will review?

Set `$PROJ` (project path) and `$BOARD` (FrontierBoard clone — current directory or clone path).

**Global mode detection:** If `$BOARD` is under `~/.frontierboard/`, this is a global install. Check if agents already exist at `$BOARD/.board/board/`. If they do, skip Steps 2–6 (board already built) and jump to Step 7 to wire up the new project. If agents don't exist yet, this is a first-time global setup — run all steps normally, then wire the project.

Silently detect integration mode by checking `$PROJ`:
- **nanoclaw** — has `src/index.ts` + `container/build.sh` + `groups/`
- **claude-project** — has `.claude/` but not NanoClaw
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

## Step 2b: Isolation Mode

> How should agents be isolated?
>
> **Container** (recommended) — Each agent runs in its own Docker container. Agents physically cannot see each other's work or access your filesystem beyond the project source (read-only). API keys never enter containers — a credential proxy on the host injects them transparently. Requires Docker — I'll install it if needed.
>
> **Bare** — Agents run directly on the host. Blind review enforced by instructions only. Choose this if Docker truly can't run in your environment.

Record the choice. Write `isolation: container` or `isolation: bare` in BOARD.md (Step 7).

**If container mode:**
- Check if Docker is installed (`docker info`). If not, install it:
  - Debian/Ubuntu: `apt-get install -y docker.io`
  - macOS: tell user to install Docker Desktop
  - Other: `curl -fsSL https://get.docker.com | sh`
- Check if Node.js is installed (`node --version`). Needed for the credential proxy.
- Build the agent image: `$BOARD/container/build.sh`
- Verify the credential proxy script exists at `$BOARD/container/fb-credential-proxy.cjs` (it runs during `/run`, not during setup)
- **Skip board user creation** — the container IS the sandbox. No `llmuser`, no `sudo -u`, no chown needed.
- **Firewall:** If UFW is active, allow Docker containers to reach the proxy: `ufw allow from <docker-subnet> to any port <proxy-port>` (e.g., `ufw allow from 10.0.0.0/24 to any port 3002`). Without this, containers can't reach the proxy even though it binds to the bridge IP.
- **Outbox permissions:** Container agents run as `node` (uid 1000). After creating agent directories, `chown -R 1000:1000 $BOARD/.board/board/*/outbox $BOARD/.board/board/*/learnings` so agents can write reports.
- **Credential mounting:** Claude Code with OAuth subscriptions (Max/Pro) needs the host credential file mounted into the container. Copy `~/.claude/.credentials.json` to a readable temp file and mount it: `-v /tmp/.fb-claude-creds.json:/home/node/.claude/.credentials.json:ro`. The credential proxy does NOT work with OAuth tokens — it only works with `ANTHROPIC_API_KEY`. If the user has an API key, use the proxy. If OAuth only, mount credentials directly.

**If bare mode:**
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

---

## Step 6: Build the Agents

For each agent, create their directory at `$BOARD/.board/board/{agent-name}/` with:
- `inbox/`, `outbox/`, `learnings/`, `contexts/`
- Settings bubble for their CLI (Claude: `.claude/settings.json` allowing all tools + model. Codex: `.codex/config.toml` with approval=never + project doc pointing to CLAUDE.md. Qwen: `.qwen/settings.json` with yolo mode.)
- `CLAUDE.md` — agent identity. Domain-agnostic thinking style, NOT domain knowledge. Cover: who they are, how they think, what they're reviewing (one sentence naming the project), output format (structured findings using the SOP severity levels: FIX NOW / DEFER / INFO / REJECT, with location/finding/scenario/recommendation), rules (blind review, write report first, load context from inbox).

**Context files** go in `contexts/{domain}.md`. This is where ALL domain-specific knowledge lives — architecture, tech stack, key files, threat models. Tailor to each agent's thinking style. Write one context per domain chosen in Step 3, or three (software, business, general) if they chose "mix."

---

## Step 6b: Fix Ownership

If a board user exists, chown all of `.board/` to that user and ensure parent directory traversal (see Hard-Won Knowledge #5).

---

## Step 7: Board Identity and Integration

### Board orchestrator CLAUDE.md

Write `$BOARD/.board/CLAUDE.md` — the orchestrator identity. Include: project name/path/stack, agent table (name, dir, CLI, style), how reviews work (detect domain → copy context → write brief → run agents → synthesise → write to REVIEW-LOG.md), available commands (/new-agent, /brief, /run).

### BOARD.md

Write `$BOARD/.board/board/BOARD.md` — operational source of truth. Include: project path, autonomous mode (`yolo_mode: true/false`), isolation mode (`isolation: container/bare`), board user (bare mode only), per-agent invocation commands with `timeout 900` wrapper, parallelism pattern (run all agents in parallel, wait for all, check exit codes, verify report freshness).

**All Claude Code invocation commands MUST include `unset CLAUDECODE`** (see Hard-Won Knowledge #1). **All Codex invocations MUST use `codex exec`** (see Hard-Won Knowledge #2).

### Container mode invocation templates

Container agents don't need `unset CLAUDECODE` or a board user — the container is a fresh process with full isolation. Credentials are handled by the proxy — containers get placeholder keys and the proxy URL.

**Credential handling for containers** depends on auth method:
- **API key** (`ANTHROPIC_API_KEY` set): Use the credential proxy. Start it before launching agents. Containers get placeholder keys and proxy URL. Record proxy port in BOARD.md.
- **OAuth subscription** (Claude Max/Pro, no API key): Mount the host credential file directly. Proxy is NOT needed for Claude agents (but still needed for Codex if using OpenAI API key). Copy credentials to readable temp: `cp ~/.claude/.credentials.json /tmp/.fb-claude-creds.json && chmod 644 /tmp/.fb-claude-creds.json`

**Claude Code (container — OAuth mode):**
```bash
timeout 900 docker run -i --rm --name fb-$AGENT_NAME-$(date +%s) \
  -e FB_CLI=claude -e FB_YOLO=true \
  -e FB_PROMPT="read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md" \
  --add-host=host.docker.internal:host-gateway \
  -v $AGENT_DIR/.claude:/home/node/.claude \
  -v /tmp/.fb-claude-creds.json:/home/node/.claude/.credentials.json:ro \
  -v $PROJ:/workspace/project:ro \
  -v /dev/null:/workspace/project/.env:ro \
  -v $AGENT_DIR/CLAUDE.md:/workspace/agent/CLAUDE.md:ro \
  -v $AGENT_DIR/inbox:/workspace/agent/inbox:ro \
  -v $AGENT_DIR/outbox:/workspace/agent/outbox \
  -v $AGENT_DIR/contexts:/workspace/agent/contexts:ro \
  -v $AGENT_DIR/learnings:/workspace/agent/learnings \
  frontierboard-agent:latest
```

**Claude Code (container — API key mode, with proxy):**
```bash
timeout 900 docker run -i --rm --name fb-$AGENT_NAME-$(date +%s) \
  -e FB_CLI=claude -e FB_YOLO=true \
  -e FB_PROMPT="read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md" \
  -e ANTHROPIC_BASE_URL=http://host.docker.internal:$PROXY_PORT \
  -e ANTHROPIC_API_KEY=placeholder \
  -e FB_PROXY_PORT=$PROXY_PORT \
  --add-host=host.docker.internal:host-gateway \
  -v $PROJ:/workspace/project:ro \
  -v /dev/null:/workspace/project/.env:ro \
  -v $AGENT_DIR/CLAUDE.md:/workspace/agent/CLAUDE.md:ro \
  -v $AGENT_DIR/inbox:/workspace/agent/inbox:ro \
  -v $AGENT_DIR/outbox:/workspace/agent/outbox \
  -v $AGENT_DIR/contexts:/workspace/agent/contexts:ro \
  -v $AGENT_DIR/learnings:/workspace/agent/learnings \
  -v $AGENT_DIR/.claude:/home/node/.claude \
  frontierboard-agent:latest
```

**Codex (container):**
```bash
timeout 900 docker run -i --rm --name fb-$AGENT_NAME-$(date +%s) \
  -e FB_CLI=codex -e FB_YOLO=true \
  -e FB_PROMPT="read CLAUDE.md then read inbox/context.md and inbox/brief.md and write your report to outbox/report.md" \
  -e OPENAI_BASE_URL=http://host.docker.internal:$PROXY_PORT \
  -e OPENAI_API_KEY=placeholder \
  -e FB_PROXY_PORT=$PROXY_PORT \
  --add-host=host.docker.internal:host-gateway \
  -v $PROJ:/workspace/project:ro \
  -v /dev/null:/workspace/project/.env:ro \
  -v $AGENT_DIR/CLAUDE.md:/workspace/agent/CLAUDE.md:ro \
  -v $AGENT_DIR/inbox:/workspace/agent/inbox:ro \
  -v $AGENT_DIR/outbox:/workspace/agent/outbox \
  -v $AGENT_DIR/contexts:/workspace/agent/contexts:ro \
  -v $AGENT_DIR/.codex:/home/node/.codex:ro \
  frontierboard-agent:latest
```

Containers get `placeholder` as the API key and the proxy URL as the base URL. The proxy intercepts requests and injects real credentials. **Real keys never enter the container** — not in env, files, or `/proc`. If supervised mode, set `FB_YOLO=false`.

### Bare mode invocation templates

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

**nanoclaw:** Create `$BOARD/.board/bridge/run-review.sh` (executable) that accepts a brief, populates each agent's `inbox/brief.md` (not a dead `board/inbox/` path), switches to board user if root, runs the orchestrator. The bridge must include `unset CLAUDECODE` before any Claude invocation. Create a NanoClaw skill at `$PROJ/.claude/skills/board-review/SKILL.md` that tells NanoClaw Claude how to invoke the bridge with timing estimates and a polling pattern. Add bridge section to BOARD.md.

**claude-project:** Create a skill at `$PROJ/.claude/skills/board-review/SKILL.md` (or `frontierboard-review` if name is taken) that triggers the board from any Claude session. Include timing estimates, background launch with nohup, polling, and cleanup. Check for existing skill — if it's a previous FrontierBoard install, offer to update; if unrelated, use alternate name. Add integration section to BOARD.md. Tell the user what was created and how to use it.

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
- **global**: "Type `/frontierboard` from any project session, or `cd ~/.frontierboard/FrontierBoard && claude` and tell it which project to review."

> What would you like the board to look at first?
