/**
 * FGUA v2 — detecção de capacidades do ambiente (best-effort; nunca lança).
 */

import { result } from '../core/states.js';

function withTimeout(promise, ms = 2500, label = 'probe') {
  return Promise.race([
    promise.catch(() => null),
    new Promise(res => setTimeout(() => res(null), ms))
  ]).catch(() => null);
}

async function probeWebGPU() {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return { supported: false, motivo: 'navigator.gpu ausente (use Chrome/Edge 113+)' };
  }
  const adapter = await withTimeout(navigator.gpu.requestAdapter(), 2500, 'webgpu-adapter');
  if (!adapter) return { supported: true, adapter: null, motivo: 'Nenhum adaptador disponível' };
  let info = {};
  try {
    if (typeof adapter.requestAdapterInfo === 'function') info = (await adapter.requestAdapterInfo()) || {};
    else if (adapter.info) info = adapter.info;
  } catch { /* info opcional */ }
  return {
    supported: true,
    adapter: { vendor: info.vendor ?? null, architecture: info.architecture ?? null, features: [...(adapter.features ?? [])].slice(0, 12) }
  };
}

function probeContext(type) {
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext(type, { failIfMajorPerformanceCaveat: false });
    if (!ctx) return { supported: false };
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;
    const v = ctx.getParameter(ctx.VERSION);
    return { supported: true, version: v, renderer };
  } catch {
    return { supported: false };
  }
}

function probeWasmSimd() {
  // probe padrão de detecção de SIMD em WebAssembly
  const bytes = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
  try { new WebAssembly.Module(bytes); return true; } catch { return false; }
}

export async function detectCapabilities() {
  const env = typeof window !== 'undefined';
  const caps = {
    ambiente: env ? { secureContext: window.isSecureContext, crossOriginIsolated: !!window.crossOriginIsolated, userAgent: navigator.userAgent.slice(0, 120) } : { host: 'node/test' },
    webgpu: { supported: false },
    webgl: { supported: false },
    webgl2: { supported: false },
    wasm: { supported: typeof WebAssembly === 'object', simd: false },
    webcodecs: { videoEncoder: env && 'VideoEncoder' in window, videoFrame: env && 'VideoFrame' in window, audioDecoder: env && 'AudioDecoder' in window },
    offscreenCanvas: env && typeof OffscreenCanvas !== 'undefined',
    workers: env && typeof Worker !== 'undefined',
    sharedArrayBuffer: env && typeof SharedArrayBuffer !== 'undefined',
    storage: { indexedDB: env && !!globalThis.indexedDB, opfs: env && !!(navigator.storage && navigator.storage.getDirectory), localStorage: (() => { try { return !!globalThis.localStorage; } catch { return false; } })() },
    hardware: {
      cores: env && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : null,
      deviceMemoryGB: env && navigator.deviceMemory ? navigator.deviceMemory : null,
      battery: env && typeof navigator.getBattery === 'function'
    }
  };
  try { caps.wasm.simd = probeWasmSimd(); } catch { /* noop */ }
  if (env) {
    caps.webgpu = await probeWebGPU();
    try { caps.webgl = probeContext('webgl'); } catch { /* noop */ }
    try { caps.webgl2 = probeContext('webgl2'); } catch { /* noop */ }
  }
  return caps;
}

export function enginesDetect(caps) {
  const list = [
    { id: 'webgpu', label: 'WebGPU', ok: !!caps.webgpu?.supported, detalhe: caps.webgpu?.adapter?.vendor || caps.webgpu?.motivo || '' },
    { id: 'webgl2', label: 'WebGL 2', ok: !!caps.webgl2?.supported, detalhe: caps.webgl2?.renderer || caps.webgl2?.version || '' },
    { id: 'webgl', label: 'WebGL', ok: !!caps.webgl?.supported, detalhe: caps.webgl?.renderer || '' },
    { id: 'wasm', label: 'WebAssembly', ok: !!caps.wasm?.supported, detalhe: caps.wasm?.simd ? 'SIMD disponível' : 'sem SIMD' },
    { id: 'webcodecs', label: 'WebCodecs', ok: !!caps.webcodecs?.videoEncoder, detalhe: 'vídeo/áudio de baixo nível' },
    { id: 'workers', label: 'Web Workers', ok: !!caps.workers, detalhe: '' },
    { id: 'opfs', label: 'OPFS (armazenamento)', ok: !!caps.storage?.opfs, detalhe: '' }
  ];
  return result('ready', { engines: list, caps });
}

export default { detectCapabilities, enginesDetect };
