export class WebGPUEngine {
  constructor(){ this.adapter=null; this.device=null; this.info=null; this.id='webgpu'; this.name='WebGPU Engine'; }
  async detect(){
    if(!navigator.gpu) return { available:false, reason:'WebGPU não suportado' };
    try{ this.adapter=await navigator.gpu.requestAdapter(); if(!this.adapter) return {available:false,reason:'Adaptador indisponível'};
      this.info={ available:true, features:[...(this.adapter.features||[])], limits:{ maxBufferSize:this.adapter.limits?.maxBufferSize, maxTextureDimension2D:this.adapter.limits?.maxTextureDimension2D } };
      return this.info;
    }catch(e){ return {available:false,reason:e.message}; }
  }
  async getDevice(){ if(this.device) return this.device; if(!this.adapter) await this.detect(); if(!this.adapter) return null; try{ this.device=await this.adapter.requestDevice(); this.device.lost.then(()=>{this.device=null;}); return this.device; }catch{return null;} }
  getStatus(){ return { id:this.id, available:!!navigator.gpu, adapter:!!this.adapter, device:!!this.device, info:this.info }; }
  async dispose(){ try{this.device?.destroy?.();}catch{} this.device=null; }
}
export default WebGPUEngine;
