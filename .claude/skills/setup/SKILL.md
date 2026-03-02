---
name: setup
description: Set up the Board of Governance. Run when the user types /setup or asks to set up, install, or configure the board for the first time.
---

# Board of Governance — Setup

Walk the user through setting up their board from scratch. This is a conversation, not a script. Ask questions, listen to answers, do the work. Only pause when you genuinely need the user to do something — paste a key, scan a QR code, open a browser.

When something is missing or broken, fix it. Don't tell the user to go fix it themselves unless it truly requires their hands.

---

## Host Project Safety Rules — Read Before Starting

These rules apply for the entire setup. Never break them.

**You may freely:**
- Create and write anything inside `$PROJ/.board/**` — FrontierBoard's exclusive territory
- Append to `$PROJ/.gitignore` — never modify or delete existing lines
- Create **new** files and directories inside `$PROJ/.claude/skills/` — adding new skills doesn't touch existing config
- Create **new** files and directories inside `$PROJ/container/skills/` — for NanoClaw integration

**You may read but never modify:**
- `$PROJ/.claude/settings.json`, `$PROJ/CLAUDE.md`, `$PROJ/src/`, and all other existing project files — read to understand, never change

**Never:**
- Delete, overwrite, or rename any file that already exists outside `$PROJ/.board/`
- Modify existing `.gitignore` entries — only append new ones
- Require the user to create directories or write files — you do all of that

**Key distinction:** creating a *new* file in a directory that already exists (e.g. `.claude/skills/board-review/SKILL.md` when `.claude/` already exists) is always safe. Only writing to *existing* files outside `.board/` is off-limits.

If the project has no `.claude/` directory: FrontierBoard still works entirely inside `.board/`. You can create `.claude/skills/board-review/` as new directories without issue. The project doesn't need an existing Claude setup for FrontierBoard to install.

---

## Step 1: Welcome, Detect Integration Mode, Get the Project Path

Introduce what's about to happen:

> Welcome to Board of Governance setup. I'll set up a board of independent AI reviewers for your project. I do all the file and directory work — I'll only pause when I genuinely need something from you, like an API key.
>
> First: what's the path to the project this board will review? (e.g. `~/projects/my-app`)
>
> If you haven't created the directory yet, tell me where you want it and I'll create it.

Once you have the path, expand it and check what's there:

```bash
PROJ=$(eval echo [path])
ls "$PROJ" 2>/dev/null && echo "exists" || echo "missing"
```

If missing, create it:
```bash
mkdir -p "$PROJ"
```

**Detect integration mode** — check silently, don't ask the user:

```bash
# Is this a NanoClaw project?
ls "$PROJ/src/index.ts" "$PROJ/container/build.sh" "$PROJ/groups/" 2>/dev/null
# Does it have any Claude setup?
ls "$PROJ/.claude/" 2>/dev/null
# Is it a git repo?
git -C "$PROJ" rev-parse --git-dir 2>/dev/null
```

Set `INTEGRATION_MODE` to one of:
- `nanoclaw` — NanoClaw project detected (has `src/index.ts` + `container/build.sh` + `groups/`)
- `claude-project` — has `.claude/` but not NanoClaw
- `standalone` — no AI tooling found; board will run standalone

Note the integration mode. You will use it in Step 8 when wiring up the review bridge.

Note the absolute project path. Every subsequent file operation targets this path. The board lives at `$PROJ/.board/`.

---

## Step 2: Read the Project

Before asking the user anything else, read what's at the project path:

```bash
ls "$PROJ/CLAUDE.md" 2>/dev/null
ls "$PROJ/SPEC.md" 2>/dev/null
ls "$PROJ/tasks.md" 2>/dev/null
ls "$PROJ/package.json" "$PROJ/pyproject.toml" "$PROJ/Gemfile" "$PROJ/go.mod" "$PROJ/Cargo.toml" 2>/dev/null
cat "$PROJ/README.md" 2>/dev/null | head -60
cat "$PROJ/CLAUDE.md" 2>/dev/null | head -40
cat "$PROJ/SPEC.md" 2>/dev/null | head -40
```

From this, build a brief mental model of the project: what it is, what stack, how mature it is. You'll use this in Step 5 when writing agent contexts — agents who know they're reviewing a Node.js auth service write better findings than agents who know nothing.

If the project directory is empty or near-empty, note it. You'll tell the user the board is ready to review future work even if nothing is there yet.

---

## Step 3: Autonomous Mode

Lead with the benefit before the technical explanation:

