# Roadmap: Security Guard Agent

**Status:** Planning — needs more thought before implementation.

---

## The Idea

A security guard agent that monitors other board agents when they run in YOLO mode. Not a reviewer — a monitor.

## Current Thinking

### Post-Hoc Reviewer (v1 — ephemeral, fits current model)

- Guard agent spawns AFTER other agents complete
- Reads all outbox reports and any files agents created/modified
- Produces a security assessment: unauthorized file access, credential exposure, destructive commands, prompt injection attempts, unexpected network calls
- Guard writes to `outbox/security-report.md`
- Orchestrator includes guard findings in synthesis
- **Does NOT block** — reports only, user decides

### Real-Time Monitor (v2 — needs daemon/cron, more complex)

- Uses a cronjob or daemon to monitor critical file changes
- Can **halt the operation and the agent** if something dangerous is detected
- Could be wired as a PostToolUse hook in Claude Code's `settings.json`
- Watches in real-time, not post-hoc
- **This is the real version** — but it's a significant architecture change

## Open Questions (need to think through)

1. **What files are "critical"?** Need a configurable watchlist per project. `.env`, credentials, `/etc/`, system dirs — but also project-specific files the user marks as protected.

2. **How does the daemon halt an agent?** Kill the process? Send a signal? Claude Code doesn't have a graceful stop mechanism from outside. Killing `claude` mid-run leaves partial state.

3. **Token waste** — The post-hoc approach (v1) runs a full agent session just to review reports. That's an Opus invocation per review. For a 3-agent board that's a 33% overhead. Is the security value worth it every time, or should it be opt-in per review?

4. **Scope of monitoring** — Should the guard only monitor agent reports (text output), or also audit the filesystem diff (what files were created/modified/deleted during the agent's run)? Filesystem diff is more useful but harder to capture.

5. **False positives** — Agents legitimately write to outbox, create context files, modify briefs. The guard needs to distinguish expected writes from unexpected ones. Needs a whitelist of expected paths per agent.

6. **User context matters** — Single user on own VPS in YOLO mode doesn't need the same guard as a team environment. Should be opt-in, not default.

## Files That Would Change

- `.claude/skills/setup/SKILL.md` — Add security guard as optional agent type in Step 4
- `.claude/skills/run/SKILL.md` — Add optional guard step after agent reports
- `.claude/skills/new-agent/SKILL.md` — Support "security guard" as an agent type
- New: daemon/cron configuration for real-time monitoring (v2)

## Relationship to Bare Mode Isolation

Container isolation was removed in v3.0 (see `git tag v2.0-last-container-support` for the last container-capable commit). FrontierBoard now runs agents in bare mode only — as a dedicated board user with directory-level permissions.

This makes the security guard **more relevant**, not less:

- Agents share the board user and CAN read sibling outboxes if they ignore instructions
- Agents have unrestricted network access
- Agents hold real credentials (not proxied placeholders)

The v1 post-hoc reviewer is a practical mitigation for blind review enforcement in bare mode. The v2 real-time monitor would provide stronger guarantees.

See [Security Posture](SECURITY-POSTURE.md) for the full bare-mode threat model.

## When to Build

This is now higher priority than when container mode existed. Consider building v1 (post-hoc reviewer) as the next feature — it's the cheapest way to add verification that blind review was respected.
