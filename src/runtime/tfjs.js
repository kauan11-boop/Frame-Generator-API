/**
 * FGUA v2 — adaptador TensorFlow.js (@tensorflow/tfjs) carregado sob demanda via CDN ESM.
 * Sem results fictícios: se o carregamento/backend falhar, estado explícito 'unavailable'.
 */

import { result } from '../core/states.js';
import { notify } from '../core/bus.js';

const STATUS = {
  idle: { state: 'requires-runtime', loaded: false, backend: null },
  loading: { state: 'planned', loaded: false, backend: null },
  ready: { state: 'ready', loaded: true },
  unavailable: { state: 'unavailable', loaded: false }
};

let status = { ...STATUS.idle, state: 'requires-runtime' };
let tf = null;

export function getStatus() { return { ...status, tf: tf ? { version: tf.version_tfjs ?? 'desconhecida' } : null }; }

export async function load({ cdn = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/+esm', preferredBackend = 'webgl' } = {}) {
  if (status.state === 'loading') return result('planned', null, { error: 'Carregamento já em andamento.' });
  status = { ...STATUS.loading };
  try {
    notify('TensorFlow.js', 'Carregando runtime a partir do CDN…', 'info');
    const mod = await import(/* webpackIgnore: true */ cdn);
    tf = mod.default?.setBackend ? mod.default : mod;
    if (!tf || typeof tf.setBackend !== 'function') throw new Error('Módulo TF.js sem setBackend');
    const order = preferredBackend === 'webgpu' ? ['webgpu', 'webgl', 'cpu'] : ['webgl', 'cpu'];
    let used = null;
    for (const b of order) {
      try { if (await tf.setBackend(b)) { used = b; break; } } catch { /* tenta próximo */ }
    }
    await tf.ready;
    status = { ...STATUS.ready, backend: used ?? tf.getBackend() };
    notify('TensorFlow.js', `Runtime pronto (backend: ${status.backend})`, 'ok');
    return result('ready', { backend: status.backend, backendsDisponiveis: tf.getBackendNames?.() ?? [] });
  } catch (err) {
    status = { ...STATUS.unavailable, error: String(err?.message || err) };
    notify('TensorFlow.js', 'Runtime indisponível (offline ou CDN bloqueado). Operações reais ficam em requires-runtime.', 'warn');
    return result('unavailable', null, { error: `TF.js indisponível: ${err?.message || err}` });
  }
}

/** executa operação real se runtime pronto; caso contrário estado explícito */
export async function run(fn) {
  if (!tf) return result('requires-runtime', null, { error: 'TF.js não carregado. Clique em "Carregar runtime".' });
  try {
    const data = await fn(tf);
    return result('succeeded', data);
  } catch (err) {
    return result('failed', null, { error: String(err?.message || err) });
  }
}

export default { load, run, getStatus };
