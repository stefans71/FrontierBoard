# Security Posture — Bare Mode

FrontierBoard runs agents as a dedicated board user (`$BOARD_USER`) on the host. This document states what bare mode protects, what it doesn't, and what you accept by using it.

---

## What Bare Mode Provides

| Property | Mechanism |
|----------|-----------|
| **Write isolation from host** | Agents run as `$BOARD_USER` via `sudo -u`. They cannot write to files owned by other users (assuming correct ownership/permissions). |
| **Process identity separation** | Agent processes run under a different uid than the orchestrator. |
| **Ephemeral sessions** | Each agent invocation is a fresh CLI session with no persistent memory. No state carries between rounds. |
| **Blind review by convention** | Agent CLAUDE.md instructions prohibit reading sibling directories. CLI working directory is set to the agent's own directory. |
| **Directory structure** | Each agent has isolated inbox/outbox/contexts directories. |

## What Bare Mode Does NOT Provide

| Gap | Detail |
|-----|--------|
| **Inter-agent read isolation** | All agents share the same `$BOARD_USER`. Agent A can read Agent B's outbox (`cat ../agent-b/outbox/report.md`) if it chooses to ignore its instructions. Blind review is instruction-enforced, not technically enforced. |
| **Network isolation** | Agents have unrestricted network access. They can reach any endpoint the host can reach, including cloud metadata services (169.254.169.254), internal APIs, and the public internet. |
| **Filesystem read isolation** | The board user can read any world-readable file on the host: `/etc/passwd`, other users' public files, `/proc`, shared `/tmp`. |
| **Credential isolation** | Agents have direct access to real API keys (see Credential Flow below). There is no proxy or placeholder pattern. |
| **Capability restriction** | The board user inherits standard UNIX capabilities. SUID binaries are available. No seccomp, AppArmor, or capability dropping is applied. |

## Credential Flow in Bare Mode

### API Key Users (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)

API keys are set as environment variables on the host. When the orchestrator runs:

```bash
sudo -u $BOARD_USER bash -c 'ANTHROPIC_API_KEY=$KEY ... claude -p "..."'
```

The agent process holds the real API key in its environment. Any process running as `$BOARD_USER` can read it via `/proc/self/environ`.

**Mitigation:** Use API keys with spend limits. Rotate after reviews. Prefer OAuth subscription auth when available.

### Claude OAuth Users (Pro/Max/Teams)

The orchestrator copies `~/.claude/.credentials.json` to the board user's home directory during setup. The board user's Claude Code reads the token directly.

**Exposure:** The board user has persistent access to the OAuth credential file between reviews. The token auto-refreshes and has a multi-hour lifetime.

### Codex ChatGPT OAuth Users

The orchestrator copies `~/.codex/auth.json` to the board user's home during setup. Codex reads it natively.

**Exposure:** Same as Claude OAuth — persistent file access between reviews.

## Accepted Risks

By using FrontierBoard in bare mode, you accept:

1. **Blind review is convention, not enforcement.** A confused or misbehaving agent could read sibling reports. This is detectable in consolidation (Round 2) if an agent's findings suspiciously mirror another's.

2. **Agents hold real credentials.** Unlike the former container/proxy pattern, agents have direct access to API keys and OAuth tokens. Use spend limits.

3. **No network boundary.** Agents can make arbitrary network requests. This is standard for AI coding assistants running on developer machines.

4. **Review artifacts are not secrets.** The primary assets being protected (markdown review reports) are low-sensitivity. The consequence of a blind review violation is a marginally less independent review, not a data breach.

## When You Need Stronger Isolation

If your threat model requires technical enforcement of agent isolation (shared infrastructure, multi-tenant hosts, sensitive review artifacts), consider:

- Running each agent as a separate UNIX user (heavy but effective)
- Using container orchestration external to FrontierBoard
- Restricting the board user with AppArmor or seccomp profiles
- Network namespaces for the board user

These are not built into FrontierBoard. They are host-level controls you can layer on top.
