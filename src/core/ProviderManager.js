import { uid, nowIso } from './utils.js';

export class ProviderManager {
  constructor(options = {}) {
    this.events = options.events || null;
    this.providers = new Map();
  }

  register(spec = {}) {
    const id = spec.id || uid('provider');
    const prev = this.providers.get(id) || {};
    const provider = {
      ...prev,
      id,
      name: spec.name || prev.name || 'Provider',
      type: spec.type || prev.type || 'unknown',
      url: spec.url ?? prev.url ?? null,
      capabilities: Array.isArray(spec.capabilities) ? [...spec.capabilities] : (Array.isArray(prev.capabilities) ? [...prev.capabilities] : []),
      formats: Array.isArray(spec.formats) ? [...spec.formats] : (Array.isArray(prev.formats) ? [...prev.formats] : []),
      state: spec.state || prev.state || 'registered',
      authRequired: !!spec.authRequired,
      headers: spec.headers && typeof spec.headers === 'object' ? { ...spec.headers } : (prev.headers || {}),
      updatedAt: nowIso(),
      createdAt: prev.createdAt || nowIso(),
    };
    this.providers.set(id, provider);
    this.events?.emit('provider.registered', { id, provider });
    return { ...provider };
  }

  list() {
    return [...this.providers.values()].map((p) => ({ ...p }));
  }

  get(id) {
    const p = this.providers.get(id);
    return p ? { ...p } : null;
  }

  update(id, patch = {}) {
    const prev = this.providers.get(id);
    if (!prev) return null;
    return this.register({ ...prev, ...patch, id });
  }

  remove(id) {
    const ok = this.providers.delete(id);
    if (ok) this.events?.emit('provider.removed', { id });
    return ok;
  }

  select(criteria = {}) {
    const list = this.list();
    if (!list.length) return null;
    if (criteria.id) return list.find((p) => p.id === criteria.id) || null;
    if (criteria.type) return list.find((p) => p.type === criteria.type) || null;
    if (criteria.capability) return list.find((p) => (p.capabilities || []).includes(criteria.capability)) || null;
    return list.find((p) => p.state === 'available' || p.state === 'configured' || p.state === 'connected') || list[0];
  }
}

export default ProviderManager;
