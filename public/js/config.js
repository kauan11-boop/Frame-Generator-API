// Configuração da interface: API estática em src/api/v1
export const CONFIG = {
  // Caminho relativo da interface (public/) para a raiz da API estática
  API_ROOT: '../src',
  API_V1: '../src/api/v1',
  PROMPTS_SRC: '../src/prompts/integration.md'
};

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = String(path).replace(/^\//, '');
  // aceita "api/v1/..." ou caminho já relativo à API_ROOT
  if (clean.startsWith('api/') || clean.startsWith('schemas/') || clean.startsWith('data/')) {
    return `${CONFIG.API_ROOT}/${clean}`;
  }
  if (clean.startsWith('v1/')) return `${CONFIG.API_V1}/${clean.slice(3)}`;
  return `${CONFIG.API_V1}/${clean}`;
}
