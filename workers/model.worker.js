self.onmessage = async (e) => {
  const { type } = e.data || {};
  if (type === 'ping') { self.postMessage({ type: 'pong', payload: { ok: true } }); return; }
  self.postMessage({ type: 'error', payload: { ok: false, error: 'Parser GGUF executa no thread principal neste build; worker reservado para tarefas compatíveis.' } });
};
