---
name: setup
description: Set up the Board of Governance. Run when the user types /setup or asks to set up, install, or configure the board for the first time.
---

# Board of Governance — Setup

Walk the user through setting up their board from scratch. This is a conversation, not a script. Ask questions, listen to answers, do the work. Only pause when you genuinely need the user to do something — paste a key, scan a QR code, open a browser.

When something is missing or broken, fix it. Don't tell the user to go fix it themselves unless it truly requires their hands.

---

## Step 1: Welcome and Get the Project Path

Introduce what's about to happen, then ask for the project path immediately:

> Welcome to Board of Governance setup. Before anything else — what's the path to the project this board will review? (e.g. `~/projects/my-app`)
>
> If you haven't created the directory yet, tell me where you want it and I'll create it.

Once you have the path, expand it to an absolute path and verify it exists:

```bash
PROJ=$(eval echo [path])
ls "$PROJ" 2>/dev/null && echo "exists" || echo "missing"
```

If missing, create it:
```bash
mkdir -p "$PROJ"
```

Note the absolute project path. Every subsequent file operation targets this path. The board will live at `$PROJ/.board/`.

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

If they pick 1–4, note the primary domain. You will write one context per agent for this domain during agent setup.

If they pick 5, tell them:

> No problem. I'll write three starter contexts for each agent — software, business, and a general-purpose one — so you have something to work with immediately. You can generate new contexts any time by describing what you want to review.

Note: write three contexts per agent later in Step 7.

---

## Step 5: Compose the Board

Before asking how many agents, briefly explain what an agent is in this context — especially if the user seems unfamiliar with AI tooling:

> Each board member is an AI agent — an independent AI that reviews your work and writes a report. They all see the same thing, but write their findings separately, so you get genuinely different perspectives rather than one consensus view.

Ask:

> How many agents do you want on your board? Two is the minimum for independent perspectives. Three gives you a tiebreaker. More than four gets noisy.

Then for each agent, ask in plain language:

> Tell me about agent [number]. What's their role on the board — and what's their angle? You can describe them however feels natural. For example: "a rigorous skeptic who always looks for what's missing" or "a systems thinker who traces second-order consequences" or "a devil's advocate who challenges every assumption."

If the user isn't sure, offer a few patterns to spark ideas:

> Some common board compositions:
> - Skeptic + Optimist + Pragmatist
> - Architect + Challenger + Risk Officer
> - Strategist + Operator + Devil's Advocate
> - Domain Expert + Generalist + Contrarian
>
> Or describe something completely different — I'll write the role from your description.

For each agent, also ask which CLI they should use. Explain the choice before asking:

> Each agent needs an AI tool to run on. A CLI (command-line interface) is just a program you run from the terminal — like Claude Code, Codex, or Qwen. They're made by different AI companies and each has slightly different strengths. I'll handle all the terminal commands; you just need to tell me which one you want.
>
> Which would you like for this agent — Claude (by Anthropic), Codex (by OpenAI), Qwen (by Alibaba), or something else?

If the user isn't sure which to pick, suggest Claude Code as a default and briefly explain: "Claude Code is a good default if you already use Claude. If you have an OpenAI subscription or API key, Codex is a natural fit. Qwen has a generous free tier if you're just getting started."

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

If subscription: run `claude --dangerously-skip-permissions -p "echo hello"` and direct them to complete the browser flow.
If API key: ask them to paste it and store it in their shell profile or the board user's environment.

**Codex:**

Check if the Codex CLI is installed (`which codex`). If not:

> I'll help you install Codex — OpenAI's command-line tool for running their models.
>
> You'll need an OpenAI account and an API key. If you don't have one:
> 1. Go to platform.openai.com and sign up (or sign in)
> 2. Click your profile → API Keys → Create new secret key
> 3. Copy the key — you'll only see it once
>
> Once you have the key, I'll install Codex and configure it. Paste your OpenAI API key when you're ready.

Direct them to the Codex GitHub repo for the current install command — don't hardcode a package name here as it can change. Once installed, store their API key in the environment.

**Qwen:**

Check if the Qwen CLI is installed. If not:

