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

Ask:

> Do you want any of your board agents to run autonomously — meaning they execute without you having to approve each action? This is what makes reviews run unattended in the background while you work on something else.
>
> If yes, there are a few things to sort out depending on your setup. If no, agents will pause and ask for approval at each step — slower, but you stay in control of every action.

If they say no — note that agents will run in interactive mode and move on. No user setup needed.

If they say yes — check whether the current user is root.

If they are not root, autonomous mode will work as-is. Note it and move on.

If they are root, explain:

> There's one thing to sort out first. The frontier CLIs — Claude Code, Codex, Qwen and others — have a safety check baked in that prevents them from running autonomously as root. It's not a FrontierBoard limitation, it's the CLIs protecting you from a fully autonomous process with root-level access to your entire system.
>
> The fix is a dedicated board user — a non-root account the agents run as. Your credentials stay on your main account and get copied across. Takes about 2 minutes to set up.
>
> What would you like to call this user? The default is `llmuser`.

Create the user with a home directory and bash shell. Configure sudoers so the current user can run commands as the board user without a password prompt. Note the board user name — all agent invocation commands will use it.

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

For each agent, also ask:

> Which CLI would you like this agent to use — Claude, Codex, Qwen, or something else?

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
Check if Claude Code is installed. If not, tell the user the install command and ask them to run it, then confirm. For authentication, ask whether they have a Claude subscription or an API key. For subscription, walk them through running the auth command and completing the browser flow. For API key, ask them to paste it and store it securely in their environment.

**Codex:**
Check if the Codex CLI is installed. If not, direct them to the Codex GitHub repo for the current install command — package names change and you don't want to give them a stale one. For authentication, they need an OpenAI API key. Ask them to paste it. Store it in their environment or shell profile.

**Qwen:**
Check if the Qwen CLI is installed. If not, direct them to the Qwen Code GitHub repo for the current install command. For authentication, they need a DashScope API key from the Bailian Coding Plan. Walk them through where to get it and how to store it.

**Other providers:**
If the user wants a CLI you don't recognise, ask them what CLI it uses, how it authenticates, and what its settings file format is. Adapt the setup accordingly.

**Auth and settings are separate — explain this once:**

> Just so you know — your credentials (API keys, OAuth tokens) live globally in your home directory. That's standard for all these CLIs and it only needs to happen once per machine. Each agent will have its own local settings file that controls how it behaves — that's separate from auth. So if you have three Codex agents, they all share one set of credentials but each has its own behaviour config.

If a board user was created in Step 3, copy the relevant credential files from the current user's home directory into the board user's home directory for each provider being used. The board user needs to be able to authenticate when it runs the CLIs.

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

Tell the user their board is ready. Name each agent, their CLI, and their role. Show them the project path and board path (`$PROJ/.board/`).

Then offer:

> To run your first real review, tell me what you want the board to look at — or type `/brief` to set the context explicitly first.
>
> From your project Claude session, you can also request a board review directly — I've written the bridge pattern into BOARD.md.
