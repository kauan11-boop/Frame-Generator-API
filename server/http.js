import { createServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createFguaMcpServer } from './mcp-server.js';
import { createRuntime } from './runtime.js';

const MAX_BODY = 4 * 1024 * 1024;

function allowedOrigin(origin, port) {
  if (!origin) return true;
  const allowed = new Set([
    'http://localhost:' + port,
    'http://127.0.0.1:' + port,
    ...(process.env.FGUA_MCP_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)
  ]);
  return allowed.has(origin);
}

function corsHeaders(origin) {
  return origin ? {
    'access-control-allow-origin': origin,
    'vary': 'Origin',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name'
  } : {};
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function startHttpServer() {
  const host = process.env.FGUA_MCP_HOST || '127.0.0.1';
  const port = Number(process.env.FGUA_MCP_PORT || 3333);
  const token = process.env.FGUA_MCP_TOKEN || '';
  const remote = !['127.0.0.1', 'localhost', '::1'].includes(host);

  if (remote && (process.env.FGUA_MCP_ALLOW_REMOTE !== 'true' || token.length < 32)) {
    throw new Error('Acesso remoto exige FGUA_MCP_ALLOW_REMOTE=true e FGUA_MCP_TOKEN com pelo menos 32 caracteres.');
  }
  if (remote && !(process.env.FGUA_MCP_ALLOWED_HOSTS || '').trim()) {
    throw new Error('Acesso remoto exige FGUA_MCP_ALLOWED_HOSTS com hosts autorizados.');
  }

  const runtime = await createRuntime();
  const handler = createMcpHandler(() => createFguaMcpServer(runtime), {
    onerror: error => console.error('[FGUA MCP]', error)
  });

  const http = createServer(async (req, res) => {
    try {
      const origin = req.headers.origin;
      const hostHeader = String(req.headers.host || '').toLowerCase();
      if (remote) {
        const hosts = (process.env.FGUA_MCP_ALLOWED_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
        if (!hosts.includes(hostHeader)) { res.writeHead(403); res.end('Invalid Host'); return; }
      } else if (!['localhost:' + port, '127.0.0.1:' + port].includes(hostHeader)) {
        res.writeHead(403); res.end('Invalid Host'); return;
      }
      if (!allowedOrigin(origin, port)) { res.writeHead(403); res.end('Invalid Origin'); return; }

      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders(origin));
        res.end();
        return;
      }
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', ...corsHeaders(origin) });
        res.end(JSON.stringify({ ok: true, service: 'fgua-mcp', ...runtime.status() }));
        return;
      }
      if (req.url !== '/mcp') {
        res.writeHead(404, { 'content-type': 'application/json', ...corsHeaders(origin) });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
      if (token && req.headers.authorization !== 'Bearer ' + token) {
        res.writeHead(401, { 'www-authenticate': 'Bearer', ...corsHeaders(origin) });
        res.end('Unauthorized');
        return;
      }

      const body = await readBody(req);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
        else if (value !== undefined) headers.set(key, value);
      }
      const url = new URL(req.url, 'http://' + hostHeader);
      const request = new Request(url, {
        method: req.method,
        headers,
        ...(body.length && !['GET', 'HEAD'].includes(req.method) ? { body, duplex: 'half' } : {})
      });
      const response = await handler.fetch(request);
      const responseHeaders = Object.fromEntries(response.headers.entries());
      Object.assign(responseHeaders, corsHeaders(origin));
      res.writeHead(response.status, responseHeaders);
      if (!response.body) { res.end(); return; }
      for await (const chunk of response.body) res.write(Buffer.from(chunk));
      res.end();
    } catch (error) {
      const status = error.status || 500;
      if (!res.headersSent) res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  await new Promise((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, host, resolve);
  });
  console.error('[FGUA MCP] HTTP listening at http://' + host + ':' + port + '/mcp');
  const close = async () => {
    await handler.close();
    await new Promise(resolve => http.close(resolve));
  };
  process.once('SIGINT', () => close().finally(() => process.exit(0)));
  process.once('SIGTERM', () => close().finally(() => process.exit(0)));
  return { http, handler, close };
}
