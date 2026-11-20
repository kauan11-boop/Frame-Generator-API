export class ImageProcessor {
  async getInfo(file) {
    const info = { ok: true, state: 'analyzed', name: file?.name, size: file?.size, type: file?.type };
    try {
      if (file && typeof createImageBitmap === 'function') {
        const b = await createImageBitmap(file);
        info.width = b.width;
        info.height = b.height;
        try { b.close?.(); } catch {}
      }
    } catch (e) {
      info.warning = e?.message || 'Não foi possível obter dimensões da imagem.';
    }
    return info;
  }

  async toBitmap(file) {
    if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap indisponível neste ambiente.');
    return await createImageBitmap(file);
  }
}

export default ImageProcessor;
