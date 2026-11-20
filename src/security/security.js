/**
 * FGUA v2 — segurança em nível de UI: usuários, papéis, permissões e sessão.
 * IMPORTANTE: autorização confiável exige backend. Aqui é trava de interface.
 * Senhas: SHA-256 + salt aleatório via crypto.subtle (nunca texto puro).
 */

import { result } from '../core/states.js';
import { emit } from '../core/bus.js';

async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) {
    // fallback apenas para ambientes sem crypto (testes) — nunca usado em produção real
    let h = 0;
    for (let i = 0; i < text.length; i++) { h = (h * 31 + text.charCodeAt(i)) >>> 0; }
    return `weak-${h.toString(16)}`;
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const a = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 256) | 0;
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createSecurity(permissionsConfig, store) {
  const NS = 'fgua.users';
  const roles = permissionsConfig.roles;
  const namespaceGuard = permissionsConfig.namespaceGuard ?? {};
  const policy = permissionsConfig.policy ?? {};
  let failed = 0;
  let lockedUntil = 0;

  function builtinUsers() { return structuredClone(permissionsConfig.users ?? []); }
  function customUsers() { return store.get(NS, 'custom', []); }
  function passwordStore() { return store.get(NS, 'passwords', {}); }

  function allUsers() {
    const passwords = passwordStore();
    const list = [...builtinUsers(), ...customUsers()].map(u => ({
      ...u,
      passwordHash: passwords[u.id] ? { salt: passwords[u.id].salt, hash: passwords[u.id].hash } : u.passwordHash
    }));
    return list;
  }

  function session() { return store.get(NS, 'session', null); }

  async function setPassword(id, password) {
    const users = allUsers();
    if (!users.some(u => u.id === id)) return result('invalid', null, { error: `Usuário não encontrado: ${id}` });
    const passwords = passwordStore();
    if (!password) { delete passwords[id]; }
    else {
      const salt = randomSalt();
      passwords[id] = { salt, hash: await sha256Hex(`${salt}:${password}`) };
    }
    store.set(NS, 'passwords', passwords);
    return result('succeeded', { id, comSenha: !!password });
  }

  async function login(id, password = '') {
    const now = Date.now();
    if (now < lockedUntil) {
      return result('failed', null, { error: `Bloqueado por ${Math.ceil((lockedUntil - now) / 1000)}s após tentativas falhas.` });
    }
    const u = allUsers().find(x => x.id === id);
    if (!u) { failed++; if (failed >= (policy.maxFailedLogins ?? 5)) lockedUntil = now + (policy.lockSeconds ?? 30) * 1000; return result('failed', null, { error: 'Usuário inexistente.' }); }
    const passwords = passwordStore();
    const stored = passwords[u.id];
    let okAuth = true;
    if (stored?.hash) {
      okAuth = (await sha256Hex(`${stored.salt}:${password}`)) === stored.hash;
    } // sem senha definida → login direto (conta local sem trava)
    if (!okAuth) {
      failed++;
      if (failed >= (policy.maxFailedLogins ?? 5)) lockedUntil = now + (policy.lockSeconds ?? 30) * 1000;
      emit('security:denied', { id, motivo: 'senha' });
      return result('failed', null, { error: 'Senha incorreta.' });
    }
    failed = 0;
    const sess = { userId: u.id, name: u.name, role: u.role, avatar: u.avatar ?? u.name[0], at: new Date().toISOString() };
    store.set(NS, 'session', sess);
    emit('security:login', sess);
    return result('succeeded', sess);
  }

  function logout() {
    store.set(NS, 'session', null);
    emit('security:logout', null);
    return result('succeeded', null);
  }

  function resumeSession() {
    const sess = session();
    if (sess && allUsers().some(u => u.id === sess.userId)) return sess;
    // sessão padrão: admin sem senha (conta local)
    const admin = builtinUsers().find(u => u.role === 'admin') ?? builtinUsers()[0];
    if (admin) {
      const s = { userId: admin.id, name: admin.name, role: admin.role, avatar: admin.avatar ?? 'A', at: new Date().toISOString(), auto: true };
      store.set(NS, 'session', s);
      return s;
    }
    return null;
  }

  function can(perm) {
    const sess = session();
    if (!sess) return perm === 'public';
    if (perm === 'public') return true;
    const role = roles[sess.role];
    if (!role) return false;
    return role.permissions.includes(perm) || role.permissions.includes('*');
  }

  function guard(perm) {
    if (can(perm)) return result('ready', { allowed: true });
    emit('security:denied', { perm, role: session()?.role ?? null });
    return result('unavailable', { allowed: false }, { error: `Permissão negada: ${perm} (papel: ${session()?.role ?? 'sem sessão'})` });
  }

  function listUsers() {
    return result('ready', allUsers().map(u => ({
      id: u.id, name: u.name, role: u.role, avatar: u.avatar ?? u.name?.[0] ?? '?',
      comSenha: !!passwordStore()[u.id], builtIn: builtinUsers().some(b => b.id === u.id)
    })));
  }

  function createUser({ id, name, role = 'visitante', password = null }) {
    if (!id || !name) return result('invalid', null, { error: 'id e name são obrigatórios.' });
    if (!roles[role]) return result('invalid', null, { error: `Papel desconhecido: ${role}` });
    const custom = customUsers();
    if (allUsers().some(u => u.id === id)) return result('invalid', null, { error: `id já existe: ${id}` });
    custom.push({ id, name, role, passwordHash: null, avatar: name[0]?.toUpperCase() ?? 'U' });
    store.set(NS, 'custom', custom);
    if (password) setPassword(id, password);
    return result('succeeded', { id, name, role });
  }

  function removeUser(id) {
    if (builtinUsers().some(u => u.id === id)) return result('invalid', null, { error: 'Usuário embutido não pode ser removido.' });
    const custom = customUsers();
    const idx = custom.findIndex(u => u.id === id);
    if (idx < 0) return result('invalid', null, { error: 'Usuário não encontrado.' });
    custom.splice(idx, 1);
    store.set(NS, 'custom', custom);
    return result('succeeded', { id });
  }

  function rolesMatrix() {
    return result('ready', { roles, namespaceGuard, policy });
  }

  return {
    login, logout, resumeSession, session, can, guard, listUsers,
    createUser, removeUser, setPassword, rolesMatrix, sha256Hex
  };
}

export default { createSecurity };
