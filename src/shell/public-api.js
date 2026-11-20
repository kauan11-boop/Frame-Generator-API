/**
 * FGUA v2 — ponte pública: window.FGUA para o shell Windows 11 e apps.
 * Também inicializa o VFS e monta handlers que dependem de arquivos.
 */

import * as kernel from '../core/kernel.js';
import { STATES, STATE_INFO, result, canTransition } from '../core/states.js';
import { parseGGUFBlob, humanSize, GGML_TYPES, FILE_TYPES } from '../models/gguf.js';
import * as quantizer from '../models/quantizer.js';
import * as tfjs from '../runtime/tfjs.js';
import * as transformers from '../runtime/transformers.js';
import { PerfMonitor, PixelBudgetController } from '../generators/perf.js';
import { createVFS } from '../storage/fs.js';

let instance = null;

export async function initFGUA() {
  if (instance) return instance;
  const snap = await kernel.boot();

  // VFS + seed (para o Explorador)
  const vfs = createVFS();
  await vfs.seed();
  kernel.register('vfs', vfs);

  // monitor de desempenho compartilhado
  const perf = new PerfMonitor();
  kernel.register('perf', perf);

  instance = {
    version: kernel.VERSION,
    snapshot: () => kernel.snapshot(),
    ...kernel,
    states: { STATES, STATE_INFO, result, canTransition },
    gguf: { parseBlob: parseGGUFBlob, humanSize, GGML_TYPES, FILE_TYPES },
    quantizer,
    runtime: { tfjs, transformers },
    perf: { PerfMonitor, PixelBudgetController, shared: perf },
    vfs
  };

  if (typeof window !== 'undefined') {
    window.FGUA = instance;
    window.dispatchEvent(new Event('fgua:ready'));
  }
  return instance;
}

export { kernel };
