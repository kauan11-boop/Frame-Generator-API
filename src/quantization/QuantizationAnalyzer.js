export class QuantizationAnalyzer {
  constructor(){ this.profiles=[{id:'F32',bits:32,category:'fp'},{id:'F16',bits:16,category:'fp'},{id:'BF16',bits:16,category:'fp'},{id:'Q8_0',bits:8,category:'gguf-int'},{id:'Q6_K',bits:6,category:'gguf-k'},{id:'Q5_K',bits:5,category:'gguf-k'},{id:'Q4_K',bits:4,category:'gguf-k'},{id:'Q4_0',bits:4,category:'gguf-int'},{id:'IQ4',bits:4,category:'gguf-iq'}]; }
  getProfiles(){ return this.profiles.map(p=>({...p})); }
  identify(modelMeta={}){
    const t = modelMeta?.metadata?.quantization?.tensorTypes || modelMeta?.tensorTypes || [];
    const fileType = modelMeta?.metadata?.model?.fileType ?? modelMeta?.metadata?.quantization?.fileType ?? null;
    const types = Array.isArray(t) ? t.map(x=>String(x).toUpper()) : [];
    const quantizedTypes = types.filter(x=>/^Q|^IQ/.test(x));
    const fpTypes = types.filter(x=>/^F(16|32|64)$|^BF16$/.test(x));
    const isQuantized = quantizedTypes.length > 0;
    const isUnquantized = !isQuantized && fpTypes.length > 0;
    const precision = isUnquantized ? (types.includes('F32') ? 'F32' : types.includes('BF16') ? 'BF16' : types.includes('F64') ? 'F64' : 'F16') : (isQuantized ? (quantizedTypes[0] || 'quantized') : null);
    return { tensorTypes: t, fileType, quantized: types.length ? isQuantized : null, unquantized: types.length ? isUnquantized : null, precision, quantizedTypes, fpTypes };
  }
  estimate(modelMeta={}, target='Q4_K'){
    const size = modelMeta?.size || modelMeta?.file?.size || null;
    const profile = this.profiles.find(p=>p.id===target);
    if(!size || !profile) return { ok:false, error:'Tamanho ou perfil inválido', inputSize:size, target };
    const ratio = profile.bits/16; const estimated = Math.round(size*ratio*1.05);
    return { ok:true, inputSize:size, target, estimatedSize:estimated, estimatedDelta:estimated-size, ratio, note:'Estimativa aproximada.' };
  }
  analyze(modelMeta={}, target='Q4_K'){
    const identification=this.identify(modelMeta); const estimate=this.estimate(modelMeta,target);
    const convertible = (modelMeta?.format==='gguf') ? { possible:'requires-runtime', runtimes:['llama-quantize/serviço externo'] } : { possible:false, reason:'Quantização GGUF aplica-se a modelos GGUF; outros formatos exigem ferramenta específica.' };
    return { ok:true, analyzedAt:new Date().toISOString(), identification, estimate, compatibility:convertible, sourcePreserved:true };
  }
}
export default QuantizationAnalyzer;
