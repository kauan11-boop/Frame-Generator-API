import { normalizeBaseUrl, joinPath } from '../core/utils.js';

function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

export class BackendAdapter {
  constructor(options = {}) {
    this.id = options.id || 'backend';
    this.name = options.name || 'Backend Adapter';
    this.baseUrl = normalizeBaseUrl(options.baseUrl || null);
    this.type = options.type || 'remote';
    this.headers = options.headers && typeof options.headers === 'object' ? { ...options.headers } : {};
    this.timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 30000;
    this.state = this.baseUrl ? 'configured' : 'unconfigured';
    this.lastHealth = null;
  }

  configure({ baseUrl, type, headers, timeoutMs } = {}) {
    if (baseUrl !== undefined) this.baseUrl = normalizeBaseUrl(baseUrl);
    if (type !== undefined) this.type = type;
    if (headers !== undefined && headers && typeof headers === 'object') this.headers = { ...headers };
    if (timeoutMs !== undefined && Number.isFinite(Number(timeoutMs))) this.timeoutMs = Number(timeoutMs);
    if (this.baseUrl && !isAllowedUrl(this.baseUrl)) {
      this.state = 'invalid';
    } else {
      this.state = this.baseUrl ? 'configured' : 'unconfigured';
    }
    return this.getStatus();
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      baseUrl: this.baseUrl,
      state: this.state,
      timeoutMs: this.timeoutMs,
      lastHealth: this.lastHealth,
    };
  }

  async health(options = {}) {
    if (!this.baseUrl) {
      this.state = 'unconfigured';
      this.lastHealth = { ok: false, state: this.state, checkedAt: new Date().toISOString(), reason: 'baseUrl ausente' };
      return { ...this.lastHealth };
    }
    if (!isAllowedUrl(this.baseUrl)) {
      this.state = 'invalid';
      this.lastHealth = { ok: false, state: this.state, checkedAt: new Date().toISOString(), reason: 'URL inválida' };
      return { ...this.lastHealth };
    }
    const ctrl = new AbortController();
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : Math.min(this.timeoutMs, 8000);
    const timer = setTimeout(() => { try { ctrl.abort('timeout'); } catch {} }, Math.max(1, timeoutMs));
    try {
      const url = joinPath(this.baseUrl, '/health');
      const r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json', ...this.headers }, signal: ctrl.signal });
      clearTimeout(timer);
      const ok = r.ok;
      this.state = ok ? 'connected' : 'unreachable';
      this.lastHealth = { ok, state: this.state, status: r.status, url, checkedAt: new Date().toISOString() };
      return { ...this.lastHealth };
    } catch (e) {
      clearTimeout(timer);
      this.state = 'unreachable';
      this.lastHealth = { ok: false, state: this.state, error: e?.message || String(e), reason: ctrl.signal?.reason || null, checkedAt: new Date().toISOString() };
      return { ...this.lastHealth };
    }
  }

  async request(path, options = {}) {
    if (!this.baseUrl) return { ok: false, state: 'unconfigured', error: { code: 'UNCONFIGURED', message: 'Backend não configurado.' } };
    if (!isAllowedUrl(this.baseUrl)) return { ok: false, state: 'invalid', error: { code: 'INVALID_BASE_URL', message: 'URL base inválida.' } };
    const reqPath = String(path || '');
    const url = /^https?:\/\//i.test(reqPath) ? reqPath : joinPath(this.baseUrl, reqPath);
    const ctrl = new AbortController();
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : this.timeoutMs;
    const timer = setTimeout(() => { try { ctrl.abort('timeout'); } catch {} }, Math.max(1, timeoutMs));
    try {
      const headers = { Accept: 'application/json', ...(options.body != null ? { 'Content-Type': 'application/json' } : {}), ...this.headers, ...(options.headers || {}) };
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body == null ? undefined : JSON.stringify(options.body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      let data = null;
      if (res.status !== 204) {
        const text = await res.text().catch(() => '');
        if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
      }
      if (!res.ok) return { ok: false, state: 'error', status: res.status, error: { code: `HTTP_${res.status}`, message: data?.error?.message || data?.message || res.statusText, details: data }, data: null };
      return { ok: true, state: 'ok', status: res.status, data, error: null };
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, state: ctrl.signal?.reason === 'timeout' ? 'timeout' : 'error', error: { code: ctrl.signal?.reason === 'timeout' ? 'TIMEOUT' : 'NETWORK_ERROR', message: e?.message || String(e) } };
    }
  }
}

export default BackendAdapter;
