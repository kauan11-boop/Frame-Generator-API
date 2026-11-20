import { QuantizationAnalyzer } from './QuantizationAnalyzer.js';
import { uid, nowIso } from '../core/utils.js';

export class QuantizationManager {
  constructor(options = {}) {
    this.analyzer = new QuantizationAnalyzer();
    this.jobs = new Map();
    this.events = options.events || null;
    this.jobManager = options.jobs || null; // optional integration with global JobManager
  }

  getProfiles() { return this.analyzer.getProfiles(); }
  analyze(modelMeta, target) { return this.analyzer.analyze(modelMeta, target); }

  async plan(modelMeta = {}, target = 'Q4_K_M', provider = null) {
    const analysis = this.analyze(modelMeta, target);
    const format = String(modelMeta?.format || '').toLowerCase();
    const canExecuteInBrowser = false;
    const requiresRuntime = format === 'gguf';
    return {
      ok: true,
      state: 'planned',
      plan: {
        id: uid('qplan'),
        createdAt: nowIso(),
        modelId: modelMeta?.id || null,
        target,
        format: modelMeta?.format || null,
        analysis,
        steps: [
          'validate-input',
          'inspect-metadata-and-tensors',
          'select-target-profile',
          'delegate-conversion-to-compatible-runtime-provider',
          'validate-output-artifact',
          'register-result-without-modifying-source',
        ],
        canExecuteInBrowser,
        requiresRuntime,
        provider: provider?.id || provider || null,
        note: 'Nenhuma conversão/quantização é executada no cliente estático; arquivo original deve ser preservado.',
      },
    };
  }

  async execute(modelMeta = {}, target = 'Q4_K_M', options = {}) {
    const job = {
      id: uid('qjob'),
      state: 'analyzing',
      modelId: modelMeta?.id || null,
      target,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      result: null,
      error: null,
    };
    this.jobs.set(job.id, job);
    this.events?.emit('quantization.started', { id: job.id, modelId: job.modelId, target });

    const analysis = this.analyze(modelMeta, target);
    job.result = { analysis };

    // Explicit and honest behavior: no fake conversion in browser/static client.
    job.state = 'unavailable';
    job.updatedAt = nowIso();
    job.completedAt = nowIso();
    job.error = {
      code: options?.provider?.supportsQuantization ? 'PROVIDER_DELEGATION_UNAVAILABLE' : 'RUNTIME_REQUIRED',
      message: options?.provider?.supportsQuantization
        ? 'Delegação de quantização ao provedor informado não está implementada neste cliente. Nenhuma conversão fictícia executada; arquivo original preservado.'
        : 'Conversão/quantização requer runtime/provedor compatível. Nenhuma conversão fictícia executada; arquivo original preservado.',
    };
    this.events?.emit('quantization.unavailable', { id: job.id, error: job.error });
    return { ok: false, state: 'unavailable', job: { ...job } };
  }

  getJob(id) { const j = this.jobs.get(id); return j ? { ...j } : null; }
  listJobs() { return [...this.jobs.values()].map((j) => ({ ...j })); }
}

export default QuantizationManager;
