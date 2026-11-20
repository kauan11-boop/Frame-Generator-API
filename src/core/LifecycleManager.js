import { EventBus } from './EventBus.js';
import { ModuleRegistry } from './ModuleRegistry.js';

export class LifecycleManager {
  constructor(options = {}) {
    this.version = options.version || '1.0.0';
    this.status = 'created';
    this.events = options.events || new EventBus();
    this.modules = new Map();
    this.registries = {
      generators: new ModuleRegistry('generators'),
      engines: new ModuleRegistry('engines'),
      models: new ModuleRegistry('models'),
      tools: new ModuleRegistry('tools'),
      repacks: new ModuleRegistry('repacks'),
      users: new ModuleRegistry('users'),
      tasks: new ModuleRegistry('tasks'),
      providers: new ModuleRegistry('providers')
    };
    this.state = { startedAt: null, initialized: false };
    this.log = options.log || console;
  }

  registerModule(name, instance, meta = {}) {
    if (!name) throw new Error('Nome de módulo obrigatório');
    if (this.modules.has(name)) throw new Error(`Módulo já registrado: ${name}`);
    this.modules.set(name, { instance, meta: { name, ...meta, registeredAt: new Date().toISOString() } });
    this.events.emit('core.module.registered', { name, meta });
    return instance;
  }

  getModule(name) { return this.modules.get(name)?.instance || null; }
  listModules() { return [...this.modules.entries()].map(([name, v]) => ({ name, meta: v.meta })); }
  getRegistry(name) { return this.registries[name] || null; }

  async initialize(context = {}) {
    if (this.state.initialized) return this.getStatus();
    this.status = 'initializing';
    for (const [name, { instance }] of [...this.modules.entries()]) {
      if (typeof instance?.initialize === 'function') {
        await instance.initialize({ core: this, lifecycle: this, events: this.events, ...context });
      }
    }
    this.state.initialized = true;
    this.state.startedAt = new Date().toISOString();
    this.status = 'ready';
    this.events.emit('core.initialized', { at: this.state.startedAt });
    return this.getStatus();
  }

  async shutdown() {
    this.status = 'shutting_down';
    const entries = [...this.modules.entries()].reverse();
    for (const [name, { instance }] of entries) {
      try { await (instance?.dispose?.() || instance?.shutdown?.()); } catch {}
    }
    this.state.initialized = false;
    this.status = 'stopped';
    this.events.emit('core.shutdown', { at: new Date().toISOString() });
  }

  getStatus() {
    return {
      name: 'Frame-Generator-API',
      version: this.version,
      status: this.status,
      initialized: this.state.initialized,
      startedAt: this.state.startedAt,
      modules: this.listModules(),
      registries: Object.fromEntries(Object.entries(this.registries).map(([k, r]) => [k, r.count()]))
    };
  }
}

export default LifecycleManager;
