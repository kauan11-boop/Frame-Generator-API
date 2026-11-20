export class HistoryManager {
  constructor(options = {}) {
    this.entries = [];
    this.max = Math.max(1, Number(options.max) || 1000);
  }

  add(entry = {}) {
    const e = { at: new Date().toISOString(), ...entry };
    this.entries.push(e);
    if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
    return { ...e };
  }

  list(limit = 100, filter = null) {
    const lim = Math.max(0, Number(limit) || 0);
    let arr = [...this.entries];
    if (filter && typeof filter === 'object') {
      if (filter.type) arr = arr.filter((e) => e.type === filter.type);
      if (filter.level) arr = arr.filter((e) => e.level === filter.level);
      if (filter.scope) arr = arr.filter((e) => e.scope === filter.scope);
    }
    const out = lim ? arr.slice(-lim) : arr;
    return out.reverse().map((e) => ({ ...e }));
  }

  clear() { this.entries = []; }
  count() { return this.entries.length; }
  export() { return JSON.stringify(this.entries, null, 2); }
}

export default HistoryManager;
