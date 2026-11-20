export class VideoGenerator {
  constructor() { this.id = 'video-generator'; this.name = 'Video Generator'; this.category = 'video'; }

  detectSupport() {
    return {
      webCodecs: typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined',
      videoFrame: typeof VideoFrame !== 'undefined',
      offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      workers: typeof Worker !== 'undefined',
    };
  }

  async analyze(file) {
    const info = { ok: true, state: 'analyzed', support: this.detectSupport(), file: file ? { name: file.name, type: file.type, size: file.size } : null };
    let url = null;
    try {
      if (file && typeof document !== 'undefined' && typeof URL !== 'undefined') {
        url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.preload = 'metadata';
        await new Promise((res, rej) => {
          v.onloadedmetadata = () => res();
          v.onerror = () => rej(new Error('Falha ao ler metadados de vídeo.'));
          v.src = url;
        });
        info.duration = Number.isFinite(v.duration) ? v.duration : null;
        info.width = v.videoWidth || null;
        info.height = v.videoHeight || null;
      }
    } catch (e) {
      info.metadataError = e?.message || 'Metadados indisponíveis.';
    } finally {
      if (url) try { URL.revokeObjectURL(url); } catch {}
    }
    return info;
  }

  plan(inputFps, targetFps) {
    const inFps = inputFps != null ? Number(inputFps) : null;
    const outFps = targetFps != null ? Number(targetFps) : null;
    const ratio = (Number.isFinite(inFps) && inFps > 0 && Number.isFinite(outFps) && outFps > 0) ? (outFps / inFps) : null;
    return {
      inputFps: inFps,
      targetFps: outFps,
      ratio,
      valid: !!(ratio && ratio > 0),
      note: 'Interpolação/processamento real requer pipeline compatível (decode→process→encode/mux) e runtime/provedor adequado.',
    };
  }

  async process(request = {}) {
    const analysis = request.input ? await this.analyze(request.input) : { ok: true, state: 'analyzed', support: this.detectSupport() };
    const targetFps = request.targetFps ?? request.fps ?? null;
    if (request.inputFps != null && !(Number(request.inputFps) > 0)) {
      return { ok: false, state: 'invalid', error: { code: 'INVALID_INPUT_FPS', message: 'inputFps inválido.' }, analysis };
    }
    if (targetFps != null && !(Number(targetFps) > 0)) {
      return { ok: false, state: 'invalid', error: { code: 'INVALID_TARGET_FPS', message: 'targetFps inválido.' }, analysis };
    }
    return {
      ok: false,
      state: 'requires-provider',
      message: 'Processamento de vídeo (interpolação/upscale/exportação) requer engine/provedor e pipeline de mídia compatíveis. Nenhum resultado simulado.',
      analysis,
      plan: this.plan(request.inputFps, targetFps),
      requested: request,
    };
  }
}

export default VideoGenerator;
