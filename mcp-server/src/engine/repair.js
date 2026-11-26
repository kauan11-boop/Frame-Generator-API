import fs from 'node:fs';
import path from 'node:path';
import { MAX_ITERATIONS, REPORTS_DIR, ensureDirs } from '../config.js';
import { chat, extractCode } from '../llm.js';
import { runCode, supportedLanguages } from '../sandbox.js';
import { createJob, getPreset, getPrompt, uid, updateJob } from '../store.js';

function buildUserPrompt({ code, instruction, tests, language, targetLanguage, lastRun, motive }) {
  const parts = [
    `Linguagem de entrada: ${language}`,
    `Linguagem de saída: ${targetLanguage}`,
    instruction ? `Instrução: ${instruction}` : '',
    tests ? `Testes de aceitação (devem passar):\n\`\`\`\n${tests}\n\`\`\`` : 'Testes de aceitação: nenhum fornecido.',
    `Código atual:\n\`\`\`\n${code}\n\`\`\``,
  ];
  if (lastRun) {
    parts.push(`Resultado da última execução real: exit=${lastRun.exitCode}, passed=${lastRun.passed}`);
    if (lastRun.stderr) parts.push(`stderr:\n${lastRun.stderr.slice(0, 4000)}`);
    if (lastRun.stdout) parts.push(`stdout:\n${lastRun.stdout.slice(0, 2000)}`);
    if (motive) parts.push(`Motivo declarado na tentativa anterior: ${motive}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

export async function improveCode({
  code,
  language,
  targetLanguage,
  instruction = '',
  tests = '',
  preset,
  mode = 'repair',
  maxIterations,
  outputPath,
  ...llmOverrides
}) {
  if (typeof code !== 'string' || !code.trim()) throw new Error('code é obrigatório');
  const from = language || 'javascript';
  const to = targetLanguage || from;
  const isTranspile = mode === 'transpile';

  const presetId = preset || (isTranspile ? 'transpile-preserving-tests' : 'repair-fast');
  const selected = getPreset(presetId);
  if (!selected || selected.kind !== (isTranspile ? 'transpile' : 'repair')) {
    throw new Error(`Preset inválido para ${mode}: ${presetId}`);
  }
  const cfg = selected.config || {};
  const limit = Math.min(Math.max(Number(maxIterations || cfg.maxIterations || MAX_ITERATIONS), 1), 12);
  const system = getPrompt(isTranspile ? 'transpile-system' : 'repair-system')?.body || '';
  const runnable = supportedLanguages().includes(to) && Boolean(tests);

  const job = await createJob({
    id: uid('job'),
    type: mode,
    status: 'running',
    sourceLanguage: from,
    targetLanguage: to,
    preset: presetId,
    iterations: [],
  });

  const history = [];
  let status = 'max-iterations';
  let currentCode = code;
  let lastRun = null;
  let motive = '';

  for (let i = 1; i <= limit; i += 1) {
    const user = buildUserPrompt({ code: currentCode, instruction, tests, language: from, targetLanguage: to, lastRun, motive });
    const answer = await chat({
      system,
      user,
      temperature: Number(cfg.temperature ?? 0.2),
      ...llmOverrides,
    });
    if (!answer.ok) {
      status = answer.reason || 'failed';
      history.push({ iteration: i, status, error: answer.error || answer.reason });
      break;
    }

    const extracted = extractCode(answer.text);
    if (!extracted.code) {
      status = 'empty-response';
      history.push({ iteration: i, status, error: 'Modelo não retornou código' });
      break;
    }
    currentCode = extracted.code;
    motive = extracted.motive;

    const run = runnable
      ? await runCode({ code: currentCode, language: to, tests })
      : { passed: null, reward: null, exitCode: null, stdout: '', stderr: 'execução de testes indisponível para esta linguagem ou sem testes', reason: 'requires-runtime' };
    lastRun = run;
    history.push({
      iteration: i,
      model: answer.model,
      motive,
      code: currentCode,
      reward: run.reward,
      run: {
        passed: run.passed,
        exitCode: run.exitCode,
        reason: run.reason || null,
        stdout: (run.stdout || '').slice(0, 4000),
        stderr: (run.stderr || '').slice(0, 4000),
        durationMs: run.durationMs || null,
      },
    });

    if (run.passed && cfg.stopOnPass !== false) { status = 'succeeded'; break; }
    if (!runnable) { status = 'requires-runtime'; break; }
  }

  const passing = history.find((h) => h.run?.passed === true);
  const best = passing || history.filter((h) => typeof h.code === 'string').at(-1) || { code, motive: '' };
  let finalPath = null;
  if (outputPath) {
    finalPath = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fs.writeFileSync(finalPath, best.code, 'utf8');
  } else {
    ensureDirs();
    finalPath = path.join(REPORTS_DIR, `${job.id}-${mode}-candidate.${extensionFor(to)}`);
    fs.writeFileSync(finalPath, best.code, 'utf8');
  }

  const result = {
    jobId: job.id,
    status,
    mode,
    preset: presetId,
    sourceLanguage: from,
    targetLanguage: to,
    iterations: history.length,
    reward: passing ? 1 : (best.reward ?? 0),
    testsExecuted: runnable,
    outputPath: finalPath,
    code: best.code,
    motive: best.motive || '',
    history: history.map(({ code: _code, ...meta }) => meta),
  };
  await updateJob(job.id, { status, result, iterations: history });
  return result;
}

function extensionFor(language) {
  return { javascript: 'mjs', typescript: 'ts', python: 'py', cpp: 'cpp', csharp: 'cs', c: 'c' }[language] || 'txt';
}
