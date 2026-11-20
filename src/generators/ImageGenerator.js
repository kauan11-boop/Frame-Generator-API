export class ImageGenerator {
  constructor(){ this.id='image-generator'; this.name='Image Generator'; this.category='image'; }
  async analyze(file){ const info={ok:true,category:'image'}; if(file){ info.file={name:file.name,type:file.type,size:file.size}; try{ if(typeof createImageBitmap==='function' && file instanceof Blob){ const b=await createImageBitmap(file); info.width=b.width; info.height=b.height; b.close(); } }catch{} } return info; }
  async process(request={}){ const analysis=request.input?await this.analyze(request.input):null; return { ok:false, state:'requires-provider', message:'Aprimoramento neural de imagem requer modelo/runtime/provedor compatível. Sem resultado simulado.', analysis, requested:{scale:request.scale||null,denoise:!!request.denoise,enhance:!!request.enhance} }; }
}
export default ImageGenerator;
