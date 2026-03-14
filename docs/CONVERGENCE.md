# NanoClaw + FrontierBoard Convergence

**Status:** Phase 3 — unified container image and entrypoint. NanoClaw-side integration is a separate PR.

---

## Architecture

FrontierBoard and NanoClaw share a single container image (`frontierboard-agent:latest`) that serves both systems. The mode is selected at runtime via the `AGENT_MODE` environment variable:

| Mode | `AGENT_MODE` | Orchestrator | What runs |
|------|-------------|-------------|-----------|
| **FrontierBoard** | `fb` (default) | Claude session running `/run` | CLI dispatcher → `claude` or `codex exec` |
| **NanoClaw** | `nc` | NanoClaw Node.js process | TypeScript agent-runner via stdin JSON |

Both modes share the same base (node:22-slim + Chromium + Claude Code + Codex + agent-browser) and the same non-root user. Only the entrypoint routing differs.

---

## What Each Mode Uses

### FrontierBoard mode (`AGENT_MODE=fb`)

**Env vars:** `FB_CLI`, `FB_PROMPT`, `FB_YOLO`

**Mounts:**
| Container Path | Host Path | Mode |
|---|---|---|
| `/workspace/project` | Project source | `ro` |
| `/workspace/agent/CLAUDE.md` | Agent identity | `ro` |
| `/workspace/agent/inbox` | Brief + context | `ro` |
| `/workspace/agent/outbox` | Report output | `rw` |
| `/workspace/agent/contexts` | Domain context | `ro` |
| `/workspace/agent/learnings` | Persistent notes | `rw` |
| `/home/node/.claude` | CLI settings | `rw` |

**Credential proxy:** `fb-credential-proxy.cjs` on host, containers get placeholder keys.

### NanoClaw mode (`AGENT_MODE=nc`)

**Input:** JSON via stdin (prompt, sessionId, groupFolder, chatJid, isMain)

**Mounts:**
| Container Path | Host Path | Mode |
|---|---|---|
| `/workspace/project` | NanoClaw project root | `ro` |
| `/workspace/group` | Group folder | `rw` |
| `/workspace/global` | Global memory | `ro` |
| `/workspace/ipc` | IPC directory | `rw` |
| `/app/src` | Agent-runner source | `rw` |
| `/home/node/.claude` | Per-group sessions | `rw` |

**Credential proxy:** NanoClaw's built-in proxy (port 3001).

---

## Shared Infrastructure

### Container Image
Both systems build from the same `container/Dockerfile`. The image includes all CLIs both systems need. NanoClaw doesn't need to maintain a separate Dockerfile — it can use `frontierboard-agent:latest` with `AGENT_MODE=nc`.

### Credential Proxy
FrontierBoard's `fb-credential-proxy.cjs` handles multi-upstream (Anthropic + OpenAI + DashScope). NanoClaw can reuse this instead of its own single-upstream `credential-proxy.ts`. The FB proxy is a superset — it supports everything NanoClaw's proxy does plus OpenAI and DashScope.

### Workspace Structure
Both modes use `/workspace/` but different subdirectories. No collision — FB uses `agent/` and `project/`, NanoClaw uses `group/`, `global/`, and `ipc/`. Both share `project/` for read-only project source access.

---

## How to Use the Shared Image from NanoClaw

NanoClaw's `container-runner.ts` needs these changes to use the shared image:

1. **Image name:** Change `nanoclaw-agent` to `frontierboard-agent` (or build under both tags)
2. **Env var:** Add `-e AGENT_MODE=nc` to `docker run` args
3. **Mounts:** Keep existing NanoClaw mounts — they map to `/workspace/group`, `/workspace/global`, `/workspace/ipc` which exist in the unified image
4. **Agent-runner source:** Mount to `/app/src` (same as current `/app/src`)
5. **Credential proxy:** Optionally switch to `fb-credential-proxy.cjs` for multi-upstream support

These are non-breaking changes — NanoClaw's existing orchestrator logic, channel system, and database layer are unaffected.

---

## What This Enables

### Today (Phase 3)
- Single image to build and maintain
- Both systems get Codex support from the same image
- FrontierBoard can review NanoClaw projects using the same container infrastructure

### Future (Phase 4)
- NanoClaw triggers FrontierBoard reviews directly via `AGENT_MODE=fb`
- Projects containerized with FB as cross-project governance service
- Shared agent pool: NanoClaw spawns FB review agents alongside chat agents
- Single credential proxy serves both orchestrators

---

## NanoClaw-Side Changes (Separate PR)

These changes live in the NanoClaw repo, not FrontierBoard:

1. Update `container-runner.ts` to pass `AGENT_MODE=nc` env var
2. Update `build.sh` to reference `frontierboard-agent` image (or tag as both)
3. Optionally replace `src/credential-proxy.ts` with `fb-credential-proxy.cjs`
4. Test: verify NanoClaw agent-runner works in the unified image
