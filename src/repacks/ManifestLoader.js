import { deepMergeSafe } from '../core/utils.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function safeObject(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

export class ManifestLoader {
  validate(manifest) {
    const errors = [];
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      return { ok: false, errors: ['Manifesto inválido (objeto esperado).'] };
    }
    for (const k of Object.keys(manifest)) if (DANGEROUS_KEYS.has(k)) errors.push(`Chave proibida: ${k}`);
    if (!manifest.id || typeof manifest.id !== 'string') errors.push('id ausente ou inválido.');
    if (!manifest.name || typeof manifest.name !== 'string') errors.push('name ausente ou inválido.');
    if (manifest.version != null && typeof manifest.version !== 'string') errors.push('version deve ser string.');
    if (manifest.modules != null && !Array.isArray(manifest.modules)) errors.push('modules deve ser array.');
    if (manifest.dependencies != null && !Array.isArray(manifest.dependencies)) errors.push('dependencies deve ser array.');
    if (manifest.permissions != null && !Array.isArray(manifest.permissions)) errors.push('permissions deve ser array.');
    if (manifest.configuration != null && (typeof manifest.configuration !== 'object' || Array.isArray(manifest.configuration))) errors.push('configuration deve ser objeto.');
    if (Array.isArray(manifest.modules)) {
      manifest.modules.forEach((m, i) => {
        if (!m || typeof m !== 'object') errors.push(`modules[${i}] inválido.`);
        else if (m.id && typeof m.id !== 'string') errors.push(`modules[${i}].id inválido.`);
      });
    }
    return { ok: errors.length === 0, errors };
  }

  normalize(manifest) {
    const m = safeObject(manifest);
    const base = {
      id: typeof m.id === 'string' ? m.id.trim() : '',
      name: typeof m.name === 'string' ? m.name.trim() : (typeof m.id === 'string' ? m.id.trim() : ''),
      version: typeof m.version === 'string' ? m.version : '1.0.0',
      enabled: m.enabled !== false,
      modules: Array.isArray(m.modules) ? m.modules.map((x) => deepMergeSafe({}, x)).filter((x) => x && typeof x === 'object') : [],
      dependencies: Array.isArray(m.dependencies) ? [...m.dependencies] : [],
      permissions: Array.isArray(m.permissions) ? [...m.permissions].filter((x) => typeof x === 'string') : [],
      configuration: deepMergeSafe({}, safeObject(m.configuration)),
      description: typeof m.description === 'string' ? m.description : undefined,
    };
    // Preserve extra safe metadata without overriding normalized core fields
    const extras = {};
    for (const [k, v] of Object.entries(m)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      if (k in base) continue;
      extras[k] = (v && typeof v === 'object') ? deepMergeSafe(Array.isArray(v) ? [] : {}, v) : v;
    }
    return { ...extras, ...base };
  }

  async loadFromUrl(url, options = {}) {
    if (!url || typeof url !== 'string') throw new Error('URL de manifesto inválida.');
    const res = await fetch(url, { cache: options.cache ?? 'no-store', signal: options.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao carregar manifesto`);
    const text = await res.text();
    let m;
    try { m = text ? JSON.parse(text) : null; } catch (e) { throw new Error(`Manifesto JSON inválido: ${e?.message || e}`); }
    const v = this.validate(m);
    if (!v.ok) throw new Error(`Manifesto inválido: ${v.errors.join('; ')}`);
    return this.normalize(m);
  }
}

export default ManifestLoader;
