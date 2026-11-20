export class IndexedDBManager {
  constructor(options = {}) {
    this.dbName = options.dbName || 'frame-generator-api';
    this.dbVersion = options.dbVersion || 1;
    this.db = null;
    this.stores = Array.isArray(options.stores) && options.stores.length ? options.stores : ['configs', 'models', 'jobs', 'cache', 'history', 'files'];
  }

  async open() {
    if (this.db) return this.db;
    if (typeof indexedDB === 'undefined') return null;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of this.stores) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { try { db.close(); } catch {} this.db = null; };
        db.onclose = () => { this.db = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error('Falha ao abrir IndexedDB'));
      req.onblocked = () => reject(new Error('Abertura do IndexedDB bloqueada por outra sessão'));
    });
    return this.db;
  }

  _lsKey(store, key) { return `fg:${store}:${key}`; }

  async put(store, key, value) {
    const db = await this.open().catch(() => null);
    const record = { key, value, updatedAt: new Date().toISOString() };
    if (!db) {
      try { localStorage.setItem(this._lsKey(store, key), JSON.stringify(record)); return { ok: true, backend: 'localStorage' }; }
      catch (e) { return { ok: false, backend: 'localStorage', error: e?.message || String(e) }; }
    }
    return new Promise((res) => {
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(record);
        tx.oncomplete = () => res({ ok: true, backend: 'indexedDB' });
        tx.onerror = () => res({ ok: false, backend: 'indexedDB', error: tx.error?.message || 'Erro de transação' });
      } catch (e) { res({ ok: false, backend: 'indexedDB', error: e?.message || String(e) }); }
    });
  }

  async get(store, key) {
    const db = await this.open().catch(() => null);
    if (!db) {
      try {
        const raw = localStorage.getItem(this._lsKey(store, key));
        if (raw == null) return null;
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object' && 'value' in parsed) ? parsed.value : parsed;
      } catch { return null; }
    }
    return new Promise((res) => {
      try {
        const tx = db.transaction(store, 'readonly');
        const r = tx.objectStore(store).get(key);
        r.onsuccess = () => res(r.result?.value ?? null);
        r.onerror = () => res(null);
      } catch { res(null); }
    });
  }

  async del(store, key) {
    const db = await this.open().catch(() => null);
    if (!db) {
      try { localStorage.removeItem(this._lsKey(store, key)); return { ok: true, backend: 'localStorage' }; }
      catch (e) { return { ok: false, backend: 'localStorage', error: e?.message || String(e) }; }
    }
    return new Promise((res) => {
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => res({ ok: true, backend: 'indexedDB' });
        tx.onerror = () => res({ ok: false, backend: 'indexedDB', error: tx.error?.message || 'Erro de transação' });
      } catch (e) { res({ ok: false, backend: 'indexedDB', error: e?.message || String(e) }); }
    });
  }

  async keys(store) {
    const db = await this.open().catch(() => null);
    if (!db) {
      const prefix = `fg:${store}:`;
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
        }
      } catch {}
      return out;
    }
    return new Promise((res) => {
      try {
        const tx = db.transaction(store, 'readonly');
        const r = tx.objectStore(store).getAllKeys();
        r.onsuccess = () => res(Array.isArray(r.result) ? r.result : []);
        r.onerror = () => res([]);
      } catch { res([]); }
    });
  }

  async clearStore(store) {
    const db = await this.open().catch(() => null);
    if (!db) {
      const keys = await this.keys(store);
      for (const k of keys) { try { localStorage.removeItem(this._lsKey(store, k)); } catch {} }
      return { ok: true, backend: 'localStorage' };
    }
    return new Promise((res) => {
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => res({ ok: true, backend: 'indexedDB' });
        tx.onerror = () => res({ ok: false, backend: 'indexedDB', error: tx.error?.message || 'Erro de transação' });
      } catch (e) { res({ ok: false, backend: 'indexedDB', error: e?.message || String(e) }); }
    });
  }
}

export default IndexedDBManager;