> I'll help you install Qwen Code — Alibaba's command-line AI tool. It has a free tier, which makes it a good option if you're just getting started.
>
> You'll need a DashScope API key from Alibaba's Bailian platform:
> 1. Go to bailian.console.aliyun.com and sign up (free)
> 2. Look for the "Bailian Coding Plan" — this gives you free API quota
> 3. Under API Keys, create a new key and copy it
>
> Paste your DashScope API key here when you're ready, and I'll handle the install and configuration.

Direct them to the Qwen Code GitHub repo for the current install command.

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

Write this from the user's description of the agent's role and angle, combined with what you learned about the project in Step 2. This is the agent's identity — stable across all reviews.

It should cover:
- Who they are and what their angle is on any question put before them
- How they think — their reasoning style, what they always look for, what they tend to challenge
- The project context: what they know they're reviewing (use what you read in Step 2)
- Their output format — structured findings with severity, file or section reference, description, and recommended action
- Their rules — write report first, blind review (no reading other reports before writing their own), no coordination with other agents

Make it specific to what the user described and what the project is. A skeptic reviewing a fintech API should sound different from a skeptic reviewing a marketing strategy.

**Contexts:**

Based on the domain the user chose in Step 4, write context files for each agent. Use the project knowledge from Step 2 to make these specific — not generic.

A context file goes in `$PROJ/.board/board/{agent}/contexts/{domain}.md`. It tells the agent what lens to apply for this type of question — what to look for, what questions to ask, what a good finding looks like in this domain.

If the user chose a specific domain (software, business, HR, finance), write one context per agent for that domain.

If the user chose "mix of everything," write three contexts per agent: software, business, and general-purpose.

The context files are gitignored. They live locally. The user can generate new ones any time with `/brief`.

---

## Step 8: Write Board Identity Files

**`$PROJ/.board/CLAUDE.md`**

This is the board orchestrator's identity. Write it now:

```markdown
# Board of Governance

You are the Board of Governance orchestrator for [project name].

## Project

Path: [absolute project path]
Stack: [what you found in Step 2, or "not yet determined"]
What it is: [one sentence from README/CLAUDE.md, or "project is in early setup"]

## Your Role

Coordinate the board agents. Run briefs, collect reports, synthesise findings. You do not review work yourself — your agents do. Your job is to run them well and give the user a clear synthesis they can act on.

## Agents

[For each agent: name, directory, CLI, role in one sentence]

## Running a Review

To run all agents: see BOARD.md for invocation commands and parallelism pattern.
To add an agent: /new-agent
To set a review brief: /brief
To run the board: /run
```

**`$PROJ/.board/board/BOARD.md`**

This is the operational source of truth. Write it with:
- The project name and absolute path
- Whether agents run autonomously or interactively
- The board user if one was created (otherwise the current user)
- For each agent: name, directory, CLI, model, role description, and the exact command to invoke them
- The parallelism pattern — how to run all agents in parallel and wait for completion
- The bridge pattern — how project Claude can request a board review:

```markdown
## Project Bridge

To request a review from a project Claude session:
1. Write a brief to `$PROJ/.board/board/inbox/[topic].md`
2. Run: `cd $PROJ/.board && claude --dangerously-skip-permissions -p "read CLAUDE.md then /run"`
3. Board runs all agents, writes synthesis to `$PROJ/.board/board/REVIEW-LOG.md`
4. Read synthesis from the review log
```

---

## Step 9: Update .gitignore

Add to `$PROJ/.gitignore` (create it if it doesn't exist):

```
# FrontierBoard
.board/board/*/contexts/
.board/board/*/inbox/
.board/board/*/outbox/
.board/board/BOARD.md
.board/board/REVIEW-LOG.md
.env
.env.*
```

The settings bubbles, agent CLAUDE.md files, and board skill files should be committed — they define the board's structure and contain no credentials.

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

Then give them concrete next steps — don't leave them wondering what to type:

> Your board is ready. Here's how to use it:
>
> **To start a review right now**, just describe what you want looked at:
> - "Board, review the code I just wrote in `src/auth.ts`"
> - "Board, look at this architecture decision: [paste your question]"
> - "Board, review everything in `src/` for quality issues"
>
> **To set detailed context first** (recommended for complex reviews), type `/brief` — I'll ask you a few questions about what you want the board to focus on, then run it.
>
> **From your project's own Claude session**, you can also request a board review directly. The command is in BOARD.md — look for the "Project Bridge" section.
>
> What would you like the board to look at first?
