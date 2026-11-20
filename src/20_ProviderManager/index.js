import { uid, nowIso } from '../26_Utils/index.js';

export class FrameProviderManager {
  constructor(options = {}) {
    this.providers = new Map();
    this.events = options.events || null;
  }

  register(spec = {}) {
    const p = {
      id: spec.id || uid('provider'),
      name: spec.name || 'Provider',
      type: spec.type || 'Remote REST API', // Browser Local | WebGPU | WebAssembly | Remote REST API | External Inference Service | Custom Provider
      url: spec.url || null,
      capabilities: spec.capabilities || [],
      formats: spec.formats || [],
      models: spec.models || [],
      limits: spec.limits || {},
      state: 'registered',
      authRequired: !!spec.authRequired,
      headers: spec.headers || {},
      timeoutMs: spec.timeoutMs || 30000,
      createdAt: nowIso(),
      lastHealth: null
    };
    this.providers.set(p.id, p);
    this.events?.emit('provider.registered', { id: p.id, name: p.name, type: p.type });
    return p;
  }

  get(id) { return this.providers.get(id) || null; }
  list() { return [...this.providers.values()]; }
  remove(id) { return this.providers.delete(id); }

  async healthCheck(id) {
    const p = this.providers.get(id);
    if (!p) return { ok: false, error: 'Provider não encontrado' };
    if (!p.url || p.type === 'Browser Local' || p.type === 'WebGPU' || p.type === 'WebAssembly') {
      p.state = 'available'; p.lastHealth = { ok: true, at: nowIso(), mode: 'local' };
      this.events?.emit('provider.connected', { id: p.id });
      return p.lastHealth;
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), Math.min(p.timeoutMs, 8000));
      const res = await fetch(p.url.replace(/\/$/, '') + '/health', { signal: ctrl.signal, headers: p.headers }).catch(() => null);
      clearTimeout(t);
      const ok = !!(res && res.ok);
      p.state = ok ? 'connected' : 'unreachable';
      p.lastHealth = { ok, status: res?.status || null, at: nowIso() };
      this.events?.emit(ok ? 'provider.connected' : 'provider.disconnected', { id: p.id });
      return p.lastHealth;
    } catch (e) {
      p.state = 'unreachable';
      p.lastHealth = { ok: false, error: e.message, at: nowIso() };
      this.events?.emit('provider.disconnected', { id: p.id });
      return p.lastHealth;
    }
  }

  select(criteria = {}) {
    const list = this.list().filter(p => p.state !== 'disabled');
    if (criteria.id) return list.find(p => p.id === criteria.id) || null;
    if (criteria.type) {
      const byType = list.filter(p => p.type === criteria.type);
      if (byType.length) return byType[0];
    }
    if (criteria.capability) {
      const byCap = list.find(p => (p.capabilities || []).includes(criteria.capability));
      if (byCap) return byCap;
    }
    return list[0] || null;
  }
}

export default FrameProviderManager;
