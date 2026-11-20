export class QuantizationAnalyzer {
  constructor() {
    this.profiles = [
      { id: 'F32', bits: 32, category: 'fp' },
      { id: 'F16', bits: 16, category: 'fp' },
      { id: 'BF16', bits: 16, category: 'fp' },
      { id: 'Q8_0', bits: 8, category: 'gguf-int' },
      { id: 'Q6_K', bits: 6, category: 'gguf-k' },
      { id: 'Q5_K_M', bits: 5.5, category: 'gguf-k' },
      { id: 'Q5_K', bits: 5, category: 'gguf-k' },
      { id: 'Q4_K_M', bits: 4.5, category: 'gguf-k' },
      { id: 'Q4_K', bits: 4, category: 'gguf-k' },
      { id: 'Q4_0', bits: 4, category: 'gguf-int' },
      { id: 'Q3_K_M', bits: 3.5, category: 'gguf-k' },
      { id: 'Q2_K', bits: 2.5, category: 'gguf-k' },
    ];
  }

  getProfiles() { return this.profiles.map((p) => ({ ...p })); }

  identify(modelMeta = {}) {
    const t = modelMeta?.metadata?.quantization?.tensorTypes || modelMeta?.tensorTypes || [];
    const fileType = modelMeta?.metadata?.model?.fileType ?? modelMeta?.metadata?.quantization?.fileType ?? null;
    const types = Array.isArray(t) ? t.map((x) => String(x).toUpperCase()) : [];
    const quantizedTypes = types.filter((x) => /^Q|^IQ/.test(x));
    const fpTypes = types.filter((x) => /^F(16|32|64)$|^BF16$/.test(x));
    const isQuantized = quantizedTypes.length > 0 ? true : (types.length ? false : null);
    const isUnquantized = !isQuantized && fpTypes.length > 0 ? true : (types.length ? false : null);
    const precision = isUnquantized ? (types.includes('F32') ? 'F32' : types.includes('BF16') ? 'BF16' : types.includes('F64') ? 'F64' : 'F16') : (isQuantized ? (quantizedTypes[0] || 'quantized') : null);
    return { tensorTypes: types, fileType, quantized: isQuantized, unquantized: isUnquantized, precision, quantizedTypes, fpTypes };
  }

  _sourceBitsHint(identification) {
    if (identification?.unquantized) {
      if (identification.precision === 'F32') return 32;
      if (identification.precision === 'F64') return 64;
      return 16; // F16/BF16
    }
    if (identification?.quantized) return 8; // rough fallback when only quantized type is known
    return null;
  }

  estimate(modelMeta = {}, target = 'Q4_K_M') {
    const size = Number(modelMeta?.size || modelMeta?.file?.size || modelMeta?.metadata?.file?.size);
    const profile = this.profiles.find((p) => p.id === String(target).toUpperCase()) || this.profiles.find((p) => p.id === target);
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, state: 'invalid', error: { code: 'INVALID_SIZE', message: 'Tamanho do modelo inválido para estimativa.' }, inputSize: size || null, target };
    }
    if (!profile) {
      return { ok: false, state: 'unsupported-target', error: { code: 'UNKNOWN_PROFILE', message: 'Perfil de quantização alvo não reconhecido.' }, inputSize: size, target };
    }
    const identification = this.identify(modelMeta);
    const sourceBits = this._sourceBitsHint(identification) || 16;
    const ratio = Math.max(0.05, profile.bits / sourceBits);
    const estimated = Math.round(size * ratio * 1.05);
    return {
      ok: true,
      state: 'estimated',
      inputSize: size,
      target: profile.id,
      estimatedSize: estimated,
      estimatedDelta: estimated - size,
      ratio,
      assumptions: {
        sourceBitsAssumed: sourceBits,
        note: 'Estimativa aproximada baseada em tamanho total e perfil alvo; resultados reais dependem do formato, tensores e runtime/ferramenta.',
      },
    };
  }

  analyze(modelMeta = {}, target = 'Q4_K_M') {
    const identification = this.identify(modelMeta);
    const estimate = this.estimate(modelMeta, target);
    const format = String(modelMeta?.format || '').toLowerCase();
    const convertible = format === 'gguf'
      ? { possible: 'requires-runtime', runtimes: ['ferramenta/runtime GGUF compatível (ex.: llama.cpp/serviço externo)'], reason: 'Conversão/quantização efetiva não é executada no cliente estático.' }
      : { possible: false, reason: 'Quantização GGUF aplica-se a modelos GGUF; outros formatos exigem ferramenta/runtime específico.' };
    return {
      ok: true,
      state: estimate.ok ? 'analyzed' : 'analyzed-with-warnings',
      analyzedAt: new Date().toISOString(),
      identification,
      estimate,
      compatibility: convertible,
      sourcePreserved: true,
      warnings: estimate.ok ? [] : [estimate.error?.message || 'Estimativa indisponível.'],
    };
  }
}

export default QuantizationAnalyzer;
