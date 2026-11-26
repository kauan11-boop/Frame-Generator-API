import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..', '..');
export const SERVER_DIR = path.join(ROOT, 'mcp-server');
export const VERSION = '3.0.0';
export const DASHBOARD_URL = 'https://kauan11-boop.github.io/Frame-Generator-API/';

export const DATA_DIR = path.resolve(process.env.FGUA_DATA_DIR || path.join(ROOT, '.frame-data'));
export const STORE_FILE = path.join(DATA_DIR, 'store.json');
export const REPORTS_DIR = path.join(DATA_DIR, 'reports');
export const WORK_DIR = path.join(DATA_DIR, 'work');
export const DEFAULTS_FILE = path.join(ROOT, 'config', 'defaults.json');

export const LM_STUDIO_URL = (process.env.FGUA_LM_URL || 'http://localhost:1234/v1').replace(/\/+$/, '');
export const LM_MODEL = process.env.FGUA_LM_MODEL || '';
export const LM_TIMEOUT_MS = Number(process.env.FGUA_LM_TIMEOUT_MS || 60000);

export const BRIDGE_PORT = Number(process.env.FGUA_BRIDGE_PORT || 4174);
export const BRIDGE_HOST = process.env.FGUA_BRIDGE_HOST || '127.0.0.1';

export const MAX_ITERATIONS = Math.min(Number(process.env.FGUA_MAX_ITERATIONS || 4), 12);
export const MAX_OUTPUT_BYTES = 200_000;
export const RUN_TIMEOUT_MS = Math.min(Number(process.env.FGUA_RUN_TIMEOUT_MS || 10000), 120000);

function readOpenCodeConfig() {
  const candidates = [
    process.env.OPENCODE_CONFIG,
    path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
    path.join(os.homedir(), '.opencode', 'config.json'),
  ].filter(Boolean);
  for (const file of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed?.mcp?.rea?.command) {
        return { command: parsed.mcp.rea.command, environment: parsed.mcp.rea.environment || {}, source: file };
      }
    } catch {
      // config ausente ou inválido: tenta o próximo candidato
    }
  }
  return null;
}

export function reaTransportConfig() {
  if (process.env.FGUA_REA_COMMAND) {
    try {
      const command = JSON.parse(process.env.FGUA_REA_COMMAND);
      if (Array.isArray(command) && command.length) {
        return { command, environment: {}, source: 'FGUA_REA_COMMAND' };
      }
    } catch {
      throw new Error('FGUA_REA_COMMAND deve ser um array JSON, ex.: ["node","rea.mjs","mcp"]');
    }
  }
  const found = readOpenCodeConfig();
  if (found) return found;
  return { command: ['npx', 'rea-agents', 'mcp'], environment: {}, source: 'default' };
}

export function ensureDirs() {
  for (const dir of [DATA_DIR, REPORTS_DIR, WORK_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
