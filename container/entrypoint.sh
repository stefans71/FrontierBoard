#!/bin/bash
set -e

# Unified AI Agent Entrypoint
# Supports two modes:
#   AGENT_MODE=fb  (default) — FrontierBoard board review agent
#   AGENT_MODE=nc  — NanoClaw chat agent (TypeScript agent-runner)
#
# FrontierBoard env vars:
#   FB_CLI    — claude | codex (required in fb mode)
#   FB_YOLO   — true | false (controls permission flags)
#   FB_PROMPT — the agent prompt string (required in fb mode)
#
# NanoClaw: reads JSON from stdin (prompt, sessionId, groupFolder, etc.)

AGENT_MODE="${AGENT_MODE:-fb}"

case "$AGENT_MODE" in
  fb)
    # --- FrontierBoard mode: route to CLI ---
    if [ -z "$FB_CLI" ]; then
      echo "ERROR: FB_CLI not set. Must be one of: claude, codex" >&2
      exit 1
    fi

    if [ -z "$FB_PROMPT" ]; then
      echo "ERROR: FB_PROMPT not set." >&2
      exit 1
    fi

    # C10: verify credential proxy is reachable before launching agent
    # Skip for OAuth containers — they don't use the proxy
    PROXY_PORT="${FB_PROXY_PORT:-3002}"
    if [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ] && [ -n "$ANTHROPIC_BASE_URL$OPENAI_BASE_URL" ]; then
      if command -v curl >/dev/null 2>&1; then
        if ! curl -sf "http://host.docker.internal:${PROXY_PORT}/health" >/dev/null 2>&1; then
          echo "WARNING: Credential proxy not reachable at host.docker.internal:${PROXY_PORT}" >&2
          echo "Agent may fail to authenticate. Check proxy is running on host." >&2
        fi
      fi
    fi

    case "$FB_CLI" in
      claude)
        FLAGS=""
        [ "$FB_YOLO" = "true" ] && FLAGS="--dangerously-skip-permissions"
        exec claude $FLAGS -p "$FB_PROMPT"
        ;;
      codex)
        FLAGS=""
        [ "$FB_YOLO" = "true" ] && FLAGS="--dangerously-bypass-approvals-and-sandbox"
        exec codex exec $FLAGS "$FB_PROMPT"
        ;;
      qwen)
        echo "ERROR: Qwen is not available in container mode (this release). Use bare mode for Qwen agents." >&2
        exit 1
        ;;
      *)
        echo "ERROR: Unknown CLI '$FB_CLI'. Must be one of: claude, codex" >&2
        exit 1
        ;;
    esac
    ;;

  nc)
    # --- NanoClaw mode: compile + run agent-runner ---
    # Expects the full agent-runner directory mounted at /app (read-only)
    # including: src/, package.json, tsconfig.json, node_modules/
    # NanoClaw's container-runner.ts handles this mount.
    if [ ! -f /app/package.json ]; then
      echo "ERROR: NanoClaw agent-runner not found at /app" >&2
      echo "Mount the full agent-runner directory (with src/, tsconfig.json, node_modules/) to /app" >&2
      exit 1
    fi
    cd /app && npx tsc --outDir /tmp/dist > /dev/null 2>&1 || {
      echo "ERROR: TypeScript compilation failed. Check /app/src for errors." >&2
      cd /app && npx tsc --outDir /tmp/dist 2>&1  # Re-run to show errors
      exit 1
    }
    ln -s /app/node_modules /tmp/dist/node_modules 2>/dev/null || true
    cat > /tmp/input.json
    exec node /tmp/dist/index.js < /tmp/input.json
    ;;

  *)
    echo "ERROR: Unknown AGENT_MODE '$AGENT_MODE'. Must be 'fb' or 'nc'" >&2
    exit 1
    ;;
esac
