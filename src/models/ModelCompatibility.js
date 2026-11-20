export class ModelCompatibility {
  assess(model={}, caps={}){
    const issues=[]; const notes=[];
    const fmt = model.format || 'unknown';
    if(fmt==='gguf') notes.push('GGUF: análise local de metadados suportada; inferência requer runtime/provedor compatível.');
    if(fmt==='onnx') notes.push('ONNX: execução possível via ONNX Runtime Web quando operadores/modelo forem compatíveis.');
    if(fmt==='unknown') issues.push('Formato não reconhecido.');
    const mem = caps?.hardware?.deviceMemoryGB;
    const sizeGB = model.size ? model.size/1024/1024/1024 : null;
    if(sizeGB && mem && sizeGB > mem*0.6) issues.push('Tamanho do modelo pode exceder memória disponível no navegador.');
    const webgpu = !!caps?.capabilities?.webgpu;
    if((model.runtimeCompatible||[]).includes('onnxruntime-web') && !webgpu) notes.push('WebGPU indisponível; fallback WASM pode ser necessário.');
    let status='Compatible';
    if(issues.some(i=>/não reconhecido/i.test(i))) status='Unsupported';
    else if(issues.length) status='Partially Compatible';
    if(fmt!=='json-manifest' && !['gguf','onnx'].includes(fmt) && fmt!=='unknown') status='Requires External Provider';
    return { status, issues, notes, format: fmt, checkedAt: new Date().toISOString() };
  }
}
export default ModelCompatibility;
