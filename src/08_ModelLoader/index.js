import { GGUFMetadataLoader } from '../09_ModelMetadata/index.js';
import { uid, nowIso, bytesToHuman } from '../26_Utils/index.js';

export class UniversalModelLoader {
  constructor(options = {}) {
    this.registry = options.registry || null;
    this.events = options.events || null;
    this.gguf = new GGUFMetadataLoader();
    this.loaded = new Map(); // id -> runtime handle/state
  }

  detectFormat(fileName = '', mime = '') {
    const n = (fileName || '').toLowerCase();
    if (n.endsWith('.gguf')) return 'gguf';
    if (n.endsWith('.onnx')) return 'onnx';
    if (n.endsWith('.safetensors')) return 'safetensors';
    if (n.endsWith('.bin')) return 'bin';
    if (n.endsWith('.pt')) return 'pt';
    if (n.endsWith('.pth')) return 'pth';
    if ((mime || '').includes('json')) return 'json-manifest';
    return 'unknown';
  }

  runtimeCompatibility(format, analysis = null) {
    // Navegador: análise/metadados amplos; execução depende de runtime/provedor
    if (format === 'gguf') return { analyzable: true, browserExecution: 'requires-provider', runtimes: ['llama.cpp-server (externo)', 'WebAssembly (limitado/experimental)', 'provedor remoto'] };
    if (format === 'onnx') return { analyzable: 'parcial', browserExecution: 'possível via ONNX Runtime Web (modelo compatível)', runtimes: ['onnxruntime-web', 'provedor remoto'] };
    if (format === 'safetensors') return { analyzable: 'parcial', browserExecution: 'requires-provider', runtimes: ['provedor remoto', 'runtime especializado'] };
    if (format === 'json-manifest') return { analyzable: true, browserExecution: 'config/manifest', runtimes: ['browser'] };
    return { analyzable: false, browserExecution: 'unsupported', runtimes: [] };
  }

  async analyzeFile(file, options = {}) {
    const format = this.detectFormat(file.name, file.type);
    const base = { id: uid('model'), fileName: file.name, size: file.size, sizeHuman: bytesToHuman(file.size), format, analyzedAt: nowIso() };
    if (format === 'gguf') {
      const parsed = await this.gguf.parseFile(file, options);
      const quant = parsed.quantization?.tensorTypes?.[0] || (parsed.model?.fileType ?? null);
      const compat = this.runtimeCompatibility(format, parsed);
      const model = {
        ...base,
        name: parsed.model?.name || file.name,
        architecture: parsed.model?.architecture || null,
        quantization: quant,
        tensorTypes: parsed.quantization?.tensorTypes || [],
        parameters: null,
        contextLength: parsed.model?.contextLength || null,
        requirements: { memoryEstimate: null, note: 'Carregamento de pesos grandes requer runtime/provedor compatível; análise feita por metadados/índice.' },
        runtimeCompatible: compat.runtimes,
        metadata: parsed,
        tensors: parsed.tensors,
        state: 'analyzed'
      };
      if (this.registry) this.registry.register(model);
      this.events?.emit('model.analyzed', { id: model.id, name: model.name, format, architecture: model.architecture });
      return { ok: true, model, compatibility: compat };
    }
    const compat = this.runtimeCompatibility(format);
    const model = { ...base, name: file.name, architecture: null, quantization: null, tensorTypes: [], runtimeCompatible: compat.runtimes, metadata: null, tensors: null, state: format === 'unknown' ? 'error' : 'analyzed', note: format === 'unknown' ? 'Formato não reconhecido.' : 'Análise profunda indisponível no navegador para este formato; metadados básicos registrados.' };
    if (this.registry) this.registry.register(model);
    this.events?.emit('model.analyzed', { id: model.id, name: model.name, format });
    return { ok: format !== 'unknown', model, compatibility: compat, warning: format !== 'unknown' ? 'Parser binário completo não implementado para este formato no cliente; use provedor/runtime compatível.' : 'Formato não suportado.' };
  }

  async loadModel(modelId, options = {}) {
    const model = this.registry?.get(modelId);
    if (!model) return { ok: false, error: { code: 'NOT_FOUND', message: 'Modelo não registrado' } };
    const provider = options.provider || null;
    // Execução real no navegador para GGUF completo não é garantida; requer runtime/provedor
    if (!provider) {
      return { ok: false, state: 'unavailable', error: { code: 'PROVIDER_REQUIRED', message: 'Carregamento/execução deste modelo requer provedor ou runtime compatível (ex.: llama.cpp server, ONNX Runtime Web compatível, serviço externo). Metadados já disponíveis.' }, model };
    }
    this.loaded.set(modelId, { provider, loadedAt: nowIso(), status: 'requested' });
    if (this.registry) this.registry.update(modelId, { state: 'loaded' });
    this.events?.emit('model.loaded', { id: modelId, provider: provider.id || provider });
    return { ok: true, state: 'loaded', model: this.registry.get(modelId), provider: provider.id || provider };
  }

  async unloadModel(modelId) {
    this.loaded.delete(modelId);
    if (this.registry) this.registry.update(modelId, { state: 'unloaded' });
    this.events?.emit('model.unloaded', { id: modelId });
    return { ok: true, id: modelId, state: 'unloaded' };
  }

  getLoaded(id) { return this.loaded.get(id) || null; }
  listLoaded() { return [...this.loaded.keys()]; }
}

export default UniversalModelLoader;
