import { MetadataLoader } from './MetadataLoader.js';

function uid(p='model'){return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
function human(bytes){ if(!Number.isFinite(bytes)) return 'n/d'; const u=['B','KB','MB','GB','TB']; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(i?2:0)} ${u[i]}`; }

export class ModelLoader {
  constructor(options={}){
    this.registry = options.registry || null;
    this.events = options.events || null;
    this.meta = new MetadataLoader();
    this.loaded = new Map();
  }

  detectFormat(fileName='', mime=''){
    const n=(fileName||'').toLowerCase();
    if(n.endsWith('.gguf')) return 'gguf';
    if(n.endsWith('.onnx')) return 'onnx';
    if(n.endsWith('.safetensors')) return 'safetensors';
    if(n.endsWith('.bin')) return 'bin';
    if(n.endsWith('.pt')) return 'pt';
    if(n.endsWith('.pth')) return 'pth';
    if((mime||'').includes('json')) return 'json-manifest';
    return 'unknown';
  }

  runtimeCompatibility(format){
    if(format==='gguf') return { analyzable:true, browserExecution:'requires-provider', runtimes:['llama.cpp-server (externo)','WASM (limitado)','provedor remoto'] };
    if(format==='onnx') return { analyzable:'parcial', browserExecution:'onnxruntime-web (compatível)', runtimes:['onnxruntime-web','provedor remoto'] };
    if(format==='safetensors') return { analyzable:'parcial', browserExecution:'requires-provider', runtimes:['provedor remoto'] };
    if(format==='json-manifest') return { analyzable:true, browserExecution:'local', runtimes:['browser'] };
    return { analyzable:false, browserExecution:'unsupported', runtimes:[] };
  }

  async analyzeFile(file, options={}){
    const format = this.detectFormat(file.name, file.type);
    const base = { id: uid(), fileName:file.name, size:file.size, sizeHuman: human(file.size), format, analyzedAt: new Date().toISOString() };
    if(format==='gguf'){
      const parsed = await this.meta.parseFile(file, options);
      const quant = parsed.quantization?.tensorTypes?.[0] || (parsed.model?.fileType ?? null);
      const compat = this.runtimeCompatibility(format);
      const model = { ...base, name: parsed.model?.name||file.name, architecture: parsed.model?.architecture||null, quantization: quant, tensorTypes: parsed.quantization?.tensorTypes||[], parameters:null, contextLength: parsed.model?.contextLength||null, runtimeCompatible: compat.runtimes, metadata: parsed, tensors: parsed.tensors, state:'analyzed' };
      if(this.registry) this.registry.register(model);
      this.events?.emit('model.analyzed', { id:model.id, format, architecture:model.architecture });
      return { ok:true, model, compatibility: compat };
    }
    const compat = this.runtimeCompatibility(format);
    const model = { ...base, name:file.name, architecture:null, quantization:null, tensorTypes:[], runtimeCompatible: compat.runtimes, metadata:null, tensors:null, state: format==='unknown'?'error':'analyzed' };
    if(this.registry) this.registry.register(model);
    this.events?.emit('model.analyzed', { id:model.id, format });
    return { ok: format!=='unknown', model, compatibility: compat, warning: format!=='unknown' ? 'Parser binário completo não implementado para este formato no cliente.' : 'Formato não suportado.' };
  }

  async loadModel(modelId, options={}){
    const model = this.registry?.get(modelId);
    if(!model) return { ok:false, error:{code:'NOT_FOUND', message:'Modelo não registrado'} };
    const provider = options.provider || null;
    if(!provider){
      return { ok:false, state:'unavailable', error:{code:'PROVIDER_REQUIRED', message:'Carregamento/execução requer runtime ou provedor compatível. Metadados disponíveis.'}, model };
    }
    this.loaded.set(modelId, { provider, loadedAt:new Date().toISOString(), status:'requested' });
    if(this.registry) this.registry.update(modelId, { state:'loaded' });
    this.events?.emit('model.loaded', { id:modelId, provider: provider.id||provider });
    return { ok:true, state:'loaded', model: this.registry.get(modelId) };
  }

  async unloadModel(modelId){
    this.loaded.delete(modelId);
    if(this.registry) this.registry.update(modelId, { state:'unloaded' });
    this.events?.emit('model.unloaded', { id:modelId });
    return { ok:true, id:modelId, state:'unloaded' };
  }

  listLoaded(){ return [...this.loaded.keys()]; }
}

export default ModelLoader;
