import { EventBus } from './EventBus.js';
import { Registry } from './Registry.js';
import { logger } from '../23_Logging/index.js';
import { nowIso } from '../26_Utils/index.js';

export class FrameGeneratorCore {
  constructor(options = {}) {
    this.name = 'FrameGeneratorCore';
    this.version = options.version || '1.0.0';
    this.status = 'created';
    this.events = new EventBus();
    this.modules = new Map(); // name -> { instance, meta }
    this.registries = {
      generators: new Registry('generators'),
      engines: new Registry('engines'),
      models: new Registry('models'),
      tools: new Registry('tools'),
      repacks: new Registry('repacks'),
      controllers: new Registry('controllers'),
      providers: new Registry('providers'),
      users: new Registry('users'),
      tasks: new Registry('tasks')
    };
    this.state = { startedAt: null, initialized: false };
    this.config = options.config || null;
  }

  registerModule(name, instance, meta = {}) {
    if (!name) throw new Error('Nome de módulo obrigatório');
    if (this.modules.has(name)) throw new Error(`Módulo já registrado: ${name}`);
    this.modules.set(name, { instance, meta: { name, ...meta, registeredAt: nowIso() } });
    logger.info(`Módulo registrado: ${name}`, null, 'core');
    this.events.emit('core.module.registered', { name, meta });
    return instance;
  }

  getModule(name) { return this.modules.get(name)?.instance || null; }
  listModules() { return [...this.modules.entries()].map(([name, v]) => ({ name, meta: v.meta })); }

  getRegistry(name) { return this.registries[name] || null; }

  async initialize(context = {}) {
    if (this.state.initialized) return this.getStatus();
    this.status = 'initializing';
    logger.info('Inicializando FrameGeneratorCore', { modules: this.modules.size }, 'core');
    const order = [...this.modules.entries()];
    for (const [name, { instance }] of order) {
      if (typeof instance?.initialize === 'function') {
        try {
          await instance.initialize({ core: this, ...context });
          logger.info(`Módulo inicializado: ${name}`, null, 'core');
        } catch (e) {
          logger.error(`Falha ao inicializar módulo: ${name}`, { message: e.message }, 'core');
          this.events.emit('engine.failed', { module: name, error: e.message });
          throw e;
        }
      }
    }
    this.state.initialized = true;
    this.state.startedAt = nowIso();
    this.status = 'ready';
    this.events.emit('core.initialized', { at: this.state.startedAt, modules: this.listModules() });
    logger.info('FrameGeneratorCore pronto', { at: this.state.startedAt }, 'core');
    return this.getStatus();
  }

  async shutdown() {
    this.status = 'shutting_down';
    const entries = [...this.modules.entries()].reverse();
    for (const [name, { instance }] of entries) {
      if (typeof instance?.dispose === 'function' || typeof instance?.shutdown === 'function') {
        try { await (instance.dispose || instance.shutdown).call(instance); } catch (e) { logger.warn(`Erro ao encerrar ${name}`, { message: e.message }, 'core'); }
      }
    }
    this.state.initialized = false;
    this.status = 'stopped';
    this.events.emit('core.shutdown', { at: nowIso() });
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      initialized: this.state.initialized,
      startedAt: this.state.startedAt,
      modules: this.listModules(),
      registries: Object.fromEntries(Object.entries(this.registries).map(([k, r]) => [k, r.count()]))
    };
  }
}

export default FrameGeneratorCore;
