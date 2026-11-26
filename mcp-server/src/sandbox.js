import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_OUTPUT_BYTES, RUN_TIMEOUT_MS, WORK_DIR, ensureDirs } from './config.js';

const RUNNERS = {
  javascript: { ext: 'mjs', command: 'node', args: ['--experimental-permission'] },
  typescript: { ext: 'ts', command: 'node', args: ['--experimental-permission'] },
  python: { ext: 'py', command: 'python', args: ['-I'] },
};

export function supportedLanguages() {
  return Object.keys(RUNNERS);
}

export async function runCode({ code, language = 'javascript', tests = '', timeoutMs = RUN_TIMEOUT_MS }) {
  const runner = RUNNERS[language];
  if (!runner) throw new Error(`Linguagem não executável: ${language}. Suportadas: ${supportedLanguages().join(', ')}`);
  if (typeof code !== 'string' || !code.trim()) throw new Error('code é obrigatório');

  ensureDirs();
  const workDir = fs.mkdtempSync(path.join(WORK_DIR, `run-${language}-`));
  const file = path.join(workDir, `solution.${runner.ext}`);
  const source = `${code}\n\n${String(tests || '')}\n`;
  fs.writeFileSync(file, source, 'utf8');

  const allow = `--allow-fs-read=${workDir}`;
  const allowWrite = `--allow-fs-write=${workDir}`;
  const args = language === 'python'
    ? [...runner.args, file]
    : [...runner.args, allow, allowWrite, file];
  const env = language === 'python'
    ? { PATH: process.env.PATH || '', PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8' }
    : { PATH: process.env.PATH || '', NODE_NO_WARNINGS: '1' };

  const started = Date.now();
  const result = await new Promise((resolve) => {
    const child = spawn(runner.command, args, { cwd: workDir, env, windowsHide: true });
    let bytes = 0;
    let truncated = false;
    const append = (target, chunk) => {
      const text = String(chunk);
      if (bytes + text.length > MAX_OUTPUT_BYTES) { truncated = true; return; }
      bytes += text.length;
      target.push(text);
    };
    const outParts = [];
    const errParts = [];
    child.stdout.on('data', (chunk) => append(outParts, chunk));
    child.stderr.on('data', (chunk) => append(errParts, chunk));
    const timer = setTimeout(() => child.kill('SIGKILL'), Math.min(timeoutMs, 120000));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: -1, signal: null, stderr: error.message });
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        stdout: outParts.join('').slice(0, MAX_OUTPUT_BYTES),
        stderr: errParts.join('').slice(0, MAX_OUTPUT_BYTES),
      });
    });
  });

  const durationMs = Date.now() - started;
  const passed = result.exitCode === 0 && !result.signal;
  if (!process.env.FGUA_KEEP_WORK) fs.rmSync(workDir, { recursive: true, force: true });

  return {
    ok: passed,
    passed,
    reward: passed ? 1 : 0,
    language,
    exitCode: result.exitCode,
    signal: result.signal,
    durationMs,
    truncated,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    command: `${runner.command} ${args.join(' ')}`,
    workDir: process.env.FGUA_KEEP_WORK ? workDir : null,
  };
}
