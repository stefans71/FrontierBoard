<div align="center">

# FrontierBoard

![FrontierBoard — Lawyers without a courtroom](assets/banner.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-black?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude_Code-required-orange?style=flat-square&logo=anthropic)](https://claude.ai/code)
[![Skills](https://img.shields.io/badge/Skills-6-blue?style=flat-square)](#the-skills)
[![Models](https://img.shields.io/badge/Multi--Model-Claude_·_Codex_·_Qwen-purple?style=flat-square)](#requirements)
[![Version](https://img.shields.io/badge/Version-2.0-brightgreen?style=flat-square)](https://github.com/stefans71/FrontierBoard/discussions)

**A governance board of frontier model agents — independent, parallel, ruthlessly honest.**

*Your Claude sets it up. Your Claude runs it. FrontierBoard is just the instructions it reads.*

---

[Get Started](#getting-started) · [Three Ways to Use It](#three-ways-to-use-frontierboard) · [How It Works](#how-it-works) · [The Skills](#the-skills) · [Philosophy](#philosophy)

</div>

---

## What It Is

FrontierBoard gives any project an independent review board made of AI agents. Each agent is a frontier model CLI — Claude, Codex, Qwen, or any other — running in its own isolated directory with its own settings. They don't coordinate. They don't see each other's work. They review independently, write their reports, and your Claude synthesises the findings.

Point it at code, architecture, a business decision, a hiring brief, a financial model. The board has no fixed domain. You bring the question. The board brings the perspectives.

---

## Getting Started

You need [Claude Code](https://claude.ai/code). That's it.

```bash
git clone https://github.com/stefans71/FrontierBoard
cd FrontierBoard
claude
```

Then tell Claude what you want to do:

| You say | What happens |
|---------|-------------|
| `/project-init` | **New or existing project.** Claude asks the project name and path, creates the folder if needed, writes the filing cabinet, and optionally adds a review board. |
| `/setup` | **Board only.** Claude asks which project to attach to, reads it, interviews you about agents, and builds the board. |
| `/review-release` | **Review a GitHub repo.** No project needed. Claude asks for the repo, fetches it via GitHub API, and runs the board against it. |

Claude handles all directory creation. You don't need to think about where things go — Claude will create your project folder and a board folder (named `your-project-board/`) as siblings, keeping settings isolated. At the end of setup, Claude tells you exactly where to go next:

> *Your board is ready at `~/myproject-board/`. To start a session: `cd ~/myproject-board && claude`*

---

## Three Ways to Use FrontierBoard

### `/project-init` — Filing cabinet + board *(recommended for new projects)*

> *An improvising Claude, left alone in a new codebase, produces the kind of file structure that looks like a 5-year-old was left unsupervised in your office for an hour.*

Claude interviews you and builds the four files that keep it sane across every session:

| File | What it does |
|------|-------------|
| `.claude/settings.json` | Guardrails before anything runs. Deny list tailored to your stack. |
| `CLAUDE.md` | Under 150 lines. Identity, not a knowledge dump. |
| `SPEC.md` | Architecture from the interview — not a template. |
| `tasks.md` | Survives compaction. Phase boundaries. Keeps your project from losing its place. |

Works for new and existing projects. For existing projects it scans first, confirms what it found, and only fills in what's missing. Optionally wires in the review board at the end.

---

### `/setup` — Just the board

Already have your project set up? Claude interviews you about your review needs, reads the project, builds the agents, and installs the board. Everything is conversational — Claude asks the questions, you answer, Claude does the work.

---

### `/review-release` — Review any GitHub repo

Don't have a project at all? Just want to review someone else's code before installing it, or find bugs to contribute? This works standalone — no project folder needed. Three review modes:

- **Mode A** — Static release review: find bugs and improvements in a diff
- **Mode B** — Safety review: is this repo safe to install?
- **Mode C** — Full build review: clone it, install it, capture what breaks

---

## How It Works

```mermaid
graph TD
    A[you + claude] -->|/project-init or /setup| B[your Claude interviews you]
    B --> C[filing cabinet written to your project]
    B --> D[board agents configured]
    D --> E[skeptic · optimist · risk officer · ...]
    E -->|run in parallel, no coordination| F[independent reports]
    F --> G[your Claude synthesises findings]
    G --> H[you get signal you can trust]
```

Each agent runs from its own directory. That directory contains a settings file for that agent's CLI. When the CLI starts, it finds that local settings file first — and stops walking up the tree. Your project config, your interactive session, your other agents — none of it bleeds through.

Your project Claude can request a board review without you opening a second terminal. It writes a brief, shells out, the agents run in parallel, and it reads the synthesis back to you.

---

## The Skills

| Command | What your Claude does |
|---------|----------------------|
| `/project-init` | Interviews you · writes the filing cabinet · optionally wires in the board · works for new and existing projects |
| `/setup` | Builds your board from scratch — reads your project, sets up agents, handles CLI auth |
| `/brief` | Sets context for a review — detects domain, writes or activates context, populates inboxes |
| `/run` | Runs all agents in parallel · collects reports · synthesises findings |
| `/review-release` | Reviews a GitHub repo or release — static analysis, safety verdict, or full build monitoring |
| `/new-agent` | Adds a new agent to the board — same conversational flow |

Plain language always works. The slash commands are shortcuts.

---

## What Gets Committed vs What Lives Locally

The repo contains only the seed — skill files and an empty board directory. Everything generated lives locally and is gitignored:

- Agent directories and their settings bubbles
- Agent identities and domain contexts
- Review briefs, reports, and the review log
- Your filing cabinet (`SPEC.md`, `tasks.md`, `settings.json`)

The repo stays minimal. Your board is yours.

---

## Requirements

- **[Claude Code](https://claude.ai/code)** — required. This is how you interact with the board.
- **Frontier model CLIs** — installed by your Claude during `/setup` as needed:
  - `claude` — Claude Code (Anthropic)
  - `codex` — Codex CLI (OpenAI) · [github.com/openai/codex](https://github.com/openai/codex)
  - `qwen` — Qwen Code (Alibaba) · [github.com/QwenLM/qwen-code](https://github.com/QwenLM/qwen-code)
  - Any other frontier CLI that supports a local settings file

---

## Philosophy

FrontierBoard is built on a philosophy pioneered by **Gavriel** and the contributors of [NanoClaw](https://github.com/qwibitai/NanoClaw):

> *Small enough to understand. AI-native. Claude Code is the installer, the runtime, and the operator.*

No framework. No wizard. No dependency tree. No code that runs before you trust it. Just your Claude reading a skill file and doing the work — asking questions, fixing problems, building things from your answers.

FrontierBoard applies that to a governance problem: independent agents, independent perspectives, independent reports. A system designed to find what one model misses, to surface disagreement, to give you signal you can trust because no single model produced it alone.

**The board is lawyers without a courtroom.** It has no opinions about what you're reviewing. You bring the question. The board brings the perspectives.

---

## Tribute

FrontierBoard would not exist without **Gavriel** ([qwibitai](https://github.com/qwibitai)) and the NanoClaw contributors — Vaibhav Aggarwal, Skip Potter, Rafael Garcia, Lingfeng Guan, and others.

If you haven't read NanoClaw, [read it](https://github.com/qwibitai/NanoClaw). It will change how you think about what a software project can be.

---

<div align="center">

*MIT License · [Discussions](https://github.com/stefans71/FrontierBoard/discussions) · [Report an Issue](https://github.com/stefans71/FrontierBoard/issues)*

</div>
