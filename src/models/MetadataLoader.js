// GGUF binary metadata/tensor parser (v2/v3) - leitura real de cabeçalho, KV e infos de tensores.
const GGUF_MAGIC = 0x46554747; // "GGUF" LE
const VALUE_TYPES = { 0:'UINT8',1:'INT8',2:'UINT16',3:'INT16',4:'UINT32',5:'INT32',6:'FLOAT32',7:'BOOL',8:'STRING',9:'ARRAY',10:'UINT64',11:'INT64',12:'FLOAT64' };
const TENSOR_TYPES = { 0:'F32',1:'F16',2:'Q4_0',3:'Q4_1',6:'Q5_0',7:'Q5_1',8:'Q8_0',9:'Q8_1',10:'Q2_K',11:'Q3_K',12:'Q4_K',13:'Q5_K',14:'Q6_K',15:'Q8_K',16:'IQ2_XXS',17:'IQ2_XS',18:'IQ3_XXS',19:'IQ1_S',20:'IQ4_NL',21:'IQ3_S',22:'IQ2_S',23:'IQ4_XS',24:'I8',25:'I16',26:'I32',27:'I64',28:'F64',29:'IQ1_M',30:'BF16' };

class Reader {
  constructor(buffer){ this.dv=new DataView(buffer); this.buf=buffer; this.off=0; this.le=true; }
  u8(){const v=this.dv.getUint8(this.off);this.off+=1;return v;}
  i8(){const v=this.dv.getInt8(this.off);this.off+=1;return v;}
  u16(){const v=this.dv.getUint16(this.off,this.le);this.off+=2;return v;}
  i16(){const v=this.dv.getInt16(this.off,this.le);this.off+=2;return v;}
  u32(){const v=this.dv.getUint32(this.off,this.le);this.off+=4;return v;}
  i32(){const v=this.dv.getInt32(this.off,this.le);this.off+=4;return v;}
  f32(){const v=this.dv.getFloat32(this.off,this.le);this.off+=4;return v;}
  f64(){const v=this.dv.getFloat64(this.off,this.le);this.off+=8;return v;}
  bool(){return this.u8()!==0;}
  u64(){const lo=this.u32();const hi=this.u32();return hi*2**32+lo;}
  i64(){const lo=this.u32();const hi=this.i32();return hi*2**32+lo;}
  bytes(n){const b=new Uint8Array(this.buf,this.off,n);this.off+=n;return b;}
  string(){const len=this.u64();return new TextDecoder('utf-8').decode(this.bytes(len));}
}

function readValue(r,type){
  switch(type){
    case 0:return r.u8();case 1:return r.i8();case 2:return r.u16();case 3:return r.i16();
    case 4:return r.u32();case 5:return r.i32();case 6:return r.f32();case 7:return r.bool();
    case 8:return r.string();
    case 9:{const et=r.u32();const len=r.u64();const arr=[];const limit=Math.min(len,4096);
      for(let i=0;i<len;i++){const v=readValue(r,et); if(i<limit) arr.push(v);} 
      return len>limit?{truncated:true,length:len,sample:arr}:arr;}
    case 10:return r.u64();case 11:return r.i64();case 12:return r.f64();
    default: throw new Error(`Tipo de valor GGUF desconhecido: ${type}`);
  }
}

export class MetadataLoader {
  async parseArrayBuffer(buffer, options={}){
    const maxTensors = options.maxTensors ?? 5000;
    const r = new Reader(buffer);
    const magic = r.u32();
    if (magic !== GGUF_MAGIC) throw new Error('Arquivo inválido: magic GGUF não encontrado');
    const version = r.u32();
    if (version < 2 || version > 3) throw new Error(`Versão GGUF não suportada: ${version}`);
    const tensorCount = r.u64();
    const metadataKvCount = r.u64();
    const metadata = {}; const metadataRaw = [];
    for(let i=0;i<metadataKvCount;i++){
      const key=r.string(); const vtype=r.u32(); const value=readValue(r,vtype);
      metadata[key]=value; metadataRaw.push({key,type:VALUE_TYPES[vtype]||String(vtype),value});
    }
    const tensors=[]; const tensorLimit=Math.min(tensorCount,maxTensors);
    for(let i=0;i<tensorCount;i++){
      const name=r.string(); const nDims=r.u32(); const dims=[]; for(let d=0;d<nDims;d++) dims.push(r.u64());
      const ttype=r.u32(); const offset=r.u64();
      if(i<tensorLimit) tensors.push({name,dimensions:dims,nDimensions:nDims,typeId:ttype,type:TENSOR_TYPES[ttype]||`TYPE_${ttype}`,offset});
    }
    const arch = metadata['general.architecture'] || null;
    const quantTypes = [...new Set(tensors.map(t=>t.type))];
    return {
      ok:true, format:'gguf', version, counts:{tensors:tensorCount,metadata:metadataKvCount},
      model:{ name: metadata['general.name']||metadata['general.basename']||null, architecture:arch, fileType:metadata['general.file_type']??null, quantizationVersion:metadata['general.quantization_version']??null, contextLength:arch?(metadata[`${arch}.context_length`]??null):null, embeddingLength:arch?(metadata[`${arch}.embedding_length`]??null):null, blockCount:arch?(metadata[`${arch}.block_count`]??null):null },
      quantization:{ tensorTypes:quantTypes, fileType:metadata['general.file_type']??null },
      alignment: metadata['general.alignment']||32,
      metadata, metadataRawCount: metadataRaw.length,
      tensors, tensorsTruncated: tensorCount>tensorLimit,
      integrity:{ magicOk:true, headerParsed:true }
    };
  }
  async parseFile(file, options={}){
    const buf = await file.arrayBuffer();
    const res = await this.parseArrayBuffer(buf, options);
    res.file = { name:file.name, size:file.size, type:file.type||'application/octet-stream', lastModified:file.lastModified };
    return res;
  }
}

export const GGUFMetadataLoader = MetadataLoader;
export default MetadataLoader;
