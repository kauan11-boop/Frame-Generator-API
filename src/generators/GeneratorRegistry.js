export class GeneratorRegistry {
  constructor() { this.generators = new Map(); }

  register(spec) {
    if (!spec?.id) throw new Error('Generator id obrigatório');
    if (this.generators.has(spec.id)) throw new Error(`Gerador duplicado: ${spec.id}`);
    const g = { status: 'registered', enabled: spec.enabled !== false, registeredAt: new Date().toISOString(), ...spec };
    this.generators.set(g.id, g);
    return { ...g };
  }

  upsert(spec = {}) {
    if (!spec?.id) throw new Error('Generator id obrigatório');
    const prev = this.generators.get(spec.id) || {};
    const g = { ...prev, ...spec, id: spec.id, enabled: spec.enabled !== undefined ? !!spec.enabled : (prev.enabled !== false), updatedAt: new Date().toISOString(), registeredAt: prev.registeredAt || new Date().toISOString() };
    this.generators.set(g.id, g);
    return { ...g };
  }

  get(id) { const g = this.generators.get(id); return g ? { ...g } : null; }
  list() { return [...this.generators.values()].map((g) => ({ ...g })); }
  remove(id) { return this.generators.delete(id); }
  setEnabled(id, enabled) { const g = this.generators.get(id); if (g) { g.enabled = !!enabled; g.updatedAt = new Date().toISOString(); } return g ? { ...g } : null; }
}

export default GeneratorRegistry;
