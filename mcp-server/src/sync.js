import fs from 'node:fs';
import path from 'node:path';
import { DASHBOARD_URL, ROOT, VERSION, reaTransportConfig } from './config.js';
import { getCatalog } from './rea.js';
import { read } from './store.js';

const OUT_FILE = path.join(ROOT, 'dashboard', 'data', 'snapshot.json');

const db = read();
let reaTools = [];
let reaCommand = '';
let reaError = null;
try {
  reaCommand = reaTransportConfig().command.join(' ');
  const catalog = await Promise.race([
    getCatalog({ limit: 200 }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout ao consultar catálogo REA (10s)')), 10_000)),
  ]);
  reaTools = catalog.tools.map(({ name, description }) => ({ name, description }));
} catch (error) {
  reaError = error?.message || String(error);
}

const snapshot = {
  version: VERSION,
  generatedAt: new Date().toISOString(),
  dashboard: DASHBOARD_URL,
  reaCommand,
  reaError,
  presets: db.presets || [],
  prompts: db.prompts || [],
  jobs: (db.jobs || []).map(({ id, type, status, createdAt }) => ({ id, type, status, createdAt })),
  reaTools,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`[FGUA] snapshot: ${OUT_FILE}`);
console.log(`[FGUA] presets=${snapshot.presets.length} prompts=${snapshot.prompts.length} reaTools=${reaTools.length}`);
if (reaError) console.log(`[FGUA] REA indisponível na sincronização: ${reaError}`);
process.exit(0);
