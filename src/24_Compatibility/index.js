export class CompatibilityManager {
  async detect() {
    const nav = globalThis.navigator || {};
    const hasWebGPU = !!globalThis.navigator?.gpu;
    const hasWasm = typeof WebAssembly === 'object';
    const hasWebCodecs = typeof globalThis.VideoDecoder !== 'undefined' && typeof globalThis.VideoEncoder !== 'undefined';
    const hasOffscreen = typeof globalThis.OffscreenCanvas !== 'undefined';
    const hasWorkers = typeof globalThis.Worker !== 'undefined';
    const hasSharedArrayBuffer = typeof globalThis.SharedArrayBuffer !== 'undefined';
    const hasIndexedDB = typeof globalThis.indexedDB !== 'undefined';
    const memory = nav.deviceMemory || null;
    const cores = nav.hardwareConcurrency || null;
    let webgpuAdapter = null;
    if (hasWebGPU) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          webgpuAdapter = {
            available: true,
            features: [...(adapter.features || [])],
            limits: adapter.limits ? { maxBufferSize: adapter.limits.maxBufferSize, maxTextureDimension2D: adapter.limits.maxTextureDimension2D } : null
          };
        } else {
          webgpuAdapter = { available: false, reason: 'Nenhum adaptador retornado' };
        }
      } catch (e) { webgpuAdapter = { available: false, reason: e.message }; }
    }
    return {
      browser: { userAgent: nav.userAgent || 'n/d', platform: nav.platform || 'n/d', language: nav.language || 'n/d' },
      capabilities: { webgpu: hasWebGPU, wasm: hasWasm, webcodecs: hasWebCodecs, offscreenCanvas: hasOffscreen, workers: hasWorkers, sharedArrayBuffer: hasSharedArrayBuffer, indexedDB: hasIndexedDB },
      hardware: { deviceMemoryGB: memory, hardwareConcurrency: cores },
      webgpu: webgpuAdapter || { available: false, reason: 'WebGPU não suportado' },
      formats: { input: ['png','jpg','jpeg','webp','bmp','mp4','webm'], output: ['png','jpg','webp','mp4','webm'], models: ['gguf','json-manifest'] }
    };
  }

  classify(requirements = {}, caps = null) {
    const c = caps || {};
    const issues = [];
    if (requirements.webgpu && !c.capabilities?.webgpu) issues.push({ type: 'unsupported', item: 'WebGPU' });
    if (requirements.webcodecs && !c.capabilities?.webcodecs) issues.push({ type: 'unsupported', item: 'WebCodecs' });
    if (requirements.wasm && !c.capabilities?.wasm) issues.push({ type: 'unsupported', item: 'WebAssembly' });
    if (requirements.workers && !c.capabilities?.workers) issues.push({ type: 'unsupported', item: 'Web Workers' });
    if (requirements.minMemoryGB && (c.hardware?.deviceMemoryGB || 0) < requirements.minMemoryGB) issues.push({ type: 'resource', item: 'Memória insuficiente' });
    let status = 'Compatible';
    if (issues.some(i => i.type === 'unsupported')) status = 'Unsupported';
    else if (issues.some(i => i.type === 'resource')) status = 'Partially Compatible';
    if (requirements.externalProvider && status === 'Unsupported') status = 'Requires External Provider';
    return { status, issues, requirements, at: new Date().toISOString() };
  }
}

export default CompatibilityManager;
