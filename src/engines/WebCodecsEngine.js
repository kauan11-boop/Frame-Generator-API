export class WebCodecsEngine {
  constructor(){ this.id='webcodecs'; this.name='WebCodecs Engine'; }
  detect(){
    return { available: typeof VideoDecoder!=='undefined' && typeof VideoEncoder!=='undefined', videoDecoder: typeof VideoDecoder!=='undefined', videoEncoder: typeof VideoEncoder!=='undefined', videoFrame: typeof VideoFrame!=='undefined', audioDecoder: typeof AudioDecoder!=='undefined', audioEncoder: typeof AudioEncoder!=='undefined' };
  }
  getStatus(){ return { id:this.id, ...this.detect() }; }
  async supportsVideoConfig(config){ try{ if(typeof VideoDecoder==='undefined') return {supported:false}; const r=await VideoDecoder.isConfigSupported(config); return r||{supported:false}; }catch(e){ return {supported:false,error:e.message}; } }
  async supportsAudioConfig(config){ try{ if(typeof AudioEncoder==='undefined') return {supported:false}; const r=await AudioEncoder.isConfigSupported(config); return r||{supported:false}; }catch(e){ return {supported:false,error:e.message}; } }
}
export default WebCodecsEngine;
