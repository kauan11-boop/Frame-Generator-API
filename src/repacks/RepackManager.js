import { ManifestLoader } from './ManifestLoader.js';
import { uid, nowIso } from '../core/utils.js';

export class RepackManager {
  constructor(options = {}) {
    this.loader = new ManifestLoader();
    this.repacks = new Map();
    this.tools = options.toolRegistry || null;
    this.events = options.events || null;
  }

  create(spec = {}) {
    const normalized = this.loader.normalize({ id: spec.id || uid('repack'), name: spec.name || 'Repack', ...spec });
    const v = this.loader.validate(normalized);
    if (!v.ok) return { ok: false, state: 'invalid', errors: v.errors };
    if (this.repacks.has(normalized.id)) return { ok: false, state: 'conflict', errors: ['Repack duplicado.'] };
    const repack = { ...normalized, createdAt: nowIso(), updatedAt: nowIso(), state: 'registered' };
    this.repacks.set(repack.id, repack);
    try { this.events?.emit('repack.created', { id: repack.id }); } catch {}
    return { ok: true, state: 'registered', repack: { ...repack } };
  }

  import(spec) {
    let obj = spec;
    try {
      if (typeof spec === 'string') obj = JSON.parse(spec);
    } catch (e) {
      return { ok: false, state: 'invalid', errors: [`JSON inválido: ${e?.message || e}`] };
    }
    const normalized = this.loader.normalize(obj);
    const v = this.loader.validate(normalized);
    if (!v.ok) return { ok: false, state: 'invalid', errors: v.errors };
    const existing = this.repacks.get(normalized.id);
    const repack = { ...normalized, createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso(), state: 'imported' };
    this.repacks.set(repack.id, repack);
    try { this.events?.emit('repack.imported', { id: repack.id }); } catch {}
    return { ok: true, state: existing ? 'updated' : 'imported', repack: { ...repack } };
  }

  export(id) {
    const r = this.repacks.get(id);
    return r ? JSON.stringify(r, null, 2) : null;
  }

  list() { return [...this.repacks.values()].map((r) => ({ ...r })); }
  get(id) { const r = this.repacks.get(id); return r ? { ...r } : null; }

  validate(id) {
    const r = this.repacks.get(id);
    if (!r) return { ok: false, state: 'not_found', errors: ['Repack não encontrado.'] };
    return this.loader.validate(r);
  }

  setEnabled(id, enabled) {
    const r = this.repacks.get(id);
    if (!r) return null;
    r.enabled = !!enabled;
    r.updatedAt = nowIso();
    return { ...r };
  }

  remove(id) {
    const ok = this.repacks.delete(id);
    if (ok) try { this.events?.emit('repack.removed', { id }); } catch {}
    return ok;
  }
}

export default RepackManager;
