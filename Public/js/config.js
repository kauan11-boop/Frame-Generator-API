// Configuração da interface (hospedagem estática).
// Resolve caminhos de forma determinística em relação à localização deste módulo.

const moduleUrl = new URL('.', import.meta.url);
const siteRoot = new URL('../../', moduleUrl); // repo/site root
const publicRoot = new URL('../', moduleUrl);  // Public/

export const CONFIG = {
  SITE_ROOT: siteRoot.href,
  PUBLIC_ROOT: publicRoot.href,
  CONFIGS_ROOT: new URL('configs/', siteRoot).href,
  SRC_ROOT: new URL('src/', siteRoot).href,
  DOCS_ROOT: new URL('Public/documentation/', siteRoot).href,
};

export function toAbsolute(path) {
  if (path == null) return '';
  const s = String(path);
  if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('blob:')) return s;
  if (s.startsWith('/')) return new URL(s.replace(/^\//, ''), siteRoot).href;
  if (s.startsWith('./') || s.startsWith('../')) return new URL(s, moduleUrl).href;
  return new URL(s, siteRoot).href;
}

export function configUrl(name) {
  const clean = String(name || '').replace(/^\/+/, '').replace(/^configs\//, '');
  return new URL(clean, CONFIG.CONFIGS_ROOT).href;
}

export function docUrl(name) {
  const clean = String(name || '').replace(/^\/+/, '').replace(/^Public\/documentation\//, '').replace(/^documentation\//, '');
  return new URL(clean, CONFIG.DOCS_ROOT).href;
}

export function publicUrl(path) {
  const clean = String(path || '').replace(/^\/+/, '').replace(/^Public\//, '');
  return new URL(clean, CONFIG.PUBLIC_ROOT).href;
}

// Compatibilidade: resolve caminhos "lógicos" usados por código legado/UI.
export function apiUrl(path) {
  if (path == null) return CONFIG.SITE_ROOT;
  const s = String(path);
  if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('blob:')) return s;
  if (s.startsWith('./') || s.startsWith('../')) return new URL(s, moduleUrl).href;

  const clean = s.replace(/^\/+/, '');
  if (clean.startsWith('configs/')) return configUrl(clean.slice('configs/'.length));
  if (clean.startsWith('Public/')) return new URL(clean.slice('Public/'.length), CONFIG.PUBLIC_ROOT).href;
  if (clean.startsWith('src/')) return new URL(clean.slice('src/'.length), CONFIG.SRC_ROOT).href;
  if (clean.startsWith('documentation/')) return docUrl(clean.slice('documentation/'.length));
  if (clean.startsWith('LICENSE')) return new URL('LICENSE', siteRoot).href;

  // Paths legados (arquivo-estáticos) — mapear para archive/Legacy quando existir; não inventar src/03_API etc.
  if (clean.startsWith('03_API/') || clean.startsWith('archive/Legacy/')) {
    const rel = clean.startsWith('archive/Legacy/') ? clean.slice('archive/Legacy/'.length) : clean;
    return new URL(`archive/Legacy/${rel}`, siteRoot).href;
  }

  // Contrato lógico /api/v1/* não é um arquivo estático no GitHub Pages; retornar caminho absoluto do site para referência.
  if (clean.startsWith('api/v1/') || clean.startsWith('v1/')) {
    const suffix = clean.startsWith('api/v1/') ? clean.slice('api/v1/'.length) : clean.slice('v1/'.length);
    return new URL(`api/v1/${suffix}`, siteRoot).href;
  }

  // Fallback: tratar como recurso relativo à raiz do site.
  return new URL(clean, siteRoot).href;
}

export function siteBaseUrl() {
  return CONFIG.SITE_ROOT;
}
