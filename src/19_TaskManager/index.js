import { uid, nowIso } from '../26_Utils/index.js';

export class FrameTaskManager {
  constructor(options = {}) {
    this.tasks = new Map();
    this.queue = [];
    this.concurrency = options.concurrency || 1;
    this.running = 0;
    this.events = options.events || null;
  }

  create(spec = {}) {
    const task = {
      id: spec.id || uid('task'),
      category: spec.category || 'general',
      engine: spec.engine || null,
      model: spec.model || null,
      provider: spec.provider || null,
      state: 'Pending',
      progress: 0,
      createdAt: nowIso(),
      startedAt: null,
      completedAt: null,
      input: spec.input || null,
      output: null,
      result: null,
      errors: [],
      priority: spec.priority || 0,
      cancelRequested: false,
      _run: typeof spec.run === 'function' ? spec.run : null
    };
    this.tasks.set(task.id, task);
    this.queue.push(task.id);
    this.queue.sort((a,b) => (this.tasks.get(b)?.priority||0) - (this.tasks.get(a)?.priority||0));
    this._emit('task.created', task);
    this._pump();
    return this._public(task);
  }

  get(id) { const t = this.tasks.get(id); return t ? this._public(t) : null; }
  list() { return [...this.tasks.values()].map(t => this._public(t)); }

  async cancel(id) {
    const t = this.tasks.get(id); if (!t) return null;
    t.cancelRequested = true;
    if (t.state === 'Pending') { t.state = 'Cancelled'; t.completedAt = nowIso(); this._emit('task.cancelled', t); }
    return this._public(t);
  }

  pause(id) { const t = this.tasks.get(id); if (t && t.state === 'Running') { t.state = 'Paused'; } return this.get(id); }
  resume(id) { const t = this.tasks.get(id); if (t && t.state === 'Paused') { t.state = 'Running'; this._emit('task.progress', t); } return this.get(id); }

  _emit(event, task) { if (this.events?.emit) this.events.emit(event, this._public(task)); }

  async _pump() {
    while (this.running < this.concurrency) {
      const nextId = this.queue.find(id => this.tasks.get(id)?.state === 'Pending');
      if (!nextId) break;
      const task = this.tasks.get(nextId);
      this.queue = this.queue.filter(id => id !== nextId);
      this._runTask(task);
    }
  }

  async _runTask(task) {
    this.running++;
    task.state = 'Initializing'; task.startedAt = nowIso(); this._emit('task.progress', task);
    try {
      task.state = 'Running'; this._emit('task.progress', task);
      const update = (p, extra = {}) => { task.progress = Math.max(0, Math.min(100, p)); Object.assign(task, extra); this._emit('task.progress', task); };
      if (task._run) {
        task.result = await task._run({ task, update, isCancelled: () => task.cancelRequested });
      } else {
        update(100);
        task.result = { status: 'unavailable', message: 'Nenhum executor/provedor compatível associado à tarefa.' };
      }
      if (task.cancelRequested) { task.state = 'Cancelled'; }
      else { task.state = 'Completed'; task.progress = 100; this._emit('generator.completed', task); }
    } catch (e) {
      task.state = 'Failed';
      task.errors.push({ message: e.message, at: nowIso() });
      this._emit('engine.failed', { taskId: task.id, error: e.message });
    } finally {
      task.completedAt = nowIso();
      this.running--;
      this._pump();
    }
  }

  _public(t) {
    const { _run, ...rest } = t; return { ...rest };
  }
}

export default FrameTaskManager;
