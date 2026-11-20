const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function clone(v) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(v); } catch {}
  }
  return JSON.parse(JSON.stringify(v));
}

export class JsonManager {
  async loadFromUrl(url, options = {}) {
    const res = await fetch(url, { cache: options.cache ?? 'no-store', signal: options.signal });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ao carregar ${url}`);
      err.status = res.status;
      err.url = url;
      throw err;
    }
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      const err = new Error(`JSON inválido em ${url}: ${e?.message || e}`);
      err.url = url;
      throw err;
    }
  }

  parse(text) {
    return JSON.parse(text);
  }

  stringify(obj, pretty = true) {
    return JSON.stringify(obj, null, pretty ? 2 : 0);
  }

  validate(data, schema = {}) {
    const errors = [];
    if (!schema || typeof schema !== 'object') return { ok: true, errors };
    if (Array.isArray(schema.required)) {
      for (const k of schema.required) {
        if (!(data && typeof data === 'object' && k in data)) errors.push(`Campo obrigatório ausente: ${k}`);
      }
    }
    if (schema.properties && data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [k, rule] of Object.entries(schema.properties)) {
        if (!(k in data) || !rule || typeof rule !== 'object') continue;
        if (rule.type) {
          const actual = Array.isArray(data[k]) ? 'array' : (data[k] === null ? 'null' : typeof data[k]);
          if (rule.type !== actual) errors.push(`Tipo inválido em ${k}: esperado ${rule.type}, recebido ${actual}`);
        }
        if (rule.enum && Array.isArray(rule.enum) && !rule.enum.includes(data[k])) {
          errors.push(`Valor inválido em ${k}`);
        }
      }
    }
    if (schema.type) {
      const actual = Array.isArray(data) ? 'array' : (data === null ? 'null' : typeof data);
      if (schema.type !== actual) errors.push(`Tipo inválido: esperado ${schema.type}, recebido ${actual}`);
    }
    return { ok: errors.length === 0, errors };
  }

  merge(base, patch) {
    if (isPlainObject(base) && isPlainObject(patch)) {
      const out = { ...base };
      for (const [k, v] of Object.entries(patch)) {
        if (DANGEROUS_KEYS.has(k)) continue;
        out[k] = isPlainObject(v) ? this.merge(isPlainObject(out[k]) ? out[k] : {}, v) : (Array.isArray(v) ? clone(v) : v);
      }
      return out;
    }
    if (Array.isArray(patch)) return clone(patch);
    if (isPlainObject(patch)) return this.merge({}, patch);
    return patch;
  }

  export(data) { return this.stringify(data, true); }
  import(text) { return this.parse(text); }
}

export default JsonManager;
