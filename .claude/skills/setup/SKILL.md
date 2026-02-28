---
name: setup
description: Set up the Board of Governance. Run when the user types /setup or asks to set up, install, or configure the board for the first time.
---

# Board of Governance — Setup

Walk the user through setting up their board from scratch. This is a conversation, not a script. Ask questions, listen to answers, do the work. Only pause when you genuinely need the user to do something — paste a key, scan a QR code, open a browser.

When something is missing or broken, fix it. Don't tell the user to go fix it themselves unless it truly requires their hands.

---

## Step 1: Welcome and Orient

Introduce what's about to happen:

> Welcome to Board of Governance setup. I'm going to ask you a few questions, then build your board from scratch — agents, identities, settings, the works. It takes about 10 minutes. You'll have a working board at the end that you can point at anything.

---

## Step 2: Check for Root

Check whether the current user is root.

If they are running as root, explain clearly:

> You're running as root. The board CLIs — Claude Code, Codex, Qwen and others — refuse to run in full-auto mode as root. It's a safety check baked into the CLIs themselves. We need to create a dedicated non-root user to run the board agents.
>
> What would you like to call this user? (The default is `llmuser`)

Create the user with a home directory and bash shell. Configure sudoers so the current user can run commands as the board user without a password prompt. Note the board user name — all agent invocation commands will use it.

If they are not root, no board user is needed. Note that agents will run as the current user.

---

## Step 3: Establish Project Context

Ask explicitly — do not try to detect:

> What is the name of this project? And what is the full path to the project root — the folder where this board will live?

Confirm back what you heard before continuing.

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

If a board user was created in Step 2, copy the relevant credential files from the current user's home directory into the board user's home directory for each provider being used. The board user needs to be able to authenticate when it runs the CLIs.

---

## Step 7: Build the Agents

For each agent the user described in Step 5, create their directory and everything in it.

**Directory structure for each agent:**

Create the agent directory inside `board/`. The name should reflect the agent's role — lowercase, hyphens, no spaces. For example: `board/skeptic/`, `board/systems-thinker/`, `board/devil-s-advocate/`.

Inside each agent directory, create:
- An inbox folder
- An outbox folder  
- A learnings folder
- A settings bubble for their CLI (see below)
- A CLAUDE.md that defines who they are
- A contexts folder (gitignored — generated content lives here)

**Settings bubble:**

This is the most important structural detail. Each agent directory gets a settings file for their specific CLI. When that CLI runs from this directory, it finds this file first and stops walking up the tree. The agent's behaviour is fully isolated.

For a Claude agent, create a `.claude` folder containing a `settings.json` that allows all tools without prompting and sets the model. Do not put credentials here — only behaviour settings.

For a Codex agent, create a `.codex` folder containing a `config.toml` that sets approval policy to never and loads CLAUDE.md as the project context document. Include a brief developer instructions block pointing to CLAUDE.md for full SOPs.

For a Qwen agent, create a `.qwen` folder containing a `settings.json` that sets yolo mode and loads CLAUDE.md as the context file.

For other CLIs, ask the user where that CLI looks for a local settings file, then create it with the equivalent of "full auto, no prompts."

**CLAUDE.md for each agent:**

Write this from the user's description of the agent's role and angle. This is the agent's identity — stable across all reviews, all domains.

It should cover:
- Who they are and what their angle is on any question put before them
- How they think — their reasoning style, what they always look for, what they tend to challenge
- Their output format — structured findings with severity, file or section reference, description, and recommended action
- Their rules — write report first, blind review (no reading other reports before writing their own), no coordination with other agents

Make it specific to what the user described. A skeptic should sound different from an optimist. A risk officer should ask different questions than a systems thinker. Write the identity from the description — don't use a generic template.

**Contexts:**

Based on the domain the user chose in Step 4, write context files for each agent.

A context file goes in `board/{agent}/contexts/{domain}.md`. It tells the agent what lens to apply for this type of question — what to look for, what questions to ask, what a good finding looks like in this domain.

If the user chose a specific domain (software, business, HR, finance), write one context per agent for that domain.

If the user chose "mix of everything," write three contexts per agent: software, business, and general-purpose.

The context files are gitignored. They live locally. The user can generate new ones any time with `/brief`.

---

## Step 8: Write BOARD.md

Create `board/BOARD.md`. This is the source of truth for the board — written by you, read by you in future sessions.

It should contain:
- The project name and path
- The board user if one was created (otherwise the current user)
- For each agent: their name, their directory, their CLI, their model, their role description, and the exact command to invoke them for a review
- The parallelism pattern — how to run multiple agents at once and wait for all of them
- A note on settings isolation — confirming each agent has their own settings bubble

Write the invocation commands using the board user if one exists (`sudo -n -u boarduser -- ...`), otherwise the current user. Include the correct flags for full-auto unattended operation for each CLI.

---

## Step 9: Update .gitignore

Add to the project's `.gitignore` (create it if it doesn't exist):

- All agent context files (the contexts folders)
- All inbox contents (review briefs)
- All outbox contents (review reports)
- The BOARD.md file (contains local paths)
- The REVIEW-LOG.md file
- Any .env files

The settings bubbles, agent CLAUDE.md files, and skill files should be committed — they contain no credentials and define the board's structure.

---

## Step 10: Smoke Test

Run a quick test to confirm the board actually works.

Write a minimal test brief — one sentence asking each agent to confirm their identity, confirm they can write to their outbox, and report back with a score of 10/10.

Copy it to every agent's inbox. Run each agent from their own directory. Check that a report appears in each agent's outbox.

If any agent fails, diagnose from the error output and fix it before declaring setup complete. Common causes: auth not copied to board user, settings bubble in wrong location, CLI not recognising its flags.

Don't tell the user it worked until you've confirmed every agent produced a report.

---

## Step 11: Done

Tell the user their board is ready. Name each agent, their CLI, and their role. Show them the project path and board path.

Then offer:

> Do you need help setting up any CLIs you didn't configure today, or would you like to add more agents? Type `/new-agent` any time to add one. 
>
> To run your first real review, just tell me what you want the board to look at — or type `/brief` to set the context explicitly first.
