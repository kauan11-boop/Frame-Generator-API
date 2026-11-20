// Usage tracking for dashboard (local, session/browser storage, no secrets).

const STORAGE_KEY = 'fgua:usage:v1';
const MAX_EVENTS = 500;

function now() { return Date.now(); }

function safeRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tools: {}, features: {}, events: [], updatedAt: null };
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') throw new Error('invalid');
    return {
      tools: data.tools && typeof data.tools === 'object' ? data.tools : {},
      features: data.features && typeof data.features === 'object' ? data.features : {},
      events: Array.isArray(data.events) ? data.events : [],
      updatedAt: data.updatedAt || null,
    };
  } catch {
    return { tools: {}, features: {}, events: [], updatedAt: null };
  }
}

function safeWrite(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function bump(map, id, meta = {}) {
  if (!id) return;
  const key = String(id);
  const prev = map[key] || { id: key, count: 0, label: meta.label || key, category: meta.category || 'outros', lastUsedAt: null };
  prev.count = (Number(prev.count) || 0) + 1;
  prev.lastUsedAt = new Date().toISOString();
  if (meta.label) prev.label = meta.label;
  if (meta.category) prev.category = meta.category;
  map[key] = prev;
}

function pushEvent(data, event) {
  data.events.push(event);
  if (data.events.length > MAX_EVENTS) data.events.splice(0, data.events.length - MAX_EVENTS);
}

export function recordToolUse(id, meta = {}) {
  const data = safeRead();
  const key = String(id || 'unknown-tool');
  bump(data.tools, key, { label: meta.label || key, category: meta.category || 'tool' });
  pushEvent(data, { type: 'tool', id: key, at: new Date().toISOString(), source: meta.source || 'ToolRegistry' });
  data.updatedAt = new Date().toISOString();
  safeWrite(data);
  try { window.dispatchEvent(new CustomEvent('fgua:usage', { detail: { type: 'tool', id: key } })); } catch {}
  return data.tools[key];
}

export function recordFeatureUse(id, meta = {}) {
  const data = safeRead();
  const key = String(id || 'unknown-feature');
  bump(data.features, key, { label: meta.label || key, category: meta.category || 'ui' });
  pushEvent(data, { type: 'feature', id: key, at: new Date().toISOString(), source: meta.source || 'dashboard' });
  data.updatedAt = new Date().toISOString();
  safeWrite(data);
  try { window.dispatchEvent(new CustomEvent('fgua:usage', { detail: { type: 'feature', id: key } })); } catch {}
  return data.features[key];
}

export function getUsageStats() {
  const data = safeRead();
  const tools = Object.values(data.tools || {});
  const features = Object.values(data.features || {});
  const combinedMap = new Map();
  for (const item of [...tools, ...features]) {
    const k = `${item.category || 'outros'}::${item.id}`;
    const prev = combinedMap.get(k) || { id: item.id, label: item.label || item.id, category: item.category || 'outros', count: 0, lastUsedAt: item.lastUsedAt || null };
    prev.count += Number(item.count) || 0;
    if (!prev.lastUsedAt || (item.lastUsedAt && item.lastUsedAt > prev.lastUsedAt)) prev.lastUsedAt = item.lastUsedAt;
    if (item.label) prev.label = item.label;
    combinedMap.set(k, prev);
  }
  const combined = [...combinedMap.values()].sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
  return { tools, features, combined, events: data.events || [], updatedAt: data.updatedAt };
}

export function getTopTools(limit = 8) {
  const { combined } = getUsageStats();
  return combined.slice(0, Math.max(0, limit));
}

export function clearUsageStats() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function usageSummary() {
  const stats = getUsageStats();
  const total = (stats.combined || []).reduce((acc, i) => acc + (Number(i.count) || 0), 0);
  return { total, items: stats.combined.length, updatedAt: stats.updatedAt };
}
