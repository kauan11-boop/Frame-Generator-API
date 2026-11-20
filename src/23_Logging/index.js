import { nowIso } from '../26_Utils/index.js';

export class FrameLogger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.maxEntries = options.maxEntries || 500;
    this.entries = [];
    this.sinks = new Set();
    this.levels = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
  }

  setLevel(level) { if (this.levels[level]) this.level = level; }
  addSink(fn) { if (typeof fn === 'function') this.sinks.add(fn); return () => this.sinks.delete(fn); }

  _should(level) { return (this.levels[level] || 0) >= (this.levels[this.level] || 0); }

  _emit(level, message, data = null, scope = 'system') {
    const entry = { ts: nowIso(), level, scope, message, data };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
    if (this._should(level)) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : level === 'debug' ? console.debug : console.log;
      try { fn(`[${entry.ts}] [${level}] [${scope}] ${message}`, data ?? ''); } catch {}
    }
    for (const sink of this.sinks) { try { sink(entry); } catch {} }
    return entry;
  }

  debug(msg, data, scope) { return this._emit('debug', msg, data, scope); }
  info(msg, data, scope) { return this._emit('info', msg, data, scope); }
  warn(msg, data, scope) { return this._emit('warn', msg, data, scope); }
  error(msg, data, scope) { return this._emit('error', msg, data, scope); }
  getRecent(limit = 100) { return this.entries.slice(-limit); }
  clear() { this.entries = []; }
}

export const logger = new FrameLogger();
export default logger;
