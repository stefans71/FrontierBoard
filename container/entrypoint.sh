#!/bin/bash
set -e

# FrontierBoard Agent Entrypoint
# Routes to the correct CLI based on FB_CLI env var
#
# Environment variables:
#   FB_CLI    — claude | codex | qwen (required)
#   FB_YOLO   — true | false (controls permission flags)
#   FB_PROMPT — the agent prompt string (required)

if [ -z "$FB_CLI" ]; then
  echo "ERROR: FB_CLI not set. Must be one of: claude, codex, qwen" >&2
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
    exec qwen-coder --prompt "$FB_PROMPT"
    ;;
  *)
    echo "ERROR: Unknown CLI '$FB_CLI'. Must be one of: claude, codex, qwen" >&2
    exit 1
    ;;
esac
