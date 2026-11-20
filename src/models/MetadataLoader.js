// GGUF metadata/tensor parser (v2/v3) com verificações de limites.
// Observação: parsing é feito a partir de ArrayBuffer; para arquivos muito grandes, prefira análise parcial/externa.

const GGUF_MAGIC = 0x46554747; // "GGUF" LE
const VALUE_TYPES = { 0: 'UINT8', 1: 'INT8', 2: 'UINT16', 3: 'INT16', 4: 'UINT32', 5: 'INT32', 6: 'FLOAT32', 7: 'BOOL', 8: 'STRING', 9: 'ARRAY', 10: 'UINT64', 11: 'INT64', 12: 'FLOAT64' };
const TENSOR_TYPES = { 0: 'F32', 1: 'F16', 2: 'Q4_0', 3: 'Q4_1', 6: 'Q5_0', 7: 'Q5_1', 8: 'Q8_0', 9: 'Q8_1', 10: 'Q2_K', 11: 'Q3_K', 12: 'Q4_K', 13: 'Q5_K', 14: 'Q6_K', 15: 'Q8_K', 16: 'IQ2_XXS', 17: 'IQ2_XS', 18: 'IQ3_XXS', 19: 'IQ1_S', 20: 'IQ4_NL', 21: 'IQ3_S', 22: 'IQ2_S', 23: 'IQ4_XS', 24: 'I8', 25: 'I16', 26: 'I32', 27: 'I64', 28: 'F64', 29: 'IQ1_M', 30: 'BF16' };

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

class Reader {
  constructor(buffer) {
    this.dv = new DataView(buffer);
    this.buf = buffer;
    this.off = 0;
    this.le = true;
  }
  remaining() { return this.dv.byteLength - this.off; }
  ensure(n) { if (n < 0 || this.remaining() < n) throw new Error(`Leitura fora dos limites (need=${n}, remaining=${this.remaining()}, offset=${this.off})`); }
  u8() { this.ensure(1); const v = this.dv.getUint8(this.off); this.off += 1; return v; }
  i8() { this.ensure(1); const v = this.dv.getInt8(this.off); this.off += 1; return v; }
  u16() { this.ensure(2); const v = this.dv.getUint16(this.off, this.le); this.off += 2; return v; }
  i16() { this.ensure(2); const v = this.dv.getInt16(this.off, this.le); this.off += 2; return v; }
  u32() { this.ensure(4); const v = this.dv.getUint32(this.off, this.le); this.off += 4; return v; }
  i32() { this.ensure(4); const v = this.dv.getInt32(this.off, this.le); this.off += 4; return v; }
  f32() { this.ensure(4); const v = this.dv.getFloat32(this.off, this.le); this.off += 4; return v; }
  f64() { this.ensure(8); const v = this.dv.getFloat64(this.off, this.le); this.off += 8; return v; }
  bool() { return this.u8() !== 0; }
  u64() {
    this.ensure(8);
    const lo = this.dv.getUint32(this.off, this.le);
    const hi = this.dv.getUint32(this.off + 4, this.le);
    this.off += 8;
    const bi = (BigInt(hi) << 32n) + BigInt(lo);
    if (bi <= BigInt(MAX_SAFE)) return Number(bi);
    return bi.toString(); // preserve precision as string when unsafe for Number
  }
  i64() {
    this.ensure(8);
    const lo = this.dv.getUint32(this.off, this.le);
    const hi = this.dv.getInt32(this.off + 4, this.le);
    this.off += 8;
    const bi = (BigInt(hi) << 32n) + BigInt(lo >>> 0);
    if (bi <= BigInt(MAX_SAFE) && bi >= BigInt(-MAX_SAFE)) return Number(bi);
    return bi.toString();
  }
  bytes(n) {
    const count = Number(n);
    if (!Number.isFinite(count) || count < 0) throw new Error('Comprimento de bytes inválido.');
    this.ensure(count);
    const b = new Uint8Array(this.buf, this.off, count);
    this.off += count;
    return b;
  }
  string(maxBytes = 16 * 1024 * 1024) {
    const len = this.u64();
    const n = typeof len === 'string' ? Number(BigInt(len)) : Number(len);
    if (!Number.isFinite(n) || n < 0) throw new Error('Comprimento de string inválido.');
    if (n > maxBytes) throw new Error(`String GGUF excede limite seguro (${n} > ${maxBytes}).`);
    return new TextDecoder('utf-8').decode(this.bytes(n));
  }
}

function toNumberSafe(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    try { const b = BigInt(v); if (b <= BigInt(MAX_SAFE)) return Number(b); } catch {}
  }
  return null;
}

function readValue(r, type, options = {}, depth = 0) {
  if (depth > 8) throw new Error('Profundidade de estrutura GGUF excedida.');
  switch (type) {
    case 0: return r.u8();
    case 1: return r.i8();
    case 2: return r.u16();
    case 3: return r.i16();
    case 4: return r.u32();
    case 5: return r.i32();
    case 6: return r.f32();
    case 7: return r.bool();
    case 8: return r.string(options.maxStringBytes);
    case 9: {
      const et = r.u32();
      const lenRaw = r.u64();
      const len = toNumberSafe(lenRaw);
      if (len == null || len < 0) throw new Error('Comprimento de array GGUF inválido ou muito grande.');
      const maxElements = Number(options.maxArrayElements) || 100000;
      if (len > maxElements) throw new Error(`Array GGUF excede limite (${len} > ${maxElements}).`);
      const sampleLimit = Math.min(len, Number(options.arraySampleLimit) || 256);
      const arr = [];
      for (let i = 0; i < len; i++) {
        const v = readValue(r, et, options, depth + 1);
        if (i < sampleLimit) arr.push(v);
      }
      return len > sampleLimit ? { truncated: true, length: len, sample: arr } : arr;
    }
    case 10: return r.u64();
    case 11: return r.i64();
    case 12: return r.f64();
    default: throw new Error(`Tipo de valor GGUF desconhecido: ${type}`);
  }
}

