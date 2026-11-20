#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
function resolveRoot() {
  const cwd = process.cwd();
  const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const fromScript = path.resolve(scriptDir, '..');
  if (fs.existsSync(path.join(fromScript, 'api/v1/index.json'))) return fromScript;
  if (fs.existsSync(path.join(cwd, 'src/api/v1/index.json'))) return path.join(cwd, 'src');
  if (fs.existsSync(path.join(cwd, 'api/v1/index.json'))) return cwd;
  return cwd;
}
const ROOT = resolveRoot();
const files = [
  'api/v1/index.json','api/v1/system/status.json','api/v1/models/index.json','api/v1/frames/index.json',
  'api/v1/frames/templates.json','api/v1/packages/index.json','api/v1/commands/index.json','api/v1/repack/index.json',
  'api/v1/adapters/index.json','api/v1/prompts/integration.json','api/v1/content/index.json',
  'schemas/command.schema.json','schemas/response.schema.json','schemas/frame-job.schema.json'
];
let ok = true;
for (const f of files) {
  const p = path.join(ROOT,f);
  try {
    const j = JSON.parse(fs.readFileSync(p,'utf8'));
    if (f.startsWith('api/v1/') && !f.includes('schemas')) {
      if (!j.version) { console.error('missing version:', f); ok=false; }
      if (!j.updated_at && !j.generated_at && !j.status) { /* allow */ }
    }
    console.log('OK', f);
  } catch(e){ console.error('FAIL', f, e.message); ok=false; }
}
process.exit(ok?0:1);
