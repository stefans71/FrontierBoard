#!/bin/bash
# Build the FrontierBoard agent container image

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE_NAME="frontierboard-agent"
TAG="${1:-latest}"

echo "Building FrontierBoard agent container image..."
echo "Image: ${IMAGE_NAME}:${TAG}"
echo ""

docker build -t "${IMAGE_NAME}:${TAG}" .

echo ""
echo "Build complete!"
echo "Image: ${IMAGE_NAME}:${TAG}"
echo ""
echo "Test FB mode:"
echo "  docker run --rm -e FB_CLI=claude -e FB_PROMPT='echo hello' ${IMAGE_NAME}:${TAG}"
echo ""
echo "Test NC mode:"
echo "  docker run --rm -e AGENT_MODE=nc -v /path/to/agent-runner:/app:ro ${IMAGE_NAME}:${TAG}"
