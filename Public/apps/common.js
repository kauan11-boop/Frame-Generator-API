/**
 * FGUA v2 — utilitários compartilhados dos apps.
 */

export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const icon = id => `<svg><use href="../assets/icons.svg#${id}"/></svg>`;

export function header(title, subtitle, actionsHtml = '') {
  return el('div', '', `<h1>${title}</h1><p class="sub">${subtitle ?? ''}</p>`);
}

export function stateBadge(state) {
  const toneMap = { ready: 'ok', succeeded: 'ok', planned: 'info', analyzed: 'info', 'requires-provider': 'warn', 'requires-runtime': 'warn', unavailable: 'err', invalid: 'err', failed: 'err', cancelled: 'muted' };
  const labelMap = { ready: 'Pronto', succeeded: 'Concluído', planned: 'Planejado', analyzed: 'Analisado', 'requires-provider': 'Requer provedor', 'requires-runtime': 'Requer runtime', unavailable: 'Indisponível', invalid: 'Inválido', failed: 'Falhou', cancelled: 'Cancelado' };
  return `<span class="badge ${toneMap[state] ?? 'muted'}"><span class="dot"></span>${labelMap[state] ?? state ?? '—'}</span>`;
}

export function jsonPretty(value) {
  const json = JSON.stringify(value, null, 2) ?? 'null';
  const esc = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:')
    .replace(/: "(.*?)"/g, ': <span class="s">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="n">$1</span>')
    .replace(/: (true|false|null)/g, ': <span class="b">$1</span>');
}

export function jsonView(value) {
  return el('div', 'json-view', jsonPretty(value));
}

export function table(headers, rows) {
  const t = el('table', 'tbl');
  t.innerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tb = el('tbody');
  for (const r of rows) {
    const tr = el('tr');
    tr.innerHTML = r.map(c => `<td>${c ?? '—'}</td>`).join('');
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  return t;
}

export function callout(text, variant = '') {
  return el('div', `callout ${variant}`, text);
}

/** abre seletor de arquivo e devolve File */
export function pickFile({ accept = '', multiple = false } = {}) {
  return new Promise(resolve => {
    const inp = el('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.multiple = multiple;
    inp.style.display = 'none';
    inp.onchange = () => { resolve(multiple ? [...inp.files] : inp.files[0] ?? null); inp.remove(); };
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => { if (!inp.files?.length) inp.remove(); }, 5 * 60 * 1000);
  });
}

export function bytes(n) {
  if (!Number.isFinite(n) || n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 2)} ${u[i]}`;
}

export function section(parent, title) {
  const s = el('div', '', `<h2>${title}</h2>`);
  parent.appendChild(s);
  return s;
}

export default { el, icon, stateBadge, jsonPretty, jsonView, table, callout, pickFile, bytes };