> Do you want your board agents to run unattended — meaning they work in the background while you do something else, and come back with their reports ready? Or would you prefer they pause and ask you before each action so you stay in control of every step?

If they say no (or prefer to stay in control) — note that agents will run in interactive mode and move on. No user setup needed.

If they say yes (unattended/autonomous mode) — check whether the current user is root.

If they are not root, autonomous mode will work as-is. Note it and move on.

If they are root, explain the situation plainly before asking anything:

> There's one thing to sort out first. The AI tools we'll be using — Claude Code, Codex, Qwen and others — have a built-in safety rule: they won't run fully unattended when the process has root (administrator) access to your machine. This isn't a FrontierBoard limitation — it's the tools protecting you from an autonomous process that could modify anything on your system.
>
> The solution is a separate user account just for the board agents. Your own account stays untouched — your API keys and credentials just get copied across once. The board agents then run as that user. It takes about 2 minutes.
>
> What would you like to call this account? The default is `llmuser`.

Create the user with a home directory and bash shell. Run these commands yourself — don't ask the user to run them:

```bash
useradd -m -s /bin/bash llmuser   # or whatever name they chose
# Add sudoers entry so current user can run commands as the board user without password
echo "$(whoami) ALL=(llmuser) NOPASSWD:ALL" >> /etc/sudoers.d/frontierboard
```

Note the board user name — all agent invocation commands will use it.

---

## Step 4: What Will the Board Review?

Ask:

> What will your board primarily be reviewing? Pick the one that fits best — you can always add more later.
>
> 1. Software — code, architecture, integration quality
> 2. Business decisions — strategy, pricing, partnerships, go-to-market
> 3. HR and hiring — candidates, team decisions, org structure
> 4. Finance — investments, budgets, financial models
> 5. Mix of everything — I'll figure it out as I go

Note the answer. You'll use it in Step 5 to give the user domain-relevant role suggestions, and in Step 7 to write the right context files.

If they pick 1–4, note the primary domain.

If they pick 5, tell them briefly how that works before moving on — don't leave them wondering:

> No problem. Here's how that works: each agent gets a stable thinking style (like "the skeptic" or "the systems thinker"), and I'll write separate context files for software, business, and general use. When you send a review request, the board orchestrator reads it and loads the right context automatically — so a code review gets the software lens and a business decision gets the business lens. You don't need to configure anything per review.

Note: write three contexts per agent (software, business, general) later in Step 7.

---

## Step 5: Compose the Board

Before asking anything, briefly explain what an agent is and how thinking styles work — this prevents the confusion of trying to map abstract role names onto specific domains:

> Each board member is an AI agent — an independent AI that reviews your work and writes a report. They all see the same thing, but write their findings separately, so you get genuinely different perspectives rather than one consensus view.
>
> Each agent has a **thinking style** — the way they approach any question. That's what stays stable. What changes per review is the **context**: I'll load a software lens for code reviews, a business lens for strategy questions, and so on. So when you're picking agents, think about *how* you want things questioned, not *what domain* they specialise in.

Ask:

> How many agents do you want on your board? Two is the minimum for independent perspectives. Three gives you a tiebreaker. More than four gets noisy.

Then for each agent, ask about their thinking style. Frame the question based on what domain(s) they chose in Step 4:

**If they chose a specific domain (e.g. software):**

> Tell me about agent [number]. What's their angle when reviewing [domain]? You can describe them however feels natural. For example:
> - "Always looks for what could break or be exploited" ← good for security-focused software review
> - "Asks whether this is the simplest solution that could work" ← good for architecture review
> - "Traces what happens downstream when something changes" ← good for systems/integration review
> - "Pushes back on every assumption — why are we doing it this way at all?"
>
> Or describe something completely different — I'll write the role from your description.

**If they chose "mix of everything":**

> Tell me about agent [number]. What's their thinking style — how do they approach any question?
>
> For mixed reviews, thinking styles work better than domain expertise, because the same style can be applied to code, strategy, or hiring decisions. Some examples:
> - **The Skeptic** — challenges every assumption, asks "what could go wrong?" and "what are we not seeing?" Works for software (finds edge cases and failure modes), business (finds shaky assumptions), hiring (spots red flags).
> - **The Systems Thinker** — traces how things connect and what the second-order effects are. Works for architecture (traces dependencies), strategy (traces market dynamics), org decisions (traces team dynamics).
> - **The Pragmatist** — focuses on what's actually feasible given real constraints. Works for code (is this maintainable?), business (can we actually execute this?), finance (are these numbers realistic?).
> - **The Contrarian** — argues the opposite position to stress-test the logic. Works for any domain.
>
> These are just starting points — describe what you want and I'll write it.

