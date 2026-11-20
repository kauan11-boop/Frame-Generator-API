/**
 * FGUA v2 — armazenamento de chave-valor com namespaces.
 * localStorage quando disponível; fallback em memória (Node/testes).
 */

export function createStore() {
  let ok = false;
  try { ok = typeof localStorage !== 'undefined'; globalThis.localStorage?.setItem('__fgua', '1'); globalThis.localStorage?.removeItem('__fgua'); } catch { ok = false; }
  const mem = new Map();

  function key(ns, k) { return `${ns}::${k}`; }

  function get(ns, k, def = null) {
    try {
      if (ok) {
        const raw = localStorage.getItem(key(ns, k));
        return raw == null ? def : JSON.parse(raw);
      }
      return mem.has(key(ns, k)) ? mem.get(key(ns, k)) : def;
    } catch {
      return def;
    }
  }

  function set(ns, k, v) {
    try {
      if (ok) localStorage.setItem(key(ns, k), JSON.stringify(v));
      else mem.set(key(ns, k), v);
      return true;
    } catch {
      mem.set(key(ns, k), v);
      return false;
    }
  }

  function remove(ns, k) {
    try { if (ok) localStorage.removeItem(key(ns, k)); } catch { /* noop */ }
    mem.delete(key(ns, k));
  }

  function keys(ns) {
    const out = [];
    try {
      if (ok) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(`${ns}::`)) out.push(k.slice(ns.length + 2));
        }
      } else {
        for (const k of mem.keys()) if (k.startsWith(`${ns}::`)) out.push(k.slice(ns.length + 2));
      }
    } catch { /* noop */ }
    return out;
  }

  return { get, set, remove, keys, driver: ok ? 'localStorage' : 'memory' };
}

export default { createStore };
