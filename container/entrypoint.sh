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
    # Expects agent-runner source at /app/src (mounted by NanoClaw host)
    if [ -d /app/src ]; then
      cd /app && npx tsc --outDir /tmp/dist 2>&1 >&2
      ln -s /app/node_modules /tmp/dist/node_modules 2>/dev/null || true
      chmod -R a-w /tmp/dist
      cat > /tmp/input.json
      exec node /tmp/dist/index.js < /tmp/input.json
    else
      echo "ERROR: NanoClaw agent-runner source not found at /app/src" >&2
      echo "Mount the agent-runner source directory to /app/src" >&2
      exit 1
    fi
    ;;

  *)
    echo "ERROR: Unknown AGENT_MODE '$AGENT_MODE'. Must be 'fb' or 'nc'" >&2
    exit 1
    ;;
esac
