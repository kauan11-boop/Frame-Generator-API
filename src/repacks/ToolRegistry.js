export class ToolRegistry {
  constructor(){ this.tools=new Map(); }
  register(spec={}){ if(!spec.id) throw new Error('Tool id obrigatório'); if(this.tools.has(spec.id)) throw new Error(`Ferramenta duplicada: ${spec.id}`); const t={enabled:true,status:'registered',registeredAt:new Date().toISOString(),...spec}; this.tools.set(t.id,t); const {handler,...safe}=t; return {...safe, hasHandler:!!handler}; }
  list(){ return [...this.tools.values()].map(({handler,...t})=>({...t,hasHandler:!!handler})); }
  get(id){ const t=this.tools.get(id); if(!t) return null; const {handler,...r}=t; return {...r,hasHandler:!!handler}; }
  setEnabled(id,enabled){ const t=this.tools.get(id); if(t) t.enabled=!!enabled; return this.get(id); }
  remove(id){ return this.tools.delete(id); }
  async execute(id,input={},ctx={}){ const t=this.tools.get(id); if(!t) return {ok:false,error:'Ferramenta não encontrada'}; if(!t.enabled) return {ok:false,error:'Ferramenta desativada'}; if(typeof t.handler!=='function') return {ok:false,state:'unavailable',error:'Sem handler executável no ambiente atual'}; try{ return {ok:true,result: await t.handler(input,ctx)}; }catch(e){ return {ok:false,error:e.message}; } }
}
export default ToolRegistry;
