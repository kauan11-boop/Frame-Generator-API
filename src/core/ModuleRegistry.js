function clonePlain(value) {
  if (value && typeof value === 'object') return Array.isArray(value) ? [...value] : { ...value };
  return value;
}

export class ModuleRegistry {
  constructor(name = 'registry') {
    this.name = name;
    this.items = new Map();
  }

  register(id, item = {}, options = {}) {
    if (!id) throw new Error(`[${this.name}] id obrigatório`);
    if (this.items.has(id) && !options.replace) throw new Error(`[${this.name}] duplicado: ${id}`);
    const now = new Date().toISOString();
    const prev = this.items.get(id) || null;
    const rec = {
      ...clonePlain(item),
      id,
      registeredAt: prev?.registeredAt || now,
      updatedAt: now,
    };
    this.items.set(id, rec);
    return { ...rec };
  }

  upsert(id, item = {}) {
    if (!id) throw new Error(`[${this.name}] id obrigatório`);
    const now = new Date().toISOString();
    const prev = this.items.get(id) || null;
    const rec = {
      ...(prev || {}),
      ...clonePlain(item),
      id,
      registeredAt: prev?.registeredAt || now,
      updatedAt: now,
    };
    this.items.set(id, rec);
    return { ...rec };
  }

  get(id) {
    const v = this.items.get(id);
    return v ? { ...v } : null;
  }

  has(id) { return this.items.has(id); }

  list() { return [...this.items.values()].map((v) => ({ ...v })); }

  remove(id) { return this.items.delete(id); }

  clear() { this.items.clear(); }

  count() { return this.items.size; }
}

export const Registry = ModuleRegistry;
export default ModuleRegistry;
