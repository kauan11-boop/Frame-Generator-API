self.onmessage = async (e) => {
  const { type, payload } = e.data || {};
  if (type === 'ping') { self.postMessage({ type: 'pong', payload: { ok: true } }); return; }
  if (type === 'analyze') {
    // análise básica no worker
    self.postMessage({ type: 'result', payload: { ok: true, note: 'Worker de imagem pronto; processamento neural requer runtime/modelo compatível.', input: payload?.info || null } });
    return;
  }
  self.postMessage({ type: 'error', payload: { ok: false, error: 'Comando não suportado', received: type } });
};
