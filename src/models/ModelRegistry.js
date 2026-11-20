import { uid, nowIso, deepMergeSafe } from '../core/utils.js';

const ALLOWED = new Set(['name', 'format', 'architecture', 'size', 'quantization', 'quantized', 'unquantized', 'precision', 'tensorTypes', 'parameters', 'contextLength', 'runtimeCompatible', 'requirements', 'fileName', 'hash', 'state', 'metadata', 'tensors', 'source', 'splitHint', 'analyzedAt', 'warnings', 'compatibility', 'loaded', 'loadedAt', 'provider']);

export class ModelRegistry {
  constructor() { this.models = new Map(); }

  _normalize(spec = {}, existing = null) {
    const id = existing?.id || spec.id || uid('model');
    const base = existing ? deepMergeSafe({}, existing) : {};
    const out = {
      ...base,
      id,
      name: spec.name || spec.fileName || base.name || 'Modelo',
      format: spec.format || base.format || 'unknown',
      architecture: spec.architecture ?? base.architecture ?? null,
      size: spec.size ?? base.size ?? null,
      quantization: spec.quantization ?? base.quantization ?? null,
      quantized: spec.quantized ?? base.quantized ?? null,
      unquantized: spec.unquantized ?? base.unquantized ?? null,
      precision: spec.precision ?? base.precision ?? null,
      tensorTypes: Array.isArray(spec.tensorTypes) ? [...spec.tensorTypes] : (Array.isArray(base.tensorTypes) ? [...base.tensorTypes] : []),
      parameters: spec.parameters ?? base.parameters ?? null,
      contextLength: spec.contextLength ?? base.contextLength ?? null,
      runtimeCompatible: Array.isArray(spec.runtimeCompatible) ? [...spec.runtimeCompatible] : (Array.isArray(base.runtimeCompatible) ? [...base.runtimeCompatible] : []),
      requirements: spec.requirements && typeof spec.requirements === 'object' ? deepMergeSafe({}, spec.requirements) : (base.requirements || {}),
      fileName: spec.fileName ?? base.fileName ?? null,
      hash: spec.hash ?? base.hash ?? null,
      state: spec.state || base.state || 'registered',
      metadata: spec.metadata !== undefined ? spec.metadata : (base.metadata ?? null),
      tensors: spec.tensors !== undefined ? spec.tensors : (base.tensors ?? null),
      warnings: Array.isArray(spec.warnings) ? [...spec.warnings] : (Array.isArray(base.warnings) ? [...base.warnings] : []),
      registeredAt: base.registeredAt || nowIso(),
      updatedAt: nowIso(),
    };
    for (const [k, v] of Object.entries(spec)) {
      if (!ALLOWED.has(k)) continue;
      if (out[k] === undefined) out[k] = v;
    }
    return out;
  }

  register(spec = {}) {
    const existing = spec.id ? this.models.get(spec.id) : null;
    const m = this._normalize(spec, existing);
    this.models.set(m.id, m);
    return deepMergeSafe({}, m);
  }

  update(id, patch = {}) {
    const m = this.models.get(id);
    if (!m) return null;
    const next = this._normalize({ ...m, ...patch, id: m.id }, m);
    this.models.set(id, next);
    return deepMergeSafe({}, next);
  }

  get(id) { const m = this.models.get(id); return m ? deepMergeSafe({}, m) : null; }

  list(filter = {}) {
    let a = [...this.models.values()].map((m) => deepMergeSafe({}, m));
    if (filter.format) a = a.filter((m) => m.format === filter.format);
    if (filter.state) a = a.filter((m) => m.state === filter.state);
    if (filter.query) {
      const q = String(filter.query).toLowerCase();
      a = a.filter((m) => [m.name, m.fileName, m.id, m.format, m.architecture].some((v) => String(v || '').toLowerCase().includes(q)));
    }
    return a;
  }

  remove(id) { return this.models.delete(id); }
}

export default ModelRegistry;
