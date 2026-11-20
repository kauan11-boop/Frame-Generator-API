self.onmessage = async (e) => {
  const { type } = e.data || {};
  if (type === 'ping') { self.postMessage({ type: 'pong', payload: { ok: true, worker: 'processing' } }); return; }
  self.postMessage({ type: 'error', payload: { ok: false, error: 'Comando não suportado' } });
};
