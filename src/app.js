import { EventBus } from './core/EventBus.js';
import { LifecycleManager } from './core/LifecycleManager.js';
import { ApiController } from './core/ApiController.js';
import { JobManager } from './core/JobManager.js';
import { ProviderManager } from './core/ProviderManager.js';
import { SettingsManager } from './configuration/SettingsManager.js';
import { ModelLoader } from './models/ModelLoader.js';
import { ModelRegistry } from './models/ModelRegistry.js';
import { ModelCompatibility } from './models/ModelCompatibility.js';
import { QuantizationAnalyzer } from './quantization/QuantizationAnalyzer.js';
import { QuantizationManager } from './quantization/QuantizationManager.js';
import { FrameGenerator } from './generators/FrameGenerator.js';
import { ImageGenerator } from './generators/ImageGenerator.js';
import { VideoGenerator } from './generators/VideoGenerator.js';
import { GeneratorRegistry } from './generators/GeneratorRegistry.js';
import { ImageProcessor } from './processing/ImageProcessor.js';
import { VideoProcessor } from './processing/VideoProcessor.js';
import { FrameProcessor } from './processing/FrameProcessor.js';
import { WebGPUEngine } from './engines/WebGPUEngine.js';
import { WebCodecsEngine } from './engines/WebCodecsEngine.js';
import { ONNXEngine } from './engines/ONNXEngine.js';
import { BackendAdapter } from './engines/BackendAdapter.js';
import { ToolRegistry } from './repacks/ToolRegistry.js';
import { RepackManager } from './repacks/RepackManager.js';
import { AuthenticationManager } from './security/AuthenticationManager.js';
import { PermissionManager } from './security/PermissionManager.js';
import { ValidationManager } from './security/ValidationManager.js';
import { IndexedDBManager } from './storage/IndexedDBManager.js';
import { CacheManager } from './storage/CacheManager.js';
import { HistoryManager } from './storage/HistoryManager.js';
import { deepMergeSafe, nowIso } from './core/utils.js';

const APP_VERSION = '1.0.0';
const CONFIG_NAMES = ['api', 'models', 'generators', 'repacks', 'permissions', 'settings'];

function createLogger(events, max = 500) {
  const entries = [];
  const push = (level, message, data = null, scope = 'app') => {
    const entry = { ts: nowIso(), level, scope, message, data };
    entries.push(entry);
    if (entries.length > max) entries.splice(0, entries.length - max);
    try { (console[level] || console.log)(`[${level}] ${scope}: ${message}`, data ?? ''); } catch {}
    try { events?.emit('log', entry); } catch {}
    return entry;
  };
  return {
    entries,
    info: (m, d, s) => push('info', m, d, s),
    warn: (m, d, s) => push('warn', m, d, s),
    error: (m, d, s) => push('error', m, d, s),
    debug: (m, d, s) => push('debug', m, d, s),
    getRecent: (n = 100) => entries.slice(-Math.max(0, n)),
  };
}

async function loadConfigs(settings, logger) {
  const cfgBase = new URL('../configs/', import.meta.url);
  const diagnostics = {};
  for (const name of CONFIG_NAMES) {
    const candidates = [
      new URL(`${name}.json`, cfgBase).href,
      `./configs/${name}.json`,
      `../configs/${name}.json`,
    ];
    let loaded = false;
    let lastError = null;
    for (const src of candidates) {
      await settings.load(name, src);
      const entry = settings.getEntry(name);
      if (entry && entry.loaded && !entry.error) {
        diagnostics[name] = { ok: true, source: entry.source, validation: entry.validation || { ok: true, errors: [] } };
        loaded = true;
        break;
      }
      lastError = entry?.error || lastError;
    }
    if (!loaded) {
      const entry = settings.getEntry(name);
      diagnostics[name] = {
        ok: false,
        source: entry?.source || null,
        error: lastError || entry?.error || { message: 'Não foi possível carregar a configuração; defaults aplicados quando disponíveis.' },
        validation: entry?.validation || { ok: true, errors: [] },
      };
      logger?.warn(`Config '${name}' não carregada; usando defaults/fallback.`, diagnostics[name].error, 'bootstrap');
    }
  }
  return diagnostics;
}

