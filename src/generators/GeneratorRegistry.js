export class GeneratorRegistry {
  constructor(){ this.generators=new Map(); }
  register(spec){ if(!spec?.id) throw new Error('Generator id obrigatório'); if(this.generators.has(spec.id)) throw new Error(`Gerador duplicado: ${spec.id}`); const g={status:'registered',enabled:true,registeredAt:new Date().toISOString(),...spec}; this.generators.set(g.id,g); return g; }
  upsert(spec){ const prev=this.generators.get(spec.id)||{}; const g={...prev,...spec,updatedAt:new Date().toISOString()}; this.generators.set(g.id,g); return g; }
  get(id){ return this.generators.get(id)||null; }
  list(){ return [...this.generators.values()]; }
  remove(id){ return this.generators.delete(id); }
  setEnabled(id,enabled){ const g=this.generators.get(id); if(g) g.enabled=!!enabled; return g||null; }
}
export default GeneratorRegistry;
