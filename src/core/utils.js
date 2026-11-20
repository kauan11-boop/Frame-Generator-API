const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

export function safeClone(value) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch {}
  }
  return JSON.parse(JSON.stringify(value));
}

export function deepMergeSafe(target, source) {
  if (!isPlainObject(source)) return safeClone(source);
  const out = isPlainObject(target) ? { ...target } : {};
  for (const [key, val] of Object.entries(source)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    if (isPlainObject(val)) out[key] = deepMergeSafe(out[key], val);
    else if (Array.isArray(val)) out[key] = val.map((v) => (isPlainObject(v) || Array.isArray(v) ? deepMergeSafe(Array.isArray(v) ? [] : {}, v) : v));
    else out[key] = val;
  }
  return out;
}

export function sanitizeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix = 'id') {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

export function ok(data = null, meta = {}) {
  return { ok: true, state: meta.state || 'ok', data, error: null, meta: { at: nowIso(), ...meta } };
}

export function fail(code, message, details = null, meta = {}) {
  return {
    ok: false,
    state: meta.state || 'error',
    data: meta.data ?? null,
    error: { code: code || 'ERROR', message: message || 'Erro desconhecido.', ...(details != null ? { details } : {}) },
    meta: { at: nowIso(), ...meta }
  };
}

export function unavailable(code, message, details = null, meta = {}) {
  return fail(code || 'UNAVAILABLE', message || 'Operação indisponível.', details, { ...meta, state: meta.state || 'unavailable' });
}

export function toText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function normalizeBaseUrl(url) {
  if (url == null || url === '') return null;
  const s = String(url).trim();
  if (!s) return null;
  return s.replace(/\/+$/, '');
}

export function joinPath(base, path) {
  const b = normalizeBaseUrl(base) || '';
  const p = String(path || '');
  if (!b) return p.startsWith('/') ? p : `/${p}`;
  if (!p) return b;
  if (p.startsWith('/')) return `${b}${p}`;
  return `${b}/${p}`;
}
