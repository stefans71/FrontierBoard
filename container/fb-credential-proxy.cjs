#!/usr/bin/env node
/**
 * FrontierBoard Credential Proxy
 *
 * Standalone HTTP proxy that sits between containerized agents and API endpoints.
 * Containers send requests with placeholder credentials; this proxy injects the
 * real credentials before forwarding upstream. Containers never see real keys.
 *
 * Multi-upstream: routes to Anthropic, OpenAI, or DashScope based on
 * x-fb-upstream header (primary) or request heuristics (fallback).
 *
 * Security: binds to Docker bridge IP (not 0.0.0.0), so only containers on the
 * same Docker network can reach it. No token auth needed — CLIs (Claude Code,
 * Codex) cannot inject custom headers into their API requests.
 *
 * Credential resolution (per-request, checked in order):
 *   1. Environment variables (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
 *   2. CLI credential files (read on each request so refreshed tokens are picked up):
 *      - Claude Code: ~/.claude/.credentials.json (OAuth accessToken)
 *      - Codex: ~/.codex/auth.json (ChatGPT OAuth access_token)
 *   This means OAuth users (Max plan, Teams) don't need API keys — the proxy
 *   reads the token the orchestrator's CLI session keeps fresh.
 *
 * Usage:
 *   node fb-credential-proxy.cjs                    # start on default port 3002
 *   FB_PROXY_PORT=3005 node fb-credential-proxy.cjs # custom port
 *   node fb-credential-proxy.cjs --stop             # stop a running proxy
 *
 * Environment variables (read from host, never passed to containers):
 *   ANTHROPIC_API_KEY       — for Claude Code agents (takes precedence over OAuth file)
 *   OPENAI_API_KEY          — for Codex agents (takes precedence over OAuth file)
 *   DASHSCOPE_API_KEY       — for Qwen agents (future)
 *   FB_PROXY_PORT           — port to listen on (default: 3002)
 *   FB_PROXY_HOST           — host to bind to (auto-detected: Docker bridge on Linux, 127.0.0.1 on macOS)
 *   FB_PROXY_MAX_IDLE       — auto-shutdown after N seconds with no requests (default: 1800 = 30 min, 0 = disabled)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.FB_PROXY_PORT || process.env.PORT || '3002', 10);
const PID_FILE = path.join(__dirname, '.fb-proxy.pid');
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IDLE_SECONDS = parseInt(process.env.FB_PROXY_MAX_IDLE || '1800', 10); // 30 min default, 0 = disabled

// --- Bind host detection (Q1) ---

function detectBindHost() {
  if (process.env.FB_PROXY_HOST) return process.env.FB_PROXY_HOST;
  if (process.platform === 'darwin') return '127.0.0.1';

  // Linux: detect Docker bridge IP so containers can reach us
  try {
    const output = execSync("ip addr show docker0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1", { encoding: 'utf8' }).trim();
    if (output) return output;
  } catch (e) {}

  // Fallback: standard Docker bridge IP (0.0.0.0 would expose proxy to public internet)
  console.log('WARNING: Could not detect docker0 bridge IP. Using 172.17.0.1 (standard Docker bridge).');
  console.log('If containers cannot reach the proxy, set FB_PROXY_HOST explicitly.');
  return '172.17.0.1';
}

const HOST = detectBindHost();

// --- Stop mode (Q3: validate PID before killing) ---

if (process.argv.includes('--stop')) {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);

    // Validate the PID is actually our proxy process
    let isProxy = false;
    try {
      const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      isProxy = cmdline.includes('fb-credential-proxy');
    } catch (e) {
      // /proc not available (macOS) — try ps
      try {
        const ps = execSync(`ps -p ${pid} -o command=`, { encoding: 'utf8' });
        isProxy = ps.includes('fb-credential-proxy');
      } catch (e2) {
        // Process doesn't exist
      }
    }

    if (isProxy) {
      process.kill(pid, 'SIGTERM');
      console.log(`Stopped credential proxy (PID ${pid})`);
    } else {
      console.log(`PID ${pid} is not a credential proxy — removing stale PID file`);
    }
    fs.unlinkSync(PID_FILE);
  } catch (e) {
    console.log('No running proxy found');
  }
  process.exit(0);
}

// --- Credential loading ---
// Credentials are resolved per-request so OAuth token refreshes are picked up.
// Priority: env var > CLI credential file > empty (fail at proxy time)

const HOME = process.env.HOME || '/root';
const CLAUDE_CRED_FILE = path.join(HOME, '.claude', '.credentials.json');
const CODEX_CRED_FILE = path.join(HOME, '.codex', 'auth.json');

function readClaudeOAuthToken() {
  try {
    const data = JSON.parse(fs.readFileSync(CLAUDE_CRED_FILE, 'utf8'));
    const oauth = data.claudeAiOauth;
    if (oauth && oauth.accessToken) {
      // C1: Reject expired tokens instead of forwarding them upstream
      if (oauth.expiresAt && Date.now() > oauth.expiresAt - 60000) {
        console.error('REJECTED: Claude OAuth token expired — run "claude /login" on the host to refresh');
        return '';
      }
      return oauth.accessToken;
    }
  } catch (e) {
    // File doesn't exist or isn't readable — that's fine, fall through
  }
  return '';
}

function readCodexOAuthToken() {
  try {
    const data = JSON.parse(fs.readFileSync(CODEX_CRED_FILE, 'utf8'));
    if (data.tokens && data.tokens.access_token) {
      return data.tokens.access_token;
    }
    if (data.OPENAI_API_KEY) {
      return data.OPENAI_API_KEY;
    }
  } catch (e) {
    // File doesn't exist or isn't readable — that's fine, fall through
  }
  return '';
}

// C6: Single shared credential resolution — called by both startup validation and per-request
function resolveCredentials() {
  // Anthropic: env var > env OAuth token > credential file
  let anthropic = process.env.ANTHROPIC_API_KEY || '';
  let anthropicAuthMode = anthropic ? 'apikey' : '';

  if (!anthropic) {
    const envOauth = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN || '';
    if (envOauth) {
      anthropic = envOauth;
      anthropicAuthMode = 'oauth';
    }
  }

  if (!anthropic) {
    anthropic = readClaudeOAuthToken();
    if (anthropic) anthropicAuthMode = 'oauth';
  }

  // OpenAI: env var > codex credential file
  let openai = process.env.OPENAI_API_KEY || '';
  if (!openai) {
    openai = readCodexOAuthToken();
  }

  return {
    anthropic,
    openai,
    dashscope: process.env.DASHSCOPE_API_KEY || '',
    _anthropicAuthMode: anthropicAuthMode,
  };
}

// Startup validation — exits if no credentials found
function loadCredentials() {
  const creds = resolveCredentials();
  const available = Object.entries(creds)
    .filter(([k, v]) => v && !k.startsWith('_'))
    .map(([k]) => k);

  if (available.length === 0) {
    console.error('ERROR: No credentials found.');
    console.error('The proxy checks (in order):');
    console.error('  1. Environment variables: ANTHROPIC_API_KEY, OPENAI_API_KEY, DASHSCOPE_API_KEY');
    console.error(`  2. Claude Code OAuth: ${CLAUDE_CRED_FILE}`);
    console.error(`  3. Codex OAuth: ${CODEX_CRED_FILE}`);
    console.error('Run "claude /login" or "codex" to authenticate, or set an API key.');
    process.exit(1);
  }

  return { creds, available };
}

// Per-request credential reading (tokens get refreshed by orchestrator between rounds)
function getCredentials() {
  return resolveCredentials();
}

// --- Upstream routing (Q2: no default, return null for unrecognized) ---

const UPSTREAMS = {
  anthropic: { hostname: 'api.anthropic.com', port: 443 },
  openai: { hostname: 'api.openai.com', port: 443 },
  dashscope: { hostname: 'dashscope.aliyuncs.com', port: 443 },
};

function detectUpstream(req) {
  // Primary: explicit header (Q8a)
  const target = req.headers['x-fb-upstream'];
  if (target && UPSTREAMS[target]) return target;

  // Fallback heuristics
  if (req.headers['x-api-key']) return 'anthropic';

  const authHeader = req.headers['authorization'] || '';
  const userAgent = req.headers['user-agent'] || '';

  // OpenAI/Codex: detect by user-agent (codex_exec, openai-*) — most reliable
  if (userAgent.toLowerCase().includes('codex') || userAgent.toLowerCase().includes('openai')) {
    return 'openai';
  }

  // OpenAI: Bearer auth + known URL paths (with or without /v1/ prefix)
  if (authHeader.startsWith('Bearer ') &&
      (req.url.includes('/chat/completions') || req.url.includes('/responses') ||
       req.url.includes('/models') || req.url.startsWith('/v1/'))) {
    return 'openai';
  }

  if (req.url.includes('/api/v1/services') || req.headers['x-dashscope-api-key']) {
    return 'dashscope';
  }

  // Fallback: if we only have one upstream with credentials, use it
  // (covers Codex hitting unusual paths like /v1/engines or metadata endpoints)
  if (authHeader.startsWith('Bearer ')) {
    const creds = getCredentials();
    const available = ['anthropic', 'openai', 'dashscope'].filter(k => creds[k]);
    // If only openai has creds and request has Bearer, it's almost certainly Codex
    if (available.length === 1) return available[0];
    // If anthropic is from OAuth (not API key), Bearer likely means openai
    if (creds._anthropicAuthMode === 'oauth' && creds.openai) return 'openai';
  }

  // Q2: reject unrecognized requests instead of defaulting
  // C3: log auth type/length only, never credential values
  const authType = authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'Other') : 'None';
  console.log(`Unrecognized upstream — URL: ${req.url}, UA: ${userAgent}, Auth: ${authType} (${authHeader.length} chars)`);
  return null;
}

// --- Credential injection ---

function injectCredentials(headers, upstream, creds) {
  const injected = { ...headers };

  switch (upstream) {
    case 'anthropic':
      delete injected['x-api-key'];
      if (creds._anthropicAuthMode === 'oauth') {
        delete injected['authorization'];
        injected['authorization'] = `Bearer ${creds.anthropic}`;
      } else {
        injected['x-api-key'] = creds.anthropic;
      }
      break;
    case 'openai':
      delete injected['authorization'];
      injected['authorization'] = `Bearer ${creds.openai}`;
      break;
    case 'dashscope':
      delete injected['authorization'];
      delete injected['x-dashscope-api-key'];
      injected['authorization'] = `Bearer ${creds.dashscope}`;
      break;
  }

  return injected;
}

// --- Proxy server ---

function startProxy() {
  // Validate at least one credential source exists at startup
  const { available } = loadCredentials();
  console.log(`Credentials loaded: ${available.join(', ')}`);

  // C8: idle timer for auto-shutdown
  let idleTimer = null;

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (MAX_IDLE_SECONDS > 0) {
      idleTimer = setTimeout(() => {
        console.log(`No requests for ${MAX_IDLE_SECONDS}s — auto-shutting down.`);
        server.close();
        try { fs.unlinkSync(PID_FILE); } catch (e) {}
        process.exit(0);
      }, MAX_IDLE_SECONDS * 1000);
      idleTimer.unref(); // don't keep process alive just for the timer
    }
  }

  const server = http.createServer((req, res) => {
    // Health check — no auth required, does NOT reset idle timer (D3/D5)
    if (req.url === '/health' || req.url === '/') {
      const creds = getCredentials();
      const sources = Object.entries(creds)
        .filter(([k, v]) => v && !k.startsWith('_'))
        .map(([k]) => k);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ service: 'fb-credential-proxy', port: PORT, pid: process.pid, credentials: sources }));
      return;
    }

    // Only real proxied requests reset the idle timer
    resetIdleTimer();

    // Q5: body size limit
    let bodySize = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        req.destroy();
        if (!res.headersSent) {
          res.writeHead(413);
          res.end('Request body too large (max 10MB)');
        }
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (bodySize > MAX_BODY_SIZE) return; // already handled

      const body = Buffer.concat(chunks);
      const upstream = detectUpstream(req);

      // Q2: reject unrecognized requests
      if (!upstream) {
        res.writeHead(400);
        res.end('Unrecognized upstream. Set x-fb-upstream header to: anthropic, openai, or dashscope');
        return;
      }

      // Re-read credentials on each request (OAuth tokens get refreshed)
      const creds = getCredentials();

      if (!creds[upstream]) {
        res.writeHead(401);
        res.end(`No ${upstream} credentials configured on the proxy host`);
        return;
      }

      const target = UPSTREAMS[upstream];
      const headers = injectCredentials(
        { ...req.headers, host: target.hostname, 'content-length': body.length },
        upstream,
        creds,
      );

      // Strip internal and hop-by-hop headers before forwarding upstream
      delete headers['connection'];
      delete headers['keep-alive'];
      delete headers['transfer-encoding'];
      delete headers['x-fb-upstream'];

      // Normalize path: some CLIs (Codex 0.115+) send /responses instead of /v1/responses.
      // OpenAI's API requires the /v1/ prefix.
      let upstreamPath = req.url;
      if (upstream === 'openai' && !upstreamPath.startsWith('/v1/') && upstreamPath.startsWith('/')) {
        upstreamPath = '/v1' + upstreamPath;
      }

      const upstreamReq = https.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: upstreamPath,
          method: req.method,
          headers,
        },
        (upRes) => {
          res.writeHead(upRes.statusCode, upRes.headers);
          upRes.pipe(res);
        },
      );

      upstreamReq.on('error', (err) => {
        console.error(`Proxy error (${upstream}): ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('Bad Gateway');
        }
      });

      upstreamReq.write(body);
      upstreamReq.end();
    });
  });

  // Q4: EADDRINUSE error handling
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`ERROR: Port ${PORT} is already in use.`);
      console.error('Another proxy or service may be running on this port.');
      console.error(`Check with: lsof -i :${PORT}`);
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    console.log(`FrontierBoard credential proxy listening on ${HOST}:${PORT}`);
    console.log(`Upstreams: ${Object.keys(UPSTREAMS).join(', ')}`);
    if (MAX_IDLE_SECONDS > 0) console.log(`Auto-shutdown after ${MAX_IDLE_SECONDS}s idle`);
    fs.writeFileSync(PID_FILE, process.pid.toString(), { mode: 0o600 });
    resetIdleTimer();
  });

  process.on('SIGTERM', () => {
    console.log('Credential proxy stopping...');
    server.close();
    try { fs.unlinkSync(PID_FILE); } catch (e) {}
    process.exit(0);
  });

  process.on('SIGINT', () => {
    server.close();
    try { fs.unlinkSync(PID_FILE); } catch (e) {}
    process.exit(0);
  });

  return server;
}

startProxy();
