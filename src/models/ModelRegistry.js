function uid(p='model'){return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
export class ModelRegistry {
  constructor(){ this.models = new Map(); }
  register(spec={}){
    const m = { id: spec.id||uid(), name: spec.name||spec.fileName||'Modelo', format: spec.format||'unknown', architecture: spec.architecture||null, size: spec.size||null, quantization: spec.quantization||null, tensorTypes: spec.tensorTypes||[], parameters: spec.parameters||null, contextLength: spec.contextLength||null, runtimeCompatible: spec.runtimeCompatible||[], requirements: spec.requirements||{}, fileName: spec.fileName||null, hash: spec.hash||null, state: spec.state||'registered', metadata: spec.metadata||null, tensors: spec.tensors||null, registeredAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...spec };
    this.models.set(m.id, m); return m;
  }
  update(id, patch){ const m=this.models.get(id); if(!m) return null; Object.assign(m, patch, {updatedAt:new Date().toISOString()}); return m; }
  get(id){ return this.models.get(id)||null; }
  list(filter={}){ let a=[...this.models.values()]; if(filter.format) a=a.filter(m=>m.format===filter.format); if(filter.state) a=a.filter(m=>m.state===filter.state); return a; }
  remove(id){ return this.models.delete(id); }
}
export default ModelRegistry;
