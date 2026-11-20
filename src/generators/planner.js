/**
 * FGUA v2 — planejador unificado de geração/aprimoramento de quadros.
 * Um único contrato para vários gêneros: jogos, imagem, vídeo.
 * Sempre produz PLANOS com estados explícitos — nunca simula resultado.
 */

import { result } from '../core/states.js';

export function createPlanner(configGenerators, caps) {
  const genres = configGenerators.genres;
  const budgets = configGenerators.pixelBudgets;

  function list() {
    return result('ready', Object.entries(genres).map(([id, g]) => ({
      id, label: g.label, description: g.description, engines: g.engines, defaultState: g.state
    })));
  }

  function validateParams(genreId, params) {
    const g = genres[genreId];
    if (!g) return { ok: false, error: `Gênero desconhecido: ${genreId}` };
    const p = params ?? {};
    const checks = [];
    const nums = ['fpsAlvo', 'fatoresEscala', 'fpsOrigem'];
    for (const key of nums) {
      if (key in p && p[key] != null && Array.isArray(g.params[key]) && !g.params[key].includes(Number(p[key]))) {
        checks.push(`${key}=${p[key]} fora de ${JSON.stringify(g.params[key])}`);
      }
    }
    return checks.length ? { ok: false, error: `Parâmetros fora da especificação: ${checks.join('; ')}` } : { ok: true };
  }

  function enginePick(genreId) {
    const g = genres[genreId];
    const ok = [];
    for (const e of g.engines) {
      const avail =
        (e === 'WebGPU' && caps?.webgpu?.supported) ||
        (e === 'WebGL' && caps?.webgl?.supported) ||
        (e === 'WebGL2' && caps?.webgl2?.supported) ||
        (e === 'TF.js' || e === 'Transformers.js') || // depende de carga sob demanda
        (e === 'WebCodecs' && caps?.webcodecs?.videoEncoder) ||
        (e === 'Worker' && caps?.workers);
      if (avail) ok.push(e);
    }
    return ok;
  }

  function plan({ genre = 'jogos', params = {} } = {}) {
    const v = validateParams(genre, params);
    if (!v.ok) return result('invalid', null, { error: v.error });
    const g = genres[genreId(genre)];
    const enginesOk = enginePick(genre);
    const budgetKey = g.pixelBudgetPreset;
    const budget = budgets[budgetKey];
    const steps = [
      { seq: 1, tool: 'engines.detect', label: 'Detectar engines disponíveis', state: 'succeeded' },
      { seq: 2, tool: 'params.validate', label: 'Validar parâmetros contra configs/generators.json', state: 'succeeded' },
      { seq: 3, tool: 'frames.budget', label: 'Calcular orçamento de pixels por quadro', state: 'succeeded' },
      { seq: 4, tool: `${genre}.execute`, label: `Executar pipeline ${g.label}`, state: 'requires-runtime' }
    ];
    return result('planned', {
      genre,
      label: g.label,
      params,
      engines: { requeridas: g.engines, disponiveis: enginesOk },
      pixelBudget: budget,
      steps,
      stateFinal: 'requires-runtime',
      aviso: genre === 'jogos'
        ? 'Não intercepta pipeline gráfico; usa apenas integrações/capturas autorizadas. Execução real requer runtime.'
        : 'Execução real depende de engine/modelo/provedor compatível. Este plano não simula resultado.'
    });
  }

  function genreId(id) { return genres[id] ? id : Object.keys(genres)[0]; }

  /** orçamento de pixels/fps conforme desempenho medido */
  function frameBudget({ width = 1920, height = 1080, fpsAlvo = 60, fpsMedido = null, limites = null } = {}) {
    const pixelsPorQuadro = Math.round(width * height);
    const throughput = pixelsPorQuadro * fpsAlvo;
    const lim = limites ?? { minScalePct: 50, maxScalePct: 100 };
    let scalePct = 100;
    let motivo = 'Sem medição: escala máxima.';
    if (Number.isFinite(fpsMedido) && fpsMedido > 0) {
      const ratio = fpsMedido / fpsAlvo;
      if (ratio >= 1) { scalePct = Math.min(lim.maxScalePct, 100); motivo = `fps medido (${fpsMedido.toFixed(1)}) ≥ alvo (${fpsAlvo}): escala máxima.`; }
      else { scalePct = Math.round(Math.min(lim.maxScalePct, Math.max(lim.minScalePct, ratio * 100))); motivo = `fps medido (${fpsMedido.toFixed(1)}) < alvo (${fpsAlvo}): reduzir resolução interna para ${scalePct}%.`; }
    }
    const rec = { width: Math.round(width * scalePct / 100), height: Math.round(height * scalePct / 100) };
    return result('ready', {
      entrada: { width, height, fpsAlvo, fpsMedido },
      pixelsPorQuadro,
      throughputPixelsS: throughput,
      escalaRecomendadaPct: scalePct,
      resolucaoInternaRecomendada: rec,
      motivo,
      politica: 'Gerar mais quadros OU menos pixels — nunca estourar o orçamento de desempenho.'
    });
  }

  /** análise real de imagem (analisada no cliente, sem geração) */
  async function probeImage(fileOrBitmap) {
    try {
      let bmp, sizeBytes = null, name = 'imagem';
      if (typeof createImageBitmap === 'function' && fileOrBitmap?.arrayBuffer) {
        name = fileOrBitmap.name ?? name;
        sizeBytes = fileOrBitmap.size ?? null;
        bmp = await createImageBitmap(fileOrBitmap);
      } else if (fileOrBitmap && fileOrBitmap.width) {
        bmp = fileOrBitmap;
      } else {
        return result('invalid', null, { error: 'Forneça File/Image/Blob de imagem.' });
      }
      const out = {
        name, sizeBytes, sizeHuman: sizeBytes ? `${(sizeBytes / 1024).toFixed(1)} KB` : null,
        width: bmp.width, height: bmp.height, pixels: bmp.width * bmp.height,
        state: 'analyzed'
      };
      if (bmp.close) bmp.close();
      return result('analyzed', out);
    } catch (err) {
      return result('failed', null, { error: `probeImage: ${err?.message || err}` });
    }
  }

  /** sonda real de vídeo via elemento <video> (duração/resolução; fps estimado quando suportado) */
  async function probeVideo(file) {
    if (typeof document === 'undefined') return result('unavailable', null, { error: 'probeVideo requer navegador.' });
    if (!file || typeof file !== 'object') return result('invalid', null, { error: 'Forneça um arquivo .mp4.' });
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      const done = (payload) => { URL.revokeObjectURL(url); v.removeAttribute('src'); resolve(payload); };
      const timer = setTimeout(() => done(result('failed', null, { error: 'Sonda de vídeo expirou (formato não suportado pelo navegador).' })), 8000);
      v.onloadedmetadata = () => {
        clearTimeout(timer);
        const out = {
          name: file.name, sizeBytes: file.size, sizeHuman: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          durationS: Number.isFinite(v.duration) ? +v.duration.toFixed(2) : null,
          width: v.videoWidth, height: v.videoHeight,
          fpsEstimado: null,
          state: 'analyzed',
          nota: 'fps exato exige decodificação completa (WebCodecs); use o plano para especificar o pipeline.'
        };
        done(result('analyzed', out));
      };
      v.onerror = () => { clearTimeout(timer); done(result('failed', null, { error: 'Erro ao abrir vídeo (codec não suportado).' })); };
      v.src = url;
    });
  }

  return { list, plan, frameBudget, probeImage, probeVideo, validateParams };
}
