export class CacheManager {
  constructor(options = {}) {
    this.mem = new Map();
    this.max = Math.max(1, Number(options.max) || 200);
  }

  _isExpired(entry) {
    return !!(entry && entry.exp && Date.now() > entry.exp);
  }

  _touch(key, entry) {
    // Reinsert to maintain LRU order (Map preserves insertion order)
    this.mem.delete(key);
    this.mem.set(key, entry);
  }

  set(key, value, ttlMs = 0) {
    const exp = ttlMs && Number(ttlMs) > 0 ? Date.now() + Number(ttlMs) : 0;
    if (this.mem.has(key)) this.mem.delete(key);
    this.mem.set(key, { value, exp });
    while (this.mem.size > this.max) {
      const first = this.mem.keys().next().value;
      this.mem.delete(first);
    }
  }

  get(key) {
    if (!this.mem.has(key)) return null;
    const entry = this.mem.get(key);
    if (this._isExpired(entry)) {
      this.mem.delete(key);
      return null;
    }
    this._touch(key, entry);
    return entry.value;
  }

  has(key) {
    if (!this.mem.has(key)) return false;
    const entry = this.mem.get(key);
    if (this._isExpired(entry)) {
      this.mem.delete(key);
      return false;
    }
    return true;
  }

  del(key) { return this.mem.delete(key); }
  clear() { this.mem.clear(); }
  size() { return this.mem.size; }
  keys() { return [...this.mem.keys()]; }
}

export default CacheManager;
