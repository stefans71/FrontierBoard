#!/usr/bin/env node
/**
 * FrontierBoard Credential Proxy
 *
 * Standalone HTTP proxy that sits between containerized agents and API endpoints.
 * Containers send requests with placeholder credentials; this proxy injects the
 * real credentials before forwarding upstream. Containers never see real keys.
 *
 * Multi-upstream: routes to Anthropic, OpenAI, or DashScope based on request path.
 *
 * Usage:
 *   node fb-credential-proxy.js                    # start on default port 3002
 *   PORT=3005 node fb-credential-proxy.js          # custom port
 *   node fb-credential-proxy.js --stop             # stop a running proxy
 *
 * Environment variables (read from host, never passed to containers):
 *   ANTHROPIC_API_KEY       — for Claude Code agents
 *   OPENAI_API_KEY          — for Codex agents
 *   DASHSCOPE_API_KEY       — for Qwen agents (future)
 *   FB_PROXY_PORT           — port to listen on (default: 3002)
 *   FB_PROXY_HOST           — host to bind to (default: 127.0.0.1)
 *
 * Container agents connect via:
 *   ANTHROPIC_BASE_URL=http://host.docker.internal:3002
 *   ANTHROPIC_API_KEY=placeholder
 *   (or OPENAI_BASE_URL / OPENAI_API_KEY=placeholder for Codex)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Configuration ---

const PORT = parseInt(process.env.FB_PROXY_PORT || process.env.PORT || '3002', 10);
const HOST = process.env.FB_PROXY_HOST || '127.0.0.1';
const PID_FILE = path.join(__dirname, '.fb-proxy.pid');

// --- Stop mode ---

if (process.argv.includes('--stop')) {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(PID_FILE);
    console.log(`Stopped credential proxy (PID ${pid})`);
  } catch (e) {
    console.log('No running proxy found');
  }
  process.exit(0);
}

// --- Credential loading ---

function loadCredentials() {
  // Try environment variables first
  const creds = {
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    dashscope: process.env.DASHSCOPE_API_KEY || '',
  };

  // Try Claude Code OAuth token as fallback for Anthropic
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

// --- Upstream routing ---

const UPSTREAMS = {
  anthropic: { hostname: 'api.anthropic.com', port: 443 },
  openai: { hostname: 'api.openai.com', port: 443 },
  dashscope: { hostname: 'dashscope.aliyuncs.com', port: 443 },
};

function detectUpstream(req) {
  // Check custom header first (explicit routing)
  const target = req.headers['x-fb-upstream'];
  if (target && UPSTREAMS[target]) return target;

  // Detect by request characteristics
  const hasAnthropicKey = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'] || '';
  const userAgent = req.headers['user-agent'] || '';

  // Anthropic: uses x-api-key header
  if (hasAnthropicKey) return 'anthropic';

  // OpenAI: uses Authorization: Bearer + OpenAI user agent patterns
  if (authHeader.startsWith('Bearer ') &&
      (userAgent.includes('openai') || userAgent.includes('OpenAI') ||
       req.url.includes('/v1/chat/completions') || req.url.includes('/v1/responses'))) {
    return 'openai';
  }

  // DashScope: specific paths or headers
  if (req.url.includes('/api/v1/services') || req.headers['x-dashscope-api-key']) {
    return 'dashscope';
  }

  // Default to anthropic (most common FB use case)
  return 'anthropic';
}

// --- Credential injection ---

function injectCredentials(headers, upstream, creds) {
  const injected = { ...headers };

  switch (upstream) {
    case 'anthropic':
      // Remove placeholder, inject real key
      delete injected['x-api-key'];
      if (creds._anthropicAuthMode === 'oauth') {
        // OAuth mode: inject Bearer token
        delete injected['authorization'];
        injected['authorization'] = `Bearer ${creds.anthropic}`;
      } else {
        injected['x-api-key'] = creds.anthropic;
      }
      break;

    case 'openai':
      // Remove placeholder Bearer, inject real key
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
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const upstream = detectUpstream(req);
      const target = UPSTREAMS[upstream];

      if (!creds[upstream]) {
        res.writeHead(401);
        res.end(`No ${upstream} credentials configured on the proxy host`);
        return;
      }

      const headers = injectCredentials(
        { ...req.headers, host: target.hostname, 'content-length': body.length },
        upstream,
        creds,
      );

      // Strip hop-by-hop headers
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
        console.error(`Proxy upstream error (${upstream}):`, err.message);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('Bad Gateway');
        }
      });

      upstreamReq.write(body);
      upstreamReq.end();
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`FrontierBoard credential proxy listening on ${HOST}:${PORT}`);
    console.log(`Upstreams: ${Object.keys(UPSTREAMS).join(', ')}`);

    // Write PID file for --stop
    fs.writeFileSync(PID_FILE, process.pid.toString());
  });

  // Cleanup on exit
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
