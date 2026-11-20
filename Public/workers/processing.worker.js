/* Basic processing worker (placeholder for off-main-thread tasks). */
self.onmessage = (e) => {
  const { type, payload } = e.data || {};
  if (type === 'ping') { self.postMessage({ type: 'pong', ok: true, ts: Date.now() }); return; }
  if (type === 'echo') { self.postMessage({ type: 'echo', payload }); return; }
  self.postMessage({ type: 'unsupported', ok: false, received: type || null, note: 'Tarefa requer implementação/engine compatível.' });
};
