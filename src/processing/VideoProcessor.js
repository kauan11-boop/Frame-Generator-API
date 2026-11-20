export class VideoProcessor {
  detect() {
    return { webCodecs: typeof VideoDecoder !== 'undefined', videoEncoder: typeof VideoEncoder !== 'undefined', videoFrame: typeof VideoFrame !== 'undefined' };
  }

  async getMetadata(file) {
    const meta = { ok: true, state: 'analyzed', name: file?.name, size: file?.size, type: file?.type };
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
        meta.duration = Number.isFinite(v.duration) ? v.duration : null;
        meta.width = v.videoWidth || null;
        meta.height = v.videoHeight || null;
      }
    } catch (e) {
      meta.ok = false;
      meta.state = 'error';
      meta.error = e?.message || 'Metadados indisponíveis.';
    } finally {
      if (url) try { URL.revokeObjectURL(url); } catch {}
    }
    return meta;
  }
}

export default VideoProcessor;
