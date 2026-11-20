import { uid, nowIso } from './utils.js';

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'unavailable']);
const CANCELLABLE = new Set(['pending', 'queued']);

export class JobManager {
  constructor(options = {}) {
    this.events = options.events || null;
    this.jobs = new Map();
    this.queue = [];
    this.running = 0;
    this.concurrency = Math.max(1, Number(options.concurrency) || 2);
  }

  create(spec = {}) {
    const now = nowIso();
    const job = {
      id: spec.id || uid('job'),
      type: spec.type || spec.category || 'general',
      category: spec.category || spec.type || 'general',
      user: spec.user || null,
      model: spec.model || null,
      engine: spec.engine || null,
      state: 'pending',
      progress: 0,
      message: spec.message || null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
      logs: [],
      metadata: spec.metadata && typeof spec.metadata === 'object' ? { ...spec.metadata } : {},
      _run: typeof spec.run === 'function' ? spec.run : null,
      _cancelled: false,
      _controller: typeof AbortController !== 'undefined' ? new AbortController() : null,
    };
    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    this.events?.emit('job.created', this.get(job.id));
    this._pump();
    return this.get(job.id);
  }

  get(id) {
    const job = this.jobs.get(id);
    return job ? this._public(job) : null;
  }

  list() {
    return [...this.jobs.values()].map((j) => this._public(j));
  }

  async cancel(id, reason = 'Cancelado pelo usuário.') {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (TERMINAL.has(job.state)) return this.get(id);
    job._cancelled = true;
    try { job._controller?.abort?.(reason); } catch {}
    if (CANCELLABLE.has(job.state)) {
      job.state = 'cancelled';
      job.message = reason;
      job.completedAt = nowIso();
      this.queue = this.queue.filter((x) => x !== id);
      this.events?.emit('job.cancelled', this.get(id));
    } else {
      job.message = reason;
      this.events?.emit('job.cancel_requested', this.get(id));
    }
    return this.get(id);
  }

  _public(job) {
    const { _run, _controller, _cancelled, ...rest } = job;
    return {
      ...rest,
      logs: Array.isArray(rest.logs) ? [...rest.logs] : [],
      metadata: rest.metadata ? { ...rest.metadata } : {},
      cancellable: !TERMINAL.has(rest.state),
    };
  }

  _log(job, level, message, data = null) {
    const entry = { at: nowIso(), level, message, data };
    job.logs.push(entry);
    if (job.logs.length > 200) job.logs.splice(0, job.logs.length - 200);
    return entry;
  }

  async _pump() {
    while (this.running < this.concurrency) {
      const nextId = this.queue.find((id) => {
        const j = this.jobs.get(id);
        return j && j.state === 'pending';
      });
      if (!nextId) break;
      this.queue = this.queue.filter((x) => x !== nextId);
      const job = this.jobs.get(nextId);
      if (!job) continue;
      job.state = 'queued';
      this.events?.emit('job.queued', this.get(job.id));
      void this._runJob(job);
    }
  }

  async _runJob(job) {
    this.running++;
    try {
      if (job._cancelled) {
        job.state = 'cancelled';
        job.completedAt = nowIso();
        return;
      }
      job.state = 'running';
      job.startedAt = nowIso();
      job.progress = Math.max(1, job.progress || 0);
      this._log(job, 'info', 'Execução iniciada.');
      this.events?.emit('job.started', this.get(job.id));

      const ctx = {
        signal: job._controller?.signal || null,
        isCancelled: () => !!job._cancelled,
        log: (level, message, data) => { this._log(job, level, message, data); this.events?.emit('job.log', { id: job.id, entry: job.logs[job.logs.length - 1] }); },
        update: (patch = {}) => {
          if (TERMINAL.has(job.state)) return;
          if (Number.isFinite(Number(patch.progress))) job.progress = Math.max(0, Math.min(100, Number(patch.progress)));
          if (patch.message != null) job.message = String(patch.message);
          if (patch.state && ['running'].includes(String(patch.state))) job.state = String(patch.state);
          this.events?.emit('job.progress', this.get(job.id));
        },
      };

      let result;
      if (typeof job._run === 'function') result = await job._run(ctx);
      else result = { ok: false, state: 'unavailable', error: { code: 'NO_EXECUTOR', message: 'Nenhum executor associado. Configure engine/provedor compatível.' } };

      if (job._cancelled) {
        job.state = 'cancelled';
        job.message = job.message || 'Cancelado.';
      } else {
        job.result = result ?? null;
        const rState = String(result?.state || result?.status || '').toLowerCase();
        const explicitFail = result?.ok === false && (rState === 'failed' || rState === 'error' || result?.error?.fatal === true);
        const unavailable = result?.ok === false || ['unavailable', 'requires-provider', 'requires-runtime', 'not-implemented', 'unsupported', 'blocked'].includes(rState);
        if (explicitFail) {
          job.state = 'failed';
          job.error = result?.error || { code: 'JOB_FAILED', message: result?.message || 'Falha na execução.' };
        } else if (unavailable) {
          job.state = 'unavailable';
          job.message = result?.message || result?.error?.message || job.message || 'Execução indisponível no ambiente atual.';
          if (result?.error) job.error = result.error;
        } else {
          job.state = 'succeeded';
        }
        job.progress = 100;
      }
    } catch (e) {
      if (job._cancelled) {
        job.state = 'cancelled';
        job.message = job.message || 'Cancelado.';
      } else {
        job.state = 'failed';
        job.error = { code: 'JOB_EXCEPTION', message: e?.message || String(e) };
      }
      this._log(job, 'error', job.error?.message || 'Erro na execução.', { stack: e?.stack || null });
    } finally {
      job.completedAt = nowIso();
      this.running = Math.max(0, this.running - 1);
      this.events?.emit(`job.${job.state}`, this.get(job.id));
      this.events?.emit('job.completed', this.get(job.id));
      void this._pump();
    }
  }

  clearTerminal() {
    for (const [id, job] of [...this.jobs.entries()]) {
      if (TERMINAL.has(job.state)) this.jobs.delete(id);
    }
  }
}

export default JobManager;
