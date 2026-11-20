export class WebGPUManager {
  constructor() { this.adapter = null; this.device = null; this.info = null; }

  async detect() {
    if (!navigator.gpu) return { available: false, reason: 'WebGPU não suportado neste navegador' };
    try {
      this.adapter = await navigator.gpu.requestAdapter();
      if (!this.adapter) return { available: false, reason: 'Nenhum adaptador GPU disponível' };
      const info = this.adapter.info ? await this.adapter.info : null;
      this.info = {
        available: true,
        vendor: info?.vendor || null,
        architecture: info?.architecture || null,
        device: info?.device || null,
        description: info?.description || null,
        features: [...this.adapter.features.values()],
        limits: {
          maxBufferSize: this.adapter.limits?.maxBufferSize,
          maxTextureDimension2D: this.adapter.limits?.maxTextureDimension2D,
          maxComputeWorkgroupStorageSize: this.adapter.limits?.maxComputeWorkgroupStorageSize
        }
      };
      return this.info;
    } catch (e) { return { available: false, reason: e.message }; }
  }

  async getDevice() {
    if (this.device) return this.device;
    if (!this.adapter) await this.detect();
    if (!this.adapter) return null;
    try {
      this.device = await this.adapter.requestDevice();
      this.device.lost.then((info) => { this.device = null; this.info = { ...(this.info||{}), lost: info }; });
      return this.device;
    } catch { return null; }
  }

  getStatus() { return { available: !!navigator.gpu, adapter: !!this.adapter, device: !!this.device, info: this.info }; }
  async dispose() { try { this.device?.destroy?.(); } catch {} this.device = null; }
}

export default WebGPUManager;
