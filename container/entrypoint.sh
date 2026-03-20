#!/bin/bash
set -e

# FrontierBoard Agent Entrypoint
# Routes to the correct CLI based on FB_CLI env var.
#
# Env vars:
#   FB_CLI    — claude | codex (required)
#   FB_YOLO   — true | false (controls permission flags)
#   FB_PROMPT — the agent prompt string (required)

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
  # C7: Hard-fail with retry — proxy-dependent containers cannot succeed without it
  PROXY_OK=false
  for attempt in 1 2 3; do
    if curl -sf "http://host.docker.internal:${PROXY_PORT}/health" >/dev/null 2>&1; then
      PROXY_OK=true
      break
    fi
    sleep 1
  done
  if [ "$PROXY_OK" = "false" ]; then
    echo "ERROR: Credential proxy not reachable at host.docker.internal:${PROXY_PORT} after 3 attempts" >&2
    echo "This container requires the proxy for authentication. Start it on the host:" >&2
    echo "  node \$BOARD/container/fb-credential-proxy.cjs &" >&2
    exit 1
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
