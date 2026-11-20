/**
 * FGUA v2 — barramento de eventos do núcleo.
 * Pub/sub síncrono usado por todos os subsistemas e pelo shell Windows 11.
 */

const listeners = new Map(); // evento -> Set<fn>

export function on(event, fn) {
  if (typeof fn !== 'function') return () => {};
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function once(event, fn) {
  const wrap = (payload) => { off(event, wrap); fn(payload); };
  return on(event, wrap);
}

export function off(event, fn) {
  const set = listeners.get(event);
  if (set) set.delete(fn);
}

export function emit(event, payload = null) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(payload); }
    catch (err) { console.error(`[bus] listener de "${event}" falhou:`, err); }
  }
}

/** notificação de usuário (aparece no Centro de Notificações do shell) */
export function notify(title, message, tone = 'info') {
  emit('notify', { title, message, tone, at: Date.now() });
}

export function eventNames() {
  return [...listeners.keys()];
}

export default { on, once, off, emit, notify, eventNames };
