# FrontierBoard

**A governance board composed of frontier model agents, dropped into any project, pointed at anything.**

Read this repo in under 5 minutes. No code to run. No dependencies to install beyond the CLIs you already use. Just Claude Code and 7 files — and a board that reviews anything you put in front of it.

---

## What It Is

FrontierBoard gives any project an independent review board made of AI agents. Each agent is a frontier model CLI — Claude, Codex, Qwen, or any other — running in its own isolated directory with its own settings. They don't coordinate. They review independently. They write their reports and you synthesise the findings.

The board has no fixed domain. Point it at code, architecture, a business decision, a candidate, a financial model. Describe what you need, Claude builds the board for your situation, and the agents get to work.

---

## Getting Started

You need Claude Code. Everything else gets sorted during setup.

```bash
git clone https://github.com/your-org/frontierboard
cd frontierboard
claude
```

Type `/setup`.

Claude will interview you — what CLIs you have, how many agents you want, what role and personality each one plays. It builds the board from your answers, handles any CLI installation and authentication, and runs a smoke test to confirm every agent is working before it hands control back to you.

The whole thing takes about 10 minutes. You end up with a working board tailored to your situation — not a generic template.

---

## Adding to an Existing Project

```bash
cp -r frontierboard/board ./board
cp -r frontierboard/.claude ./.claude
claude
```

Type `/setup`.

---

## Daily Use

Plain language. Tell Claude what you want reviewed:

> "Have the board look at this pricing proposal"
> "Run the board on the new auth module"
> "Board review — here's the candidate brief from today's interview"

Claude detects the domain, briefs the agents, runs them in parallel, and synthesises the findings. Or use `/brief` to set context explicitly, `/run` to execute, `/new-agent` to add a new perspective to the board.

---

## How the Isolation Works

Each agent lives in its own directory. That directory contains a settings file for that agent's CLI. When the CLI starts, it finds that local settings file first — and stops walking up the tree. Your project's root config, your interactive Claude session, your other agents — none of it bleeds through. Each agent is a completely sealed environment.

This also solves the full-auto permissions problem. Running frontier CLIs in unattended mode as root is blocked by the CLIs themselves — a safety check baked in. `/setup` detects this and creates a dedicated board user if needed. Auth lives globally. Behaviour lives locally in each agent's settings bubble.

---

## What Gets Committed vs What Lives Locally

The repo contains only the seed — skill files and an empty board directory. Everything generated during setup lives locally and is gitignored forever:

- Agent directories and their settings bubbles
- Agent identities (their CLAUDE.md files)
- Domain contexts (how each agent approaches software vs business vs finance)
- Review briefs and reports
- The review log

The repo stays minimal. Your board is yours.

---

## The Skills

| Command | What it does |
|---------|-------------|
| `/setup` | Builds your board from scratch — interactive, conversational, no assumptions |
| `/new-agent` | Adds a new agent — same conversational flow, handles CLI setup if needed |
| `/brief` | Sets context for an upcoming review — detects domain, writes or activates context, populates inboxes |
| `/run` | Runs all agents in parallel, collects reports, synthesises findings |

Plain language always works. The slash commands are shortcuts.

---

## Philosophy

FrontierBoard is built on a philosophy pioneered by **Gavriel** and the contributors of [NanoClaw](https://github.com/qwibitai/NanoClaw):

> *Small enough to understand. AI-native. Claude Code is the installer, the runtime, and the operator.*

NanoClaw proved something important: you don't need a framework, a wizard, or a dependency tree. You need a markdown file with clear instructions and Claude to read it. No installation scripts. No configuration sprawl. No code that runs before you trust it. Just Claude reading a skill file and doing the work — asking questions, fixing problems, building things from your answers.

FrontierBoard takes that philosophy and applies it to a different problem: not a personal AI assistant, but a governance board. Independent agents. Independent perspectives. Independent reports. A system designed to find what one model misses, to surface disagreement, to give you signal you can trust because no single model produced it alone.

The board is lawyers without a courtroom. It has no opinions about what you're reviewing. You bring the question. The board brings the perspectives.

---

## Requirements

- [Claude Code](https://code.claude.com) — required, this is how you interact with the board
- Frontier model CLIs — installed during `/setup` as needed:
  - `claude` — Claude Code CLI (Anthropic)
  - `codex` — Codex CLI (OpenAI) — see [github.com/openai/codex](https://github.com/openai/codex)
  - `qwen` — Qwen Code CLI (Alibaba) — see [github.com/QwenLM/qwen-code](https://github.com/QwenLM/qwen-code)
  - Any other frontier CLI that supports a local settings file

---

## Tribute

FrontierBoard would not exist without the work of **Gavriel** ([qwibitai](https://github.com/qwibitai)) and the NanoClaw contributors — Vaibhav Aggarwal, Skip Potter, Rafael Garcia, Lingfeng Guan, and others.

NanoClaw demonstrated that a codebase small enough to read in 8 minutes, with Claude Code as the installer and runtime, is not just viable — it is the better way to build software meant to be trusted, understood, and extended. That insight is the foundation this project stands on.

If you haven't read NanoClaw, [read it](https://github.com/qwibitai/NanoClaw). It will change how you think about what a software project can be.

---

*MIT License*