function alignUp(offset, alignment) {
  const a = Math.max(1, Number(alignment) || 1);
  const rem = offset % a;
  return rem === 0 ? offset : offset + (a - rem);
}

export class MetadataLoader {
  async parseArrayBuffer(buffer, options = {}) {
    const maxTensors = Math.min(Number(options.maxTensors) || 50000, 200000);
    const maxKv = Math.min(Number(options.maxKv) || 100000, 200000);
    const readOptions = {
      maxStringBytes: Number(options.maxStringBytes) || 16 * 1024 * 1024,
      maxArrayElements: Number(options.maxArrayElements) || 100000,
      arraySampleLimit: Number(options.arraySampleLimit) || 256,
    };

    const r = new Reader(buffer);
    const magic = r.u32();
    if (magic !== GGUF_MAGIC) throw new Error('Arquivo inválido: magic GGUF não encontrado.');
    const version = r.u32();
    if (version < 2 || version > 3) throw new Error(`Versão GGUF não suportada: ${version}`);

    const tensorCountRaw = r.u64();
    const metadataKvCountRaw = r.u64();
    const tensorCount = toNumberSafe(tensorCountRaw);
    const metadataKvCount = toNumberSafe(metadataKvCountRaw);
    if (tensorCount == null || metadataKvCount == null) throw new Error('Contagens GGUF inválidas ou muito grandes.');
    if (metadataKvCount > maxKv) throw new Error(`Quantidade de metadados excede limite (${metadataKvCount} > ${maxKv}).`);
    if (tensorCount > 2000000) throw new Error(`Quantidade de tensores excede limite seguro (${tensorCount}).`);

    const metadata = {};
    const metadataRaw = [];
    for (let i = 0; i < metadataKvCount; i++) {
      const key = r.string(readOptions.maxStringBytes);
      const vtype = r.u32();
      const value = readValue(r, vtype, readOptions, 0);
      metadata[key] = value;
      metadataRaw.push({ key, type: VALUE_TYPES[vtype] || String(vtype), value });
    }

    const tensors = [];
    const tensorLimit = Math.min(tensorCount, maxTensors);
    for (let i = 0; i < tensorCount; i++) {
      const name = r.string(readOptions.maxStringBytes);
      const nDims = r.u32();
      if (nDims > 16) throw new Error(`Tensor com número de dimensões inválido/excessivo: ${nDims}`);
      const dims = [];
      for (let d = 0; d < nDims; d++) dims.push(r.u64());
      const ttype = r.u32();
      const offset = r.u64();
      if (i < tensorLimit) tensors.push({ name, dimensions: dims, nDimensions: nDims, typeId: ttype, type: TENSOR_TYPES[ttype] || `TYPE_${ttype}`, offset });
    }

    const arch = metadata['general.architecture'] || null;
    const quantTypes = [...new Set(tensors.map((t) => t.type).filter(Boolean))];
    const alignment = toNumberSafe(metadata['general.alignment']) || 32;
    const tensorDataOffset = alignUp(r.off, alignment);

    return {
      ok: true,
      format: 'gguf',
      version,
      counts: { tensors: tensorCount, metadata: metadataKvCount },
      model: {
        name: metadata['general.name'] || metadata['general.basename'] || null,
        architecture: arch,
        fileType: metadata['general.file_type'] ?? null,
        quantizationVersion: metadata['general.quantization_version'] ?? null,
        contextLength: arch ? (metadata[`${arch}.context_length`] ?? null) : null,
        embeddingLength: arch ? (metadata[`${arch}.embedding_length`] ?? null) : null,
        blockCount: arch ? (metadata[`${arch}.block_count`] ?? null) : null,
      },
      quantization: { tensorTypes: quantTypes, fileType: metadata['general.file_type'] ?? null },
      alignment,
      tensorDataOffset,
      metadata,
      metadataRawCount: metadataRaw.length,
      tensors,
      tensorsTruncated: tensorCount > tensorLimit,
      integrity: { magicOk: true, headerParsed: true, boundsChecked: true },
      warnings: [
        ...(tensorCount > tensorLimit ? [`Lista de tensores truncada para ${tensorLimit} de ${tensorCount}.`] : []),
        ...(typeof tensorCountRaw === 'string' || typeof metadataKvCountRaw === 'string' ? ['Alguns valores 64-bit foram preservados como string para evitar perda de precisão.'] : []),
      ],
    };
  }

  async parseFile(file, options = {}) {
    const maxBytes = Number(options.maxBytes) || (512 * 1024 * 1024); // 512MB default safety cap for in-browser full-buffer parse
    if (file?.size && Number(file.size) > maxBytes) {
      return {
        ok: false,
        format: 'gguf',
        error: { code: 'FILE_TOO_LARGE', message: `Arquivo muito grande para análise completa no navegador (${file.size} bytes). Limite atual: ${maxBytes} bytes. Use um runtime/serviço externo para análise completa.` },
        file: { name: file.name, size: file.size, type: file.type || 'application/octet-stream', lastModified: file.lastModified },
      };
    }
    const buf = await file.arrayBuffer();
    const res = await this.parseArrayBuffer(buf, options);
    res.file = { name: file.name, size: file.size, type: file.type || 'application/octet-stream', lastModified: file.lastModified };
    return res;
  }
}

export const GGUFMetadataLoader = MetadataLoader;
export default MetadataLoader;
