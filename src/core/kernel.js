/**
 * FGUA v2 — kernel do núcleo.
 * Boot único que inicializa todos os subsistemas e expõe registro central.
 */

import { emit, on, notify } from './bus.js';
import { loadConfig, applyOverrides } from '../config/loader.js';
import { STATES, STATE_INFO, result } from './states.js';
import { detectCapabilities } from '../runtime/detect.js';
import { createRouter } from '../api/router.js';
import { createSecurity } from '../security/security.js';
import { createStore } from '../storage/store.js';

export const VERSION = '2.0.0';

const state = {
  booted: false,
  bootedAt: null,
  config: null,
  settings: null,
  caps: null,
  router: null,
  security: null,
  store: null,
  subsystems: new Map()
};

export async function boot({ fresh = false } = {}) {
  if (state.booted && !fresh) return snapshot();

  // 1) configurações JSON (fonte única de verdade)
  const [api, models, generators, repacks, permissions, settingsRaw] = await Promise.all([
    loadConfig('configs/api.json', { fresh }),
    loadConfig('configs/models.json', { fresh }),
    loadConfig('configs/generators.json', { fresh }),
    loadConfig('configs/repacks.json', { fresh }),
    loadConfig('configs/permissions.json', { fresh }),
    loadConfig('configs/settings.json', { fresh })
  ]);
  state.config = { api, models, generators, repacks, permissions };
  state.store = createStore();
  const overrides = state.store.get('fgua.config', 'settings-overrides', null);
  state.settings = applyOverrides(settingsRaw, overrides);

  // 2) capacidades do ambiente (best-effort, nunca lança)
  state.caps = await detectCapabilities();

  // 3) segurança/sessão
  state.security = createSecurity(state.config.permissions, state.store);
  state.security.resumeSession();

  // 4) roteador /api/v1
  state.router = createRouter(state);

  state.booted = true;
  state.bootedAt = new Date().toISOString();
  emit('kernel:boot', snapshot());
  return snapshot();
}

export function snapshot() {
  return {
    version: VERSION,
    booted: state.booted,
    bootedAt: state.bootedAt,
    mode: state.settings?.mode ?? 'demo',
    locale: state.settings?.locale ?? 'pt-BR',
    caps: state.caps,
    session: state.security?.session?.() ?? null
  };
}

export function get(name) {
  if (!state.booted) throw new Error('Kernel não inicializado; aguarde FGUA.ready.');
  switch (name) {
    case 'config': return state.config;
    case 'settings': return state.settings;
    case 'caps': return state.caps;
    case 'router': return state.router;
    case 'security': return state.security;
    case 'store': return state.store;
    case 'bus': return { on, notify };
    default: return state.subsystems.get(name) ?? null;
  }
}

export function register(name, module) {
  state.subsystems.set(name, module);
  emit('kernel:register', { name });
}

export function ready({ timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    if (state.booted) return resolve(snapshot());
    const timer = setTimeout(() => reject(new Error('FGUA.ready timeout')), timeoutMs);
    const offEv = on('kernel:boot', () => { clearTimeout(timer); offEv(); resolve(snapshot()); });
    boot().catch(err => { clearTimeout(timer); offEv(); reject(err); });
  });
}

export { STATES, STATE_INFO, result };
