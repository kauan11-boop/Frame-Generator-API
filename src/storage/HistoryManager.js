export class HistoryManager {
  constructor(options={}){ this.entries=[]; this.max=options.max||1000; }
  add(entry){ const e={ at:new Date().toISOString(), ...entry }; this.entries.push(e); if(this.entries.length>this.max) this.entries.splice(0,this.entries.length-this.max); return e; }
  list(limit=100, filter){ let arr=[...this.entries]; if(filter?.type) arr=arr.filter(e=>e.type===filter.type); return arr.slice(-limit).reverse(); }
  clear(){ this.entries=[]; }
  export(){ return JSON.stringify(this.entries,null,2); }
}
export default HistoryManager;
