import http from 'node:http';
import { BRIDGE_HOST, BRIDGE_PORT, VERSION } from './config.js';
import { dispatch } from './engine/tools.js';
import { close as closeRea } from './rea.js';

const MAX_BODY = 2 * 1024 * 1024;
const ALLOWED_ORIGIN = (origin) =>
  /^https:\/\/kauan11-boop\.github\.io$/i.test(origin) ||
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

function corsHeaders(req) {
  const origin = req?.headers?.origin || '';
  const headers = { vary: 'Origin' };
  if (ALLOWED_ORIGIN(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-credentials'] = 'true';
    headers['access-control-allow-headers'] = 'content-type';
    headers['access-control-allow-methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
    headers['access-control-allow-private-network'] = 'true';
    headers['access-control-max-age'] = '600';
  }
  return headers;
}

function json(res, status, payload, req) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...corsHeaders(req),
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload, null, 2));
}

function preflight(req, res) {
  res.writeHead(204, corsHeaders(req));
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error('Corpo da requisição excede 2 MB')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') return preflight(req, res);
  const url = new URL(req.url, `http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  const route = `${req.method} ${url.pathname}`;
  const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
  const query = Object.fromEntries(url.searchParams);

  if (route === 'GET /api/health') return json(res, 200, { ok: true, version: VERSION }, req);
  if (route === 'GET /api/status') return json(res, 200, await dispatch('fgua_status'), req);

  if (route === 'GET /api/presets') return json(res, 200, await dispatch('fgua_presets', { action: 'list', kind: query.kind }), req);
  if (route === 'POST /api/presets') return json(res, 200, await dispatch('fgua_presets', { action: 'save', preset: body.preset || body }), req);
  if (route === 'DELETE /api/presets' || route.startsWith('DELETE /api/presets/')) {
    const id = url.pathname.split('/').pop() || body.id;
    return json(res, 200, await dispatch('fgua_presets', { action: 'delete', id }), req);
  }

  if (route === 'GET /api/prompts') return json(res, 200, await dispatch('fgua_prompts', { action: 'list' }), req);
  if (route === 'POST /api/prompts') return json(res, 200, await dispatch('fgua_prompts', { action: 'save', prompt: body.prompt || body }), req);
  if (route === 'POST /api/prompts/render') return json(res, 200, await dispatch('fgua_prompts', { action: 'render', id: body.id, variables: body.variables || {} }), req);
  if (route === 'DELETE /api/prompts' || route.startsWith('DELETE /api/prompts/')) {
    const id = url.pathname.split('/').pop() || body.id;
    return json(res, 200, await dispatch('fgua_prompts', { action: 'delete', id }), req);
  }

  if (route === 'GET /api/settings') return json(res, 200, await dispatch('fgua_settings', { action: 'get' }), req);
  if (route === 'PATCH /api/settings' || route === 'POST /api/settings') {
    return json(res, 200, await dispatch('fgua_settings', { action: 'update', patch: body.patch || body }), req);
  }

  if (route === 'GET /api/rea/catalog') {
    return json(res, 200, await dispatch('fgua_rea_catalog', {
      query: query.query || '', limit: Number(query.limit || 50),
    }), req);
  }
  if (route === 'POST /api/rea/call') {
    return json(res, 200, await dispatch('fgua_rea_call', { tool: body.tool, args: body.args || {} }), req);
  }

  if (route === 'POST /api/reverse') return json(res, 200, await dispatch('fgua_reverse_file', body), req);
  if (route === 'POST /api/repair') return json(res, 200, await dispatch('fgua_repair_code', body), req);
  if (route === 'POST /api/transpile') return json(res, 200, await dispatch('fgua_transpile_code', body), req);
  if (route === 'POST /api/run-tests') return json(res, 200, await dispatch('fgua_run_tests', body), req);

  if (route === 'GET /api/jobs') return json(res, 200, await dispatch('fgua_jobs', { action: 'list' }), req);
  if (route.startsWith('GET /api/jobs/')) {
    const id = url.pathname.split('/').pop();
    return json(res, 200, await dispatch('fgua_jobs', { action: 'get', id }), req);
  }

  return json(res, 404, { error: 'Rota não encontrada', route }, req);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    json(res, error?.status || 500, { error: error?.message || String(error) }, req);
  });
});

server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
  console.log(`[FGUA] bridge em http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  console.log('[FGUA] dashboard: https://kauan11-boop.github.io/Frame-Generator-API/');
});

async function shutdown() {
  server.close();
  try { await closeRea(); } catch { /* noop */ }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
