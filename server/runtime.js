import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG_FILES = ['api', 'models', 'generators', 'repacks', 'permissions', 'settings'];
const MODULES = [
  { id: 'ApiController', area: 'core', state: 'browser-module' },
  { id: 'EventBus', area: 'core', state: 'browser-module' },
  { id: 'ModuleRegistry', area: 'core', state: 'browser-module' },
  { id: 'LifecycleManager', area: 'core', state: 'browser-module' },
  { id: 'ModelLoader', area: 'models', state: 'browser-module' },
  { id: 'MetadataLoader', area: 'models', state: 'browser-module' },
  { id: 'QuantizationManager', area: 'quantization', state: 'browser-module' },
  { id: 'FrameGenerator', area: 'generators', state: 'browser-module' },
  { id: 'ImageGenerator', area: 'generators', state: 'browser-module' },
  { id: 'VideoGenerator', area: 'generators', state: 'browser-module' },
  { id: 'WebGPUEngine', area: 'engines', state: 'browser-module' },
  { id: 'WebCodecsEngine', area: 'engines', state: 'browser-module' },
  { id: 'ONNXEngine', area: 'engines', state: 'browser-module' },
  { id: 'BackendAdapter', area: 'engines', state: 'browser-module' },
  { id: 'RepackManager', area: 'repacks', state: 'browser-module' },
  { id: 'ToolRegistry', area: 'repacks', state: 'browser-module' },
  { id: 'PermissionManager', area: 'security', state: 'browser-module' },
  { id: 'IndexedDBManager', area: 'storage', state: 'browser-module' },
  { id: 'JobManager', area: 'jobs', state: 'browser-module' }
];

export class FguaRuntime {
  constructor() {
    this.startedAt = new Date().toISOString();
    this.config = new Map();
    this.configErrors = [];
  }

  async initialize() {
    for (const name of CONFIG_FILES) {
      try {
        const raw = await readFile(resolve(ROOT, 'configs', name + '.json'), 'utf8');
        this.config.set(name, JSON.parse(raw.replace(/^\uFEFF/, '')));
      } catch (error) {
        this.configErrors.push({ file: name + '.json', message: error.message });
      }
    }
    return this.status();
  }

  status() {
    return {
      name: 'Frame-Generator-API',
      architecture: 'FGUA Universal Runtime',
      version: '0.2.0',
      status: 'ready',
      runtime: 'node',
      aiRequired: false,
      startedAt: this.startedAt,
      modules: MODULES.length,
      configsLoaded: this.config.size,
      configErrors: [...this.configErrors]
    };
  }

  contract() {
    return this.config.get('api') || {
      base: '/api/v1',
      namespaces: ['system','models','metadata','quantization','generators','frames','images','videos','engines','repack','tools','users','permissions','config','jobs','storage'].map(x => '/api/v1/' + x + '/')
    };
  }

  modules() { return MODULES.map(x => ({ ...x })); }

  catalog(name) {
    const cfg = this.config.get(name);
    if (!cfg) return { ok: false, error: 'Configuração não encontrada', name };
    const key = Object.keys(cfg).find(k => Array.isArray(cfg[k]));
    return { ok: true, name, items: key ? cfg[key] : cfg, count: key ? cfg[key].length : undefined };
  }

  aiStatus() {
    return {
      enabled: Boolean(process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_KEY),
      required: false,
      providers: [
        { id: 'lm-studio', configured: Boolean(process.env.LM_STUDIO_BASE_URL) },
        { id: 'openai-compatible', configured: Boolean(process.env.OPENAI_BASE_URL) }
      ],
      note: 'O runtime e as ferramentas MCP funcionam sem modelo de IA. Nenhuma chave ou segredo é exposto.'
    };
  }

  validatePipeline(input) {
    const stages = Array.isArray(input?.stages) ? input.stages : [];
    const errors = [];
    const ids = new Set();
    if (!stages.length) errors.push('Informe pelo menos uma etapa em stages.');
    stages.forEach((stage, index) => {
      if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
        errors.push('Etapa ' + index + ' deve ser um objeto.');
        return;
      }
      if (typeof stage.id !== 'string' || !stage.id.trim()) errors.push('Etapa ' + index + ': id obrigatório.');
      else if (ids.has(stage.id)) errors.push('ID duplicado: ' + stage.id);
      else ids.add(stage.id);
      if (typeof stage.type !== 'string' || !stage.type.trim()) errors.push('Etapa ' + index + ': type obrigatório.');
    });
    return {
      ok: errors.length === 0,
      validated: true,
      executed: false,
      stageCount: stages.length,
      errors,
      note: 'Validação não executa geração, inferência, quantização ou processamento.'
    };
  }
}

export async function createRuntime() {
  const runtime = new FguaRuntime();
  await runtime.initialize();
  return runtime;
}
