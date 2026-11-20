/**
 * FGUA v2 — adaptador Transformers.js (@huggingface/transformers) sob demanda via CDN ESM.
 * WebGPU quando disponível, senão wasm. Sem simulação: falha → estado explícito.
 */

import { result } from '../core/states.js';
import { notify } from '../core/bus.js';

let status = { state: 'requires-runtime', loaded: false, device: null };
let mod = null;

export function getStatus() { return { ...status }; }

export async function load({ cdn = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/+esm', device = 'auto' } = {}) {
  if (status.state === 'loading') return result('planned', null, { error: 'Carregamento já em andamento.' });
  status = { state: 'loading', loaded: false, device: null };
  try {
    notify('Transformers.js', 'Carregando runtime Hugging Face a partir do CDN…', 'info');
    mod = await import(/* webpackIgnore: true */ cdn);
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const dev = device === 'auto' ? (hasWebGPU ? 'webgpu' : 'wasm') : device;
    status = { state: 'ready', loaded: true, device: dev, env: mod.env ? { remoteHost: mod.env.remoteHost ?? 'padrão HF' } : null };
    notify('Transformers.js', `Runtime pronto (device: ${dev})`, 'ok');
    return result('ready', { device: dev, version: mod.version ?? 'desconhecida', webgpu: hasWebGPU });
  } catch (err) {
    status = { state: 'unavailable', loaded: false, error: String(err?.message || err) };
    notify('Transformers.js', 'Runtime indisponível (offline ou CDN bloqueado).', 'warn');
    return result('unavailable', null, { error: `Transformers.js indisponível: ${err?.message || err}` });
  }
}

/** cria pipeline real; modelos são baixados do HF Hub na primeira vez */
export async function pipeline(task, model, options = {}) {
  if (!mod) return result('requires-runtime', null, { error: 'Transformers.js não carregado. Clique em "Carregar runtime".' });
  try {
    const dev = options.device ?? status.device ?? 'wasm';
    const pipe = await mod.pipeline(task, model, { device: dev, ...options });
    return result('ready', { pipeline: pipe, task, model, device: dev });
  } catch (err) {
    return result('failed', null, { error: `Falha ao criar pipeline ${task}/${model}: ${err?.message || err}` });
  }
}

/** inferência com pipeline criado (função real, resultado real ou erro explícito) */
export async function infer(pipe, input) {
  if (!pipe) return result('requires-runtime', null, { error: 'Pipeline inexistente.' });
  try {
    const out = await pipe(input);
    return result('succeeded', out);
  } catch (err) {
    return result('failed', null, { error: String(err?.message || err) });
  }
}

export default { load, pipeline, infer, getStatus };
