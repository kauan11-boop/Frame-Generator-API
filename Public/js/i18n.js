// Simple i18n for static UI. Loads Public/locales/<lang>.json and provides t(key, vars).

const FALLBACK_LANG = 'pt-BR';
let currentLang = FALLBACK_LANG;
let dict = {};
let loaded = false;

function getNested(obj, path) {
  return String(path || '').split('.').reduce((acc, k) => (acc && Object.prototype.hasOwnProperty.call(acc, k) ? acc[k] : undefined), obj);
}

function interpolate(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? `{${k}}` : String(vars[k])));
}

export function detectLang() {
  try {
    const saved = localStorage.getItem('fgua.lang');
    if (saved) return saved;
  } catch {}
  const doc = document?.documentElement?.lang;
  if (doc) return doc;
  const nav = navigator?.language || FALLBACK_LANG;
  return nav.toLower().startsWith('en') ? 'en-US' : 'pt-BR';
}

export async function initI18n(preferredLang) {
  currentLang = preferredLang || detectLang() || FALLBACK_LANG;
  const base = new URL('../locales/', import.meta.url);
  const candidates = [currentLang, FALLBACK_LANG];
  dict = {};
  for (const lang of [...new Set(candidates)]) {
    try {
      const res = await fetch(new URL(`${lang}.json`, base).href, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        dict = data?.strings || {};
        currentLang = data?.id || lang;
        document.documentElement.lang = currentLang;
        loaded = true;
        return { lang: currentLang, loaded: true };
      }
    } catch {}
  }
  loaded = false;
  return { lang: currentLang, loaded: false };
}

export function t(key, vars = {}, fallback = null) {
  const val = getNested(dict, key);
  if (typeof val === 'string') return interpolate(val, vars);
  if (fallback != null) return interpolate(fallback, vars);
  return String(key);
}

export function getLang() { return currentLang; }
export function isLoaded() { return loaded; }
