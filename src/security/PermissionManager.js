export class PermissionManager {
  constructor(){ this.roles={ Administrator:{allow:['*']}, Developer:{allow:['generators.*','models.*','tools.*','repacks.*','tasks.*','providers.*','config.*','logs.read']}, Operator:{allow:['generators.execute','generators.read','models.read','models.load','tasks.*','logs.read']}, Viewer:{allow:['*.read','status.read','logs.read']} }; }
  setRoles(roles){ if(roles && typeof roles==='object') this.roles = {...this.roles,...roles}; }
  allows(role, permission){
    if(role==='Administrator') return true; const def=this.roles[role]; if(!def) return false;
    const allow=def.allow||[]; if(allow.includes('*')) return true; if(allow.includes(permission)) return true;
    const [ns]=permission.split('.'); if(allow.includes(`${ns}.*`)) return true; if(allow.some(a=>a==='*.read' && permission.endsWith('.read'))) return true; return false;
  }
  check(user, permission){ const role=user?.role||'Viewer'; const ok=this.allows(role,permission); return { ok, role, permission, note: ok?null:'Controle de UI (estático); autorização confiável requer backend.' }; }
}
export default PermissionManager;
