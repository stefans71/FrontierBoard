# Roadmap: Container Isolation (v2.0)

**Status:** Phase 1 + Phase 2 implemented. Container mode is the recommended isolation mode.

---

## The Problem

In YOLO mode, all agents run as the same user (`llmuser`) with `Read(*)`, `Write(*)`, `Bash(*)` permissions. Agent directories are siblings under `.board/board/`. Any agent can:

1. `cat ../skeptic/outbox/report.md` — read another agent's findings, breaking blind review
2. `ls ../../` — walk up the tree to read the project, other repos, or anything on the filesystem
3. Access credentials, config files, SSH keys — anything the board user can read

Blind review is enforced by **instructions** (agent CLAUDE.md says "don't snoop"), not by **technical isolation**. YOLO mode makes this worse by removing all permission prompts.

---

## The Fix: Container Mode

Each agent runs in its own Docker container. The container only mounts the specific paths that agent needs — sibling directories, parent directories, and host filesystem simply don't exist inside the container.

### Isolation Mode in BOARD.md

New field: `isolation: container | bare`

Orthogonal to YOLO/supervised — two independent axes:

| | Supervised | YOLO |
|---|---|---|
| **Container** | Isolated + prompts (safest) | Isolated + autonomous (recommended) |
| **Bare** | Host + prompts (current default) | Host + autonomous (current, leaky) |

Container mode eliminates the need for the `llmuser` board user entirely. The container IS the sandbox — no `sudo -u`, no chown, no board user creation.

### Mount Strategy

Each containerized agent sees ONLY these paths:

| Container Path | Host Path | Mode | Purpose |
|---|---|---|---|
| `/workspace/project` | `$PROJ` | `ro` | Project source code |
| `/workspace/project/.env` | `/dev/null` | `ro` | Shadow secrets (conditional) |
| `/workspace/agent/CLAUDE.md` | `{agent}/CLAUDE.md` | `ro` | Agent identity |
| `/workspace/agent/inbox` | `{agent}/inbox` | `ro` | Brief and context |
| `/workspace/agent/outbox` | `{agent}/outbox` | `rw` | Report output |
| `/workspace/agent/contexts` | `{agent}/contexts` | `ro` | Domain context |
| `/workspace/agent/learnings` | `{agent}/learnings` | `rw` | Persistent learnings |
| `/home/node/.claude` | agent settings | `rw` | CLI settings bubble |

**NOT mounted:** sibling agent dirs, BOARD.md, REVIEW-LOG.md, `.ssh`, `.aws`, `.gnupg`, the FB repo itself.

### Container Image: `frontierboard-agent`

One image, all CLIs. Entrypoint routes to the correct CLI based on `FB_CLI` env var. See `container/Dockerfile` and `container/entrypoint.sh` for the current implementation.

### Invocation Commands

**Before (bare):**
```bash
sudo -u llmuser bash -c 'unset CLAUDECODE && cd $DIR && claude --dangerously-skip-permissions -p "..."'
```

**After (container with credential proxy):**
```bash
docker run -i --rm --name fb-pragmatist-$(date +%s) \
  -e FB_CLI=claude -e FB_YOLO=true \
  -e FB_PROMPT="read CLAUDE.md then read inbox/context.md and inbox/brief.md and write report to outbox/report.md" \
  -e ANTHROPIC_BASE_URL=http://host.docker.internal:$PROXY_PORT \
  -e ANTHROPIC_API_KEY=placeholder \
  --add-host=host.docker.internal:host-gateway \
  -v $PROJ:/workspace/project:ro \
  $( [ -f "$PROJ/.env" ] && echo "-v /dev/null:/workspace/project/.env:ro" ) \
  -v $AGENT/inbox:/workspace/agent/inbox:ro \
  -v $AGENT/outbox:/workspace/agent/outbox \
  -v $AGENT/CLAUDE.md:/workspace/agent/CLAUDE.md:ro \
  -v $AGENT/contexts:/workspace/agent/contexts:ro \
  frontierboard-agent:latest
```

`unset CLAUDECODE` no longer needed — container is a fresh process. Real API keys never enter the container — proxy injects them transparently.

---

## Credential Proxy (Phase 2)

Real API keys should never enter containers. The credential proxy (`container/fb-credential-proxy.cjs`) solves this:

1. Host runs proxy on Docker bridge IP (port 3002)
2. Containers get `ANTHROPIC_BASE_URL=http://host.docker.internal:3002` + `ANTHROPIC_API_KEY=placeholder`
3. Proxy intercepts requests, injects real credentials, forwards to API
4. Containers never see real keys — not in env, files, or `/proc`

Multi-upstream proxy handles all three APIs:
- `x-api-key` header -> Anthropic API
- `Authorization: Bearer` + OpenAI User-Agent -> OpenAI API
- DashScope headers -> DashScope API

**OAuth users bypass the proxy entirely** — Claude OAuth containers get `CLAUDE_CODE_OAUTH_TOKEN` env var, Codex ChatGPT OAuth uses native auth with copied `auth.json`. See Hard-Won Knowledge #10-12 in `setup/SKILL.md`.

---

## Setup Changes

### Step 2b: Isolation Mode

> How should agents be isolated?
>
> **Container** (recommended) — Each agent runs in its own Docker container. Real OS isolation: agents physically cannot see each other's work or access your filesystem. Requires Docker (I'll install it if needed).
>
> **Bare** — Agents run directly on the host. Blind review enforced by instructions only. Choose this if Docker truly can't run in your environment.

If user picks container and Docker isn't installed, **setup installs Docker** (apt/brew/dnf). Don't fall back to bare — the user made a choice, honor it.

Container mode skips board user creation entirely.

---

## Implementation Phases

### Phase 1: Container MVP — DONE
- `container/Dockerfile` — node:22-slim + Chromium + Claude Code + Codex + agent-browser + ripgrep
- `container/entrypoint.sh` — routes to correct CLI via `FB_CLI` env var, proxy health check with retry
- `container/build.sh` — builds `frontierboard-agent:latest`
- `setup/SKILL.md` Step 2b: isolation mode choice, Docker install if needed, image build
- `setup/SKILL.md` Step 7: container invocation templates in BOARD.md
- `run/SKILL.md`: verify image exists, use `docker run` when `isolation: container`

### Phase 2: Credential Proxy — DONE
- `container/fb-credential-proxy.cjs` — standalone Node.js proxy, zero dependencies
- Multi-upstream: Anthropic (x-api-key + OAuth rejection), OpenAI (Bearer), DashScope (Bearer)
- Per-request credential resolution (tokens refreshed between rounds)
- PID file management with `--stop` flag for clean shutdown
- OAuth bypass: Claude OAuth via env var, Codex ChatGPT OAuth via native auth
- Container invocation templates use proxy for API key mode, bypass for OAuth mode

### Repo Strategy

Same repo, semantic versioning. Container mode is additive — `isolation: container | bare` in BOARD.md. No breaking changes, no new repo needed.

- v1.x = bare mode only
- v2.0 = adds container mode as recommended option

---

## What This Obsoletes

Container mode eliminates the primary threat models that the [Security Guard Agent](ROADMAP-SECURITY-GUARD.md) was designed for:
- Agents can't read sibling outboxes (not mounted)
- Agents can't walk the filesystem (container boundary)
- Agents can't access credentials (proxy pattern, or simply not mounted)

The security guard's v1 (post-hoc reviewer) becomes less critical. Its v2 (real-time monitor) may still be useful for bare mode installs or for monitoring what agents do within their allowed scope.
