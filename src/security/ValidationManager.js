const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export class ValidationManager {
  constructor(options = {}) {
    this.maxFileSize = Number.isFinite(Number(options.maxFileSize)) ? Number(options.maxFileSize) : 1024 * 1024 * 1024;
    this.allowedModelExt = new Set(['.gguf', '.onnx', '.safetensors', '.bin', '.pt', '.pth', '.json']);
    this.allowedMediaExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff', '.gif', '.mp4', '.webm', '.mov', '.mkv', '.avi']);
    this.blockedExt = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.exe', '.dll', '.so', '.dylib', '.sh', '.bash', '.bat', '.cmd', '.ps1', '.psm1', '.wasm-exec', '.html', '.htm']);
  }

  validateFile(file, kind = 'any') {
    const issues = [];
    if (!file) return { ok: false, issues: ['Arquivo ausente'], file: null };
    const name = String(file.name || '');
    const lower = name.toLowerCase();
    const ext = lower.includes('.') ? '.' + lower.split('.').pop() : '';
    const size = Number(file.size);
    const type = String(file.type || '');

    if (!name) issues.push('Nome de arquivo ausente.');
    if (!Number.isFinite(size) || size < 0) issues.push('Tamanho de arquivo inválido.');
    if (Number.isFinite(size) && size > this.maxFileSize) issues.push(`Arquivo excede limite de tamanho (${this.maxFileSize} bytes).`);
    if (ext && this.blockedExt.has(ext)) issues.push(`Tipo potencialmente executável/bloqueado: ${ext}`);
    if (kind === 'model' && ext && !this.allowedModelExt.has(ext)) issues.push(`Extensão de modelo não permitida: ${ext}`);
    if (kind === 'media' && ext && !this.allowedMediaExt.has(ext)) issues.push(`Extensão de mídia não permitida: ${ext}`);
    if (/[<>:"|?*\x00-\x1f]/.test(name)) issues.push('Nome de arquivo contém caracteres inválidos.');

    return { ok: issues.length === 0, issues, file: { name, size: Number.isFinite(size) ? size : null, type } };
  }

  validateJson(text) {
    try {
      const value = JSON.parse(text);
      return { ok: true, value, error: null };
    } catch (e) {
      return { ok: false, value: null, error: e?.message || 'JSON inválido.' };
    }
  }

  validateEndpoint(url, options = {}) {
    try {
      const u = new URL(String(url));
      if (!['http:', 'https:'].includes(u.protocol)) return { ok: false, error: 'Protocolo inválido (use http/https).' };
      if (options.httpsOnly && u.protocol !== 'https:') return { ok: false, error: 'HTTPS obrigatório para este endpoint.' };
      return { ok: true, origin: u.origin, href: u.href, protocol: u.protocol, host: u.host };
    } catch (e) {
      return { ok: false, error: e?.message || 'URL inválida.' };
    }
  }

  hasDangerousKeys(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (Array.isArray(obj)) return obj.some((v) => this.hasDangerousKeys(v));
    for (const k of Object.keys(obj)) {
      if (DANGEROUS_KEYS.has(k)) return true;
      if (this.hasDangerousKeys(obj[k])) return true;
    }
    return false;
  }

  sanitizeSegment(s = '') {
    return String(s).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.\.+/g, '.').replace(/^_+|_+$/g, '') || '_';
  }
}

export default ValidationManager;