After each agent's thinking style is confirmed, ask about CLI:

> Which tool should this agent run on — Claude (by Anthropic), Codex (by OpenAI), Qwen (by Alibaba), or something else? I'll handle all the setup; you just need to pick a provider.

If the user isn't sure which to pick, suggest Claude Code as a default and briefly explain: "Claude Code is a good default — if you have a Claude Pro or Max subscription at claude.ai, there are no extra charges for using it here. Qwen is also a good starting point because it has a free tier. Codex uses OpenAI's API, which has separate pay-per-use billing — a ChatGPT subscription doesn't cover it automatically, so there's a bit more setup involved."

Note the provider for each agent. You will use this in Step 6 to set up CLIs and in Step 7 to create settings bubbles.

---

## Step 6: CLI Setup

For each unique provider across all agents, check whether that CLI is installed and authenticated.

Check quietly — don't narrate every check. Just report what you find:

> Here's what I found:
> - Claude Code: installed and authenticated
> - Codex: installed, not authenticated
> - Qwen: not installed

For anything missing or unauthenticated, ask:

> Would you like help getting [CLI] set up?

If yes, walk through it for that CLI:

**Claude Code:**

Check if Claude Code is installed (`which claude`). If not, tell the user:

> I'll install Claude Code now. This is Anthropic's official command-line tool for running Claude.

Run the install command yourself. If the environment doesn't allow it, give the user the exact command:

```bash
npm install -g @anthropic-ai/claude-code
```

For authentication, explain the two options clearly — many users have a Claude subscription (claude.ai) but not an API key, and these are different things:

> There are two ways to authenticate Claude Code:
>
> **Option A — Claude subscription (claude.ai/pro or max):** If you already pay for Claude at claude.ai, you can use that account directly. I'll run `claude` and it will open a browser login. You sign in with your claude.ai account and that's it.
>
> **Option B — API key:** If you want to use a separate API key (for billing control or if you don't have a subscription), go to console.anthropic.com → sign in → API Keys → Create Key. Paste the key here and I'll store it securely.
>
> Which do you have — a claude.ai subscription or an API key?

If subscription: run `claude --dangerously-skip-permissions -p "echo hello"` and direct them to complete the browser flow. This is the preferred path — no per-use charges.

If API key: explain billing before asking for the key:

> Anthropic API keys are pay-per-use with no monthly cap by default. Before using one, please set a spend limit:
>
> 1. Go to console.anthropic.com → sign in → Settings → Billing → Spend limits
> 2. Set a monthly limit (e.g. $10 is plenty for casual board use)
>
> Then go to API Keys → Create Key, copy it, and paste it here.

If there's no spend limit option on their plan, strongly advise using the subscription path instead.

**Codex:**

Check if the Codex CLI is installed (`which codex`). If not, install it. Direct them to the Codex GitHub repo for the current install command — don't hardcode a package name here as it can change.

For authentication, first clarify which OpenAI product they have — these are common sources of confusion:

> Before we set up Codex, I need to check which OpenAI product you have, because they're completely separate things with different billing:
>
> - **ChatGPT subscription** ($20/month at chat.openai.com) — this gives you access to the ChatGPT web interface and app. It does **not** automatically include API access.
> - **OpenAI API key** (from platform.openai.com) — this is separate, pay-per-use billing. Each request costs a small amount based on how much text is processed. There's no monthly cap unless you set one yourself.
>
> Which do you have?

**If they have a ChatGPT subscription only:**

> A ChatGPT subscription doesn't include API access by default. To use Codex, you'd need to go to platform.openai.com and either:
> - Check if your paid plan includes API credits (sign in → Billing → look for included credits)
> - Or add a separate payment method for API usage
>
> API usage is charged per request — for typical board reviews it's usually pennies, but there's no monthly cap unless you set a spend limit yourself. Would you like to set that up, or would you prefer to use a different provider like Claude Code (which has a flat monthly subscription) or Qwen (which has a free tier)?

Only proceed with API key setup if the user explicitly wants to. If they do:

> **Important before you get a key:** OpenAI API billing is pay-per-use with no monthly cap by default. A board review typically costs a few cents, but a runaway process could spend much more. Before using an API key, please set a spending limit:
>
> 1. Go to platform.openai.com → sign in
> 2. Click your profile icon → Billing → Usage limits
> 3. Set a monthly spend limit (e.g. $10 is plenty for casual board use)
>
> Once you've set a limit, go to API Keys → Create new secret key, copy it (you'll only see it once), and paste it here.

If there is no spend limit feature available on their plan, tell them clearly:

