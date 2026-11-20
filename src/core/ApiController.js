import { uid, nowIso, normalizeBaseUrl, joinPath } from './utils.js';

const KNOWN_MODES = new Set(['demo', 'local', 'remote']);
const DEFAULT_CONTRACT_NAMESPACES = [
  'system', 'models', 'metadata', 'quantization', 'generators', 'frames', 'images', 'videos',
  'engines', 'repack', 'tools', 'users', 'permissions', 'config', 'jobs', 'storage'
];

function normalizeMode(mode) {
  const m = String(mode || '').toLowerCase();
  return KNOWN_MODES.has(m) ? m : 'demo';
}

export class ApiController {
  constructor(options = {}) {
    this.mode = normalizeMode(options.mode || 'demo');
    this.basePath = options.basePath || '/api/v1';
    this.contractBase = options.contractBase || this.basePath;
    this.backend = {
      localUrl: normalizeBaseUrl(options?.backend?.localUrl ?? options.localUrl ?? null),
      remoteUrl: normalizeBaseUrl(options?.backend?.remoteUrl ?? options.remoteUrl ?? null),
      connected: !!options?.backend?.connected,
    };
    this.baseUrl = normalizeBaseUrl(options.baseUrl || this.backend.remoteUrl || this.backend.localUrl || null);
    this.adapters = new Map();
    this.middlewares = [];
    this.headers = options.headers && typeof options.headers === 'object' ? { ...options.headers } : {};
    this.timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 30000;
    this.namespaces = Array.isArray(options.namespaces) && options.namespaces.length ? [...options.namespaces] : DEFAULT_CONTRACT_NAMESPACES.map((n) => `${this.basePath}/${n}/`);
  }

  registerAdapter(name, fn) {
    if (!name || typeof fn !== 'function') return false;
    this.adapters.set(name, fn);
    return true;
  }

  use(mw) {
    if (typeof mw === 'function') this.middlewares.push(mw);
  }

  configure(config = {}) {
    if (config.mode !== undefined) this.mode = normalizeMode(config.mode);
    if (config.base !== undefined || config.basePath !== undefined) {
      const b = String(config.base ?? config.basePath ?? this.basePath).trim() || '/api/v1';
      this.basePath = b.startsWith('/') ? b : `/${b}`;
      this.contractBase = this.basePath;
    }
    if (config.backend && typeof config.backend === 'object') {
      this.backend = {
        localUrl: config.backend.localUrl !== undefined ? normalizeBaseUrl(config.backend.localUrl) : this.backend.localUrl,
        remoteUrl: config.backend.remoteUrl !== undefined ? normalizeBaseUrl(config.backend.remoteUrl) : this.backend.remoteUrl,
        connected: config.backend.connected !== undefined ? !!config.backend.connected : this.backend.connected,
      };
    }
    if (config.baseUrl !== undefined) this.baseUrl = normalizeBaseUrl(config.baseUrl);
    if (config.headers !== undefined && config.headers && typeof config.headers === 'object') this.headers = { ...config.headers };
    if (config.timeoutMs !== undefined && Number.isFinite(Number(config.timeoutMs))) this.timeoutMs = Number(config.timeoutMs);
    if (Array.isArray(config.namespaces)) this.namespaces = [...config.namespaces];

    // Derive effective baseUrl from mode/backends when explicit baseUrl not provided in this call
    if (config.baseUrl === undefined) {
      if (this.mode === 'remote') this.baseUrl = this.backend.remoteUrl || this.baseUrl;
      else if (this.mode === 'local') this.baseUrl = this.backend.localUrl || this.backend.remoteUrl || this.baseUrl;
      else this.baseUrl = this.baseUrl || null;
    }

    return this.getConfig();
  }

  getConfig() {
    return {
      mode: this.mode,
      basePath: this.basePath,
      baseUrl: this.baseUrl,
      backend: { ...this.backend },
      timeoutMs: this.timeoutMs,
      headers: { ...this.headers },
    };
  }

  _resp(ok, state, data = null, error = null, meta = {}) {
    return { ok: !!ok, state, data, error, meta: { at: nowIso(), requestId: uid('req'), mode: this.mode, ...meta } };
  }

  _resolvePath(path) {
    const p = String(path || '');
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/api/')) return p;
    if (p.startsWith('/')) return p;
    return joinPath(this.basePath, p.startsWith('/') ? p : `/${p}`);
  }

  _effectiveBaseUrl(options = {}) {
    if (options.baseUrl) return normalizeBaseUrl(options.baseUrl);
    if (this.mode === 'remote') return normalizeBaseUrl(this.backend.remoteUrl || this.baseUrl);
    if (this.mode === 'local') return normalizeBaseUrl(this.backend.localUrl || this.baseUrl);
    if (options.forceRemote) return normalizeBaseUrl(this.backend.remoteUrl || this.backend.localUrl || this.baseUrl);
    return null;
  }

