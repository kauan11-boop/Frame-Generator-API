/**
 * FGUA v2 — quantizador: identificação, estimativa e planejamento.
 * CONVERSÃO EFETIVA REQUER RUNTIME EXTERNO (llama.cpp / provedor compatível).
 * O arquivo original é sempre preservado. Nenhuma conversão fictícia é feita aqui.
 */

import { result } from '../core/states.js';
import { GGML_TYPES, humanSize } from './gguf.js';

/** tabela de quantização para estimativa (bits por peso, valores aproximados) */
export const QUANT_TABLE = Object.entries(GGML_TYPES).map(([id, t]) => ({
  id: Number(id),
  label: t.label,
  bitsPerWeight: t.bpw,
  bytesPerWeight: t.bpw / 8,
  aproximado: true
}));

export function types() {
  return result('ready', { quants: QUANT_TABLE, note: 'Valores aproximados para planejamento; conversão real depende do runtime.' });
}

/** tamanho estimado dado nº de parâmetros e tipo alvo */
export function sizeFromParams(params, quantLabel) {
  const q = QUANT_TABLE.find(x => x.label === quantLabel);
  if (!q || !Number.isFinite(params) || params <= 0) return null;
  return params * q.bytesPerWeight;
}

/** nº de parâmetros estimado dado tamanho real e tipo atual */
export function paramsFromSize(sizeBytes, quantLabel) {
  const q = QUANT_TABLE.find(x => x.label === quantLabel);
  if (!q || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return null;
  return (sizeBytes * 8) / q.bitsPerWeight;
}

/**
 * estimativa: { source: {params | sizeBytes+quantFrom}, targets: [labels] }
 * Retorna tabela com tamanhos estimados e economia %. Estado: planned.
 */
export function estimate({ params = null, sizeBytes = null, quantFrom = null, targets = [] } = {}) {
  const p = params ?? (sizeBytes && quantFrom ? paramsFromSize(sizeBytes, quantFrom) : null);
  if (!p) return result('invalid', null, { error: 'Informe params ou (sizeBytes + quantFrom) válidos.' });
  const list = (targets.length ? targets : QUANT_TABLE.map(q => q.label)).map(label => {
    const size = sizeFromParams(p, label);
    const saving = size && sizeBytes ? Math.max(0, 1 - size / sizeBytes) : null;
    return {
      quant: label,
      sizeBytes: size,
      sizeHuman: size ? humanSize(size) : '—',
      savingPct: saving != null ? +(saving * 100).toFixed(1) : null
    };
  });
  return result('planned', {
    paramsEstimated: p,
    paramsHuman: p >= 1e9 ? `${(p / 1e9).toFixed(2)}B` : `${Math.round(p / 1e6)}M`,
    quantFrom: quantFrom ?? 'desconhecido',
    originalSizeHuman: sizeBytes ? humanSize(sizeBytes) : null,
    targets: list,
    aviso: 'Estimativas aproximadas. Conversão efetiva só em runtime externo; o arquivo original permanece intacto.'
  });
}

/**
 * plano de conversão: NÃO converte nada — produz um plano com comando sugerido
 * para runtime externo (llama.cpp llama-quantize) e estados explícitos.
 */
export function plan({ fileName = 'modelo.gguf', quantFrom = 'F16', quantTo = 'Q4_K_M', sizeBytes = null, params = null } = {}) {
  const est = sizeFromParams(params ?? paramsFromSize(sizeBytes ?? 0, quantFrom) ?? 0, quantTo);
  if (!est && !sizeBytes) return result('invalid', null, { error: 'Informe sizeBytes ou params.' });
  return result('requires-runtime', {
    arquivo: fileName,
    de: quantFrom,
    para: quantTo,
    tamanhoEstimadoHuman: est ? humanSize(est) : (sizeBytes ? humanSize(sizeBytes * 0.5) : '—'),
    originalPreservado: true,
    passos: [
      '1. Manter o arquivo original .gguf intacto (nunca sobrescrever).',
      '2. Instalar runtime externo (llama.cpp / provedor compatível).',
      '3. Executar a conversão fora do navegador (abaixo).',
      '4. Reanalisar o arquivo convertido com o parser GGUF do FGUA.'
    ],
    comandoSugerido: `llama-quantize "${fileName}" "${fileName.replace(/\.gguf$/i, '')}-${String(quantTo).toLowerCase()}.gguf" ${quantTo}`,
    aviso: 'O navegador não executa esta conversão. Este plano é somente uma especificação.'
  });
}

export default { types, estimate, plan, QUANT_TABLE };
