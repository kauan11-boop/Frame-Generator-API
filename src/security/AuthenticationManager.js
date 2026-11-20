function uid(p='user'){return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
// UI/local (GitHub Pages estático): autenticação confiável deve ser feita no backend.
export class AuthenticationManager {
  constructor(){ this.users=new Map(); this.currentUserId=null; this.sessions=new Map(); }
  createUser(spec={}){ const u={ id:spec.id||uid(), name:spec.name||'Usuário', role:spec.role||'Viewer', permissions:spec.permissions||[], preferences:spec.preferences||{}, history:[], active:spec.active!==false, createdAt:new Date().toISOString() }; this.users.set(u.id,u); if(!this.currentUserId) this.currentUserId=u.id; return {...u}; }
  listUsers(){ return [...this.users.values()].map(u=>({...u})); }
  getUser(id){ const u=this.users.get(id); return u?{...u}:null; }
  me(){ return this.currentUserId?this.getUser(this.currentUserId):null; }
  setCurrent(id){ if(this.users.has(id)) this.currentUserId=id; return this.me(); }
  updateUser(id,patch={}){ const u=this.users.get(id); if(!u) return null; const {id:_i,password:_p,secret:_s,...rest}=patch; Object.assign(u,rest,{updatedAt:new Date().toISOString()}); return {...u}; }
  removeUser(id){ const ok=this.users.delete(id); if(this.currentUserId===id) this.currentUserId=[...this.users.keys()][0]||null; return ok; }
  record(id,action){ const u=this.users.get(id||this.currentUserId); if(!u) return; u.history.push({at:new Date().toISOString(),action}); if(u.history.length>200) u.history.splice(0,u.history.length-200); }
  getAuthState(){ return { mode:'static-ui', secureBackendRequired:true, currentUser:this.me(), users:this.users.size }; }
}
export default AuthenticationManager;