> OpenAI doesn't offer a spend limit option for your account type. This means API usage has no cap and unexpected charges are possible. I'd strongly recommend using Claude Code (flat monthly subscription, no per-use charges) or Qwen (free tier available) instead. Are you sure you want to continue with an API key?

Store the API key in their environment only after they've confirmed they understand the billing and have set a limit if available.

**Qwen:**

Check if the Qwen CLI is installed. If not, install it. Direct them to the Qwen Code GitHub repo for the current install command.

For authentication:

> Qwen uses a DashScope API key from Alibaba's Bailian platform. The good news: Qwen has a free tier through the "Bailian Coding Plan", which is enough for most board use without any charges.
>
> To get your key:
> 1. Go to bailian.console.aliyun.com and sign up (it's free)
> 2. Look for the "Bailian Coding Plan" and activate it — this gives you free API quota
> 3. Go to API Keys, create a new key, and copy it
>
> Paste it here when you're ready.

If they go beyond the free tier and onto paid usage, note that DashScope does have a quota/spend limit feature in the console — advise them to set one before using paid quota. If there is no limit feature available on their plan, advise them to stick to the free tier and not add payment details until they understand the per-use billing.

**Other providers:**
If the user wants a CLI you don't recognise, ask them what CLI it uses, how it authenticates, and what its settings file format is. Adapt the setup accordingly.

**Auth and settings are separate — explain this once:**

> Just so you know — your credentials (API keys, login tokens) live globally in your home directory. That's standard for all these tools and it only needs to happen once per machine. Each agent will have its own separate settings file that controls how it behaves, but that's different from your credentials. If you have three Claude agents, they all share one login but each has its own personality and instructions.

If a board user was created in Step 3, copy the relevant credential files from the current user's home directory into the board user's home directory for each provider being used. Do this yourself — don't ask the user to do it.

---

## Step 7: Build the Agents

All agent directories live inside `$PROJ/.board/board/`. The board itself lives at `$PROJ/.board/`.

For each agent the user described in Step 5, create their directory and everything in it.

**Directory structure for each agent:**

Create the agent directory inside `$PROJ/.board/board/`. The name should reflect the agent's role — lowercase, hyphens, no spaces. For example: `$PROJ/.board/board/skeptic/`, `$PROJ/.board/board/systems-thinker/`.

Inside each agent directory, create:
- An inbox folder
- An outbox folder
- A learnings folder
- A settings bubble for their CLI (see below)
- A CLAUDE.md that defines who they are
- A contexts folder (gitignored — generated content lives here)

**Settings bubble:**

This is the most important structural detail. Each agent directory gets a settings file for their specific CLI. When that CLI runs from this directory, it finds this file first and stops walking up the tree. The agent's behaviour is fully isolated from your interactive session and from every other agent.

For a Claude agent, create a `.claude` folder containing a `settings.json` that allows all tools without prompting and sets the model. Do not put credentials here — only behaviour settings.

For a Codex agent, create a `.codex` folder containing a `config.toml` that sets approval policy to never and loads CLAUDE.md as the project context document. Include a brief developer instructions block pointing to CLAUDE.md for full SOPs.

For a Qwen agent, create a `.qwen` folder containing a `settings.json` that sets yolo mode and loads CLAUDE.md as the context file.

For other CLIs, ask the user where that CLI looks for a local settings file, then create it with the equivalent of "full auto, no prompts." Only configure autonomous settings if the user chose autonomous mode in Step 3.

**CLAUDE.md for each agent:**

Write this from the user's description of the agent's thinking style, combined with what you learned about the project in Step 2. This is the agent's identity — stable across all reviews, regardless of domain.

It should cover:
- **Who they are**: their thinking style and what they always bring to any question — frame this as a cognitive approach, not a domain role. "Always looks for the failure mode no one's thought of" is better than "software security expert."
- **How they think**: their reasoning style, what they instinctively question, what they tend to challenge, what they treat as a red flag
- **The project context**: what they know they're reviewing (use what you read in Step 2) — this gives them grounding even before a brief arrives
- **Their output format**: structured findings with severity, reference (file path, section, or topic), description, and recommended action
- **Their rules**: write report first, blind review (no reading other reports before writing their own), no coordination with other agents, always load the context file from their inbox before starting

The thinking style should read as domain-agnostic. A good CLAUDE.md for "The Skeptic" should make them equally useful reviewing a PR, a pricing decision, or a hiring scorecard — without needing to be rewritten for each.

**Contexts:**

Context files tell the agent what lens to apply for a specific type of review. The orchestrator loads the right context into the agent's inbox when a review is triggered.

A context file goes in `$PROJ/.board/board/{agent}/contexts/{domain}.md`. It covers: what questions to ask in this domain, what a strong finding looks like here, what failure modes are common in this type of review.

Write context files now based on the domain the user chose in Step 4:
- If they chose a specific domain (software, business, HR, finance): write one context per agent for that domain.
- If they chose "mix of everything": write three contexts per agent — `software.md`, `business.md`, and `general.md`.

Use the project knowledge from Step 2 to make context files specific, not generic. A software context for a Node.js microservices project should mention async patterns, container boundaries, and API surface — not generic "check code quality."

The context files are gitignored. They live locally. The user can generate new or updated ones any time with `/brief`.

**How the orchestrator uses contexts at runtime:**

Write a note in the orchestrator's CLAUDE.md (Step 8) explaining this — the user doesn't need to configure it per review:

When a review request arrives (from the user directly or via the bridge from NanoClaw), the orchestrator:
1. Reads the review request and infers the domain (software, business, etc.)
2. Copies the matching context file from each agent's `contexts/` folder into their `inbox/`
3. Adds the brief to each agent's inbox
4. Runs all agents in parallel
5. Collects reports from each agent's outbox and synthesises them

The user just describes what they want reviewed. The orchestrator handles context selection automatically.

---

## Step 8: Write Board Identity Files and Wire Integration

**`$PROJ/.board/CLAUDE.md`**

This is the board orchestrator's identity. Write it now using the template below. Fill in everything in brackets from what you've learned.

```markdown
# Board of Governance

You are the Board of Governance orchestrator for [project name].

## Project

Path: [absolute project path]
Stack: [what you found in Step 2, or "not yet determined"]
What it is: [one sentence from README/CLAUDE.md, or "project is in early setup"]

## Your Role

Coordinate the board agents. Run briefs, collect reports, synthesise findings.
You do not review work yourself — your agents do. Your job is to run them well
and give the user a clear synthesis they can act on.

## Agents

[For each agent: name, directory, CLI, thinking style in one sentence]

## How Reviews Work

When a review request arrives — from the user directly or via a project bridge:

1. Read the request and decide which domain lens to apply (software, business, general, etc.)
2. Copy the matching context file from each agent's `contexts/` folder into their `inbox/`
3. Write the brief to each agent's `inbox/` (agents must not see each other's inboxes)
4. Run all agents in parallel (see BOARD.md for exact commands)
5. Wait for all outbox reports to appear
6. Synthesise all reports into a single finding set, noting agreement and divergence
7. Write synthesis to `board/REVIEW-LOG.md`

The caller does not specify which context to use — infer it from the review request.

## Commands

To add an agent: /new-agent
To set a review brief: /brief
To run the board: /run
```

**`$PROJ/.board/board/BOARD.md`**

This is the operational source of truth. Write it with:
- The project name and absolute path
- Whether agents run autonomously or interactively
- The board user if one was created (otherwise the current user)
- For each agent: name, directory, CLI, model, thinking style, and the exact command to invoke them
- The parallelism pattern — how to run all agents in parallel and wait for completion
- The bridge section (see below, varies by integration mode)

---

**Wire the integration bridge — based on the INTEGRATION_MODE detected in Step 1:**

**If `nanoclaw`:**

The user never manually triggers board reviews — NanoClaw Claude handles it. Wire this up now:

1. Create `$PROJ/.board/bridge/` directory.

2. Write `$PROJ/.board/bridge/run-review.sh`:

```bash
#!/usr/bin/env bash
# Called by NanoClaw IPC handler when a board review is requested.
# Usage: run-review.sh "Brief text or path to brief file"
set -euo pipefail
BOARD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRIEF="${1:-}"
if [ -z "$BRIEF" ]; then
  echo "Usage: run-review.sh <brief>" >&2
  exit 1
fi
mkdir -p "$BOARD_DIR/board/inbox"
echo "$BRIEF" > "$BOARD_DIR/board/inbox/request.md"
cd "$BOARD_DIR"
exec claude --dangerously-skip-permissions -p "read CLAUDE.md then /run"
```

Make it executable: `chmod +x $PROJ/.board/bridge/run-review.sh`

3. Write a NanoClaw skill that tells NanoClaw Claude how to invoke the bridge.

First check whether `board-review` is already taken in the NanoClaw skills directory:

```bash
ls "$PROJ/container/skills/board-review/SKILL.md" 2>/dev/null && echo "exists" || echo "free"
```

- If free: use `board-review` as the skill name.
- If exists and contains FrontierBoard content: offer to update it (same rule as the `claude-project` path above).
- If exists and is unrelated: use `frontierboard-review` as the skill name.

Create `$PROJ/container/skills/{skill-name}/SKILL.md`:

```markdown
---
name: board-review
description: Request a board review via FrontierBoard. Use when asked to "review", "get a second opinion on", or "run the board on" something.
---

# Board Review

When the user asks for a board review, write their request as a brief and
invoke the FrontierBoard bridge.

The board lives at: [PROJ_PATH]/.board/
The bridge script is at: [PROJ_PATH]/.board/bridge/run-review.sh

## Timing warning

Board reviews take 8–45 minutes depending on which agents are configured:
- Claude Code and Qwen agents: ~8–12 min each
- Codex (o4-series) agents: ~40 min each

A board with mixed providers is bottlenecked by the slowest agent. Do NOT
block on the bridge command — use the polling pattern below so the user
receives progress updates and the connection stays alive.

## Steps

1. Write the review request as a markdown brief at
   `[PROJ_PATH]/.board/board/inbox/request.md`. Include:
   - What specifically is being reviewed (file paths, topic, decision)
   - What questions the board should answer
   - The domain: software / business / general

2. Tell the user the review has started and give a realistic time estimate
   based on which agents are on this board. Example:
   "Starting board review. Claude and Qwen agents typically finish in
   8–12 minutes; if Codex is on the board it may take up to 45 minutes.
   I'll send you updates as agents complete."

3. Start the bridge in the background:
   ```bash
   nohup [PROJ_PATH]/.board/bridge/run-review.sh > /tmp/board-bridge.log 2>&1 &
   echo $! > /tmp/board-bridge.pid
   ```

4. Poll every 5 minutes until the review log appears:
   ```bash
   while [ ! -f "[PROJ_PATH]/.board/board/REVIEW-LOG.md" ] && \
         kill -0 $(cat /tmp/board-bridge.pid 2>/dev/null) 2>/dev/null; do
     sleep 300
   done
   ```
   After each 5-minute sleep, send the user a brief status message so they
   know it's still running: "Board still working — [N] min elapsed."
   This keeps the NanoClaw connection alive during long Codex reviews.

5. When the log appears, read it:
   ```bash
   cat [PROJ_PATH]/.board/board/REVIEW-LOG.md
   ```

6. Summarise the key findings for the user. Highlight where agents agreed
   and where they diverged — divergence is often the most valuable signal.

7. Clean up:
   ```bash
   rm -f /tmp/board-bridge.pid /tmp/board-bridge.log
   ```

The user does not need to know the internal mechanics — just keep them
informed of progress and timing.
```

Replace `[PROJ_PATH]` with the actual absolute path and `{skill-name}` with the chosen name.

4. Tell the user what the flow looks like, including timing:

> I've wired FrontierBoard into NanoClaw. Here's how it works:
>
> You message NanoClaw: "Review the authentication code I just wrote."
> NanoClaw starts the board and sends you a timing estimate straight away.
> Every 5 minutes while agents are working, it sends you a brief update.
> When all agents are done, NanoClaw sends the synthesis.
>
> Typical times: 10–15 minutes for Claude/Qwen-only boards. Up to 45 minutes if a Codex agent is on the board — it's thorough but slow.
>
> You don't need to interact with FrontierBoard directly at all.

Add to `BOARD.md`:

```markdown
## NanoClaw Bridge

FrontierBoard is integrated with NanoClaw. The user never invokes the board
directly — NanoClaw Claude handles it via the board-review skill.

Bridge script: [PROJ_PATH]/.board/bridge/run-review.sh
NanoClaw skill: [PROJ_PATH]/container/skills/board-review/SKILL.md

To trigger manually (for testing):
  [PROJ_PATH]/.board/bridge/run-review.sh "Review [topic]"
```

**If `claude-project`:**

The existing project's Claude doesn't automatically know FrontierBoard exists. Wire it in by creating a skill file in `.claude/skills/`. Claude Code scans that directory on startup, so the skill is available immediately.

**First — check whether the skill name is already taken:**

```bash
ls "$PROJ/.claude/skills/board-review/SKILL.md" 2>/dev/null && echo "exists" || echo "free"
```

Three outcomes:

**A) Path is free** — create the skill as normal. Go to step 1 below.

