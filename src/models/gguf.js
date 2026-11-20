/**
 * FGUA v2 — parser GGUF no cliente (header + metadados KV + tensor infos).
 * Especificação: magic u32 (0x46554747), version u32, n_tensors u64, n_kv u64;
 * gguf_str = u64 n (u32 na v1) + bytes UTF-8 sem terminador;
 * tipos 0..12 (u8,i8,u16,i16,u32,i32,f32,bool,str,arr,u64,i64,f64);
 * array = type u32 + n (u64 na v2+; u32 na v1) + elementos;
 * tensor info = name str, n_dims u32, ne[4] u64, type u32, offset u64.
 * Apenas LEITURA/ANÁLISE — nunca executa inferência nem converte nada.
 */

const GGUF_MAGIC = 0x46554747; // bytes "GGUF" little-endian
const DEFAULT_ALIGNMENT = 32;
const MAX_HEADER_BYTES = 32 * 1024 * 1024; // orçamento do header (32 MB)

const VALUE_SIZES = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };

const GGML_TYPES = {
  0: { label: 'F32', bpw: 32 }, 1: { label: 'F16', bpw: 16 }, 2: { label: 'Q4_0', bpw: 4.5 },
  3: { label: 'Q4_1', bpw: 5.0 }, 6: { label: 'Q5_0', bpw: 5.5 }, 7: { label: 'Q5_1', bpw: 6.0 },
  8: { label: 'Q8_0', bpw: 8.5 }, 9: { label: 'Q8_1', bpw: 9.5 }, 10: { label: 'Q2_K', bpw: 2.7 },
  11: { label: 'Q3_K_S', bpw: 3.5 }, 12: { label: 'Q3_K_M', bpw: 3.9 }, 13: { label: 'Q3_K_L', bpw: 4.3 },
  14: { label: 'Q4_K_S', bpw: 4.6 }, 15: { label: 'Q4_K_M', bpw: 4.85 }, 16: { label: 'Q5_K_S', bpw: 5.4 },
  17: { label: 'Q5_K_M', bpw: 5.7 }, 18: { label: 'Q6_K', bpw: 6.6 }, 19: { label: 'IQ2_XXS', bpw: 2.1 },
  20: { label: 'IQ2_XS', bpw: 2.3 }, 21: { label: 'Q2_K_S', bpw: 2.6 }, 22: { label: 'IQ3_XS', bpw: 3.3 },
  23: { label: 'IQ3_XXS', bpw: 3.1 }, 24: { label: 'IQ1_S', bpw: 1.6 }, 25: { label: 'IQ4_NL', bpw: 4.5 },
  26: { label: 'IQ3_S', bpw: 3.44 }, 27: { label: 'IQ3_M', bpw: 3.66 }, 28: { label: 'IQ2_S', bpw: 2.5 },
  29: { label: 'IQ2_M', bpw: 2.7 }, 30: { label: 'IQ4_XS', bpw: 4.25 }, 31: { label: 'IQ1_M', bpw: 1.75 },
  32: { label: 'BF16', bpw: 16 }
};

const FILE_TYPES = {
  0: 'F32', 1: 'F16', 2: 'Q4_0', 3: 'Q4_1', 7: 'Q8_0', 8: 'Q5_0', 9: 'Q5_1',
  10: 'Q2_K', 11: 'Q3_K_S', 12: 'Q3_K_M', 13: 'Q3_K_L', 14: 'Q4_K_S', 15: 'Q4_K_M',
  16: 'Q5_K_S', 17: 'Q5_K_M', 18: 'Q6_K', 19: 'IQ2_XXS', 20: 'IQ2_XS', 21: 'Q2_K_S',
  22: 'IQ3_XS', 23: 'IQ3_XXS', 24: 'IQ1_S', 25: 'IQ4_NL', 26: 'IQ3_S', 27: 'IQ3_M',
  28: 'IQ2_S', 29: 'IQ2_M', 30: 'IQ4_XS', 31: 'IQ1_M', 32: 'BF16'
};

export const NEED_MORE = Symbol('gguf:need-more');