function applyApiConfig(api, backend, settings, logger) {
  const cfg = settings.get('api') || {};
  try {
    api.configure({
      mode: cfg.mode || 'demo',
      base: cfg.base || '/api/v1',
      basePath: cfg.base || '/api/v1',
      namespaces: Array.isArray(cfg.namespaces) ? cfg.namespaces : undefined,
      backend: cfg.backend || {},
    });
    if (cfg.backend && typeof cfg.backend === 'object') {
      backend.configure({
        baseUrl: cfg.backend.remoteUrl || cfg.backend.localUrl || null,
        type: (cfg.mode === 'local') ? 'local' : 'remote',
        headers: cfg.headers || {},
      });
    }
  } catch (e) {
    logger?.error('Falha ao aplicar config de API.', { message: e?.message || String(e) }, 'bootstrap');
  }
}

function applyPermissionsConfig(permissions, settings, logger) {
  const cfg = settings.get('permissions') || {};
  try {
    if (cfg.roles && typeof cfg.roles === 'object' && typeof permissions.setRoles === 'function') {
      permissions.setRoles(cfg.roles);
    }
  } catch (e) {
    logger?.error('Falha ao aplicar config de permissões.', { message: e?.message || String(e) }, 'bootstrap');
  }
}

function syncProviders(providers, settings, capabilities, logger) {
  const settingsCfg = settings.get('settings') || {};
  const configured = Array.isArray(settingsCfg.providers) ? settingsCfg.providers : [];
  for (const p of configured) {
    try { providers.register({ ...p }); } catch (e) { logger?.warn('Provedor inválido na config.', { id: p?.id, message: e?.message || String(e) }, 'bootstrap'); }
  }

  const ensure = (id, spec) => { if (!providers.get(id)) providers.register({ id, ...spec }); };
  ensure('browser-local', { name: 'Browser Local', type: 'Browser Local', state: 'available', capabilities: ['analysis', 'ui', 'storage'] });
  ensure('webgpu-local', {
    name: 'WebGPU Local',
    type: 'WebGPU',
    state: capabilities?.capabilities?.webgpu ? 'available' : 'unavailable',
    capabilities: capabilities?.capabilities?.webgpu ? ['gpu-detect', 'compute'] : [],
  });
  ensure('external-backend', {
    name: 'External Backend',
    type: 'Remote REST API',
    state: 'unconfigured',
    url: null,
    capabilities: ['remote-execution'],
  });

  // Reconcile states from settings/capabilities
  for (const p of configured) {
    if (p?.id && p?.state) providers.update(p.id, { state: p.state, url: p.url ?? providers.get(p.id)?.url ?? null });
  }
  if (capabilities?.capabilities?.webgpu) providers.update('webgpu-local', { state: 'available' });
  else providers.update('webgpu-local', { state: 'unavailable' });
}

function syncGenerators(generatorRegistry, settings) {
  const cfg = settings.get('generators') || {};
  const list = Array.isArray(cfg.generators) ? cfg.generators : [];
  for (const g of list) {
    if (!g?.id) continue;
    try { generatorRegistry.upsert(g); } catch {}
  }
  // Ensure defaults
  const defaults = [
    { id: 'frame-generator', name: 'Universal Frame Generator', category: 'unified', engine: 'auto', enabled: true },
    { id: 'image-generator', name: 'Image Generator', category: 'image', engine: 'image', enabled: true },
    { id: 'video-generator', name: 'Video Generator', category: 'video', engine: 'video', enabled: true },
    { id: 'game-frame-generator', name: 'Game Frame Generator', category: 'game', engine: 'game', enabled: true },
  ];
  for (const g of defaults) if (!generatorRegistry.get(g.id)) generatorRegistry.register(g);
}