**B) Path exists and contains FrontierBoard content** — check whether it's an older install:

```bash
grep -l "FrontierBoard" "$PROJ/.claude/skills/board-review/SKILL.md" 2>/dev/null
```

If it matches, offer the user a choice:

> There's already a FrontierBoard board-review skill at `.claude/skills/board-review/SKILL.md`. It looks like a previous install. Would you like me to update it to the current version, or leave it as-is?

If they say update: overwrite it (this is the one case where overwriting an existing file outside `.board/` is permitted — it's a previous FrontierBoard file, not the user's own work). If they say leave it: note the existing path and skip to the BOARD.md step.

**C) Path exists but is NOT a FrontierBoard file** — the project already has a `board-review` skill for something else. Do not touch it. Use `frontierboard-review` as the skill name instead:

```bash
# Use frontierboard-review as the skill directory name
SKILL_NAME="frontierboard-review"
SKILL_DIR="$PROJ/.claude/skills/$SKILL_NAME"
```

Remember the skill name chosen — you'll need it for BOARD.md and for the user notification.

**1. Write the skill file** at `$PROJ/.claude/skills/{skill-name}/SKILL.md`:

```markdown
---
name: {skill-name}
description: Request a FrontierBoard review. Use when the user asks to "review", "get a second opinion on", "run the board on", or "have the board look at" something. Also use proactively when completing a significant change and a review would add value.
---

# Board Review

FrontierBoard is installed at [PROJ_PATH]/.board/ and provides independent
multi-agent review. Use it when the user asks for a review, or when you judge
that independent perspectives would meaningfully improve a decision or output.

## Timing

Board reviews take 8–45 minutes depending on which agents are configured:
- Claude Code and Qwen agents: ~8–12 min each
- Codex (o4-series) agents: ~40 min each

Use the polling pattern below — do not block on the bridge command.

## How to trigger a review

1. Write a brief to `[PROJ_PATH]/.board/board/inbox/request.md`. Include:
   - What specifically is being reviewed (file paths, topic, decision)
   - What questions the board should answer
   - The domain: software / business / general

2. Tell the user the review is starting and give a timing estimate.

3. Start the bridge in the background:
   ```bash
   nohup cd [PROJ_PATH]/.board && claude --dangerously-skip-permissions \
     -p "read CLAUDE.md then /run" > /tmp/board-bridge.log 2>&1 &
   echo $! > /tmp/board-bridge.pid
   ```

4. Poll every 5 minutes until the review log appears, writing a brief
   status update to the user each cycle so the session stays alive:
   ```bash
   while [ ! -f "[PROJ_PATH]/.board/board/REVIEW-LOG.md" ] && \
         kill -0 $(cat /tmp/board-bridge.pid 2>/dev/null) 2>/dev/null; do
     sleep 300
   done
   ```

5. Read and summarise the synthesis:
   ```
   [PROJ_PATH]/.board/board/REVIEW-LOG.md
   ```
   Highlight where agents agreed and where they diverged.

6. Clean up: `rm -f /tmp/board-bridge.pid /tmp/board-bridge.log`

## When NOT to use it

- For quick factual questions — answer directly
- When the user just wants a fast check, not an independent review
- If the board was already run on this topic recently (check REVIEW-LOG.md)
```

