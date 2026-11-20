export class WebGPUEngine {
  constructor() {
    this.id = 'webgpu';
    this.name = 'WebGPU Engine';
    this.adapter = null;
    this.device = null;
    this.info = null;
  }

  _gpu() {
    try { return globalThis.navigator?.gpu || null; } catch { return null; }
  }

  async detect() {
    const gpu = this._gpu();
    if (!gpu) {
      this.info = { available: false, reason: 'WebGPU não suportado neste ambiente/navegador.' };
      return { ...this.info };
    }
    try {
      this.adapter = await gpu.requestAdapter();
      if (!this.adapter) {
        this.info = { available: false, reason: 'Adaptador WebGPU indisponível.' };
        return { ...this.info };
      }
      let features = [];
      try { features = this.adapter.features ? [...this.adapter.features] : []; } catch { features = []; }
      const limits = this.adapter.limits ? {
        maxBufferSize: this.adapter.limits.maxBufferSize,
        maxTextureDimension2D: this.adapter.limits.maxTextureDimension2D,
        maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
      } : {};
      this.info = { available: true, features, limits, isFallbackAdapter: !!this.adapter.isFallbackAdapter };
      return { ...this.info };
    } catch (e) {
      this.info = { available: false, reason: e?.message || 'Falha ao detectar WebGPU.' };
      return { ...this.info };
    }
  }

  async getDevice(options = {}) {
    if (this.device) return this.device;
    if (!this.adapter) await this.detect();
    if (!this.adapter) return null;
    try {
      this.device = await this.adapter.requestDevice(options);
      try {
        this.device.lost?.then?.((info) => {
          this.info = { ...(this.info || {}), available: false, deviceLost: { reason: info?.reason, message: info?.message } };
          this.device = null;
        });
      } catch {}
      return this.device;
    } catch (e) {
      this.info = { ...(this.info || {}), available: !!this.adapter, deviceError: e?.message || String(e) };
      return null;
    }
  }

  getStatus() {
    const gpu = !!this._gpu();
    return {
      id: this.id,
      name: this.name,
      available: gpu && !!this.info?.available,
      adapter: !!this.adapter,
      device: !!this.device,
      info: this.info ? { ...this.info } : null,
    };
  }

  async dispose() {
    try { this.device?.destroy?.(); } catch {}
    this.device = null;
  }
}

export default WebGPUEngine;
