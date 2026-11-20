import { EventBus } from './EventBus.js';
import { ModuleRegistry } from './ModuleRegistry.js';

export class LifecycleManager {
  constructor(options = {}) {
    this.name = options.name || 'Frame-Generator-API';
    this.version = options.version || '1.0.0';
    this.status = 'created';
    this.events = options.events || new EventBus();
    this.modules = new Map();
    this.errors = [];
    this.registries = {
      generators: new ModuleRegistry('generators'),
      engines: new ModuleRegistry('engines'),
      models: new ModuleRegistry('models'),
      tools: new ModuleRegistry('tools'),
      repacks: new ModuleRegistry('repacks'),
      users: new ModuleRegistry('users'),
      jobs: new ModuleRegistry('jobs'),
      providers: new ModuleRegistry('providers'),
    };
    this.state = { startedAt: null, initialized: false, partiallyInitialized: false };
    this.log = options.log || console;
  }

  registerModule(name, instance, meta = {}) {
    if (!name) throw new Error('Nome de módulo obrigatório');
    if (this.modules.has(name)) throw new Error(`Módulo já registrado: ${name}`);
    const record = { instance, meta: { name, ...meta, registeredAt: new Date().toISOString() }, status: 'registered', error: null };
    this.modules.set(name, record);
    try { this.events.emit('core.module.registered', { name, meta: record.meta }); } catch {}
    return instance;
  }

  getModule(name) { return this.modules.get(name)?.instance || null; }

  listModules() {
    return [...this.modules.entries()].map(([name, v]) => ({ name, status: v.status || 'registered', meta: v.meta, error: v.error || null }));
  }

  getRegistry(name) { return this.registries[name] || null; }

  async initialize(context = {}) {
    if (this.state.initialized) return this.getStatus();
    this.status = 'initializing';
    this.errors = [];
    const failures = [];
    for (const [name, rec] of [...this.modules.entries()]) {
      if (typeof rec.instance?.initialize !== 'function') {
        rec.status = 'ready';
        continue;
      }
      try {
        await rec.instance.initialize({ core: this, lifecycle: this, events: this.events, ...context });
        rec.status = 'ready';
        rec.error = null;
      } catch (e) {
        rec.status = 'error';
        rec.error = { message: e?.message || String(e), name: e?.name || 'Error' };
        failures.push({ module: name, ...rec.error });
        this.errors.push({ module: name, ...rec.error, at: new Date().toISOString() });
        try { this.events.emit('core.module.error', { name, error: rec.error }); } catch {}
        try { this.log?.warn?.('[Lifecycle] falha ao inicializar módulo', name, rec.error); } catch {}
      }
    }
    this.state.startedAt = new Date().toISOString();
    this.state.initialized = true;
    this.state.partiallyInitialized = failures.length > 0;
    this.status = failures.length ? 'degraded' : 'ready';
    try { this.events.emit('core.initialized', { at: this.state.startedAt, status: this.status, failures }); } catch {}
    return this.getStatus();
  }

  async shutdown() {
    this.status = 'shutting_down';
    const entries = [...this.modules.entries()].reverse();
    for (const [name, rec] of entries) {
      try {
        await (rec.instance?.dispose?.() || rec.instance?.shutdown?.());
        rec.status = 'stopped';
      } catch (e) {
        rec.status = 'error';
        rec.error = { message: e?.message || String(e), name: e?.name || 'Error' };
        this.errors.push({ module: name, phase: 'shutdown', ...rec.error, at: new Date().toISOString() });
        try { this.log?.warn?.('[Lifecycle] falha ao finalizar módulo', name, rec.error); } catch {}
      }
    }
    this.state.initialized = false;
    this.status = 'stopped';
    try { this.events.emit('core.shutdown', { at: new Date().toISOString() }); } catch {}
    return this.getStatus();
  }

  getStatus() {
    const registries = Object.fromEntries(Object.entries(this.registries).map(([k, r]) => [k, r.count()]));
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      initialized: this.state.initialized,
      partiallyInitialized: this.state.partiallyInitialized,
      startedAt: this.state.startedAt,
      modules: this.listModules(),
      registries,
      errors: [...this.errors],
    };
  }
}

export default LifecycleManager;
