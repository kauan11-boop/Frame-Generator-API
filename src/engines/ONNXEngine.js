export class ONNXEngine {
  constructor() {
    this.id = 'onnx-web';
    this.name = 'ONNX Runtime Web (Adapter)';
    this.runtime = null;
  }

  detect() {
    const ort = globalThis.ort || null;
    const has = !!ort;
    const executionProviders = has && ort?.env?.webgpu ? ['webgpu', 'wasm'] : (has ? ['wasm'] : []);
    return {
      available: has,
      runtime: has ? 'onnxruntime-web' : null,
      executionProviders,
      note: has ? 'ONNX Runtime Web detectado no ambiente.' : 'ONNX Runtime Web não carregado; inclua o runtime (ort) e um modelo compatível para execução.',
    };
  }

  getStatus() {
    const d = this.detect();
    return { id: this.id, name: this.name, ...d, loaded: !!(this.runtime || globalThis.ort) };
  }

  async loadRuntime(ortGlobal = null) {
    this.runtime = ortGlobal || globalThis.ort || null;
    return this.getStatus();
  }

  async createSession(model, options = {}) {
    const ort = this.runtime || globalThis.ort;
    if (!ort?.InferenceSession?.create) {
      return { ok: false, state: 'unavailable', error: { code: 'ORT_UNAVAILABLE', message: 'ONNX Runtime Web não disponível no ambiente atual.' } };
    }
    try {
      const session = await ort.InferenceSession.create(model, options);
      return { ok: true, state: 'ready', session };
    } catch (e) {
      return { ok: false, state: 'error', error: { code: 'ORT_SESSION_ERROR', message: e?.message || String(e) } };
    }
  }
}

export default ONNXEngine;
