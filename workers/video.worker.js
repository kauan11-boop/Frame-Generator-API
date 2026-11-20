self.onmessage = async (e) => {
  const { type, payload } = e.data || {};
  if (type === 'ping') { self.postMessage({ type: 'pong', payload: { ok: true } }); return; }
  if (type === 'plan') {
    self.postMessage({ type: 'result', payload: { ok: true, note: 'Worker de vídeo pronto; decodificação/interpolação/codificação requer pipeline e provedor compatíveis.', plan: payload || null } });
    return;
  }
  self.postMessage({ type: 'error', payload: { ok: false, error: 'Comando não suportado', received: type } });
};
