export class ModelCompatibility {
  assess(model = {}, caps = {}) {
    const issues = [];
    const notes = [];
    const recommendations = [];
    const fmt = String(model.format || 'unknown').toLowerCase();
    const capabilities = caps?.capabilities || {};

    if (fmt === 'unknown') issues.push('Formato de modelo não reconhecido.');

    const mem = Number(caps?.hardware?.deviceMemoryGB);
    const size = Number(model.size);
    const sizeGB = Number.isFinite(size) ? size / 1024 / 1024 / 1024 : null;
    if (Number.isFinite(sizeGB) && Number.isFinite(mem) && mem > 0 && sizeGB > mem * 0.6) {
      issues.push('Tamanho do modelo pode exceder memória prática disponível no navegador.');
      recommendations.push('Considere um modelo menor, quantizado, ou execução em backend/provedor externo.');
    }

    if (fmt === 'gguf') {
      notes.push('GGUF: metadados podem ser analisados no cliente; inferência/carregamento real requer runtime/provedor compatível.');
      recommendations.push('Use runtime compatível (ex.: backend local/remoto com suporte GGUF) para execução.');
    } else if (fmt === 'onnx') {
      if (capabilities.wasm || capabilities.webgpu) {
        notes.push('ONNX: pode ser compatível com ONNX Runtime Web conforme operadores/modelo/runtime disponível.');
        if (!capabilities.webgpu) notes.push('WebGPU indisponível; fallback WASM pode ser necessário (quando suportado).');
      } else {
        issues.push('WebAssembly/WebGPU indisponíveis para execução ONNX no navegador.');
        recommendations.push('Ative um runtime compatível ou configure backend externo.');
      }
    } else if (fmt === 'json-manifest') {
      notes.push('Manifesto JSON: utilizável localmente para configuração/registro, sem inferência de pesos.');
    } else if (fmt !== 'unknown') {
      notes.push('Formato sem execução local garantida neste cliente.');
      recommendations.push('Configure um provedor/runtime externo compatível com este formato.');
    }

    let status = 'compatible';
    if (fmt === 'unknown') status = 'unsupported';
    else if (issues.some((i) => /não reconhecido|indisponíveis/i.test(i))) status = 'unsupported';
    else if (issues.length) status = 'partially-compatible';
    else if (fmt !== 'json-manifest' && !['gguf', 'onnx'].includes(fmt)) status = 'requires-external-provider';
    else if (fmt === 'gguf') status = 'analysis-only';

    return { status, issues, notes, recommendations, format: fmt, checkedAt: new Date().toISOString() };
  }
}

export default ModelCompatibility;
