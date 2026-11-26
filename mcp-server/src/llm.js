import { LM_MODEL, LM_STUDIO_URL, LM_TIMEOUT_MS } from './config.js';
import { getSettings } from './store.js';

export function resolveLlmOptions(overrides = {}) {
  const settings = getSettings();
  return {
    url: String(overrides.url || settings.lmStudioUrl || LM_STUDIO_URL).replace(/\/+$/, ''),
    model: String(overrides.model || settings.model || LM_MODEL || ''),
    temperature: Number.isFinite(overrides.temperature)
      ? overrides.temperature
      : Number(settings.temperature ?? 0.2),
    timeoutMs: Number(overrides.timeoutMs || LM_TIMEOUT_MS),
  };
}

async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(options.timeoutMs || LM_TIMEOUT_MS) });
  const text = await response.text();
  if (!response.ok) throw new Error(`LM Studio HTTP ${response.status}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch { throw new Error(`LM Studio respondeu JSON inválido: ${text.slice(0, 200)}`); }
}

export async function status(overrides = {}) {
  const opts = resolveLlmOptions(overrides);
  try {
    const data = await request(`${opts.url}/models`, { method: 'GET', timeoutMs: Math.min(opts.timeoutMs, 8000) });
    const models = (data.data || []).map((m) => m.id).filter(Boolean);
    return { available: true, url: opts.url, models, configuredModel: opts.model || null };
  } catch (error) {
    return { available: false, url: opts.url, error: error?.message || String(error), configuredModel: opts.model || null };
  }
}

export async function chat({ system, user, history = [], ...overrides }) {
  const opts = resolveLlmOptions(overrides);
  const probe = await status({ ...overrides, timeoutMs: Math.min(opts.timeoutMs, 8000) });
  if (!probe.available) {
    return { ok: false, reason: 'requires-provider', error: probe.error, url: opts.url };
  }
  const model = opts.model || probe.models[0];
  if (!model) return { ok: false, reason: 'requires-model', error: 'LM Studio não reportou modelos carregados', url: opts.url };
  const messages = [
    { role: 'system', content: String(system || '') },
    ...history.map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '') })),
    { role: 'user', content: String(user || '') },
  ];
  try {
    const data = await request(`${opts.url}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: opts.temperature, stream: false }),
      timeoutMs: opts.timeoutMs,
    });
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'empty-response', model };
    return { ok: true, text, model, url: opts.url };
  } catch (error) {
    return { ok: false, reason: 'request-failed', error: error?.message || String(error), model, url: opts.url };
  }
}

export function extractCode(text) {
  const source = String(text || '');
  const match = source.match(/```[a-zA-Z0-9_+-]*\r?\n([\s\S]*?)```/);
  const code = match ? match[1] : source;
  const motive = source.match(/MOTIVO:\s*(.+)$/im)?.[1]?.trim() || '';
  return { code: code.trim(), motive };
}
