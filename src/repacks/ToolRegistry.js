import { nowIso } from '../core/utils.js';

export class ToolRegistry {
  constructor() { this.tools = new Map(); }

  register(spec = {}, options = {}) {
    if (!spec || typeof spec !== 'object' || !spec.id) return { ok: false, state: 'invalid', error: { code: 'INVALID_TOOL', message: 'Tool id obrigatório.' } };
    if (this.tools.has(spec.id) && !options.replace) return { ok: false, state: 'conflict', error: { code: 'DUPLICATE_TOOL', message: `Ferramenta duplicada: ${spec.id}` } };
    const prev = this.tools.get(spec.id) || null;
    const tool = {
      id: String(spec.id),
      name: typeof spec.name === 'string' ? spec.name : String(spec.id),
      description: typeof spec.description === 'string' ? spec.description : '',
      version: typeof spec.version === 'string' ? spec.version : (prev?.version || '1.0.0'),
      enabled: spec.enabled !== false,
      status: spec.status || (prev?.status || 'registered'),
      permissions: Array.isArray(spec.permissions) ? [...spec.permissions] : (Array.isArray(prev?.permissions) ? [...prev.permissions] : []),
      handler: typeof spec.handler === 'function' ? spec.handler : (prev?.handler || null),
      metadata: spec.metadata && typeof spec.metadata === 'object' ? { ...spec.metadata } : (prev?.metadata || {}),
      registeredAt: prev?.registeredAt || nowIso(),
      updatedAt: nowIso(),
    };
    this.tools.set(tool.id, tool);
    const { handler, ...safe } = tool;
    return { ok: true, state: prev ? 'updated' : 'registered', tool: { ...safe, hasHandler: !!handler } };
  }

  list() { return [...this.tools.values()].map(({ handler, ...t }) => ({ ...t, hasHandler: !!handler })); }
  get(id) { const t = this.tools.get(id); if (!t) return null; const { handler, ...r } = t; return { ...r, hasHandler: !!handler }; }

  setEnabled(id, enabled) {
    const t = this.tools.get(id);
    if (!t) return null;
    t.enabled = !!enabled;
    t.updatedAt = nowIso();
    return this.get(id);
  }

  remove(id) { return this.tools.delete(id); }

  async execute(id, input = {}, ctx = {}) {
    const t = this.tools.get(id);
    if (!t) return { ok: false, state: 'not_found', error: { code: 'NOT_FOUND', message: 'Ferramenta não encontrada.' } };
    if (!t.enabled) return { ok: false, state: 'disabled', error: { code: 'DISABLED', message: 'Ferramenta desativada.' } };
    if (typeof t.handler !== 'function') return { ok: false, state: 'unavailable', error: { code: 'NO_HANDLER', message: 'Sem handler executável no ambiente atual.' } };
    try {
      const result = await t.handler(input, ctx);
      if (result && typeof result === 'object' && 'ok' in result && ('state' in result || 'error' in result || 'data' in result)) return result;
      return { ok: true, state: 'ok', data: result, error: null };
    } catch (e) {
      return { ok: false, state: 'error', error: { code: 'TOOL_ERROR', message: e?.message || String(e) } };
    }
  }
}

export default ToolRegistry;