async function detectCapabilities(webgpu, webcodecs, onnx, backend) {
  const safe = async (fn, fallback) => { try { return await fn(); } catch (e) { return { ...(fallback || {}), available: false, error: e?.message || String(e) }; } };
  const webgpuInfo = await safe(() => webgpu.detect(), { available: false, reason: 'Detecção indisponível' });
  const webcodecsInfo = webcodecs.detect ? webcodecs.detect() : { available: false };
  const onnxInfo = onnx.detect ? onnx.detect() : { available: false };
  const backendInfo = backend.getStatus ? backend.getStatus() : { id: 'backend', available: false, state: 'unconfigured' };
  const caps = {
    capabilities: {
      webgpu: !!webgpuInfo?.available,
      wasm: typeof WebAssembly === 'object',
      webcodecs: !!webcodecsInfo?.available,
      workers: typeof Worker !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      fileApi: typeof File !== 'undefined' && typeof Blob !== 'undefined',
    },
    webgpu: webgpuInfo,
    webcodecs: webcodecsInfo,
    onnx: onnxInfo,
    backend: backendInfo,
    hardware: {
      deviceMemoryGB: (typeof navigator !== 'undefined' && navigator.deviceMemory) || null,
      hardwareConcurrency: (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || null,
      platform: (typeof navigator !== 'undefined' && navigator.platform) || null,
    },
    browser: {
      userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
      language: (typeof navigator !== 'undefined' && navigator.language) || null,
    },
    detectedAt: nowIso(),
  };
  return caps;
}

export async function createApp(options = {}) {
  const events = new EventBus();
  const logger = options.logger || createLogger(events);
  const lifecycle = new LifecycleManager({ events, version: APP_VERSION, name: 'Frame-Generator-API', log: logger });

  const api = new ApiController({ mode: 'demo' });
  const settings = new SettingsManager();
  const db = new IndexedDBManager();
  const cache = new CacheManager();
  const history = new HistoryManager();
  const modelRegistry = new ModelRegistry();
  const modelLoader = new ModelLoader({ registry: modelRegistry, events });
  const modelCompatibility = new ModelCompatibility();
  const quantizationAnalyzer = new QuantizationAnalyzer();
  const jobs = new JobManager({ events, concurrency: 2 });
  const providers = new ProviderManager({ events });
  const quantization = new QuantizationManager({ events, jobs });
  const generatorRegistry = new GeneratorRegistry();
  const frameGenerator = new FrameGenerator();
  const imageGenerator = new ImageGenerator();
  const videoGenerator = new VideoGenerator();
  const imageProcessor = new ImageProcessor();
  const videoProcessor = new VideoProcessor();
  const frameProcessor = new FrameProcessor();
  const webgpu = new WebGPUEngine();
  const webcodecs = new WebCodecsEngine();
  const onnx = new ONNXEngine();
  const backend = new BackendAdapter({ id: 'default-backend', name: 'Default Backend', type: 'remote' });
  const tools = new ToolRegistry();
  const repacks = new RepackManager({ toolRegistry: tools, events });
  const auth = new AuthenticationManager();
  const permissions = new PermissionManager();
  const validation = new ValidationManager();

  // Register modules for lifecycle observability
  const moduleEntries = [
    ['ApiController', api, { category: 'core' }],
    ['SettingsManager', settings, { category: 'configuration' }],
    ['ModelLoader', modelLoader, { category: 'models' }],
    ['ModelRegistry', modelRegistry, { category: 'models' }],
    ['QuantizationManager', quantization, { category: 'quantization' }],
    ['FrameGenerator', frameGenerator, { category: 'generators' }],
    ['ImageGenerator', imageGenerator, { category: 'generators' }],
    ['VideoGenerator', videoGenerator, { category: 'generators' }],
    ['GeneratorRegistry', generatorRegistry, { category: 'generators' }],
    ['WebGPUEngine', webgpu, { category: 'engines' }],
    ['WebCodecsEngine', webcodecs, { category: 'engines' }],
    ['ONNXEngine', onnx, { category: 'engines' }],
    ['BackendAdapter', backend, { category: 'engines' }],
    ['RepackManager', repacks, { category: 'repacks' }],
    ['ToolRegistry', tools, { category: 'repacks' }],
    ['AuthenticationManager', auth, { category: 'security' }],
    ['PermissionManager', permissions, { category: 'security' }],
    ['ValidationManager', validation, { category: 'security' }],
    ['IndexedDBManager', db, { category: 'storage' }],
    ['CacheManager', cache, { category: 'storage' }],
    ['HistoryManager', history, { category: 'storage' }],
    ['JobManager', jobs, { category: 'jobs' }],
    ['ProviderManager', providers, { category: 'providers' }],
  ];
  for (const [name, instance, meta] of moduleEntries) {
    try { lifecycle.registerModule(name, instance, meta); } catch (e) { logger.warn(`Falha ao registrar módulo ${name}`, { message: e?.message || String(e) }); }
  }

  // Keep lifecycle registries in sync (counts/visibility)
  try {
    lifecycle.getRegistry('generators')?.clear();
    lifecycle.getRegistry('providers')?.clear();
    lifecycle.getRegistry('jobs')?.clear();
  } catch {}

  // Load and apply configs
  const configDiagnostics = await loadConfigs(settings, logger);
  applyApiConfig(api, backend, settings, logger);
  applyPermissionsConfig(permissions, settings, logger);

  // Default user/session (UI-level only in static hosting)
  try { if (!auth.listUsers().length) auth.createUser({ name: 'Administrator', role: 'Administrator' }); } catch {}

  syncGenerators(generatorRegistry, settings);

  // Capability detection
  const caps = await detectCapabilities(webgpu, webcodecs, onnx, backend);
  syncProviders(providers, settings, caps, logger);

  // Engines manager facade
  const enginesManager = {
    list: () => [webgpu.getStatus(), webcodecs.getStatus(), onnx.getStatus(), backend.getStatus()],
    get: (id) => ({ webgpu, webcodecs, onnx, 'onnx-web': onnx, backend, 'default-backend': backend }[id] || null),
    detect: async () => detectCapabilities(webgpu, webcodecs, onnx, backend),
    select: (criteria = {}) => {
      const c = criteria || {};
      const fmt = String(c.format || c.modelFormat || '').toLowerCase();
      const op = String(c.operation || c.type || '').toLowerCase();
      const backendOk = !!(backend.baseUrl || api.baseUrl) && backend.state !== 'unconfigured';
      const needVideo = /video|decode|encode|media|frame|interpol/.test(op);
      if (c.prefer === 'backend' && backendOk) return { id: 'backend', reason: 'Backend preferido e configurado.', state: 'selected' };
      if (fmt === 'onnx' && onnx.detect?.()?.available) return { id: 'onnx-web', reason: 'Modelo ONNX com runtime ONNX Web detectado.', state: 'selected' };
      if (needVideo && webcodecs.detect?.()?.available) return { id: 'webcodecs', reason: 'Operação de mídia com WebCodecs disponível.', state: 'selected' };
      if (caps?.capabilities?.webgpu && /gpu|compute|image|frame/.test(op || '')) return { id: 'webgpu', reason: 'WebGPU disponível para operações compatíveis.', state: 'selected' };
      if (backendOk) return { id: 'backend', reason: 'Backend configurado como alternativa.', state: 'selected' };
      return { id: null, reason: 'Nenhum engine compatível/disponível no ambiente atual; pode requerer runtime/provedor externo.', state: 'unavailable', criteria: c };
    },
  };

  // Sync lifecycle registries for visibility
  try {
    for (const g of generatorRegistry.list()) lifecycle.getRegistry('generators')?.upsert(g.id, { id: g.id, name: g.name, category: g.category, enabled: g.enabled });
    for (const p of providers.list()) lifecycle.getRegistry('providers')?.upsert(p.id, { id: p.id, name: p.name, type: p.type, state: p.state });
  } catch {}

  events.on('job.created', (job) => { try { lifecycle.getRegistry('jobs')?.upsert(job.id, { id: job.id, type: job.type, state: job.state }); } catch {} });
  events.on('job.completed', (job) => { try { lifecycle.getRegistry('jobs')?.upsert(job.id, { id: job.id, type: job.type, state: job.state }); } catch {} });
  events.on('provider.registered', ({ id, provider }) => { try { lifecycle.getRegistry('providers')?.upsert(id, { id, name: provider?.name, type: provider?.type, state: provider?.state }); } catch {} });

  const lifecycleStatus = await lifecycle.initialize({ caps, logger, settings, api, providers, engines: enginesManager, jobs });

  function getStatus() {
    const s = lifecycle.getStatus();
    let models = 0, loadedModels = 0, taskList = [], providerList = [], engineList = [], toolList = [], repackList = [], userList = [], generatorList = [];
    try { models = modelRegistry.list().length; } catch {}
    try { loadedModels = modelLoader.listLoaded().length; } catch {}
    try { taskList = jobs.list(); } catch {}
    try { providerList = providers.list(); } catch {}
    try { engineList = enginesManager.list(); } catch {}
    try { toolList = tools.list(); } catch {}
    try { repackList = repacks.list(); } catch {}
    try { userList = auth.listUsers(); } catch {}
    try { generatorList = generatorRegistry.list(); } catch {}
    const jobStates = taskList.reduce((acc, j) => { acc[j.state] = (acc[j.state] || 0) + 1; return acc; }, {});
    return {
      ...s,
      version: APP_VERSION,
      mode: api.mode,
      api: api.getConfig(),
      capabilities: caps,
      webgpu: caps.webgpu,
      webcodecs: caps.webcodecs,
      onnx: caps.onnx,
      backend: backend.getStatus(),
      config: { diagnostics: configDiagnostics, loaded: settings.list() },
      counts: {
        modules: s.modules?.length || 0,
        models,
        loadedModels,
        tasks: taskList.length,
        providers: providerList.length,
        engines: engineList.length,
        tools: toolList.length,
        repacks: repackList.length,
        users: userList.length,
        generators: generatorList.length,
      },
      jobs: { states: jobStates },
      enginesState: engineList,
      providersState: providerList,
      generatorsState: generatorList,
      updatedAt: nowIso(),
    };
  }

  function getIntegrationPayload(siteBase = '') {
    const status = getStatus();
    const contract = api.getContract();
    const base = siteBase || (typeof location !== 'undefined' ? new URL('../', location.href).toString() : './');
    const models = modelRegistry.list().map((m) => ({
      id: m.id, name: m.name || m.fileName, format: m.format, architecture: m.architecture,
      quantization: m.quantization, quantized: m.quantized, unquantized: m.unquantized, precision: m.precision,
      contextLength: m.contextLength, size: m.size, state: m.state, runtimeCompatible: m.runtimeCompatible || [],
    }));
    return {
      project: 'Frame-Generator-API',
      generatedAt: nowIso(),
      site: base,
      mode: api.mode,
      contract,
      backend: { baseUrl: api.baseUrl, configured: !!api.baseUrl, state: backend.getStatus().state },
      status: { status: status.status, initialized: status.initialized, version: status.version, counts: status.counts, jobs: status.jobs },
      capabilities: status.capabilities,
      models,
      engines: enginesManager.list(),
      providers: providers.list(),
      generators: generatorRegistry.list(),
      repacks: repacks.list(),
      tools: tools.list(),
      configs: {
        api: new URL('configs/api.json', base).toString(),
        models: new URL('configs/models.json', base).toString(),
        generators: new URL('configs/generators.json', base).toString(),
        repacks: new URL('configs/repacks.json', base).toString(),
        permissions: new URL('configs/permissions.json', base).toString(),
        settings: new URL('configs/settings.json', base).toString(),
      },
      docs: {
        masterPrompt: new URL('Public/documentation/master-prompt.md', base).toString(),
        commands: new URL('Public/documentation/commands.md', base).toString(),
        documentation: new URL('Public/documentation/index.md', base).toString(),
      },
      notes: [
        'Hospedagem estática: /api/v1 é contrato lógico; operações remotas requerem backend/provedor compatível configurado.',
        'Inferência, quantização efetiva e processamento pesado não são simulados; estados unavailable/requires-provider/runtime indicam dependências ausentes.',
        'GGUF: metadados podem ser analisados no cliente quando suportado; execução requer runtime/provedor compatível.',
      ],
    };
  }

  const app = {
    version: APP_VERSION,
    events,
    logger,
    lifecycle,
    core: lifecycle,
    api,
    settings,
    config: settings,
    db,
    storage: db,
    cache,
    history,
    modelRegistry,
    modelLoader,
    modelCompatibility,
    quantization,
    quantizationAnalyzer,
    generatorRegistry,
    frameGenerator,
    imageGenerator,
    videoGenerator,
    universalGenerator: frameGenerator,
    imageProcessor,
    videoProcessor,
    frameProcessor,
    webgpu,
    webcodecs,
    onnx,
    backend,
    engines: enginesManager,
    tools,
    repacks,
    auth,
    users: auth,
    permissions,
    validation,
    security: validation,
    jobs,
    tasks: jobs,
    providers,
    caps,
    capabilities: caps,
    webgpuInfo: caps.webgpu,
    codecsInfo: caps.webcodecs,
    configDiagnostics,
    getStatus,
    getIntegrationPayload,
  };

  if (typeof window !== 'undefined') {
    window.FGUA = app;
    window.FGUA_APP = app;
  }

  logger.info('Núcleo FGUA inicializado.', { status: lifecycleStatus.status, version: APP_VERSION }, 'bootstrap');
  return app;
}

export default createApp;
