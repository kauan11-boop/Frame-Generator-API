/**
 * FGUA v2 — worker de parsing GGUF (fora da thread principal).
 * Recebe um File/Blob (transferível via structured clone), lê apenas o header
 * progressivamente e devolve os metadados — nunca o corpo do modelo.
 * Fallback: se Worker indisponível, o app usa parseGGUFBlob na thread principal.
 */

let NEED_MORE = Symbol('gguf:need-more');

self.onmessage = async (ev) => {
  const { id, file } = ev.data ?? {};
  if (!file) return;
  try {
    // importa o parser puro do núcleo (mesma especificação da thread principal)
    const { parseGGUFBlob } = await import('../../src/models/gguf.js');
    const parsed = await parseGGUFBlob(file, {
      onProgress: (p) => self.postMessage({ id, type: 'progress', loaded: p.loaded })
    });
    // transfere apenas dados serializáveis
    self.postMessage({ id, type: 'done', result: parsed });
  } catch (err) {
    self.postMessage({ id, type: 'error', error: String(err?.message || err) });
  }
};
