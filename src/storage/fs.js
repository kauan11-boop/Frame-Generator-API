/**
 * FGUA v2 — sistema de arquivos virtual sobre IndexedDB (com fallback em memória).
 * Alimenta o Explorador de Arquivos do shell. Suporta textos e Blobs.
 */

const DB_NAME = 'fgua-fs';
const STORE = 'files';
let dbPromise = null;
const memory = new Map(); // fallback: path -> entry

function idb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'path' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

async function tx(mode) {
  const db = await idb();
  if (!db) return null;
  return db.transaction(STORE, mode).objectStore(STORE);
}

function reqAsPromise(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

function normalize(p) {
  const parts = String(p).split('/').filter(Boolean);
  return '/' + parts.join('/');
}

function parentOf(p) {
  const n = normalize(p);
  if (n === '/') return null;
  return n.slice(0, n.lastIndexOf('/')) || '/';
}

function nameOf(p) {
  const n = normalize(p);
  return n === '/' ? '' : n.slice(n.lastIndexOf('/') + 1);
}

export function createVFS() {
  async function put(entry) {
    const s = await tx('readwrite');
    if (s) { await reqAsPromise(s.put(entry)); return; }
    memory.set(entry.path, entry);
  }
  async function getEntry(path) {
    const s = await tx('readonly');
    const n = normalize(path);
    if (s) { const v = await reqAsPromise(s.get(n)); return v ?? null; }
    return memory.get(n) ?? null;
  }
  async function del(path) {
    const s = await tx('readwrite');
    const n = normalize(path);
    if (s) await reqAsPromise(s.delete(n));
    else memory.delete(n);
  }
  async function allEntries() {
    const s = await tx('readonly');
    if (s) return await reqAsPromise(s.getAll()) ?? [];
    return [...memory.values()];
  }

  async function ensureDir(path) {
    const n = normalize(path);
    const e = await getEntry(n);
    if (e && e.type === 'dir') return n;
    await put({ path: n, type: 'dir', mtime: Date.now() });
    // garante pais
    const parent = parentOf(n);
    if (parent && parent !== '/') await ensureDir(parent);
    return n;
  }

  async function ls(path = '/') {
    const n = normalize(path);
    if (n !== '/') {
      const root = await getEntry(n);
      if (!root) return { ok: false, state: 'invalid', error: `Caminho não encontrado: ${n}` };
      if (root.type !== 'dir') return { ok: false, state: 'invalid', error: `Não é pasta: ${n}` };
    }
    const entries = await allEntries();
    const prefix = n === '/' ? '/' : n + '/';
    const children = entries
      .filter(e => e.path !== n && e.path.startsWith(prefix) && !e.path.slice(prefix.length).includes('/'))
      .map(e => ({ name: nameOf(e.path), type: e.type, size: e.size ?? null, mtime: e.mtime ?? null }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'pt-BR') : a.type === 'dir' ? -1 : 1));
    return { ok: true, state: 'ready', data: { path: n, children } };
  }

  async function mkdir(path) {
    await ensureDir(path);
    return { ok: true, state: 'succeeded', data: { path: normalize(path) } };
  }

  async function writeFile(path, content, meta = {}) {
    const n = normalize(path);
    const isBlob = typeof Blob !== 'undefined' && content instanceof Blob;
    const entry = {
      path: n, type: 'file',
      content: isBlob ? null : String(content),
      blob: isBlob ? content : null,
      size: isBlob ? content.size : content.length,
      mime: meta.mime ?? (isBlob ? (content.type || 'application/octet-stream') : 'text/plain'),
      mtime: Date.now(),
      meta
    };
    await ensureDir(parentOf(n) || '/');
    await put(entry);
    return { ok: true, state: 'succeeded', data: { path: n, size: entry.size } };
  }

  async function readFile(path, { asBlob = false } = {}) {
    const e = await getEntry(path);
    if (!e) return { ok: false, state: 'invalid', error: `Arquivo não encontrado: ${normalize(path)}` };
    if (e.type !== 'file') return { ok: false, state: 'invalid', error: 'Caminho é uma pasta.' };
    if (asBlob && e.blob) return { ok: true, state: 'ready', data: e.blob };
    return { ok: true, state: 'ready', data: e.blob ?? e.content, meta: { mime: e.mime, size: e.size, mtime: e.mtime, path: e.path } };
  }

  async function remove(path) {
    const n = normalize(path);
    const entries = await allEntries();
    const prefix = n + '/';
    for (const e of entries) {
      if (e.path === n || e.path.startsWith(prefix)) await del(e.path);
    }
    return { ok: true, state: 'succeeded', data: { removed: n } };
  }

  async function rename(oldPath, newName) {
    const e = await getEntry(oldPath);
    if (!e) return { ok: false, state: 'invalid', error: 'Caminho não encontrado.' };
    const parent = parentOf(e.path);
    const nPath = normalize(`${parent}/${newName}`);
    if (await getEntry(nPath)) return { ok: false, state: 'invalid', error: 'Já existe item com esse nome.' };
    // move subárvore
    const entries = await allEntries();
    const prefix = e.path + '/';
    for (const x of entries) {
      if (x.path === e.path) { await put({ ...x, path: nPath }); await del(x.path); }
      else if (x.path.startsWith(prefix)) {
        const np = normalize(nPath + x.path.slice(e.path.length));
        await put({ ...x, path: np }); await del(x.path);
      }
    }
    return { ok: true, state: 'succeeded', data: { path: nPath } };
  }

  async function exists(path) {
    return !!(await getEntry(path));
  }

  async function seed() {
    for (const d of ['/Documentos', '/Modelos', '/Projetos', '/Repacks', '/Downloads']) await ensureDir(d);
    if (!(await getEntry('/Documentos/Leia-me.txt'))) {
      await writeFile('/Documentos/Leia-me.txt',
        'Frame-Generator-API v2\n\nEste é o sistema de arquivos virtual do FGUA.\n' +
        '- Arraste arquivos .gguf para o Hub de Modelos para análise de metadados.\n' +
        '- Use o Explorador para organizar seus projetos.\n' +
        '- Nada aqui sai do seu navegador (IndexedDB local).\n');
    }
    if (!(await getEntry('/Repacks/exemplo.json'))) {
      await writeFile('/Repacks/exemplo.json', JSON.stringify({
        id: 'exemplo-local', name: 'Repack local de exemplo', tools: ['frames.budget', 'frames.plan']
      }, null, 2));
    }
  }

  return { ls, mkdir, writeFile, readFile, remove, rename, exists, seed, normalize };
}

export default { createVFS };
