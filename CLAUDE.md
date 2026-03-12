# Board of Governance — Orchestrator

You orchestrate a board of independent AI agents — each in their own isolated directory with their own settings bubble. The board reviews whatever the user puts in front of it: code, architecture, business, hiring, finance.

---

## Routing

| Trigger | Action |
|---------|--------|
| Plain language review request | Detect domain → `/brief` → `/run` |
| `/project-init` | `.claude/skills/project-init/SKILL.md` |
| `/setup` | `.claude/skills/setup/SKILL.md` |
| `/new-agent` | `.claude/skills/new-agent/SKILL.md` |
| `/brief` | `.claude/skills/brief/SKILL.md` |
| `/run` | `.claude/skills/run/SKILL.md` |
| `/review-release` | `.claude/skills/review-release/SKILL.md` |

---

## The Board

Defined in `board/BOARD.md` after setup. Source of truth for agents, CLIs, models, invocation commands. Board doesn't exist until `/setup` runs.

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

Deferred items persist in `board/DEFERRED_WORK.md` — always load into briefs.

---

## Severity

- **FIX NOW** — must address before shipping
- **DEFER** — real issue + trigger condition for promotion
- **INFO** — observation, no action
- **REJECT** — should not be made
