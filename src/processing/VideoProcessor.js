export class VideoProcessor {
  detect(){ return { webCodecs: typeof VideoDecoder!=='undefined', videoFrame: typeof VideoFrame!=='undefined' }; }
  async getMetadata(file){ const meta={name:file?.name,size:file?.size,type:file?.type}; try{ if(file&&typeof document!=='undefined'){ const url=URL.createObjectURL(file); const v=document.createElement('video'); v.preload='metadata'; await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(new Error('metadata'));v.src=url;}); meta.duration=v.duration; meta.width=v.videoWidth; meta.height=v.videoHeight; URL.revokeObjectURL(url);} }catch(e){ meta.error=e.message; } return meta; }
}
export default VideoProcessor;
