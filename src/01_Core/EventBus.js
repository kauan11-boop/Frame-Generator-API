export class EventBus {
  constructor() {
    this.listeners = new Map(); // event -> Set<{fn, once}>
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const rec = { fn, once: false };
    this.listeners.get(event).add(rec);
    return () => this.off(event, fn);
  }

  once(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const rec = { fn, once: true };
    this.listeners.get(event).add(rec);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const rec of set) if (rec.fn === fn) set.delete(rec);
    if (set.size === 0) this.listeners.delete(event);
  }

  async emit(event, payload) {
    const set = this.listeners.get(event);
    const wildcard = this.listeners.get('*');
    const targets = [...(set || []), ...(wildcard || [])];
    const results = [];
    for (const rec of targets) {
      try {
        results.push(await rec.fn(payload, event));
      } catch (e) {
        results.push({ error: e });
      }
      if (rec.once && set) set.delete(rec);
    }
    return results;
  }

  clear(event) {
    if (event) this.listeners.delete(event); else this.listeners.clear();
  }
}

export default EventBus;
