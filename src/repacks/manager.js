/**
 * FGUA v2 — gerenciador de repacks: múltiplas ferramentas em 1 comando.
 * Executa passos declarativos (spec nos configs/repacks.json + manifests em /Public/manifests).
 */

import { result } from '../core/states.js';
import { notify } from '../core/bus.js';

export function createRepackManager({ repacksConfig, route, onProgress = null } = {}) {
  const defs = [...(repacksConfig.repacks ?? [])];

  function list() {
    return result('ready', { repacks: defs.map(d => ({ id: d.id, name: d.name, version: d.version, description: d.description, tools: d.tools, state: d.state })) });
  }

  function get(id) {
    const d = defs.find(x => x.id === id);
    if (!d) return result('invalid', null, { error: `Repack não encontrado: ${id}` });
    return result('ready', d);
  }

  function addLocal(manifest) {
    if (!manifest?.id || !Array.isArray(manifest?.tools)) return result('invalid', null, { error: 'Manifest inválido: requer id + tools[]' });
    const idx = defs.findIndex(d => d.id === manifest.id);
    if (idx >= 0) defs[idx] = manifest; else defs.push(manifest);
    return result('succeeded', manifest);
  }

  /**
   * Instala/executa o repack inteiro — 1 comando que integra várias ferramentas.
   * Cada passo chama o roteador /api/v1 e registra o estado real retornado.
   */
  async function install(id, { payload = {} } = {}) {
    const d = defs.find(x => x.id === id);
    if (!d) return result('invalid', null, { error: `Repack não encontrado: ${id}` });
    const steps = [];
    const t0 = performance.now();
    notify('Repack', `Executando "${d.name}" (${d.steps?.length ?? d.tools.length} passos)…`, 'info');
    let allOk = true;
    let i = 0;
    for (const step of (d.steps ?? d.tools.map(tool => ({ tool, label: tool })))) {
      i++;
      onProgress?.({ step: i, total: d.steps?.length ?? d.tools.length, label: step.label, state: 'running' });
      const endpoint = toolToEndpoint(step.tool);
      let outcome;
      if (!endpoint) {
        outcome = result('invalid', null, { error: `Ferramenta sem mapeamento de endpoint: ${step.tool}` });
      } else {
        try {
          outcome = await route(endpoint, { method: 'POST', payload: { repack: d.id, step: step.label, ...payload } });
        } catch (err) {
          outcome = result('failed', null, { error: String(err?.message || err) });
        }
      }
      if (!outcome.ok || outcome.state === 'unavailable') allOk = false;
      steps.push({ seq: i, tool: step.tool, label: step.label, endpoint, state: outcome.state, ok: outcome.ok, data: outcome.data ?? null, error: outcome.error ?? null });
    }
    const elapsed = Math.round(performance.now() - t0);
    notify('Repack', allOk ? `"${d.name}" concluído (${elapsed} ms).` : `"${d.name}" concluído com passos em requires-runtime/erro.`, allOk ? 'ok' : 'warn');
    return result(allOk ? 'succeeded' : 'planned', {
      id: d.id, name: d.name, steps, elapsedMs: elapsed,
      nota: 'Passos com estado requires-runtime/planned exigem runtime/provedor compatível — nada foi simulado.'
    });
  }

  /** mapeia "ns.action" → endpoint do contrato */
  function toolToEndpoint(tool) {
    const [ns, action] = tool.split('.');
    if (!ns || !action) return null;
    const known = {
      'engines.detect': '/api/v1/engines/detect',
      'frames.budget': '/api/v1/frames/budget',
      'frames.plan': '/api/v1/frames/plan',
      'metadata.parse': '/api/v1/metadata/parse',
      'quantization.estimate': '/api/v1/quantization/estimate',
      'quantization.plan': '/api/v1/quantization/plan',
      'models.register': '/api/v1/models/register',
      'models.load': '/api/v1/models/load',
      'videos.probe': '/api/v1/videos/probe',
      'videos.plan': '/api/v1/videos/plan',
      'jobs.create': '/api/v1/jobs/create',
      'lmstudio.models.list': '/api/v1/models/list-remote',
      'lmstudio.chat': '/api/v1/tools/run',
      'perf.monitor': '/api/v1/frames/budget'
    };
    return known[tool] ?? `/api/v1/${ns}/${action.replace(/([A-Z])/g, c => '-' + c.toLowerCase())}`;
  }

  return { list, get, install, addLocal, toolToEndpoint };
}