Replace `[PROJ_PATH]` with the actual absolute project path and `{skill-name}` with the chosen name.

**2. Add to `BOARD.md`:**

```markdown
## Project Claude Integration

FrontierBoard is integrated with the host project's Claude via:
  [PROJ_PATH]/.claude/skills/{skill-name}/SKILL.md

The project's Claude will use this skill automatically when asked for a review.
Trigger phrase: "/{skill-name}" or natural language ("review xyz", "get a second opinion on xyz")

To trigger manually (for testing or scripting):
  echo "Review: [topic]" > [PROJ_PATH]/.board/board/inbox/request.md
  cd [PROJ_PATH]/.board && claude --dangerously-skip-permissions -p "read CLAUDE.md then /run"
```

**3. Tell the user explicitly what was done and how to use it** — always do this, regardless of which path (A/B/C) was taken:

> I've added FrontierBoard integration to your project's Claude.
>
> **What I created:** `.claude/skills/{skill-name}/SKILL.md`
>
> **How to use it:** Open Claude Code from your project directory (`{PROJ_PATH}`) and say something like:
> - "Review the code in `src/auth.ts`"
> - "Get a second opinion on this architecture decision"
> - "/{skill-name}" to trigger it explicitly
>
> Claude will run the board, wait for the agents to finish, and summarise the findings for you. The whole process takes 2–5 minutes depending on what's being reviewed.
>
> **The skill file is safe to commit** — it contains no credentials, just instructions. Anyone who clones your repo gets the board integration working immediately.

