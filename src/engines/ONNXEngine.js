export class ONNXEngine {
  constructor(){ this.id='onnx-web'; this.name='ONNX Runtime Web (Adapter)'; this.runtime=null; }
  detect(){
    // runtime não incluído por padrão; detecta se ort está disponível globalmente
    const ort = globalThis.ort || null;
    return { available: !!ort, runtime: ort ? 'ort-web' : null, note: ort ? 'ONNX Runtime Web detectado.' : 'ONNX Runtime Web não carregado; requer inclusão do runtime e modelo compatível.' };
  }
  getStatus(){ return { id:this.id, ...this.detect(), loaded: !!this.runtime }; }
  async loadRuntime(ortGlobal){ this.runtime = ortGlobal || globalThis.ort || null; return this.getStatus(); }
}
export default ONNXEngine;
