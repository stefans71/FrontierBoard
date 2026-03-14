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

**Prerequisites:** The host must mount the full agent-runner directory at `/app` (read-only). This directory must contain `src/`, `package.json`, `tsconfig.json`, and `node_modules/` with TypeScript installed. NanoClaw's `container-runner.ts` currently mounts agent-runner source but may need updating to mount the full directory at `/app:ro` — see "NanoClaw-Side Changes" below. The image does not ship its own TypeScript or agent-runner deps.

**Mounts:**
| Container Path | Host Path | Mode |
|---|---|---|
| `/workspace/project` | NanoClaw project root | `ro` |
| `/workspace/group` | Group folder | `rw` |
| `/workspace/global` | Global memory | `ro` |
| `/workspace/ipc` | IPC directory | `rw` |
| `/app` | Agent-runner directory (src/, tsconfig.json, node_modules/) | `ro` |
| `/home/node/.claude` | Per-group sessions | `rw` |

**Credential proxy:** NanoClaw's built-in proxy (port 3001). If you only use Anthropic, NanoClaw's existing proxy works unchanged. Switch to `fb-credential-proxy.cjs` only if you need OpenAI or DashScope support.

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

1. **`container-runner.ts`:** Add `-e AGENT_MODE=nc` to docker run args
2. **`container-runner.ts`:** Mount agent-runner at `/app:ro` (the full directory with `src/`, `tsconfig.json`, `node_modules/`) — NanoClaw already mounts agent-runner source, just ensure the mount point is `/app` not a subdirectory
3. **`build.sh`:** Reference `frontierboard-agent` image (or tag as both names)
4. **Credential proxy (optional):** Replace `src/credential-proxy.ts` with `fb-credential-proxy.cjs` for multi-upstream support. Only needed if adding Codex/OpenAI agents to NanoClaw
5. **Test:** Verify NanoClaw agent-runner compiles and runs in the unified image end-to-end
