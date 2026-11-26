import fs from 'node:fs';
import path from 'node:path';
import { REPORTS_DIR, ensureDirs } from '../config.js';
import { callTool } from '../rea.js';
import { createJob, getPreset, uid, updateJob } from '../store.js';

const STEP_BUILDERS = {
  open_binary: (ctx) => ({ path: ctx.path }),
  inspect_artifact: (ctx) => ({ detail: ctx.detail }),
  list_procedures: () => ({ detail: 'summary' }),
  list_strings: () => ({ detail: 'summary' }),
  list_names: () => ({ detail: 'summary' }),
  inspect_wasm_artifact: (ctx) => ({ path: ctx.path }),
  inspect_binary_layout: (ctx) => ({ path: ctx.path, detail: 'summary' }),
  inspect_model_artifact: (ctx) => ({ path: ctx.path, detail: 'summary', hash: 'header' }),
  binary_overview: () => ({}),
};

function display(value, max = 8000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n… [truncado]` : text;
}

function buildReport({ ctx, results, reportPath }) {
  const lines = [
    '# Relatório de engenharia reversa — FGUA',
    '',
    `- Arquivo: \`${ctx.path}\``,
    `- Tamanho: ${ctx.size} bytes`,
    `- SHA-256: ${ctx.sha256}`,
    `- Preset: ${ctx.preset}`,
    `- Gerado em: ${new Date().toISOString()}`,
    '',
    '## Fatos observados',
    '',
  ];
  for (const step of results) {
    lines.push(`### \`${step.tool}\` — ${step.status}`);
    lines.push('');
    lines.push(step.error ? `Erro: ${step.error}` : `\`\`\`json\n${display(step.result?.data ?? step.result?.text)}\n\`\`\``);
    if (step.evidenceIds?.length) lines.push('', `Evidências: ${step.evidenceIds.join(', ')}`);
    lines.push('');
  }
  const evidence = [...new Set(results.flatMap((r) => r.evidenceIds || []))];
  lines.push('## Evidências', '', evidence.length ? evidence.join('\n') : 'Nenhuma Evidence ID coletada.', '');
  lines.push('## Inferências', '', 'Nenhuma inferência automática. Interprete os fatos acima.', '');
  lines.push('## Perguntas em aberto', '', '- A sessão do REA permanece aberta para análise aprofundada.', '');
  if (reportPath) lines.push('', `Relatório: \`${reportPath}\``);
  return lines.join('\n');
}

export async function reverseFile({ path: inputPath, outputDir, preset, steps }) {
  if (!inputPath || typeof inputPath !== 'string') throw new Error('path é obrigatório');
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) throw new Error(`Arquivo não encontrado: ${resolved}`);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`Não é um arquivo: ${resolved}`);

  let presetId = preset || (resolved.toLowerCase().endsWith('.wasm') ? 'reverse-wasm' : 'reverse-binary');
  const selectedPreset = getPreset(presetId);
  if (!selectedPreset || selectedPreset.kind !== 'reverse') throw new Error(`Preset de RE inválido: ${presetId}`);

  const crypto = await import('node:crypto');
  const ctx = {
    path: resolved,
    size: stat.size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex'),
    preset: presetId,
    detail: selectedPreset.config?.detail || 'summary',
  };
  const selectedSteps = Array.isArray(steps) && steps.length ? steps : selectedPreset.config?.steps || [];
  if (!selectedSteps.length) throw new Error('Preset sem etapas configuradas');

  const job = await createJob({
    id: uid('job'),
    type: 'reverse',
    status: 'running',
    source: resolved,
    preset: presetId,
    steps: [],
  });

  const results = [];
  for (const tool of selectedSteps) {
    const build = STEP_BUILDERS[tool];
    if (!build) {
      results.push({ tool, status: 'skipped', error: `Etapa não mapeada no FGUA: ${tool}` });
      continue;
    }
    try {
      const result = await callTool(tool, build(ctx));
      results.push({
        tool,
        status: result.isError ? 'failed' : 'ok',
        result,
        evidenceIds: result.evidenceIds,
        error: result.isError ? result.text : null,
      });
    } catch (error) {
      results.push({ tool, status: 'failed', error: error?.message || String(error), evidenceIds: [] });
    }
  }

  ensureDirs();
  const targetDir = path.resolve(outputDir || REPORTS_DIR);
  fs.mkdirSync(targetDir, { recursive: true });
  const reportPath = path.join(targetDir, `${job.id}-reverse.md`);
  const jsonPath = path.join(targetDir, `${job.id}-reverse.json`);
  const evidenceIds = [...new Set(results.flatMap((r) => r.evidenceIds || []))];
  fs.writeFileSync(reportPath, buildReport({ ctx, results, reportPath }), 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify({ job: job.id, ctx, results }, null, 2), 'utf8');

  const status = results.some((r) => r.status === 'ok') ? 'succeeded' : 'failed';
  await updateJob(job.id, { status, reportPath, jsonPath, evidenceIds, steps: results.map(({ tool, status: s, error }) => ({ tool, status: s, error })) });

  return {
    jobId: job.id,
    status,
    source: resolved,
    preset: presetId,
    reportPath,
    jsonPath,
    evidenceIds,
    steps: results.map(({ tool, status: s, error }) => ({ tool, status: s, error })),
  };
}

export const reverseSteps = Object.keys(STEP_BUILDERS);