If the skill was renamed to `frontierboard-review` (path C), add:

> Note: I used the name `frontierboard-review` instead of `board-review` because your project already has a `board-review` skill for something else. Use `/frontierboard-review` to trigger it explicitly, or just describe what you want reviewed in plain language.

**If `standalone`:**

The user invokes the board directly from the `.board/` directory. Add to `BOARD.md`:

```markdown
## Running a Review

From the .board/ directory:
  cd [PROJ_PATH]/.board
  claude --dangerously-skip-permissions -p "review [topic]"

Or use /brief to set context first, then /run.
```

---

## Step 9: Update .gitignore

**Important: append only. Never modify or delete existing lines.**

Check what's already in `.gitignore` first:

```bash
cat "$PROJ/.gitignore" 2>/dev/null
```

Then append only the FrontierBoard entries that aren't already present. Use `grep` to check before appending each line. Create the file if it doesn't exist.

```bash
GITIGNORE="$PROJ/.gitignore"
touch "$GITIGNORE"
add_if_missing() {
  grep -qxF "$1" "$GITIGNORE" || echo "$1" >> "$GITIGNORE"
}
# Add section header only if no FB entries exist yet
grep -q "FrontierBoard" "$GITIGNORE" || echo "" >> "$GITIGNORE" && echo "# FrontierBoard" >> "$GITIGNORE"
add_if_missing ".board/board/*/contexts/"
add_if_missing ".board/board/*/inbox/"
add_if_missing ".board/board/*/outbox/"
add_if_missing ".board/board/BOARD.md"
add_if_missing ".board/board/REVIEW-LOG.md"
add_if_missing ".board/bridge/"
```

