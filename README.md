<div align="center">

# FrontierBoard

![FrontierBoard — Lawyers without a courtroom](assets/board.png)

![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Claude Code](https://img.shields.io/badge/Claude_Code-required-orange?style=for-the-badge&logo=anthropic)
![Skills](https://img.shields.io/badge/Skills-10-green?style=for-the-badge)
![Multi-Model](https://img.shields.io/badge/Multi--Model-any_frontier_CLI-purple?style=for-the-badge)
![GitHub stars](https://img.shields.io/github/stars/stefans71/FrontierBoard?style=for-the-badge)

<br>

**Independent AI agents review your work in parallel.<br>None of them see what the others wrote.<br>Your Claude tells you what they agree on — and where they don't.**

<br>

*Your Claude sets it up. Your Claude runs it. FrontierBoard is just the instructions it reads.*

<br>

[30-Second Install](#-getting-started) · [See It Work](#-what-you-get) · [How It Works](#-how-it-works) · [The Skills](#-the-skills)

---

> **This project was reviewed by its own board** — three agents found 10 critical issues across credential handling, container isolation, and review process integrity. All fixed. [See the review.](docs/tasks/FB-000-oauth-credential-fix.yaml)

</div>

<br>

## 🤔 Why

One model reviewing your code catches some things.

The same model reviewing it three times catches **similar things three times**.

Three *different* models — each with a different thinking style, running independently, unable to see each other's work — catch **different things**.

Disagreements are signal, not noise.

> *You pick which models sit on your board. You pick how many.<br>You bring the question. The board brings the perspectives.*

<br>

---

<br>

## 🎯 What You Get

Real output from a board review of FrontierBoard's own credential proxy:

```mermaid
graph LR
    subgraph "🔍 Round 1 — Blind Review"
        S["Skeptic<br/>(Claude Opus)"]
        P["Pragmatist<br/>(Claude Opus)"]
        T["Systems Thinker<br/>(Codex)"]
    end

    subgraph "📊 Round 2 — Consolidated Findings"
        C1["🔴 C1: Add ripgrep to image<br/>3/3 agree · FIX NOW"]
        C4["🔴 C4: Auth cleanup on crash<br/>3/3 agree · FIX NOW"]
        C6["🔴 C6: Token expires mid-review<br/>2/3 agree · FIX NOW"]
        C8["🔴 C8: Proxy idle timeout<br/>3/3 agree · FIX NOW"]
        D1["🟡 D1: Proxy health detection<br/>DEFER · trigger: next proxy change"]
        I1["🔵 I1: Exit code propagation<br/>INFO · no action needed"]
    end

    S --> C1
    S --> C6
    P --> C4
    P --> C8
    T --> D1
    T --> I1

    subgraph "✅ Round 4 — Sign Off"
        V["2 SIGN OFF + 1 BLOCK<br/>(resolved — owner override)"]
    end

    C1 --> V
    C4 --> V
    C6 --> V
    C8 --> V
```

<br>

**10 findings. 6 FIX NOW. 2 DEFER. 2 INFO.** All implemented, smoke-tested, and shipped.

Each finding has a severity, agent consensus, and a concrete fix. Agents that disagree get deliberation rounds. The whole process follows a [4-round SOP](docs/REVIEW-SOP.md).

<br>

**Just describe what you want reviewed — Claude handles the rest:**

```
You: "Review the credential proxy changes"

Claude: [writes brief, runs 3 agents in parallel Docker containers]

Claude: "3 agents found 10 issues. 6 are FIX NOW (all agree),
         2 are DEFER (with triggers), 2 are INFO."

You: "Fix the FIX NOW items"

Claude: [implements fixes, sends diff back to the board for code review]
```

No special commands needed. Plain language always works. Slash commands are shortcuts.

<br>

---

<br>

## 🚀 Getting Started

You need [Claude Code](https://claude.ai/code). That's it.

Open Claude Code and say:

```
Set up FrontierBoard: https://github.com/stefans71/FrontierBoard/blob/main/docs/INSTALL.md
```

Claude reads the install instructions and walks you through everything:

| Option | What happens |
|--------|-------------|
| **New project** | Creates the folder, interviews you, sets up a filing cabinet + review board |
| **Existing project** | Reads your project, builds the board as a neighbor directory |
| **Review a GitHub repo** | No project needed — static analysis, safety verdict, or full build review |
| **Global install** | Install once at `~/.frontierboard/`, review any project from anywhere |

You never clone anything yourself. Claude handles it.

<br>

---

<br>

## ⚙️ How It Works

```mermaid
graph TD
    A["🧑‍💻 You + Claude"] -->|describe what to review| B["📝 Claude writes a brief"]
    B --> C["📬 Brief goes to each agent's inbox"]
    C --> D["🔍 Skeptic<br/>blind review"]
    C --> E["⚙️ Pragmatist<br/>blind review"]
    C --> F["🔗 Systems Thinker<br/>blind review"]
    D --> G["📊 Round 2: Consolidation<br/>Group findings · classify severity"]
    E --> G
    F --> G
    G --> H{"🤝 Unanimous?"}
    H -->|Yes| I["✅ Round 4: Confirmation<br/>All agents sign off"]
    H -->|No| J["⚖️ Round 3: Deliberation<br/>Disputed items only"]
    J --> I
    I --> K["📋 FIX NOW · DEFER · INFO"]
```

<br>

Each agent runs in its own **Docker container** with read-only access to your project.

They can't see each other's directories, can't access your filesystem, and never see your API keys — a credential proxy on the host handles authentication transparently.

**Not just code.** Point the board at architecture decisions, business plans, hiring briefs, financial models, legal documents. The agents have stable thinking styles that apply to any domain.

<br>

---

<br>

## 📋 The Skills

### Setup
| Command | What it does |
|---------|-------------|
| `/project-init` | Interviews you, writes a filing cabinet (settings, CLAUDE.md, spec, tasks) for new or existing projects |
| `/setup` | Builds the board — reads your project, creates agents, handles CLI auth, Docker, isolation |
| `/new-agent` | Adds a new agent to an existing board |

### Review
| Command | What it does |
|---------|-------------|
| `/brief` | Sets context for a review — detects domain, writes context, populates inboxes |
| `/run` | Runs all agents in parallel, collects reports, synthesises findings (4-round SOP) |
| `/review-release` | Reviews a GitHub repo — static analysis, safety verdict, or full build review in Docker |

### Manage
| Command | What it does |
|---------|-------------|
| `/agents-yolo` | Toggles between full autonomy and supervised mode for all agents |
| `/debug` | Diagnoses board issues — container failures, auth problems, proxy issues |
| `/debug-bug` | Bug fix lifecycle with quality gates — investigate, classify, board review, fix, test, ship |
| `/teardown` | Removes a FrontierBoard installation cleanly |

<br>

---

<br>

## 📋 Requirements

| Requirement | Details |
|-------------|---------|
| **[Claude Code](https://claude.ai/code)** | Required — this is how you interact with the board |
| **Docker** | Recommended for container isolation — setup installs it if needed |
| **Frontier model CLIs** | You choose which models sit on your board. Claude installs them during `/setup` |

**Supported CLIs** (install as many as you want):

- `claude` — Claude Code (Anthropic)
- `codex` — Codex CLI (OpenAI) · [github.com/openai/codex](https://github.com/openai/codex)
- `qwen` — Qwen Code (Alibaba) · [github.com/QwenLM/qwen-code](https://github.com/QwenLM/qwen-code)
- Any other frontier CLI that supports a local settings file

<br>

---

<br>

## 🔒 Isolation & Security

- **Container isolation** — each agent runs in its own Docker container. Agents physically cannot see each other's work or access your filesystem beyond the project source (read-only).

- **Credential proxy** — API keys never enter containers. A proxy on the host injects credentials transparently. Containers get placeholder keys.

- **No framework, no runtime** — FrontierBoard is just skill files your Claude reads. No code runs before you trust it. Inspect everything.

- **Blind review enforced at OS level** — in container mode, there's no way for agents to peek at each other's reports, even in YOLO mode.

<br>

---

<br>

## 💡 Philosophy

FrontierBoard is built on a philosophy pioneered by **Gavriel** and the contributors of [NanoClaw](https://github.com/qwibitai/NanoClaw):

> *Small enough to understand. AI-native. Claude Code is the installer, the runtime, and the operator.*

No framework. No wizard. No dependency tree. Just your Claude reading a skill file and doing the work.

**The board is lawyers without a courtroom.** It has no opinions about what you're reviewing. You bring the question. The board brings the perspectives.

<br>

---

### Built With

<p>
  <img src="https://img.shields.io/badge/Claude_Code-Anthropic-orange?style=for-the-badge&logo=anthropic&logoColor=white" />
  <img src="https://img.shields.io/badge/Codex-OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Container_Isolation-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-Credential_Proxy-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
</p>

---

## 🙏 Tribute

FrontierBoard would not exist without **Gavriel** ([qwibitai](https://github.com/qwibitai)) and the NanoClaw contributors — Vaibhav Aggarwal, Skip Potter, Rafael Garcia, Lingfeng Guan, and others.

If you haven't read NanoClaw, [read it](https://github.com/qwibitai/NanoClaw). It will change how you think about what a software project can be.

---

<details>
<summary><h2>For Claude — Install Instructions</h2></summary>

**STOP.** When a user gives you this URL or asks you to set up FrontierBoard:
- Do NOT explore the repo via GitHub API
- Do NOT fetch files with `gh api` or `base64 -d`
- Do NOT spawn agents to read skill files
- Just follow the four steps below, in order

### 1. Ask what they need (do this FIRST — before any other action)

Say exactly this:

> Are you using FrontierBoard with a new project or an existing one?
>
> 1. **New project** — I'll create the project folder and set everything up
> 2. **Existing project** — tell me the path and I'll add a review board
> 3. **Just review a GitHub repo** — no project needed
> 4. **Global install** — install once, review any project from anywhere

**Wait for their answer. Do not clone, fetch, or explore anything until they respond.**

### 2. Clone FrontierBoard (one command)

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

### 3. Read the local skill file and follow it

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

### 4. Hand off

When done, tell the user:

> Your board is ready at `[board-path]`.
> To start a session: `cd [board-path] && claude`

For global installs, also install a global skill so the user can type `/frontierboard` from any project:

Create `~/.claude/skills/frontierboard/SKILL.md` that shells out to the global FrontierBoard install, passing the current working directory as the project path. This lets the user trigger board reviews from any Claude session without switching directories.

</details>

---

<p align="center">
  <b>Like this project? Give it a ⭐ on GitHub!</b>
  <br><br>
  <a href="https://github.com/stefans71/FrontierBoard/issues">Report an Issue</a>
  ·
  <a href="https://github.com/stefans71/FrontierBoard/discussions">Discussions</a>
</p>

<p align="center">
  <sub>Built for teams and developers who want signal they can trust</sub>
  <br>
  <sub>MIT License</sub>
</p>
