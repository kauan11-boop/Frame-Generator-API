const DEFAULT_ROLES = {
  Administrator: { allow: ['*'] },
  Developer: { allow: ['generators.*', 'models.*', 'tools.*', 'repacks.*', 'tasks.*', 'providers.*', 'config.*', 'logs.read', 'status.read'] },
  User: { allow: ['generators.execute', 'generators.read', 'models.read', 'models.load', 'tasks.*', 'logs.read', 'status.read'] },
  Operator: { allow: ['generators.execute', 'generators.read', 'models.read', 'models.load', 'tasks.*', 'logs.read', 'status.read'] },
  Viewer: { allow: ['*.read', 'status.read', 'logs.read'] },
};

function normalizeRoleDef(def) {
  if (!def || typeof def !== 'object') return { allow: [] };
  const allow = Array.isArray(def.allow) ? [...new Set(def.allow.filter((x) => typeof x === 'string' && x.trim()))] : [];
  return { allow };
}

export class PermissionManager {
  constructor() {
    this.roles = { ...DEFAULT_ROLES };
  }

  setRoles(roles) {
    if (!roles || typeof roles !== 'object') return;
    const next = { ...this.roles };
    for (const [name, def] of Object.entries(roles)) {
      if (!name || typeof name !== 'string') continue;
      next[name] = normalizeRoleDef(def);
    }
    this.roles = next;
  }

  getRoles() {
    const out = {};
    for (const [k, v] of Object.entries(this.roles)) out[k] = { allow: [...(v.allow || [])] };
    return out;
  }

  allows(role, permission) {
    if (role === 'Administrator') return true;
    const def = this.roles[role];
    if (!def) return false;
    const allow = Array.isArray(def.allow) ? def.allow : [];
    if (allow.includes('*')) return true;
    if (allow.includes(permission)) return true;
    const [ns] = String(permission || '').split('.');
    if (ns && allow.includes(`${ns}.*`)) return true;
    if (String(permission || '').endsWith('.read') && allow.some((a) => a === '*.read')) return true;
    return false;
  }

  check(userOrRole, permission) {
    const role = typeof userOrRole === 'string' ? userOrRole : (userOrRole?.role || 'Viewer');
    const ok = this.allows(role, permission);
    return {
      ok,
      role,
      permission,
      mode: 'static-ui',
      note: ok ? null : 'Permissão negada no controle de UI (estático). Autorização confiável requer backend.',
    };
  }
}

export default PermissionManager;
