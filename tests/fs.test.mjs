/**
 * FGUA v2 — testes do sistema de arquivos virtual (IndexedDB/memória).
 */

import assert from 'node:assert/strict';
import { createVFS } from '../src/storage/fs.js';

export async function test() {
  const vfs = createVFS();
  await vfs.seed();

  const seed = await vfs.ls('/');
  assert.ok(seed.data.children.length >= 5, 'pastas semeadas');
  assert.ok(seed.data.children.some(c => c.name === 'Documentos'));

  await vfs.mkdir('/Projetos/frame-gen');
  await vfs.writeFile('/Projetos/frame-gen/notas.md', '# Plano\n- 60→120fps');
  const read = await vfs.readFile('/Projetos/frame-gen/notas.md');
  assert.equal(read.data, '# Plano\n- 60→120fps');

  const ls = await vfs.ls('/Projetos/frame-gen');
  assert.equal(ls.data.children[0].name, 'notas.md');

  await vfs.rename('/Projetos/frame-gen/notas.md', 'plano.md');
  const exists = await vfs.exists('/Projetos/frame-gen/plano.md');
  assert.ok(exists, 'renomeado');

  await vfs.remove('/Projetos/frame-gen');
  const gone = await vfs.exists('/Projetos/frame-gen');
  assert.ok(!gone, 'removido recursivamente');

  const missing = await vfs.readFile('/nao/existe.txt');
  assert.equal(missing.state, 'invalid');

  return `VFS OK: seed, mkdir/write/read, rename, remove recursivo`;
}

export default { test };
