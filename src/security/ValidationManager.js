export class ValidationManager {
  constructor(){ this.maxFileSize=1024*1024*1024; this.allowedModelExt=new Set(['.gguf','.onnx','.safetensors','.bin','.pt','.pth','.json']); this.allowedMediaExt=new Set(['.png','.jpg','.jpeg','.webp','.bmp','.tiff','.mp4','.webm']); }
  validateFile(file, kind='any'){
    const issues=[]; if(!file) return {ok:false,issues:['Arquivo ausente']};
    const name=(file.name||'').toLowerCase(); const ext=name.includes('.')?'.'+name.split('.').pop():'';
    if(file.size>this.maxFileSize) issues.push('Arquivo excede limite de tamanho');
    if(kind==='model' && ext && !this.allowedModelExt.has(ext)) issues.push(`Extensão de modelo não permitida: ${ext}`);
    if(kind==='media' && ext && !this.allowedMediaExt.has(ext)) issues.push(`Extensão de mídia não permitida: ${ext}`);
    if(/\.(js|mjs|cjs|exe|dll|sh|bat|ps1)$/i.test(name)) issues.push('Tipo potencialmente executável bloqueado');
    return { ok: issues.length===0, issues, file:{name:file.name,size:file.size,type:file.type} };
  }
  validateJson(text){ try{ return {ok:true,value:JSON.parse(text)}; }catch(e){ return {ok:false,error:e.message}; } }
  validateEndpoint(url){ try{ const u=new URL(url); if(!['http:','https:'].includes(u.protocol)) return {ok:false,error:'Protocolo inválido'}; return {ok:true,origin:u.origin}; }catch(e){ return {ok:false,error:e.message}; } }
  sanitizeSegment(s=''){ return String(s).replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.\.+/g,'.'); }
}
export default ValidationManager;
