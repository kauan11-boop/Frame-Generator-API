import { uid, nowIso } from '../core/utils.js';

export class FrameGenerator {
  constructor(options = {}) {
    this.id = 'frame-generator';
    this.name = 'Universal Frame Generator';
    this.engines = options.engineManager || null;
    this.tasks = options.taskManager || null;
  }

  detectCategory(input = {}) {
    if (input.category) return String(input.category);
    const f = String(input.format || input.fileName || input.mime || '').toLowerCase();
    if (/(mp4|webm|mov|mkv|avi|m4v|video)/.test(f)) return 'video';
    if (/(png|jpg|jpeg|webp|bmp|tiff|gif|image)/.test(f)) return 'image';
    if (/(game|stream|capture)/.test(f)) return 'game';
    return 'unknown';
  }

  validateRequest(request = {}) {
    const issues = [];
    if (request.targetFps != null && !(Number(request.targetFps) > 0)) issues.push('targetFps inválido.');
    if (request.inputFps != null && !(Number(request.inputFps) > 0)) issues.push('inputFps inválido.');
    if (request.scale != null && !(Number(request.scale) > 0)) issues.push('scale inválido.');
    return { ok: issues.length === 0, issues };
  }

  plan(request = {}) {
    const validation = this.validateRequest(request);
    const category = this.detectCategory(request);
    const ops = [];
    if (category === 'video') {
      if (request.interpolate || request.targetFps) ops.push('frame-interpolation');
      if (request.enhance || request.upscale) ops.push('video-enhancement');
      ops.push('analyze');
    } else if (category === 'image') {
      ops.push('analyze');
      if (request.denoise) ops.push('denoise');
      if (request.upscale || request.scale) ops.push('super-resolution');
      if (request.enhance) ops.push('enhancement');
    } else if (category === 'game') {
      ops.push('frame-ingest', 'temporal-analysis');
      if (request.interpolate || request.targetFps) ops.push('frame-generation');
    } else {
      ops.push('analyze');
    }
    return {
      id: uid('plan'),
      createdAt: nowIso(),
      category,
      operations: ops,
      validation,
      requiresProvider: category !== 'unknown',
      state: validation.ok ? 'planned' : 'invalid',
    };
  }

  async execute(request = {}) {
    const plan = this.plan(request);
    if (!plan.validation.ok) {
      return { ok: false, state: 'invalid', plan, error: { code: 'INVALID_REQUEST', message: 'Parâmetros inválidos para o plano.', details: plan.validation.issues } };
    }
    return {
      ok: false,
      state: 'requires-provider',
      plan,
      message: 'Execução real requer engine/modelo/provedor compatível configurado. Nenhum processamento simulado.',
      requirements: { category: plan.category, provider: 'compatível', engine: 'compatível' },
    };
  }
}

export default FrameGenerator;
