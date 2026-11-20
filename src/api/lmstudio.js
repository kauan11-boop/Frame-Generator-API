/**
 * FGUA v2 — cliente LM Studio.
 * Fontes (pesquisadas): https://lmstudio.ai/docs/developer
 * - Compatível com OpenAI (porta padrão 1234): GET /v1/models, POST /v1/chat/completions,
 *   POST /v1/completions, POST /v1/embeddings, POST /v1/responses
 * - REST nativa v1 (LM Studio 0.4+): GET /api/v1/models, POST /api/v1/chat,
 *   POST /api/v1/models/load, POST /api/v1/models/unload, POST /api/v1/models/download
 * - REST v0 (legado 0.3.6+): GET /api/v0/models, GET /api/v0/models/{model},
 *   POST /api/v0/chat/completions, POST /api/v0/completions, POST /api/v0/embeddings
 * - Auth opcional: "Authorization: Bearer <token>" (Manage Tokens em Server Settings)
 * - CORS precisa estar habilitado no servidor para acesso pelo navegador.
 */

import { result } from '../core/states.js';
import { request, streamChat } from './client.js';

export function createLMStudio(settings) {
  const cfg = settings?.backends?.lmstudio ?? {};
  let baseUrl = cfg.baseUrl || 'http://localhost:1234';
  let token = '';
  let flavor = 'auto'; // 'openai' | 'native' | 'auto'

  function setBaseUrl(url) { baseUrl = String(url || '').replace(/\/+$/, ''); }
  function setToken(t) { token = String(t || '').trim(); }
  function setFlavor(f) { flavor = f; }

  async function health() {
    const r = await request(baseUrl, '/v1/models', { token, timeoutMs: 4000 });
    if (r.ok) return result('ready', { baseUrl, models: r.json?.data?.length ?? 0 });
    return result('unavailable', null, { error: r.error, hint: r.hint, status: r.status });
  }

  /** GET /v1/models — lista compatível com OpenAI */
  async function listModelsOpenAI() {
    const r = await request(baseUrl, '/v1/models', { token });
    if (!r.ok) return result('unavailable', null, { error: r.error, hint: r.hint, status: r.status });
    return result('ready', r.json);
  }

  /** GET /api/v1/models (nativa 0.4+) com fallback para /api/v0/models */
  async function listModelsNative() {
    let r = await request(baseUrl, '/api/v1/models', { token });
    if (r.ok && r.json) return result('ready', { flavor: 'v1', ...r.json });
    r = await request(baseUrl, '/api/v0/models', { token });
    if (r.ok && r.json) return result('ready', { flavor: 'v0', ...r.json });
    return result('unavailable', null, { error: r.error, hint: r.hint });
  }

  /** POST /v1/chat/completions — suporta stream e response_format json_schema */
  async function chat({ model, messages, stream = false, temperature = 0.7, maxTokens = -1, responseFormat = null, onToken = null } = {}) {
    if (!model || !Array.isArray(messages)) return result('invalid', null, { error: 'model e messages são obrigatórios.' });
    const body = { model, messages, stream, temperature };
    if (maxTokens > 0) body.max_tokens = maxTokens;
    if (responseFormat) body.response_format = responseFormat;
    if (stream) {
      const r = await streamChat(baseUrl, '/v1/chat/completions', body, { token, onToken });
      if (!r.ok) return result('failed', null, { error: r.error, hint: r.hint });
      return result('succeeded', { text: r.text, stream: true });
    }
    const r = await request(baseUrl, '/v1/chat/completions', { method: 'POST', body, token, timeoutMs: 120000 });
    if (!r.ok) return result('failed', null, { error: r.error || `HTTP ${r.status}`, hint: r.hint, detail: r.json });
    return result('succeeded', r.json);
  }

  /** POST /v1/completions (legado) */
  async function completions({ model, prompt, stream = false, temperature = 0.7, onToken = null } = {}) {
    if (!model || !prompt) return result('invalid', null, { error: 'model e prompt são obrigatórios.' });
    if (stream) {
      const r = await streamChat(baseUrl, '/v1/completions', { model, prompt, stream, temperature }, { token, onToken });
      if (!r.ok) return result('failed', null, { error: r.error, hint: r.hint });
      return result('succeeded', { text: r.text, stream: true });
    }
    const r = await request(baseUrl, '/v1/completions', { method: 'POST', body: { model, prompt, temperature }, token, timeoutMs: 120000 });
    if (!r.ok) return result('failed', null, { error: r.error || `HTTP ${r.status}`, detail: r.json });
    return result('succeeded', r.json);
  }

  /** POST /v1/embeddings */
  async function embeddings({ model, input } = {}) {
    if (!model || !input) return result('invalid', null, { error: 'model e input são obrigatórios.' });
    const r = await request(baseUrl, '/v1/embeddings', { method: 'POST', body: { model, input }, token, timeoutMs: 30000 });
    if (!r.ok) return result('failed', null, { error: r.error || `HTTP ${r.status}`, detail: r.json });
    return result('succeeded', r.json);
  }

  /** POST /api/v1/chat (nativa; stateful) */
  async function nativeChat({ model, messages, stream = false } = {}) {
    if (!model || !Array.isArray(messages)) return result('invalid', null, { error: 'model e messages são obrigatórios.' });
    const r = await request(baseUrl, '/api/v1/chat', { method: 'POST', body: { model, messages, stream }, token, timeoutMs: 120000 });
    if (!r.ok) return result('failed', null, { error: r.error || `HTTP ${r.status}`, hint: 'Endpoint /api/v1/chat requer LM Studio 0.4+. Use chat() OpenAI-compat como alternativa.', detail: r.json });
    return result('succeeded', r.json);
  }

  /** POST /api/v1/models/load */
  async function loadModel({ model, config = {} } = {}) {
    if (!model) return result('invalid', null, { error: 'model é obrigatório.' });
    const r = await request(baseUrl, '/api/v1/models/load', { method: 'POST', body: { model, ...config }, token, timeoutMs: 120000 });
    if (!r.ok) {
      const fallback = await request(baseUrl, '/api/v0/chat/completions', { method: 'POST', body: { model, messages: [{ role: 'user', content: 'ping de carga' }], max_tokens: 1 }, token, timeoutMs: 60000 });
      if (fallback.ok) return result('succeeded', { via: 'v0-fallback (carregamento implícito por uso)', model });
      return result('failed', null, { error: r.error || `HTTP ${r.status}`, hint: 'Use LM Studio 0.4+ para /api/v1/models/load.', detail: r.json });
    }
    return result('succeeded', { via: 'v1', ...r.json });
  }

  /** POST /api/v1/models/unload */
  async function unloadModel({ model } = {}) {
    if (!model) return result('invalid', null, { error: 'model é obrigatório.' });
    const r = await request(baseUrl, '/api/v1/models/unload', { method: 'POST', body: { model }, token, timeoutMs: 30000 });
    if (!r.ok) return result('failed', null, { error: r.error || `HTTP ${r.status}`, detail: r.json });
    return result('succeeded', { via: 'v1', ...r.json });
  }

  function info() {
    return { baseUrl, token: token ? '(definido)' : '(vazio)', flavor, corsRequired: !!cfg.corsRequired };
  }

  return { setBaseUrl, setToken, setFlavor, health, listModelsOpenAI, listModelsNative, chat, completions, embeddings, nativeChat, loadModel, unloadModel, info };
}
