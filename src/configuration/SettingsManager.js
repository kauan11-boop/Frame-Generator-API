import { JsonManager } from './JsonManager.js';

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function clone(v) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(v); } catch {}
  }
  return JSON.parse(JSON.stringify(v));
}

export class SettingsManager {
  constructor() {
    this.json = new JsonManager();
    this.configs = new Map();
    this.defaults = new Map();
    this.schemas = new Map();
  }

  setDefaults(name, val) { this.defaults.set(name, clone(val)); }
  registerSchema(name, schema) { this.schemas.set(name, schema); }

  async load(name, source, options = {}) {
    const def = this.defaults.get(name);
    let data = isPlainObject(def) ? clone(def) : (def != null ? clone(def) : {});
    let loadError = null;
    let resolvedSource = 'default';

    try {
      if (typeof source === 'string') {
        resolvedSource = source;
        const loaded = await this.json.loadFromUrl(source, options);
        data = isPlainObject(def) && isPlainObject(loaded) ? this.json.merge(def, loaded) : (loaded ?? data);
      } else if (isPlainObject(source)) {
        resolvedSource = 'object';
        data = isPlainObject(def) ? this.json.merge(def, source) : clone(source);
      } else if (source != null) {
        resolvedSource = 'value';
        data = source;
      }
    } catch (e) {
      loadError = { message: e?.message || String(e), status: e?.status || null, url: e?.url || (typeof source === 'string' ? source : null) };
      data = isPlainObject(def) ? clone(def) : (def != null ? clone(def) : {});
      resolvedSource = typeof source === 'string' ? source : resolvedSource;
    }

    const validation = this.json.validate(data, this.schemas.get(name) || {});
    const entry = {
      name,
      data,
      validation,
      loaded: !loadError,
      error: loadError,
      updatedAt: new Date().toISOString(),
      source: resolvedSource,
    };
    this.configs.set(name, entry);
    return data;
  }

  get(name) { return this.configs.get(name)?.data ?? (this.defaults.has(name) ? clone(this.defaults.get(name)) : {}); }
  getEntry(name) { const e = this.configs.get(name); return e ? { ...e, data: clone(e.data) } : null; }
  list() { return [...this.configs.keys()]; }

  set(name, data) {
    const validation = this.json.validate(data, this.schemas.get(name) || {});
    this.configs.set(name, {
      name,
      data: clone(data),
      validation,
      loaded: true,
      error: null,
      updatedAt: new Date().toISOString(),
      source: 'set',
    });
    return this.get(name);
  }

  update(name, patch) {
    const cur = this.get(name);
    if (isPlainObject(cur) && isPlainObject(patch)) return this.set(name, this.json.merge(cur, patch));
    return this.set(name, patch);
  }

  export(name) { return this.json.export(this.get(name)); }
  import(name, text) { return this.set(name, this.json.import(text)); }
  restoreDefaults(name) { return this.set(name, clone(this.defaults.get(name) || {})); }
}

export default SettingsManager;
