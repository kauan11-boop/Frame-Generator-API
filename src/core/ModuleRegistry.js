export class ModuleRegistry {
  constructor(name = 'registry') {
    this.name = name;
    this.items = new Map();
  }

  register(id, item) {
    if (!id) throw new Error(`[${this.name}] id obrigatório`);
    if (this.items.has(id)) throw new Error(`[${this.name}] duplicado: ${id}`);
    this.items.set(id, { id, ...item, registeredAt: new Date().toISOString() });
    return this.items.get(id);
  }

  upsert(id, item) {
    if (!id) throw new Error(`[${this.name}] id obrigatório`);
    const prev = this.items.get(id) || {};
    this.items.set(id, { ...prev, id, ...item, updatedAt: new Date().toISOString() });
    return this.items.get(id);
  }

  get(id) { return this.items.get(id) || null; }
  has(id) { return this.items.has(id); }
  list() { return [...this.items.values()]; }
  remove(id) { return this.items.delete(id); }
  clear() { this.items.clear(); }
  count() { return this.items.size; }
}

export const Registry = ModuleRegistry;
export default ModuleRegistry;