Do not add `.env` or `.env.*` — those belong to the project, not to FrontierBoard.

What should be committed (defines board structure, contains no credentials):
- `$PROJ/.board/CLAUDE.md`
- `$PROJ/.board/board/{agent}/CLAUDE.md` for each agent
- `$PROJ/.board/board/{agent}/.claude/settings.json` (or equivalent) for each agent
- `$PROJ/.board/.claude/skills/` — the board's own skills
- `$PROJ/.claude/skills/board-review/` — the integration skill that tells the host project's Claude about the board
- `$PROJ/container/skills/board-review/` — if NanoClaw integration was added

These files contain no credentials and are safe to commit. They're what defines the integration — if someone clones the repo, they get a working board setup out of the box (minus credentials, which they provide during their own setup run).

---

## Step 10: Smoke Test

Run a quick test to confirm the board actually works.

Write a minimal test brief — one sentence asking each agent to confirm their identity, confirm they can write to their outbox, and report back with a score of 10/10.

Copy it to every agent's inbox. Run each agent from their own directory inside `$PROJ/.board/`. Check that a report appears in each agent's outbox.

If any agent fails, diagnose from the error output and fix it before declaring setup complete. Common causes: auth not copied to board user, settings bubble in wrong location, CLI not recognising its flags.

Don't tell the user it worked until you've confirmed every agent produced a report.

---

## Step 11: Done

Tell the user their board is ready. Name each agent, their CLI, and their role in plain language. Show them the project path and board path (`$PROJ/.board/`).

Then give concrete next steps that match the integration mode detected in Step 1. Do not give generic instructions — be specific about how this user's board gets triggered.

**If `nanoclaw`:**

> Your board is ready and wired into NanoClaw.
>
> To request a review, just message NanoClaw the way you normally would:
> - "Review the code I just pushed to src/auth.ts"
> - "Get a second opinion on this architecture decision: [describe it]"
> - "Run the board on everything in the payments module"
>
> NanoClaw will pass it to the board, the agents will work independently, and NanoClaw will send you back the synthesis. You don't interact with FrontierBoard directly — it all happens in the background.
>
> To set detailed context before a review (recommended for complex or unfamiliar topics), say "brief the board on [topic]" to NanoClaw first.

**If `claude-project`:**

> Your board is ready. To trigger a review from any Claude session in this project:
>
> Type `/board-review` or describe what you want reviewed. I'll write the brief and run the board.
>
> You can also trigger it directly from the command line — see the "Project Bridge" section in `.board/board/BOARD.md`.

**If `standalone`:**

> Your board is ready. To run a review:
>
> 1. Open a terminal and: `cd [PROJ_PATH]/.board`
> 2. Run: `claude` (or `claude --dangerously-skip-permissions` for autonomous mode)
> 3. Describe what you want reviewed, or type `/brief` to set context first, then `/run`
>
> The synthesis will appear in `.board/board/REVIEW-LOG.md`.

Always end with:

> What would you like the board to look at first?
