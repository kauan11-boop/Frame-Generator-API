/**
 * FGUA v2 — testes do parser GGUF (buffer sintético conforme spec).
 */

import assert from 'node:assert/strict';
import { parseGGUFBuffer, humanSize } from '../src/models/gguf.js';

function buildGGUF({ version = 3, kv = {}, tensors = [] } = {}) {
  const chunks = [];
  const wU32 = v => { const b = new ArrayBuffer(4); new DataView(b).setUint32(0, v, true); chunks.push(b); };
  const wU64 = v => { const b = new ArrayBuffer(8); new DataView(b).setBigUint64(0, BigInt(v), true); chunks.push(b); };
  const wF32 = v => { const b = new ArrayBuffer(4); new DataView(b).setFloat32(0, v, true); chunks.push(b); };
  const wBytes = b => chunks.push(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const wU8 = v => { const b = new ArrayBuffer(1); new DataView(b).setUint8(0, v); chunks.push(b); };
  const wStr = s => {
    const bytes = new TextEncoder().encode(s);
    if (version < 2) wU32(bytes.length); else wU64(bytes.length); // v1: u32; v2+: u64
    wBytes(bytes);
  };

  wU32(0x46554747);          // magic "GGUF"
  wU32(version);             // versão
  wU64(tensors.length);      // n_tensors
  wU64(Object.keys(kv).length); // n_kv
  for (const [key, [type, value]] of Object.entries(kv)) {
    wStr(key);
    wU32(type);
    if (type === 8) wStr(value);          // string
    else if (type === 4) wU32(value);     // u32
    else if (type === 6) wF32(value);     // f32
    else if (type === 10) wU64(value);    // u64
    else if (type === 7) wU8(value ? 1 : 0); // bool (1 byte)
    else if (type === 9) {                // array de strings
      wU32(8);
      if (version < 2) wU32(value.length); else wU64(value.length);
      for (const s of value) wStr(s);
    } else throw new Error('tipo não implementado no gerador de teste');
  }
  for (const t of tensors) {
    wStr(t.name);
    wU32(t.dims.length);
    for (const d of t.dims) wU64(d);
    wU32(t.type);
    wU64(t.offset ?? 0);
  }
  const total = chunks.reduce((a, b) => a + b.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(new Uint8Array(c), off); off += c.byteLength; }
  return out.buffer;
}

export async function test() {
  // 1) parse válido
  const buf = buildGGUF({
    version: 3,
    kv: {
      'general.architecture': [8, 'llama'],
      'general.name': [8, 'Modelo de Teste'],
      'general.file_type': [4, 15],          // Q4_K_M
      'general.alignment': [4, 32],
      'llama.context_length': [4, 8192],
      'general.tags': [9, ['teste', 'sintetico']],
      'general.flag': [7, 1]
    },
    tensors: [
      { name: 'blk.0.attn_q.weight', dims: [256, 512], type: 15, offset: 0 },
      { name: 'blk.0.attn_v.weight', dims: [256, 512], type: 0, offset: 0 }
    ]
  });
  const g = parseGGUFBuffer(buf);
  assert.equal(g.magic, 'GGUF');
  assert.equal(g.version, 3);
  assert.equal(g.arch, 'llama');
  assert.equal(g.fileTypeLabel, 'Q4_K_M');
  assert.equal(g.tensorsCount, 2);
  assert.equal(g.kvCount, 7);
  assert.equal(g.alignment, 32);
  assert.equal(g.kv['llama.context_length'], 8192);
  assert.deepEqual(g.kv['general.tags'], ['teste', 'sintetico']);
  assert.equal(g.kv['general.flag'], true);
  assert.deepEqual(g.tensors[0].dims, [256, 512]);
  assert.equal(g.tensors[0].type, 'Q4_K_M');
  // 256*512 pesos Q4_K_M ≈ 4.85 bpw + 256*512 F32 = 32 bpw
  const expected = (256 * 512 * 4.85) / 8 + (256 * 512 * 32) / 8;
  assert.ok(Math.abs(g.estimatedBytes - expected) < 1, 'estimativa de bytes de tensores');
  assert.equal(g.estimatedWeights, 262144);
  assert.ok(g.headerBytes > 0 && humanSize(g.headerBytes).includes('B'));

  // 2) v1 usa tamanhos u32 para strings — deve parsear também
  const bufV1 = buildGGUF({ version: 1, kv: { 'general.name': [8, 'v1-model'] }, tensors: [] });
  const g1 = parseGGUFBuffer(bufV1);
  assert.equal(g1.version, 1);
  assert.equal(g1.kv['general.name'], 'v1-model');

  // 3) magic inválido → erro claro
  const bad = new ArrayBuffer(64);
  assert.throws(() => parseGGUFBuffer(bad), /magic inválido/);

  // 4) header truncado → NEED_MORE tratado (parseGGUFBuffer lança symbol? não: ensure lança NEED_MORE symbol)
  const partial = buf.slice(0, 12);
  assert.throws(() => parseGGUFBuffer(partial), (e) => typeof e === 'symbol');

  return `parser GGUF OK: v3/v1, Q4_K_M detectado, ${g.tensorsCount} tensores, estimativa ${(g.estimatedBytes / 1024).toFixed(1)} KB`;
}

export default { test };
