import { uid, nowIso } from '../26_Utils/index.js';

export class ModelRegistry {
  constructor() { this.models = new Map(); }

  register(spec = {}) {
    const model = {
      id: spec.id || uid('model'),
      name: spec.name || spec.fileName || 'Modelo',
      format: spec.format || 'unknown',
      architecture: spec.architecture || null,
      size: spec.size || null,
      quantization: spec.quantization || null,
      tensorTypes: spec.tensorTypes || [],
      parameters: spec.parameters || null,
      contextLength: spec.contextLength || null,
      runtimeCompatible: spec.runtimeCompatible || [],
      requirements: spec.requirements || {},
      path: spec.path || null,
      fileName: spec.fileName || null,
      hash: spec.hash || null,
      state: spec.state || 'registered', // registered | analyzed | loaded | unloaded | error
      metadata: spec.metadata || null,
      tensors: spec.tensors || null,
      source: spec.source || 'local', // local | remote | provider
      registeredAt: nowIso(),
      updatedAt: nowIso()
    };
    this.models.set(model.id, model);
    return model;
  }

  update(id, patch) {
    const m = this.models.get(id); if (!m) return null;
    Object.assign(m, patch, { updatedAt: nowIso() });
    return m;
  }

  get(id) { return this.models.get(id) || null; }
  list(filter = {}) {
    let arr = [...this.models.values()];
    if (filter.format) arr = arr.filter(m => m.format === filter.format);
    if (filter.state) arr = arr.filter(m => m.state === filter.state);
    return arr;
  }
  remove(id) { return this.models.delete(id); }
}

export default ModelRegistry;
