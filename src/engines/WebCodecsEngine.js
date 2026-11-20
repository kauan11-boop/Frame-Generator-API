export class WebCodecsEngine {
  constructor() { this.id = 'webcodecs'; this.name = 'WebCodecs Engine'; }

  detect() {
    const g = globalThis;
    const videoDecoder = typeof g.VideoDecoder !== 'undefined';
    const videoEncoder = typeof g.VideoEncoder !== 'undefined';
    const videoFrame = typeof g.VideoFrame !== 'undefined';
    const audioDecoder = typeof g.AudioDecoder !== 'undefined';
    const audioEncoder = typeof g.AudioEncoder !== 'undefined';
    return {
      available: videoDecoder || videoEncoder || audioDecoder || audioEncoder,
      videoDecoder,
      videoEncoder,
      videoFrame,
      audioDecoder,
      audioEncoder,
    };
  }

  getStatus() { return { id: this.id, name: this.name, ...this.detect() }; }

  async supportsVideoDecodeConfig(config) {
    try {
      if (typeof globalThis.VideoDecoder === 'undefined' || !config) return { supported: false, reason: 'VideoDecoder indisponível ou config ausente.' };
      const r = await globalThis.VideoDecoder.isConfigSupported(config);
      return r || { supported: false };
    } catch (e) { return { supported: false, error: e?.message || String(e) }; }
  }

  async supportsVideoEncodeConfig(config) {
    try {
      if (typeof globalThis.VideoEncoder === 'undefined' || !config) return { supported: false, reason: 'VideoEncoder indisponível ou config ausente.' };
      const r = await globalThis.VideoEncoder.isConfigSupported(config);
      return r || { supported: false };
    } catch (e) { return { supported: false, error: e?.message || String(e) }; }
  }

  async supportsAudioDecodeConfig(config) {
    try {
      if (typeof globalThis.AudioDecoder === 'undefined' || !config) return { supported: false, reason: 'AudioDecoder indisponível ou config ausente.' };
      const r = await globalThis.AudioDecoder.isConfigSupported(config);
      return r || { supported: false };
    } catch (e) { return { supported: false, error: e?.message || String(e) }; }
  }

  async supportsAudioEncodeConfig(config) {
    try {
      if (typeof globalThis.AudioEncoder === 'undefined' || !config) return { supported: false, reason: 'AudioEncoder indisponível ou config ausente.' };
      const r = await globalThis.AudioEncoder.isConfigSupported(config);
      return r || { supported: false };
    } catch (e) { return { supported: false, error: e?.message || String(e) }; }
  }

  // Backward-compatible aliases
  async supportsVideoConfig(config) { return this.supportsVideoDecodeConfig(config); }
  async supportsAudioConfig(config) { return this.supportsAudioDecodeConfig(config); }
}

export default WebCodecsEngine;
