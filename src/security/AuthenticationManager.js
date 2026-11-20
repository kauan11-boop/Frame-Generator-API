import { uid, nowIso } from '../core/utils.js';

// UI/local (GitHub Pages estático): autenticação/autorização confiável deve ser feita no backend.
export class AuthenticationManager {
  constructor() {
    this.users = new Map();
    this.currentUserId = null;
    this.sessions = new Map();
  }

  createUser(spec = {}) {
    const id = spec.id || uid('user');
    const user = {
      id,
      name: typeof spec.name === 'string' && spec.name.trim() ? spec.name.trim() : 'Usuário',
      role: typeof spec.role === 'string' && spec.role.trim() ? spec.role.trim() : 'Viewer',
      permissions: Array.isArray(spec.permissions) ? [...spec.permissions] : [],
      preferences: spec.preferences && typeof spec.preferences === 'object' ? { ...spec.preferences } : {},
      history: [],
      active: spec.active !== false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.users.set(id, user);
    if (!this.currentUserId) this.currentUserId = id;
    return { ...user };
  }

  listUsers() { return [...this.users.values()].map((u) => ({ ...u, history: [...(u.history || [])] })); }
  getUser(id) { const u = this.users.get(id); return u ? { ...u, history: [...(u.history || [])] } : null; }
  me() { return this.currentUserId ? this.getUser(this.currentUserId) : null; }

  setCurrent(id) {
    if (id && this.users.has(id)) this.currentUserId = id;
    return this.me();
  }

  updateUser(id, patch = {}) {
    const u = this.users.get(id);
    if (!u || !patch || typeof patch !== 'object') return null;
    const { id: _id, password: _p, secret: _s, token: _t, credentials: _c, ...rest } = patch;
    if (typeof rest.name === 'string') u.name = rest.name.trim() || u.name;
    if (typeof rest.role === 'string') u.role = rest.role.trim() || u.role;
    if (Array.isArray(rest.permissions)) u.permissions = [...rest.permissions];
    if (rest.preferences && typeof rest.preferences === 'object') u.preferences = { ...u.preferences, ...rest.preferences };
    if (rest.active !== undefined) u.active = !!rest.active;
    u.updatedAt = nowIso();
    return { ...u, history: [...(u.history || [])] };
  }

  removeUser(id) {
    const ok = this.users.delete(id);
    if (this.currentUserId === id) this.currentUserId = [...this.users.keys()][0] || null;
    return ok;
  }

  record(action, meta = null, userId = null) {
    const id = userId || this.currentUserId;
    const u = this.users.get(id);
    if (!u) return null;
    const entry = { at: nowIso(), action: String(action || 'event'), meta };
    if (!Array.isArray(u.history)) u.history = [];
    u.history.push(entry);
    if (u.history.length > 200) u.history.splice(0, u.history.length - 200);
    return entry;
  }

  getAuthState() {
    return {
      mode: 'static-ui',
      secureBackendRequired: true,
      currentUser: this.me(),
      users: this.users.size,
      note: 'Estado de autenticação local apenas para UI; não use como fronteira de segurança.'
    };
  }
}

export default AuthenticationManager;
