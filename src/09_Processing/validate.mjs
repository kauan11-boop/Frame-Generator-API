#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
function resolveRoot() {
  const cwd = process.cwd();
  const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const fromScript = path.resolve(scriptDir, '..'); // src/
  if (fs.existsSync(path.join(fromScript, '03_API/v1/index.json'))) return fromScript;
  if (fs.existsSync(path.join(cwd, 'src/03_API/v1/index.json'))) return path.join(cwd, 'src');
  if (fs.existsSync(path.join(cwd, '03_API/v1/index.json'))) return cwd;
  // fallback legado
  if (fs.existsSync(path.join(fromScript, 'api/v1/index.json'))) return fromScript;
  if (fs.existsSync(path.join(cwd, 'src/api/v1/index.json'))) return path.join(cwd, 'src');
  return cwd;
}
const ROOT = resolveRoot();
const API_V1 = '03_API/v1';
const SCHEMAS = '12_Validation';
const files = [
  `${API_V1}/index.json`,`${API_V1}/system/status.json`,`${API_V1}/models/index.json`,`${API_V1}/frames/index.json`,
  `${API_V1}/frames/templates.json`,`${API_V1}/packages/index.json`,`${API_V1}/commands/index.json`,`${API_V1}/repack/index.json`,
  `${API_V1}/adapters/index.json`,`${API_V1}/prompts/integration.json`,`${API_V1}/content/index.json`,
  `${SCHEMAS}/command.schema.json`,`${SCHEMAS}/response.schema.json`,`${SCHEMAS}/frame-job.schema.json`
];
let ok = true;
for (const f of files) {
  const p = path.join(ROOT,f);
  try {
    const j = JSON.parse(fs.readFileSync(p,'utf8'));
    if (f.startsWith(API_V1 + '/') && !f.includes(SCHEMAS)) {
      if (!j.version) { console.error('missing version:', f); ok=false; }
      if (!j.updated_at && !j.generated_at && !j.status) { /* allow */ }
    }
    console.log('OK', f);
  } catch(e){ console.error('FAIL', f, e.message); ok=false; }
}
process.exit(ok?0:1);
