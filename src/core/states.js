/**
 * FGUA v2 — estados explícitos do contrato lógico.
 * Todo resultado de operação carrega um destes estados. Sem simulação fictícia.
 */

export const STATES = Object.freeze([
  'ready', 'planned', 'analyzed', 'requires-provider', 'requires-runtime',
  'unavailable', 'invalid', 'failed', 'cancelled', 'succeeded'
]);

export const STATE_INFO = Object.freeze({
  'ready': { label: 'Pronto', tone: 'ok', desc: 'Operação disponível no ambiente atual.' },
  'planned': { label: 'Planejado', tone: 'info', desc: 'Plano gerado; execução real requer engine/provedor.' },
  'analyzed': { label: 'Analisado', tone: 'info', desc: 'Análise concluída no cliente.' },
  'requires-provider': { label: 'Requer provedor', tone: 'warn', desc: 'Necessário provedor compatível conectado (ex.: LM Studio).' },
  'requires-runtime': { label: 'Requer runtime', tone: 'warn', desc: 'Necessário runtime externo para execução efetiva.' },
  'unavailable': { label: 'Indisponível', tone: 'err', desc: 'Indisponível no ambiente estático atual.' },
  'invalid': { label: 'Inválido', tone: 'err', desc: 'Entrada/manifest inválido.' },
  'failed': { label: 'Falhou', tone: 'err', desc: 'Operação falhou; veja o detalhe do erro.' },
  'cancelled': { label: 'Cancelado', tone: 'muted', desc: 'Operação cancelada pelo usuário.' },
  'succeeded': { label: 'Concluído', tone: 'ok', desc: 'Operação concluída.' }
});

export function isState(s) {
  return typeof s === 'string' && STATES.includes(s);
}

/** resultado padrão de endpoint */
export function result(state, data = null, extra = {}) {
  if (!isState(state)) {
    return { ok: false, state: 'invalid', error: `Estado inválido: ${String(state)}`, data: null };
  }
  return { ok: state !== 'failed' && state !== 'invalid', state, data, ...extra };
}

/** valida transições simples de máquina de estados para jobs */
const JOB_FLOW = Object.freeze({
  'planned': ['planned', 'cancelled', 'failed', 'succeeded'],
  'ready': ['ready', 'planned', 'failed', 'cancelled'],
  'cancelled': ['cancelled'],
  'failed': ['failed', 'planned'],
  'succeeded': ['succeeded']
});

export function canTransition(from, to) {
  const allowed = JOB_FLOW[from];
  return Array.isArray(allowed) && allowed.includes(to);
}
