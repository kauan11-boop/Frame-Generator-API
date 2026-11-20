/**
 * FGUA v2 — cliente HTTP genérico com timeout, Bearer opcional e leitura de stream SSE.
 */

export async function request(baseUrl, path, { method = 'GET', body = null, token = null, timeoutMs = 15000, headers = {} } = {}) {
  const url = `${String(baseUrl).replace(/\/+$/, '')}${path.startsWith('/') ? path : '/' + path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs);
  try {
    const h = { 'Content-Type': 'application/json', ...headers };
    if (token) h['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { method, headers: h, body: body == null ? undefined : JSON.stringify(body), signal: ctrl.signal });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { ok: res.ok, status: res.status, json, url };
  } catch (err) {
    const msg = err?.name === 'AbortError' ? `timeout após ${timeoutMs}ms` : String(err?.message || err);
    return {
      ok: false, status: 0, json: null, url,
      error: msg,
      hint: err instanceof TypeError ? 'Falha de rede/CORS: verifique se o servidor está ativo e se CORS está habilitado no LM Studio (Developer → Server Settings → Enable CORS).' : null
    };
  } finally {
    clearTimeout(timer);
  }
}

/** stream SSE de /v1/chat/completions (stream: true). onToken(delta) por fragmento. */
export async function streamChat(baseUrl, path, body, { token = null, onToken = null, signal = null } = {}) {
  const url = `${String(baseUrl).replace(/\/+$/, '')}${path.startsWith('/') ? path : '/' + path}`;
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body), signal });
  } catch (err) {
    return { ok: false, error: String(err?.message || err), hint: 'Verifique servidor ativo + CORS.' };
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: text.slice(0, 400) || `HTTP ${res.status}` };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') { return { ok: true, text: full }; }
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.text ?? '';
        if (delta) { full += delta; if (onToken) onToken(delta); }
      } catch { /* fragmento parcial; ignora */ }
    }
  }
  return { ok: true, text: full };
}

export default { request, streamChat };
