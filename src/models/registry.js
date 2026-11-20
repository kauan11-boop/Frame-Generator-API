/**
 * FGUA v2 — registro de modelos analisados (catálogo local sobre storage).
 */

import { result } from '../core/states.js';
import { humanSize } from './gguf.js';

export function createModelRegistry(store) {
  const NS = 'fgua.models';

  function list() {
    const custom = store.get(NS, 'custom', []);
    return result('ready', { custom, note: 'Modelos builtin em configs/models.json; analisados ficam aqui.' });
  }

  function register(entry) {
    if (!entry || typeof entry !== 'object') return result('invalid', null, { error: 'Entrada inválida.' });
    const required = ['name', 'format'];
    for (const k of required) if (!entry[k]) return result('invalid', null, { error: `Campo obrigatório ausente: ${k}` });
    const custom = store.get(NS, 'custom', []);
    const id = entry.id || `gguf-${Date.now().toString(36)}`;
    const item = {
      id,
      name: entry.name,
      format: entry.format,
      fileName: entry.fileName ?? null,
      fileSize: entry.fileSize ?? null,
      fileSizeHuman: entry.fileSize ? humanSize(entry.fileSize) : null,
      arch: entry.arch ?? null,
      quantization: entry.quantization ?? entry.fileTypeLabel ?? null,
      context: entry.context ?? entry.kv?.[`${entry.arch}.context_length`] ?? null,
      tensorsCount: entry.tensorsCount ?? null,
      paramsEstimate: entry.estimatedWeights ?? null,
      registeredAt: new Date().toISOString(),
      state: 'analyzed'
    };
    const idx = custom.findIndex(x => x.id === id);
    if (idx >= 0) custom[idx] = item; else custom.push(item);
    store.set(NS, 'custom', custom);
    return result('succeeded', item);
  }

  function remove(id) {
    const custom = store.get(NS, 'custom', []);
    const idx = custom.findIndex(x => x.id === id);
    if (idx < 0) return result('invalid', null, { error: `Modelo não encontrado: ${id}` });
    custom.splice(idx, 1);
    store.set(NS, 'custom', custom);
    return result('succeeded', { id });
  }

  function get(id) {
    const custom = store.get(NS, 'custom', []);
    return custom.find(x => x.id === id) ?? null;
  }

  return { list, register, remove, get };
}