class ByteReader {
  constructor(buffer, version = 3) {
    this.view = new DataView(buffer);
    this.u8 = new Uint8Array(buffer);
    this.dec = new TextDecoder('utf-8');
    this.pos = 0;
    this.version = version;
  }
  ensure(n) { if (this.pos + n > this.u8.byteLength) throw NEED_MORE; }
  skip(n) { this.ensure(n); this.pos += n; }
  bytes(n) { this.ensure(n); const s = this.u8.slice(this.pos, this.pos + n); this.pos += n; return s; }
  readU8() { this.ensure(1); return this.view.getUint8(this.pos++); }
  readI8() { this.ensure(1); return this.view.getInt8(this.pos++); }
  readU16() { this.ensure(2); const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  readI16() { this.ensure(2); const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  readU32() { this.ensure(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  readI32() { this.ensure(4); const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  readF32() { this.ensure(4); const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  readF64() { this.ensure(8); const v = this.view.getFloat64(this.pos, true); this.pos += 8; return v; }
  readU64() { this.ensure(8); const v = this.view.getBigUint64(this.pos, true); this.pos += 8; return v; }
  readI64() { this.ensure(8); const v = this.view.getBigInt64(this.pos, true); this.pos += 8; return v; }
  /** u64 → Number quando seguro (JSON-safe), senão string */
  u64n(v) { return v <= 9007199254740991n ? Number(v) : v.toString(); }
  readLen() { return this.version < 2 ? this.readU32() : this.u64n(this.readU64()); }
  readString() {
    const len = this.readLen();
    if (typeof len !== 'number' || len < 0 || len > 64 * 1024 * 1024) throw new Error(`gguf: string com tamanho inválido (${len})`);
    const bytes = this.bytes(len);
    return this.dec.decode(bytes);
  }
}

function safeNumber(v) {
  if (typeof v === 'bigint') return v <= 9007199254740991n && v >= -9007199254740991n ? Number(v) : v.toString();
  return v;
}

function readValue(r, depth = 0) {
  const type = r.readU32();
  if (type === 8) return r.readString();
  if (type === 9) {
    if (depth > 2) throw new Error('gguf: array aninhado demais');
    const elemType = r.readU32();
    const count = r.readLen();
    if (typeof count !== 'number' || count < 0) throw new Error('gguf: array com contagem inválida');
    const truncate = count > 4096;
    const take = truncate ? 64 : count;
    const arr = [];
    if (elemType === 8) {
      for (let i = 0; i < take; i++) arr.push(r.readString());
      if (truncate) { for (let i = take; i < count; i++) r.skipStringFast(); }
    } else {
      const size = VALUE_SIZES[elemType];
      if (!size) throw new Error(`gguf: elemento de array inválido (tipo ${elemType})`);
      const total = size * count;
      if (truncate) {
        for (let i = 0; i < take; i++) arr.push(safeNumber(readScalar(r, elemType)));
        r.skip(total - size * take);
      } else {
        for (let i = 0; i < count; i++) arr.push(safeNumber(readScalar(r, elemType)));
      }
    }
    return truncate ? { truncated: true, length: count, sample: arr } : arr;
  }
  return safeNumber(readScalar(r, type));
}

function readScalar(r, type) {
  switch (type) {
    case 0: return r.readU8();
    case 1: return r.readI8();
    case 2: return r.readU16();
    case 3: return r.readI16();
    case 4: return r.readU32();
    case 5: return r.readI32();
    case 6: return r.readF32();
    case 7: return r.readU8() !== 0;
    case 10: return r.readU64();
    case 11: return r.readI64();
    case 12: return r.readF64();
    case 8: return r.readString();
    default: throw new Error(`gguf: tipo de valor inválido (${type})`);
  }
}

// atalho para pular strings dentro de arrays truncados
ByteReader.prototype.skipStringFast = function () {
  const len = this.readLen();
  if (typeof len !== 'number' || len < 0) throw new Error('gguf: string com tamanho inválido');
  this.skip(len);
};

function walkTensorInfos(r, count, { maxList = 400 } = {}) {
  const tensors = [];
  let estimatedWeights = 0;
  let estimatedBytes = 0;
  let unknownTypes = 0;
  for (let i = 0; i < count; i++) {
    const name = r.readString();
    const nDims = r.readU32();
    if (nDims === 0 || nDims > 4) throw new Error(`gguf: tensor "${name}" com n_dims inválido (${nDims})`);
    const dims = [];
    for (let d = 0; d < nDims; d++) dims.push(r.u64n(r.readU64()));
    const typeId = r.readU32();
    const offset = r.u64n(r.readU64());
    const t = GGML_TYPES[typeId];
    if (!t) unknownTypes++;
    const elems = dims.reduce((a, b) => a * b, 1);
    if (t && Number.isFinite(elems)) {
      estimatedWeights += elems;
      estimatedBytes += (elems * t.bpw) / 8;
    }
    if (tensors.length < maxList) tensors.push({ name, dims, type: t ? t.label : `tipo-${typeId}`, offset });
  }
  return { tensors, estimatedWeights, estimatedBytes, unknownTypes };
}

/** parse completo sobre um buffer já carregado (usado por testes Node) */
export function parseGGUFBuffer(buffer) {
  let r = new ByteReader(buffer, 3);
  r.ensure(24);
  const magic = r.readU32();
  if (magic !== GGUF_MAGIC) throw new Error('gguf: magic inválido — não é um arquivo GGUF');
  const version = r.readU32();
  if (version < 1 || version > 3) throw new Error(`gguf: versão não suportada (${version})`);
  r = new ByteReader(buffer, version);
  r.pos = 8;
  const tensorsCount = r.u64n(r.readU64());
  const kvCount = r.u64n(r.readU64());
  if (typeof tensorsCount !== 'number' || typeof kvCount !== 'number') throw new Error('gguf: contagens u64 fora de faixa');
  const kv = {};
  for (let i = 0; i < kvCount; i++) {
    const key = r.readString();
    if (!key) throw new Error('gguf: chave vazia nos metadados');
    kv[key] = readValue(r);
  }
  const tensorSection = walkTensorInfos(r, tensorsCount);
  const arch = kv['general.architecture'] ?? null;
  const fileType = typeof kv['general.file_type'] === 'number' ? FILE_TYPES[kv['general.file_type']] ?? `ftype-${kv['general.file_type']}` : null;
  const alignment = typeof kv['general.alignment'] === 'number' ? kv['general.alignment'] : DEFAULT_ALIGNMENT;
  return {
    magic: 'GGUF',
    version,
    tensorsCount,
    kvCount,
    kv,
    ...tensorSection,
    arch,
    fileTypeLabel: fileType ?? kv['general.quantization'] ?? null,
    alignment,
    headerBytes: r.pos
  };
}

/** parse progressivo de um Blob/File do navegador (lê só o header, nunca o corpo completo) */
export async function parseGGUFBlob(file, { maxHeaderBytes = MAX_HEADER_BYTES, onProgress = null } = {}) {
  if (!file || typeof file.slice !== 'function') throw new Error('gguf: entrada deve ser um arquivo .gguf');
  if (file.size < 24) throw new Error('gguf: arquivo muito pequeno para ser GGUF');
  let buffer = new ArrayBuffer(0);
  let chunk = Math.min(1024 * 1024, Math.max(64 * 1024, Math.ceil(file.size / 64)));
  for (let offset = 0; offset < maxHeaderBytes; offset += chunk) {
    const slice = file.slice(offset, Math.min(offset + chunk, file.size));
    const part = await slice.arrayBuffer();
    const merged = new Uint8Array(buffer.byteLength + part.byteLength);
    merged.set(new Uint8Array(buffer), 0);
    merged.set(new Uint8Array(part), buffer.byteLength);
    buffer = merged.buffer;
    if (onProgress) onProgress({ loaded: buffer.byteLength, fileBytes: file.size });
    try {
      const parsed = parseGGUFBuffer(buffer);
      parsed.fileSize = file.size;
      parsed.fileName = file.name;
      parsed.headerBytes = parsed.headerBytes;
      parsed.bodyBytes = Math.max(0, file.size - parsed.headerBytes);
      return parsed;
    } catch (err) {
      if (err === NEED_MORE) {
        if (offset + chunk >= file.size) {
          throw new Error('gguf: header incompleto — arquivo truncado ou corrompido');
        }
        continue; // precisa de mais bytes
      }
      throw err; // erro real de formato
    }
  }
  throw new Error(`gguf: header excede o limite de ${Math.round(maxHeaderBytes / 1024 / 1024)} MB`);
}

export function humanSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes, u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v.toFixed(v >= 100 || u === 0 ? 0 : 2)} ${units[u]}`;
}

export { GGML_TYPES, FILE_TYPES, DEFAULT_ALIGNMENT, MAX_HEADER_BYTES };