  async request(method, path, body = null, options = {}) {
    const reqPath = this._resolvePath(path);
    const ctx = { method, path: reqPath, body, options, controller: this };
    for (const mw of this.middlewares) {
      try { await mw(ctx); } catch (e) {
        return this._resp(false, 'error', null, { code: 'MIDDLEWARE_ERROR', message: e?.message || String(e) }, { path: reqPath });
      }
    }

    if (options.adapter && this.adapters.has(options.adapter)) {
      try {
        const data = await this.adapters.get(options.adapter)(ctx);
        return this._resp(true, 'ok', data, null, { adapter: options.adapter, path: reqPath });
      } catch (e) {
        return this._resp(false, 'error', null, { code: 'ADAPTER_ERROR', message: e?.message || String(e) }, { adapter: options.adapter, path: reqPath });
      }
    }

    const baseUrl = this._effectiveBaseUrl(options);
    if (!baseUrl || (this.mode === 'demo' && !options.forceRemote)) {
      return this._resp(false, 'unavailable', null, {
        code: 'BACKEND_UNAVAILABLE',
        message: 'Nenhum backend/provedor conectado para esta operação. Configure um endpoint compatível (local/remoto) ou use recursos locais disponíveis.',
        details: { method, path: reqPath, mode: this.mode, hint: 'Defina baseUrl/backend em configs/api.json ou via configuração em runtime.' }
      }, { hosting: 'static', path: reqPath });
    }

    const url = /^https?:\/\//i.test(reqPath) ? reqPath : joinPath(baseUrl, reqPath);
    const controller = new AbortController();
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : this.timeoutMs;
    const onAbort = () => { try { controller.abort(options.signal?.reason || 'aborted'); } catch {} };
    if (options.signal) {
      if (options.signal.aborted) onAbort();
      else options.signal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = setTimeout(() => { try { controller.abort('timeout'); } catch {} }, Math.max(1, timeoutMs));
    try {
      const headers = { Accept: 'application/json', ...(body != null ? { 'Content-Type': 'application/json' } : {}), ...this.headers, ...(options.headers || {}) };
      const res = await fetch(url, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal,
        ...((options.fetchOptions && typeof options.fetchOptions === 'object') ? options.fetchOptions : {}),
      });
      clearTimeout(timer);
      const contentType = res.headers?.get?.('content-type') || '';
      let data = null;
      if (res.status !== 204) {
        if (contentType.includes('application/json')) {
          try { data = await res.json(); } catch (e) { data = { parseError: e?.message || 'JSON inválido', raw: await res.text().catch(() => '') }; }
        } else {
          const text = await res.text().catch(() => '');
          if (text) {
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
          }
        }
      }
      if (!res.ok) {
        const errMsg = data?.error?.message || data?.message || res.statusText || 'Erro HTTP';
        return this._resp(false, 'error', null, { code: `HTTP_${res.status}`, message: errMsg, details: data }, { status: res.status, url, path: reqPath });
      }
      // Pass through envelopes that already follow contract
      if (data && typeof data === 'object' && 'ok' in data && ('state' in data || 'error' in data || 'data' in data)) {
        return { ...data, meta: { ...(data.meta || {}), status: res.status, url, requestId: data?.meta?.requestId || uid('req') } };
      }
      return this._resp(true, 'ok', data, null, { status: res.status, url, path: reqPath });
    } catch (e) {
      clearTimeout(timer);
      const aborted = e?.name === 'AbortError';
      const reason = controller.signal?.reason;
      const timeout = aborted && (reason === 'timeout');
      return this._resp(false, timeout ? 'timeout' : 'error', null, {
        code: timeout ? 'TIMEOUT' : (aborted ? 'ABORTED' : 'NETWORK_ERROR'),
        message: e?.message || String(e),
      }, { url, path: reqPath, reason: reason ?? null });
    } finally {
      if (options.signal) options.signal.removeEventListener('abort', onAbort);
    }
  }

  get(p, o) { return this.request('GET', p, null, o); }
  post(p, b, o) { return this.request('POST', p, b, o); }
  put(p, b, o) { return this.request('PUT', p, b, o); }
  patch(p, b, o) { return this.request('PATCH', p, b, o); }
  del(p, o) { return this.request('DELETE', p, null, o); }

  getContract() {
    return { base: this.contractBase || this.basePath, namespaces: [...this.namespaces] };
  }
}

export default ApiController;
