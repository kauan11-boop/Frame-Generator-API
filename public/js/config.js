// Configuração da interface: API estática em src/03_API/v1 (arquitetura 01_Core..15_Integration)
export const CONFIG = {
  // Caminho relativo da interface (Public/) para a raiz da API estática
  API_ROOT: '../src',
  API_V1: '../src/03_API/v1',
  SCHEMAS: '../src/12_Validation',
  PROMPTS_SRC: '../src/02_Configuration/prompts/integration.md'
};

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (/^\.\.?\//.test(path)) return path; // caminho relativo direto
  const clean = String(path).replace(/^\//, '');
  // mapeia caminhos lógicos/legados e novos para a estrutura atual
  if (clean.startsWith('03_API/') || clean.startsWith('12_Validation/') || clean.startsWith('10_Storage/') || clean.startsWith('15_Integration/') || clean.startsWith('Legacy/')) {
    return `${CONFIG.API_ROOT}/${clean}`;
  }
  if (clean.startsWith('api/v1/')) return `${CONFIG.API_ROOT}/03_API/v1/${clean.slice('api/v1/'.length)}`;
  if (clean.startsWith('schemas/')) return `${CONFIG.SCHEMAS}/${clean.slice('schemas/'.length)}`;
  if (clean.startsWith('sdk/')) return `${CONFIG.API_ROOT}/15_Integration/sdk/${clean.slice('sdk/'.length)}`;
  if (clean.startsWith('data/')) return `${CONFIG.API_ROOT}/10_Storage/${clean.slice('data/'.length)}`;
  if (clean.startsWith('prompts/')) return `${CONFIG.API_ROOT}/02_Configuration/prompts/${clean.slice('prompts/'.length)}`;
  if (clean.startsWith('api/') || clean.startsWith('v1/')) {
    const rest = clean.startsWith('api/') ? clean.slice(4) : clean;
    return `${CONFIG.API_ROOT}/03_API/${rest}`;
  }
  return `${CONFIG.API_V1}/${clean}`;
}
