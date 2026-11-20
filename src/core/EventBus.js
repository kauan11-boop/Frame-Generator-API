export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  _add(event, fn, once) {
    if (typeof fn !== 'function') return () => {};
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const rec = { fn, once: !!once };
    this.listeners.get(event).add(rec);
    return () => this.off(event, fn);
  }

  on(event, fn) {
    return this._add(event, fn, false);
  }

  once(event, fn) {
    return this._add(event, fn, true);
  }

  off(event, fn) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const rec of [...set]) if (rec.fn === fn) set.delete(rec);
    if (set.size === 0) this.listeners.delete(event);
  }

  async emit(event, payload) {
    const exactSet = this.listeners.get(event);
    const wildcardSet = this.listeners.get('*');
    const targets = [
      ...[...(exactSet || [])].map((rec) => ({ rec, set: exactSet })),
      ...[...(wildcardSet || [])].map((rec) => ({ rec, set: wildcardSet })),
    ];
    const results = [];
    for (const { rec, set } of targets) {
      try {
        results.push(await rec.fn(payload, event));
      } catch (e) {
        const err = e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) };
        results.push({ error: err });
        try { console.warn('[EventBus] listener error', event, err); } catch {}
      }
      if (rec.once && set) set.delete(rec);
    }
    if (exactSet && exactSet.size === 0) this.listeners.delete(event);
    if (wildcardSet && wildcardSet.size === 0) this.listeners.delete('*');
    return results;
  }

  clear(event) {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}

export default EventBus;
