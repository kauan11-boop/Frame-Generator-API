import { safeJsonParse } from '../26_Utils/index.js';

export class FrameStorageManager {
  constructor(options = {}) {
    this.dbName = options.dbName || 'frame-generator-api';
    this.dbVersion = options.dbVersion || 1;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    if (!('indexedDB' in globalThis)) return null;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of ['configs', 'models', 'tasks', 'cache', 'files', 'logs']) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  }

  async put(store, key, value) {
    const db = await this.open();
    if (!db) { try { localStorage.setItem(`fgua:${store}:${key}`, JSON.stringify(value)); return true; } catch { return false; } }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put({ key, value, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(store, key) {
    const db = await this.open();
    if (!db) {
      const t = localStorage.getItem(`fgua:${store}:${key}`);
      if (!t) return null; const p = safeJsonParse(t); return p.ok ? p.value : null;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async del(store, key) {
    const db = await this.open();
    if (!db) { localStorage.removeItem(`fgua:${store}:${key}`); return true; }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async listKeys(store) {
    const db = await this.open();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}

export default FrameStorageManager;
