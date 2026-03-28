# Board of Governance — Orchestrator

You orchestrate a board of independent AI agents — each in their own isolated directory with their own settings bubble. The board reviews whatever the user puts in front of it: code, architecture, business, hiring, finance.

---

## Routing

| Trigger | Action |
|---------|--------|
| Plain language review request | Detect domain → `/brief` → `/run` |
| `/project` | `.claude/skills/project/SKILL.md` (router + state machine) |
| `/project-init` | `.claude/skills/project/init/SKILL.md` |
| `/project-status` | `.claude/skills/project/status/SKILL.md` |
| `/project-next` | `.claude/skills/project/next/SKILL.md` |
| `/project-review` | `.claude/skills/project/review/SKILL.md` |
| `/project-tests` | `.claude/skills/project/tests/SKILL.md` |
| `/project-ship` | `.claude/skills/project/ship/SKILL.md` |
| `/setup` | `.claude/skills/setup/SKILL.md` |
| `/new-agent` | `.claude/skills/new-agent/SKILL.md` |
| `/brief` | `.claude/skills/brief/SKILL.md` |
| `/run` | `.claude/skills/run/SKILL.md` |
| `/review-release` | `.claude/skills/review-release/SKILL.md` |
| `/agents-yolo` | `.claude/skills/agents-yolo/SKILL.md` |
| `/debug` | `.claude/skills/debug/SKILL.md` |
| `/debug-bug` | `.claude/skills/debug-bug/SKILL.md` |
| `/smoke-test` | `.claude/skills/smoke-test/SKILL.md` |
| `/director` | `.claude/skills/director/SKILL.md` |
| `/teardown` | `.claude/skills/teardown/SKILL.md` |

---

## The Board

Defined in `.board/board/BOARD.md` after setup. Source of truth for agents, CLIs, models, invocation commands. Board doesn't exist until `/setup` runs.

**Global mode:** If installed at `~/.frontierboard/`, agents are shared across projects. Per-project state lives in `.board/projects/{project-name}/`. When the user says "review [path]", check if that project already has an entry — if yes, load it and run. If no, run `/setup` to create one (skipping agent creation since agents already exist).

---

## Principles

**Agents are ephemeral.** Fresh session, zero memory. Everything they need must be in their inbox — identity, context, brief, prior round artifacts. Every round.

**Agents are independent.** No agent sees another's work before writing their own report. (Round 3+ deliberation: names visible, positions shared.)

**Domain-agnostic.** Agents' identities stay stable. Domain context and briefs change per review.

**Plain language works.** Slash commands are shortcuts.

---

## Review Process

4-round SOP in `docs/REVIEW-SOP.md`: Blind Review → Consolidation → Deliberation (skip if unanimous) → Confirmation.

Modes: Quick (1 agent, 1 round), Standard (full board, 4 rounds), Custom.

Deferred items: tasks with `"status": "deferred"` in `tasks.json`, plus `.board/board/DEFERRED_WORK.md` (legacy). Always load into briefs.

---

## Tracking

Two files, one system:
- `tasks.json` — master index of bugs, features, deferred work (IDs, titles, status, severity)
- `docs/tasks/{task-id}.yaml` — detailed task with phase gates, checklists, findings

Deferred items have `"status": "deferred"` and a `"trigger"` field. `/run` and `/brief` load them into every review brief. `/debug-bug` creates task YAML files with phase gates for bug investigations.

---

## Severity

- **FIX NOW** — must address before shipping
- **DEFER** — real issue + trigger condition for promotion
- **INFO** — observation, no action
- **REJECT** — should not be made
