export class IndexedDBManager {
  constructor(options={}){ this.dbName=options.dbName||'frame-generator-api'; this.dbVersion=options.dbVersion||1; this.db=null; this.stores=options.stores||['configs','models','tasks','cache','history','files']; }
  async open(){
    if(this.db) return this.db; if(!('indexedDB' in globalThis)) return null;
    this.db = await new Promise((resolve,reject)=>{ const req=indexedDB.open(this.dbName,this.dbVersion); req.onupgradeneeded=()=>{ const db=req.result; for(const s of this.stores){ if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'key'}); } }; req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
    return this.db;
  }
  async put(store,key,value){ const db=await this.open(); if(!db){ try{localStorage.setItem(`fg:${store}:${key}`,JSON.stringify(value));}catch{} return true;} return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).put({key,value,updatedAt:new Date().toISOString()}); tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error); }); }
  async get(store,key){ const db=await this.open(); if(!db){ const t=localStorage.getItem(`fg:${store}:${key}`); try{return t?JSON.parse(t):null;}catch{return null;} } return new Promise((res,rej)=>{ const tx=db.transaction(store,'readonly'); const r=tx.objectStore(store).get(key); r.onsuccess=()=>res(r.result?.value??null); r.onerror=()=>rej(r.error); }); }
  async del(store,key){ const db=await this.open(); if(!db){ localStorage.removeItem(`fg:${store}:${key}`); return true;} return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error); }); }
  async keys(store){ const db=await this.open(); if(!db) return []; return new Promise((res,rej)=>{ const tx=db.transaction(store,'readonly'); const r=tx.objectStore(store).getAllKeys(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); }
}
export default IndexedDBManager;
