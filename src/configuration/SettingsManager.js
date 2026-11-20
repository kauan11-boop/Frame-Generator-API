import { JsonManager } from './JsonManager.js';
function deepClone(o){ try{return structuredClone(o);}catch{return JSON.parse(JSON.stringify(o));} }
export class SettingsManager {
  constructor(){ this.json=new JsonManager(); this.configs=new Map(); this.defaults=new Map(); this.schemas=new Map(); }
  setDefaults(name,val){ this.defaults.set(name, deepClone(val)); }
  registerSchema(name,schema){ this.schemas.set(name,schema); }
  async load(name, source){
    let data=null;
    if(typeof source==='string'){ try{ data=await this.json.loadFromUrl(source);}catch{ data=deepClone(this.defaults.get(name)||{}); } }
    else if(source && typeof source==='object') data=deepClone(source);
    else data=deepClone(this.defaults.get(name)||{});
    const def=this.defaults.get(name); if(def && typeof def==='object' && !Array.isArray(def)) data={...def,...data};
    const validation=this.json.validate(data,this.schemas.get(name)||{});
    this.configs.set(name,{name,data,validation,updatedAt:new Date().toISOString(),source:typeof source==='string'?source:'object'});
    return data;
  }
  get(name){ return this.configs.get(name)?.data ?? deepClone(this.defaults.get(name)||{}); }
  getEntry(name){ return this.configs.get(name)||null; }
  list(){ return [...this.configs.keys()]; }
  set(name,data){ const validation=this.json.validate(data,this.schemas.get(name)||{}); this.configs.set(name,{name,data:deepClone(data),validation,updatedAt:new Date().toISOString(),source:'set'}); return data; }
  update(name,patch){ const cur=this.get(name); return this.set(name, (cur&&typeof cur==='object'&&!Array.isArray(cur))?{...cur,...(patch||{})}:patch); }
  export(name){ return this.json.export(this.get(name)); }
  import(name,text){ return this.set(name, this.json.import(text)); }
  restoreDefaults(name){ return this.set(name, deepClone(this.defaults.get(name)||{})); }
}
export default SettingsManager;
