function deepClone(o){ try{return structuredClone(o);}catch{return JSON.parse(JSON.stringify(o));} }
export class JsonManager {
  async loadFromUrl(url){
    const res = await fetch(url,{cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status} ao carregar ${url}`);
    return await res.json();
  }
  parse(text){ return JSON.parse(text); }
  stringify(obj, pretty=true){ return JSON.stringify(obj, null, pretty?2:0); }
  validate(data, schema={}){
    const errors=[];
    if(schema.required && Array.isArray(schema.required)) for(const k of schema.required) if(!(k in (data||{}))) errors.push(`Campo obrigatório ausente: ${k}`);
    if(schema.properties && data && typeof data==='object'){
      for(const [k,rule] of Object.entries(schema.properties)){
        if(k in data && rule.type){ const t=Array.isArray(data[k])?'array':typeof data[k]; if(rule.type!==t) errors.push(`Tipo inválido em ${k}`); }
      }
    }
    return { ok: errors.length===0, errors };
  }
  merge(base, patch){ if(base&&typeof base==='object'&&!Array.isArray(base)&&patch&&typeof patch==='object'&&!Array.isArray(patch)){ return {...base,...patch}; } return deepClone(patch); }
  export(data){ return this.stringify(data,true); }
  import(text){ return this.parse(text); }
}
export default JsonManager;
