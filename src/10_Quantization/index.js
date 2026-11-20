import { uid, nowIso } from '../26_Utils/index.js';

// Análise/estimativa/planejamento real; conversão delegada a runtime/provedor compatível.
export class UniversalQuantizationManager {
  constructor(options = {}) {
    this.events = options.events || null;
    this.jobs = new Map();
    this.profiles = [
      { id: 'F32', bits: 32, category: 'fp', note: 'Precisão total' },
      { id: 'F16', bits: 16, category: 'fp', note: 'Meia precisão' },
      { id: 'BF16', bits: 16, category: 'fp', note: 'Brain float 16' },
      { id: 'Q8_0', bits: 8, category: 'gguf-int', note: '8-bit (GGUF)' },
      { id: 'Q6_K', bits: 6, category: 'gguf-k', note: 'K-quant 6-bit' },
      { id: 'Q5_K', bits: 5, category: 'gguf-k', note: 'K-quant 5-bit' },
      { id: 'Q4_K', bits: 4, category: 'gguf-k', note: 'K-quant 4-bit' },
      { id: 'Q4_0', bits: 4, category: 'gguf-int', note: '4-bit legado' },
      { id: 'IQ4', bits: 4, category: 'gguf-iq', note: 'Importance quant (família)' }
    ];
  }

  getProfiles() { return this.profiles.map(p => ({ ...p })); }

  identify(modelMeta = {}) {
    const t = modelMeta?.metadata?.quantization?.tensorTypes || modelMeta?.tensorTypes || [];
    const fileType = modelMeta?.metadata?.model?.fileType ?? modelMeta?.metadata?.quantization?.fileType ?? null;
    return { tensorTypes: t, fileType, quantized: Array.isArray(t) ? t.some(x => /Q|IQ/i.test(x)) : null };
  }

  estimate(modelMeta = {}, targetProfile = 'Q4_K') {
    const size = modelMeta?.size || modelMeta?.file?.size || null;
    const profile = this.profiles.find(p => p.id === targetProfile) || null;
    if (!size || !profile) return { ok: false, error: 'Tamanho do modelo ou perfil inválido', inputSize: size, target: targetProfile };
    // estimativa aproximada baseada em razão de bits vs fp16 de referência
    const refBits = 16;
    const ratio = profile.bits / refBits;
    const estimated = Math.round(size * ratio * 1.05); // overhead leve
    return {
      ok: true,
      inputSize: size,
      target: targetProfile,
      estimatedSize: estimated,
      estimatedDelta: estimated - size,
      ratio,
      note: 'Estimativa aproximada; tamanho real depende de tensores, metadados e implementação do quantizador.'
    };
  }

  analyze(modelMeta = {}, targetProfile = 'Q4_K') {
    const idInfo = this.identify(modelMeta);
    const est = this.estimate(modelMeta, targetProfile);
    const compat = (modelMeta?.format === 'gguf')
      ? { convertible: 'requires-runtime', runtimes: ['llama.cpp/llama-quantize (externo)', 'serviço de quantização compatível'] }
      : { convertible: false, reason: 'Quantização GGUF aplicável a modelos GGUF; outros formatos exigem ferramentas específicas.' };
    return { ok: true, analyzedAt: nowIso(), identification: idInfo, estimate: est, compatibility: compat, sourcePreserved: true };
  }

  async plan(modelMeta = {}, targetProfile = 'Q4_K', provider = null) {
    const analysis = this.analyze(modelMeta, targetProfile);
    const plan = {
      id: uid('qplan'),
      createdAt: nowIso(),
      modelId: modelMeta?.id || null,
      target: targetProfile,
      analysis,
      steps: ['validate-input', 'inspect-tensors', 'select-profile', 'delegate-conversion-runtime', 'validate-output', 'register-result'],
      canExecuteInBrowser: false,
      requiresRuntime: true,
      provider: provider?.id || null
    };
    return { ok: true, plan };
  }

  async execute(modelMeta = {}, targetProfile = 'Q4_K', options = {}) {
    const job = { id: uid('qjob'), state: 'analyzing', modelId: modelMeta?.id || null, target: targetProfile, createdAt: nowIso(), result: null, error: null };
    this.jobs.set(job.id, job);
    const analysis = this.analyze(modelMeta, targetProfile);
    // Sem runtime/provedor de quantização real, não simula conversão
    if (!options.provider || !options.provider.supportsQuantization) {
      job.state = 'unavailable';
      job.result = { analysis };
      job.error = { code: 'RUNTIME_REQUIRED', message: 'Conversão de quantização requer runtime/provedor compatível (ex.: llama-quantize/serviço externo). Nenhuma conversão fictícia executada; arquivo original preservado.' };
      job.completedAt = nowIso();
      return { ok: false, job };
    }
    // Se houver provedor real no futuro, delegação ocorreria aqui
    job.state = 'unavailable';
    job.error = { code: 'NOT_IMPLEMENTED_PROVIDER', message: 'Delegação ao provedor informado não implementada neste cliente.' };
    job.completedAt = nowIso();
    return { ok: false, job };
  }

  getJob(id) { return this.jobs.get(id) || null; }
  listJobs() { return [...this.jobs.values()]; }
}

export default UniversalQuantizationManager;
