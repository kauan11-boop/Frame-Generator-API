/* Model worker (placeholder). Protocol: { id?, type, payload } -> { id?, type, ok, state, data?, error? } */
self.onmessage = async (e) => {
  const msg = e.data || {};
  const { id, type } = msg;
  const reply = (typeName, data = null, extra = {}) => self.postMessage({ id: id ?? null, type: typeName, ok: extra.ok !== false, state: extra.state || (extra.ok === false ? 'error' : 'ok'), data, ...(extra.error ? { error: extra.error } : {}) });

  try {
    if (type === 'ping') return reply('pong', { worker: 'model', ready: true, ts: Date.now() });
    return reply('error', null, { ok: false, state: 'unavailable', error: { code: 'UNAVAILABLE_IN_WORKER', message: 'Parser/análise GGUF principal executa no thread principal neste build; worker reservado para tarefas compatíveis.', received: type || null } });
  } catch (err) {
    return reply('error', null, { ok: false, state: 'error', error: { code: 'WORKER_ERROR', message: err?.message || String(err) } });
  }
};
