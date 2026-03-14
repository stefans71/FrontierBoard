# Unified AI Agent Container
# Serves both FrontierBoard (board review agents) and NanoClaw (chat agents)
# Mode is selected via AGENT_MODE env var: "fb" (default) or "nc"

FROM node:22-slim

# System dependencies (Chromium for agent-browser, git for code review)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libcups2 \
    libdrm2 \
    libxshmfence1 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Chromium path for agent-browser
ENV AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Install CLIs globally (shared across both modes)
# Claude Code + agent-browser (Anthropic)
RUN npm install -g @anthropic-ai/claude-code agent-browser
# Codex (OpenAI)
RUN npm install -g @openai/codex

# Workspace directories (unified — each mode uses its own subset)
RUN mkdir -p \
    /workspace/project \
    /workspace/agent/inbox \
    /workspace/agent/outbox \
    /workspace/agent/learnings \
    /workspace/agent/contexts \
    /workspace/group \
    /workspace/global \
    /workspace/ipc/messages \
    /workspace/ipc/tasks \
    /workspace/ipc/input

# Entrypoint: unified dispatcher
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Non-root user for security
RUN chown -R node:node /workspace /home/node && chmod 755 /home/node
USER node
WORKDIR /workspace/agent

ENTRYPOINT ["/app/entrypoint.sh"]
