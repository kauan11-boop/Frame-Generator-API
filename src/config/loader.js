/**
 * FGUA v2 — carregador/validador de configuração JSON.
 * Resolve caminhos relativos ao módulo (funciona no GitHub Pages em qualquer subpasta).
 */

import { emit } from '../core/bus.js';

const cache = new Map();
const REPO_ROOT = new URL('../../', import.meta.url); // raiz do repositório

export function configUrl(relPath) {
  return new URL(relPath, REPO_ROOT).href;
}

const REQUIRED_KEYS = {
  'configs/api.json': ['version', 'contract', 'namespaces'],
  'configs/models.json': ['version', 'models'],
  'configs/generators.json': ['version', 'genres'],
  'configs/repacks.json': ['version', 'repacks'],
  'configs/permissions.json': ['version', 'roles', 'users'],
  'configs/settings.json': ['version', 'locale', 'mode']
};

function validate(name, json) {
  const req = REQUIRED_KEYS[name];
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`Config ${name} inválida: raiz deve ser objeto.`);
  }
  if (req) {
    for (const k of req) {
      if (!(k in json)) throw new Error(`Config ${name} sem chave obrigatória "${k}".`);
    }
  }
  return json;
}

export async function loadConfig(name, { fresh = false } = {}) {
  if (!fresh && cache.has(name)) return cache.get(name);
  const url = name.startsWith('configs/') ? configUrl(name) : configUrl(`configs/${name.endsWith('.json') ? name : name + '.json'}`);
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Falha ao carregar ${name}: HTTP ${res.status}`);
  const json = await res.json();
  const validated = validate(name, json);
  cache.set(name, validated);
  emit('config:loaded', { name });
  return validated;
}

/** mescla overrides persistidos em storage sobre os defaults do settings.json */
export function applyOverrides(settings, overrides) {
  if (!overrides || typeof overrides !== 'object') return settings;
  const out = structuredClone(settings);
  for (const [k, v] of Object.entries(overrides)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = { ...out[k], ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function clearCache() {
  cache.clear();
}

export default { loadConfig, configUrl, applyOverrides, clearCache };
