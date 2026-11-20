export class ImageGenerator {
  constructor() { this.id = 'image-generator'; this.name = 'Image Generator'; this.category = 'image'; }

  async analyze(file) {
    const info = { ok: true, state: 'analyzed', category: 'image' };
    if (file) {
      info.file = { name: file.name, type: file.type, size: file.size };
      try {
        if (typeof createImageBitmap === 'function' && file instanceof Blob) {
          const b = await createImageBitmap(file);
          info.width = b.width;
          info.height = b.height;
          try { b.close?.(); } catch {}
        }
      } catch (e) {
        info.metadataWarning = e?.message || 'Não foi possível extrair dimensões da imagem.';
      }
    }
    return info;
  }

  async process(request = {}) {
    const analysis = request.input ? await this.analyze(request.input) : null;
    const scale = request.scale != null ? Number(request.scale) : null;
    if (scale != null && !(scale > 0)) {
      return { ok: false, state: 'invalid', error: { code: 'INVALID_SCALE', message: 'Escala inválida.' }, analysis, requested: request };
    }
    return {
      ok: false,
      state: 'requires-provider',
      message: 'Aprimoramento/geração neural de imagem requer modelo/runtime/provedor compatível. Nenhum resultado simulado.',
      analysis,
      requested: { scale, denoise: !!request.denoise, enhance: !!request.enhance },
    };
  }
}

export default ImageGenerator;
