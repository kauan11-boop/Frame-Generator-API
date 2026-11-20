/* Image worker (off-main-thread placeholder). Protocol: { id?, type, payload } -> { id?, type, ok, state, data?, error? } */
self.onmessage = async (e) => {
  const msg = e.data || {};
  const { id, type, payload } = msg;
  const reply = (typeName, data = null, extra = {}) => self.postMessage({ id: id ?? null, type: typeName, ok: extra.ok !== false, state: extra.state || (extra.ok === false ? 'error' : 'ok'), data, ...(extra.error ? { error: extra.error } : {}) });

  try {
    if (type === 'ping') return reply('pong', { worker: 'image', ready: true, ts: Date.now() });
    if (type === 'analyze') {
      return reply('result', { note: 'Worker de imagem pronto; análise/processamento neural requer runtime/modelo compatível.', input: payload?.info || null }, { ok: false, state: 'requires-provider' });
    }
    return reply('error', null, { ok: false, state: 'unsupported', error: { code: 'UNSUPPORTED_COMMAND', message: 'Comando não suportado pelo worker de imagem.', received: type || null } });
  } catch (err) {
    return reply('error', null, { ok: false, state: 'error', error: { code: 'WORKER_ERROR', message: err?.message || String(err) } });
  }
};
