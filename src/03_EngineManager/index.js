import { uid, nowIso } from '../26_Utils/index.js';

export class IFrameEngine {
  constructor(spec = {}) { this.id = spec.id || uid('engine'); this.name = spec.name || 'Engine'; this.category = spec.category || 'generic'; this.capabilities = spec.capabilities || []; this.status = 'registered'; }
  async initialize() { this.status = 'ready'; return { ok: true }; }
  async loadModel() { return { ok: false, error: 'Não implementado para este engine' }; }
  async processFrame() { return { ok: false, error: 'Provedor/runtime compatível necessário' }; }
  async processBatch() { return { ok: false, error: 'Provedor/runtime compatível necessário' }; }
  getCapabilities() { return { id: this.id, name: this.name, category: this.category, capabilities: this.capabilities, status: this.status }; }
  getStatus() { return { id: this.id, status: this.status }; }
  async dispose() { this.status = 'disposed'; }
}

export class FrameEngineManager {
  constructor(options = {}) {
    this.engines = new Map();
    this.events = options.events || null;
  }

  register(engine) {
    if (!engine?.id) throw new Error('Engine inválido');
    this.engines.set(engine.id, engine);
    this.events?.emit('engine.initialized', { id: engine.id, name: engine.name, category: engine.category, status: engine.status });
    return engine;
  }

  get(id) { return this.engines.get(id) || null; }
  list() { return [...this.engines.values()].map(e => e.getCapabilities ? e.getCapabilities() : e); }

  select(criteria = {}) {
    const list = [...this.engines.values()];
    let found = list;
    if (criteria.category) found = found.filter(e => e.category === criteria.category);
    if (criteria.id) found = found.filter(e => e.id === criteria.id);
    if (criteria.capability) found = found.filter(e => (e.capabilities||[]).includes(criteria.capability));
    return found[0] || null;
  }

  async run(engineId, operation, payload = {}) {
    const engine = this.get(engineId);
    if (!engine) return { ok: false, error: { code: 'ENGINE_NOT_FOUND', message: 'Engine não encontrado' } };
    if (typeof engine[operation] === 'function') {
      try { return await engine[operation](payload); }
      catch (e) { return { ok: false, error: { code: 'ENGINE_ERROR', message: e.message } }; }
    }
    return { ok: false, error: { code: 'OPERATION_NOT_SUPPORTED', message: `Operação '${operation}' não suportada` } };
  }
}

export default FrameEngineManager;
