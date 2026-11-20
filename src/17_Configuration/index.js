import { deepClone, isPlainObject, safeJsonParse } from '../26_Utils/index.js';
import { logger } from '../23_Logging/index.js';

export class FrameConfigurationManager {
  constructor(options = {}) {
    this.configs = new Map();
    this.defaults = new Map();
    this.schemas = new Map();
    this.storageKeyPrefix = options.storageKeyPrefix || 'fgua:config:';
  }

  registerSchema(name, schema) { this.schemas.set(name, schema); }
  setDefaults(name, value) { this.defaults.set(name, deepClone(value)); }

  async load(name, source) {
    let data = null;
    if (typeof source === 'string') {
      try {
        const res = await fetch(source, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      } catch (e) {
        logger.warn(`Falha ao carregar config ${name} de ${source}`, { message: e.message }, 'config');
        data = deepClone(this.defaults.get(name) || {});
      }
    } else if (isPlainObject(source)) {
      data = deepClone(source);
    } else {
      data = deepClone(this.defaults.get(name) || {});
    }
    const merged = this._mergeDefaults(name, data);
    const validation = this.validate(name, merged);
    this.configs.set(name, { name, data: merged, validation, updatedAt: new Date().toISOString(), source: typeof source === 'string' ? source : 'object' });
    return this.get(name);
  }

  _mergeDefaults(name, data) {
    const def = this.defaults.get(name);
    if (!isPlainObject(def)) return data;
    return { ...def, ...(isPlainObject(data) ? data : {}) };
  }

  validate(name, data) {
    const errors = [];
    const schema = this.schemas.get(name);
    if (schema?.required && Array.isArray(schema.required)) {
      for (const k of schema.required) if (!(k in (data || {}))) errors.push(`Campo obrigatório ausente: ${k}`);
    }
    if (schema?.properties && isPlainObject(schema.properties) && isPlainObject(data)) {
      for (const [k, rule] of Object.entries(schema.properties)) {
        if (k in data && rule.type) {
          const t = Array.isArray(data[k]) ? 'array' : typeof data[k];
          if (rule.type !== t) errors.push(`Tipo inválido em ${k}: esperado ${rule.type}, recebido ${t}`);
        }
      }
    }
    return { ok: errors.length === 0, errors, unknownProperties: [] };
  }

  get(name) { return this.configs.get(name)?.data ?? deepClone(this.defaults.get(name) || {}); }
  getEntry(name) { return this.configs.get(name) || null; }
  list() { return [...this.configs.keys()]; }

  set(name, data) {
    const validation = this.validate(name, data);
    this.configs.set(name, { name, data: deepClone(data), validation, updatedAt: new Date().toISOString(), source: 'set' });
    return this.getEntry(name);
  }

  update(name, patch) {
    const cur = this.get(name);
    const next = isPlainObject(cur) && isPlainObject(patch) ? { ...cur, ...patch } : patch;
    return this.set(name, next);
  }

  exportJson(name) { return JSON.stringify(this.get(name), null, 2); }
  importJson(name, jsonText) {
    const parsed = safeJsonParse(jsonText);
    if (!parsed.ok) throw new Error(`JSON inválido: ${parsed.error.message}`);
    return this.set(name, parsed.value);
  }

  restoreDefaults(name) { return this.set(name, deepClone(this.defaults.get(name) || {})); }

  saveToLocal(name) {
    try { localStorage.setItem(this.storageKeyPrefix + name, this.exportJson(name)); return true; } catch { return false; }
  }
  loadFromLocal(name) {
    try {
      const t = localStorage.getItem(this.storageKeyPrefix + name);
      if (!t) return null;
      return this.importJson(name, t);
    } catch { return null; }
  }
}

export default FrameConfigurationManager;
