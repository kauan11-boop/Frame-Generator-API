export class ManifestLoader {
  validate(manifest){
    const errors=[]; if(!manifest || typeof manifest!=='object') errors.push('Manifest inválido');
    if(!manifest?.id) errors.push('id ausente'); if(!manifest?.name) errors.push('name ausente');
    if(manifest?.modules && !Array.isArray(manifest.modules)) errors.push('modules deve ser array');
    if(manifest?.dependencies && !Array.isArray(manifest.dependencies)) errors.push('dependencies deve ser array');
    return { ok: errors.length===0, errors };
  }
  normalize(manifest){ return { id:manifest.id, name:manifest.name||manifest.id, version:manifest.version||'1.0.0', enabled: manifest.enabled!==false, modules: Array.isArray(manifest.modules)?manifest.modules:[], dependencies: Array.isArray(manifest.dependencies)?manifest.dependencies:[], permissions: Array.isArray(manifest.permissions)?manifest.permissions:[], configuration: manifest.configuration||{}, ...manifest }; }
  async loadFromUrl(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`HTTP ${r.status}`); const m=await r.json(); const v=this.validate(m); if(!v.ok) throw new Error('Manifest inválido: '+v.errors.join('; ')); return this.normalize(m); }
}
export default ManifestLoader;
