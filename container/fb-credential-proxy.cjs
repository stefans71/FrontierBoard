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
 * Usage:
 *   node fb-credential-proxy.cjs                    # start on default port 3002
 *   FB_PROXY_PORT=3005 node fb-credential-proxy.cjs # custom port
 *   node fb-credential-proxy.cjs --stop             # stop a running proxy
 *
 * Environment variables (read from host, never passed to containers):
 *   ANTHROPIC_API_KEY       — for Claude Code agents
 *   OPENAI_API_KEY          — for Codex agents
 *   DASHSCOPE_API_KEY       — for Qwen agents (future)
 *   FB_PROXY_PORT           — port to listen on (default: 3002)
 *   FB_PROXY_HOST           — host to bind to (auto-detected: Docker bridge on Linux, 127.0.0.1 on macOS)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.FB_PROXY_PORT || process.env.PORT || '3002', 10);
const PID_FILE = path.join(__dirname, '.fb-proxy.pid');
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

// --- Bind host detection (Q1) ---

function detectBindHost() {
  if (process.env.FB_PROXY_HOST) return process.env.FB_PROXY_HOST;
  if (process.platform === 'darwin') return '127.0.0.1';

  // Linux: detect Docker bridge IP so containers can reach us
  try {
    const output = execSync("ip addr show docker0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1", { encoding: 'utf8' }).trim();
    if (output) return output;
  } catch (e) {}

  // Fallback: bind to all interfaces (containers can't reach 127.0.0.1)
  return '0.0.0.0';
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

function loadCredentials() {
  const creds = {
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    dashscope: process.env.DASHSCOPE_API_KEY || '',
  };

  if (!creds.anthropic) {
    const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN || '';
    if (oauthToken) {
      creds.anthropic = oauthToken;
      creds._anthropicAuthMode = 'oauth';
    }
  }

  const available = Object.entries(creds)
    .filter(([k, v]) => v && !k.startsWith('_'))
    .map(([k]) => k);

  if (available.length === 0) {
    console.error('ERROR: No API keys found in environment.');
    console.error('Set at least one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, DASHSCOPE_API_KEY');
    process.exit(1);
  }

  console.log(`Credentials loaded: ${available.join(', ')}`);
  return creds;
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
  if (authHeader.startsWith('Bearer ') &&
      (userAgent.toLowerCase().includes('openai') ||
       req.url.includes('/v1/chat/completions') || req.url.includes('/v1/responses') ||
       req.url.includes('/v1/models'))) {
    return 'openai';
  }

  if (req.url.includes('/api/v1/services') || req.headers['x-dashscope-api-key']) {
    return 'dashscope';
  }

  // Q2: reject unrecognized requests instead of defaulting
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
  const creds = loadCredentials();

  const server = http.createServer((req, res) => {
    // Q2: health check endpoint
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ service: 'fb-credential-proxy', port: PORT, pid: process.pid }));
      return;
    }

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

      if (!creds[upstream]) {
        res.writeHead(401);
        res.end('Upstream not available');
        return;
      }

      const target = UPSTREAMS[upstream];
      const headers = injectCredentials(
        { ...req.headers, host: target.hostname, 'content-length': body.length },
        upstream,
        creds,
      );

      delete headers['connection'];
      delete headers['keep-alive'];
      delete headers['transfer-encoding'];

      const upstreamReq = https.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: req.url,
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
    fs.writeFileSync(PID_FILE, process.pid.toString());
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
