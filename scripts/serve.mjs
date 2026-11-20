/**
 * FGUA v2 — servidor de desenvolvimento estático (porta 4173).
 * Uso: node scripts/serve.mjs  →  http://localhost:4173
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PORT = Number(process.env.PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const full = normalize(join(ROOT, path));
    if (!full.startsWith(ROOT)) {
      res.writeHead(403).end('Proibido');
      return;
    }
    const data = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Cross-Origin-Opener-Policy': 'same-origin'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 — não encontrado: verifique o caminho.');
  }
});

server.listen(PORT, () => {
  console.log(`FGUA v2 servindo em http://localhost:${PORT}`);
  console.log(`  Área de trabalho: http://localhost:${PORT}/Public/desktop/index.html`);
  console.log(`  Dashboard:        http://localhost:${PORT}/Public/dashboard.html`);
});
