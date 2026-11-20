import { MetadataLoader } from './MetadataLoader.js';
import { uid, nowIso } from '../core/utils.js';

function human(bytes) {
  if (!Number.isFinite(Number(bytes))) return 'n/d';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = Number(bytes);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 2 : 0)} ${u[i]}`;
}

export class ModelLoader {
  constructor(options = {}) {
    this.registry = options.registry || null;
    this.events = options.events || null;
    this.meta = new MetadataLoader();
    this.loaded = new Map();
  }

  detectFormat(fileName = '', mime = '') {
    const n = String(fileName || '').toLowerCase();
    if (n.endsWith('.gguf')) return 'gguf';
    if (n.endsWith('.onnx')) return 'onnx';
    if (n.endsWith('.safetensors')) return 'safetensors';
    if (n.endsWith('.bin')) return 'bin';
    if (n.endsWith('.pt')) return 'pt';
    if (n.endsWith('.pth')) return 'pth';
    if (String(mime || '').includes('json') || n.endsWith('.json')) return 'json-manifest';
    return 'unknown';
  }

  runtimeCompatibility(format) {
    if (format === 'gguf') return { analyzable: true, browserExecution: 'requires-provider', runtimes: ['backend/local runtime (GGUF)', 'provedor remoto'] };
    if (format === 'onnx') return { analyzable: 'partial', browserExecution: 'onnxruntime-web (quando compatível)', runtimes: ['onnxruntime-web', 'provedor remoto'] };
    if (format === 'safetensors') return { analyzable: 'partial', browserExecution: 'requires-provider', runtimes: ['provedor remoto'] };
    if (format === 'json-manifest') return { analyzable: true, browserExecution: 'local', runtimes: ['browser'] };
    return { analyzable: false, browserExecution: 'unsupported', runtimes: [] };
  }

  async analyzeFile(file, options = {}) {
    const format = this.detectFormat(file?.name, file?.type);
    const splitHint = /(\.part\d+|-\d{5}-of-\d{5}|\.split|\.gguf\.\d+)/i.test(String(file?.name || ''));
    const base = {
      id: uid('model'),
      fileName: file?.name || null,
      size: Number(file?.size) || 0,
      sizeHuman: human(Number(file?.size) || 0),
      format,
      analyzedAt: nowIso(),
      splitHint,
      source: 'local-file',
    };

    if (format === 'gguf') {
      let parsed;
      try {
        parsed = await this.meta.parseFile(file, options);
      } catch (e) {
        parsed = { ok: false, error: { code: 'GGUF_PARSE_ERROR', message: e?.message || String(e) } };
      }
      if (parsed?.ok === false) {
        const model = { ...base, name: file?.name || 'Modelo GGUF', state: 'error', warnings: [parsed.error?.message || 'Falha na análise GGUF.'], metadata: parsed };
        if (this.registry) this.registry.register(model);
        return { ok: false, state: 'error', model, error: parsed.error || { code: 'GGUF_PARSE_ERROR', message: 'Falha na análise GGUF.' }, compatibility: this.runtimeCompatibility(format), analysis: parsed };
      }
      const tensorTypes = parsed.quantization?.tensorTypes || [];
      const u = tensorTypes.map((x) => String(x).toUpperCase());
      const quantized = u.some((x) => /^Q|^IQ/.test(x));
      const unquantized = !quantized && u.some((x) => /^F(16|32|64)$|^BF16$/.test(x));
      const precision = unquantized ? (u.includes('F32') ? 'F32' : u.includes('BF16') ? 'BF16' : u.includes('F64') ? 'F64' : 'F16') : (quantized ? (u.find((x) => /^Q|^IQ/.test(x)) || 'quantized') : (parsed.model?.fileType ?? null));
      const compat = this.runtimeCompatibility(format);
      const model = {
        ...base,
        name: parsed.model?.name || file?.name || 'Modelo GGUF',
        architecture: parsed.model?.architecture || null,
        quantization: precision,
        quantized,
        unquantized,
        precision,
        tensorTypes,
        parameters: null,
        contextLength: parsed.model?.contextLength || null,
        runtimeCompatible: compat.runtimes,
        metadata: parsed,
        tensors: parsed.tensors || null,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        state: 'analyzed',
      };
      if (this.registry) this.registry.register(model);
      this.events?.emit('model.analyzed', { id: model.id, format, architecture: model.architecture, quantized, precision, state: model.state });
      return {
        ok: true,
        state: 'analyzed',
        model: this.registry?.get(model.id) || model,
        compatibility: compat,
        analysis: { gguf: true, version: parsed.version, unquantized, quantized, precision, tensorTypes, splitHint, warnings: model.warnings, note: splitHint ? 'Nome sugere arquivo dividido; análise realizada apenas no arquivo selecionado.' : 'Metadados GGUF analisados no arquivo selecionado.' },
      };
    }

    const compat = this.runtimeCompatibility(format);
    const warning = format === 'unknown'
      ? 'Formato não suportado para análise no cliente.'
      : 'Análise binária completa não implementada para este formato no cliente; metadados podem ser parciais ou indisponíveis.';
    const model = {
      ...base,
      name: file?.name || 'Modelo',
      architecture: null,
      quantization: null,
      quantized: null,
      unquantized: null,
      tensorTypes: [],
      runtimeCompatible: compat.runtimes,
      metadata: null,
      tensors: null,
      warnings: [warning],
      state: format === 'unknown' ? 'unsupported' : 'analyzed',
    };
    if (this.registry) this.registry.register(model);
    this.events?.emit('model.analyzed', { id: model.id, format, state: model.state });
    return { ok: format !== 'unknown', state: model.state, model: this.registry?.get(model.id) || model, compatibility: compat, warning };
  }

  async loadModel(modelId, options = {}) {
    const model = this.registry?.get(modelId);
    if (!model) return { ok: false, state: 'not_found', error: { code: 'NOT_FOUND', message: 'Modelo não registrado.' } };
    const provider = options.provider || options.runtime || null;
    if (!provider) {
      if (this.registry) this.registry.update(modelId, { state: 'analyzed' });
      return { ok: false, state: 'requires-provider', error: { code: 'PROVIDER_REQUIRED', message: 'Carregamento/execução requer runtime ou provedor compatível. O modelo não foi carregado para inferência.' }, model: this.registry?.get(modelId) || model };
    }
    this.loaded.set(modelId, { provider, loadedAt: nowIso(), status: 'requested' });
    if (this.registry) this.registry.update(modelId, { state: 'load-requested', loadedAt: nowIso(), provider: provider.id || provider.name || provider });
    this.events?.emit('model.load_requested', { id: modelId, provider: provider.id || provider });
    return { ok: true, state: 'load-requested', model: this.registry?.get(modelId) || model, note: 'Solicitação registrada; carregamento efetivo depende de runtime/provedor compatível.' };
  }

  async unloadModel(modelId) {
    const existed = this.loaded.delete(modelId);
    if (this.registry) this.registry.update(modelId, { state: 'unloaded' });
    this.events?.emit('model.unloaded', { id: modelId, existed });
    return { ok: true, state: 'unloaded', id: modelId };
  }

  listLoaded() { return [...this.loaded.keys()]; }
}

export default ModelLoader;
