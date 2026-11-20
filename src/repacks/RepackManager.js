import { ManifestLoader } from './ManifestLoader.js';
function uid(p='repack'){return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
export class RepackManager {
  constructor(options={}){ this.loader=new ManifestLoader(); this.repacks=new Map(); this.tools=options.toolRegistry||null; }
  create(spec={}){ const r=this.loader.normalize({ id: spec.id||uid(), name: spec.name||'Repack', ...spec }); const v=this.loader.validate(r); if(!v.ok) throw new Error('Repack inválido: '+v.errors.join('; ')); if(this.repacks.has(r.id)) throw new Error('Repack duplicado'); r.createdAt=new Date().toISOString(); this.repacks.set(r.id,r); return r; }
  import(spec){ const r=this.loader.normalize(typeof spec==='string'?JSON.parse(spec):spec); const v=this.loader.validate(r); if(!v.ok) return {ok:false,errors:v.errors}; this.repacks.set(r.id,r); return {ok:true,repack:r}; }
  export(id){ const r=this.repacks.get(id); return r?JSON.stringify(r,null,2):null; }
  list(){ return [...this.repacks.values()]; }
  get(id){ return this.repacks.get(id)||null; }
  validate(id){ const r=this.repacks.get(id); if(!r) return {ok:false,error:'Não encontrado'}; return this.loader.validate(r); }
  setEnabled(id,enabled){ const r=this.repacks.get(id); if(r) r.enabled=!!enabled; return r||null; }
  remove(id){ return this.repacks.delete(id); }
}
export default RepackManager;
