export class CacheManager {
  constructor(){ this.mem=new Map(); this.max=200; }
  set(key,value,ttlMs=0){ this.mem.set(key,{value,exp: ttlMs?Date.now()+ttlMs:0}); if(this.mem.size>this.max){ const first=this.mem.keys().next().value; this.mem.delete(first);} }
  get(key){ const e=this.mem.get(key); if(!e) return null; if(e.exp && Date.now()>e.exp){ this.mem.delete(key); return null;} return e.value; }
  has(key){ return this.get(key)!==null; }
  del(key){ this.mem.delete(key); }
  clear(){ this.mem.clear(); }
  size(){ return this.mem.size; }
}
export default CacheManager;
