export class FrameWorkerManager {
  constructor() { this.workers = new Map(); }

  create(name, url, options = {}) {
    if (this.workers.has(name)) return this.workers.get(name);
    let worker = null;
    try { worker = new Worker(url, { type: options.type || 'module' }); } catch (e) { return { name, error: e.message, worker: null }; }
    const entry = { name, url, worker, createdAt: new Date().toISOString() };
    this.workers.set(name, entry);
    return entry;
  }

  get(name) { return this.workers.get(name) || null; }
  post(name, message, transfer = []) {
    const w = this.workers.get(name)?.worker; if (!w) throw new Error(`Worker não encontrado: ${name}`);
    w.postMessage(message, transfer);
  }
  terminate(name) { const w = this.workers.get(name)?.worker; if (w) { try { w.terminate(); } catch {} } this.workers.delete(name); }
  terminateAll() { for (const name of [...this.workers.keys()]) this.terminate(name); }
  list() { return [...this.workers.keys()]; }
}

export default FrameWorkerManager;
