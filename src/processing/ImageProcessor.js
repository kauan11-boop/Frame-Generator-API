export class ImageProcessor {
  async getInfo(file){ const info={name:file?.name,size:file?.size,type:file?.type}; try{ if(file && typeof createImageBitmap==='function'){ const b=await createImageBitmap(file); info.width=b.width; info.height=b.height; b.close(); } }catch{} return info; }
  async toBitmap(file){ if(typeof createImageBitmap!=='function') throw new Error('createImageBitmap indisponível'); return await createImageBitmap(file); }
}
export default ImageProcessor;
