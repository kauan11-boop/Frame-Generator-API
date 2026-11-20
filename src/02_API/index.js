import { uid, nowIso, safeJsonParse } from '../26_Utils/index.js';

export class FrameGeneratorAPI {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || null; // endpoint externo opcional
    this.mode = options.mode || 'auto'; // auto | local | remote | demo
    this.adapters = new Map();
    this.middlewares = [];
    this.defaultHeaders = options.headers || {};
    this.timeoutMs = options.timeoutMs || 30000;
  }

  registerAdapter(name, adapter) { this.adapters.set(name, adapter); }
  use(mw) { if (typeof mw === 'function') this.middlewares.push(mw); }

  async _applyMiddlewares(ctx) {
    for (const mw of this.middlewares) { await mw(ctx); }
  }

  _response(ok, data, error = null, meta = {}) {
    return { ok, data, error, meta: { at: nowIso(), requestId: uid('req'), ...meta } };
  }

  async request(method, path, body = null, options = {}) {
    const ctx = { method, path, body, options };
    await this._applyMiddlewares(ctx);

    // adapter local explícito
    if (options.adapter && this.adapters.has(options.adapter)) {
      try { const data = await this.adapters.get(options.adapter)({ method, path, body, options, api: this }); return this._response(true, data, null, { adapter: options.adapter }); }
      catch (e) { return this._response(false, null, { code: 'ADAPTER_ERROR', message: e.message }, { adapter: options.adapter }); }
    }

    // modo local/demo sem baseUrl: contrato lógico sem backend
    if (!this.baseUrl || this.mode === 'demo' || (this.mode === 'local' && !options.forceRemote)) {
      return this._localContract(method, path, body);
    }

    const url = this.baseUrl.replace(/\/$/, '') + path;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Accept': 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...this.defaultHeaders, ...(options.headers || {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal
      });
      clearTimeout(t);
      const text = await res.text();
      const parsed = safeJsonParse(text);
      const data = parsed.ok ? parsed.value : { raw: text };
      if (!res.ok) return this._response(false, null, { code: `HTTP_${res.status}`, message: data?.message || res.statusText, details: data }, { status: res.status });
      return this._response(true, data, null, { status: res.status });
    } catch (e) {
      clearTimeout(t);
      const code = e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
      return this._response(false, null, { code, message: e.message }, { url });
    }
  }

  _localContract(method, path) {
    // Em GitHub Pages não há servidor REST: expõe estado explícito
    return this._response(false, null, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Nenhum provedor/backend conectado para este endpoint. Configure um endpoint externo ou utilize processamento local compatível.',
      contract: { method, path }
    }, { mode: this.mode || 'local', hosting: 'static' });
  }

  get(path, opt) { return this.request('GET', path, null, opt); }
  post(path, body, opt) { return this.request('POST', path, body, opt); }
  put(path, body, opt) { return this.request('PUT', path, body, opt); }
  del(path, opt) { return this.request('DELETE', path, null, opt); }

  configure({ baseUrl, mode, headers, timeoutMs } = {}) {
    if (baseUrl !== undefined) this.baseUrl = baseUrl;
    if (mode !== undefined) this.mode = mode;
    if (headers !== undefined) this.defaultHeaders = headers;
    if (timeoutMs !== undefined) this.timeoutMs = timeoutMs;
    return { baseUrl: this.baseUrl, mode: this.mode };
  }

  getContract() {
    return {
      base: '/api/v1',
      endpoints: [
        'GET /api/v1/status','GET /api/v1/system','GET /api/v1/generators','GET /api/v1/generators/{id}','POST /api/v1/generators/register','POST /api/v1/generators/{id}/execute','POST /api/v1/generators/{id}/stop',
        'GET /api/v1/models','POST /api/v1/models/register','POST /api/v1/models/load','POST /api/v1/models/unload','GET /api/v1/models/metadata','POST /api/v1/models/analyze','POST /api/v1/models/quantization/analyze','POST /api/v1/models/quantization/execute',
        'GET /api/v1/tools','POST /api/v1/tools/register','GET /api/v1/repacks','POST /api/v1/repacks/load','POST /api/v1/repacks/execute','GET /api/v1/controllers','POST /api/v1/controllers/register',
        'GET /api/v1/tasks','POST /api/v1/tasks','GET /api/v1/users','POST /api/v1/users','GET /api/v1/config','POST /api/v1/config'
      ]
    };
  }
}

export default FrameGeneratorAPI;
