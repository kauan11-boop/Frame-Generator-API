// UI render helpers (accessible, consistent, no framework).

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const escAttr = esc;

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 2 : 0)} ${units[i]}`;
}

export function formatDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat(document.documentElement.lang || 'pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  } catch { return String(value); }
}

export function boolPill(value, trueLabel = 'Disponível', falseLabel = 'Indisponível') {
  const ok = !!value;
  return `<span class="pill ${ok ? 'ok' : 'warn'}">${esc(ok ? trueLabel : falseLabel)}</span>`;
}

export function statePill(state) {
  const s = String(state || 'unknown').toLowerCase();
  let cls = '';
  if (['ready', 'ok', 'succeeded', 'available', 'configured', 'connected', 'registered', 'analyzed', 'enabled', 'active'].includes(s)) cls = 'ok';
  else if (['error', 'failed', 'unsupported', 'invalid'].includes(s)) cls = 'err';
  else if (['unavailable', 'requires-provider', 'requires-runtime', 'unconfigured', 'pending', 'queued', 'running', 'planned', 'cancelled', 'demo', 'disabled', 'detect', 'unknown'].includes(s)) cls = 'warn';
  else cls = 'info';
  return `<span class="pill ${cls}">${esc(state ?? '—')}</span>`;
}

export function pills(arr) { return (arr || []).map((x) => `<span class="pill">${esc(x)}</span>`).join(''); }

export function announce(message, politeness = 'polite') {
  const region = document.getElementById('live-region');
  if (!region) return;
  region.setAttribute('aria-live', politeness === 'assertive' ? 'assertive' : 'polite');
  region.textContent = '';
  // small delay helps SRs announce repeated messages
  setTimeout(() => { region.textContent = String(message ?? ''); }, 30);
}

export function setActiveTab(id, options = {}) {
  const tabs = [...document.querySelectorAll('[role="tab"][data-tab]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"].tab')];
  const exists = tabs.some((t) => t.dataset.tab === id);
  const target = exists ? id : (tabs[0]?.dataset.tab || 'overview');
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === target;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.setAttribute('tabindex', active ? '0' : '-1');
  });
  panels.forEach((panel) => {
    const active = panel.id === `tab-${target}`;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  if (options.focus) {
    const el = document.querySelector(`[role="tab"][data-tab="${target}"]`);
    if (el) el.focus();
  }
  updatePageHeaderForTab(target);
  try { history.replaceState(null, '', `#${target}`); } catch {}
  return target;
}

const TAB_META = {
  overview: { title: 'Visão geral', subtitle: 'Estado do núcleo, diagnóstico, uso de ferramentas e contexto da sessão atual.' },
  resources: { title: 'Recursos e capacidades', subtitle: 'Capacidades do navegador, engines detectadas e provedores registrados/configurados.' },
  models: { title: 'Modelos (sessão)', subtitle: 'Modelos analisados/registrados nesta sessão e informações de suporte (análise ≠ inferência).' },
  generators: { title: 'Geradores e presets', subtitle: 'Geradores registrados, presets e templates disponíveis no projeto (execução real depende de runtime/provedor compatível).' },
  jobs: { title: 'Tarefas', subtitle: 'Fila e histórico de tarefas da sessão atual, com estados explícitos.' },
  integration: { title: 'Integração e API', subtitle: 'Contrato lógico /api/v1, utilitários WebSocket (cliente opcional), configuração de backend, payload e exemplos.' },
  discord: { title: 'Discord Bot', subtitle: 'Configuração avançada e geração de templates discord.js (Node.js) para bots e conteúdos — execução fora do GitHub Pages.' },
  config: { title: 'Configurações e permissões', subtitle: 'Arquivos de configuração públicos, permissões de UI e notas de segurança em ambiente estático.' },
  docs: { title: 'Documentação e recursos', subtitle: 'Documentação, master prompt, manifests de exemplo e links úteis do repositório.' },
};

export function updatePageHeaderForTab(id) {
  const meta = TAB_META[id] || TAB_META.overview;
  const t = document.getElementById('page-title');
  const s = document.getElementById('page-subtitle');
  if (t) t.textContent = meta.title;
  if (s) s.textContent = meta.subtitle;
}

export function renderError(target, err, title = 'Não foi possível carregar esta seção') {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  const message = (err && (err.message || err.error?.message)) ? (err.message || err.error.message) : String(err ?? 'Erro desconhecido');
  const details = esc(typeof err === 'string' ? err : JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2));
  el.innerHTML = `
    <div class="notice err" role="alert">
      <h2>${esc(title)}</h2>
      <p>${esc(message)}</p>
      <p class="section-note">Se estiver abrindo arquivos diretamente (<code>file://</code>), sirva o projeto por HTTP (ex.: <code>npx serve .</code>) e recarregue a página. Para operações remotas, verifique a configuração de backend na aba Integração.</p>
      <details class="disclosure mt"><summary>Detalhes técnicos</summary><div class="details-body"><pre class="wrap">${details}</pre></div></details>
    </div>`;
}

export function emptyState(title, message, actionsHtml = '') {
  return `<div class="empty-state"><h3>${esc(title)}</h3><p>${esc(message)}</p>${actionsHtml ? `<div class="actions mt">${actionsHtml}</div>` : ''}</div>`;
}

export function loadingCard(title = 'Carregando…') {
  return `<div class="card" aria-busy="true"><h2>${esc(title)}</h2><p class="muted">Obtendo dados da sessão e arquivos de configuração…</p><div class="skeleton" style="height:12px;margin:8px 0;width:60%"></div><div class="skeleton" style="height:12px;margin:8px 0;width:90%"></div><div class="skeleton" style="height:12px;margin:8px 0;width:75%"></div></div>`;
}

export function codeBlock(id, content, label = 'Copiar', opts = {}) {
  const preClass = opts.wrap ? 'wrap' : '';
  const safeId = escAttr(id || `code-${Math.random().toString(36).slice(2)}`);
  return `<div class="code-block"><div class="code-actions"><button class="btn small copy-btn" type="button" data-copy-target="${safeId}" data-copy-label="${escAttr(label)}">${esc(label)}</button></div><pre id="${safeId}" class="${preClass}">${esc(content)}</pre></div>`;
}

export function table(headers, rows, caption = '', opts = {}) {
  const cap = caption ? `<caption>${opts.srCaption ? `<span class="sr-only">${esc(caption)}</span>` : esc(caption)}</caption>` : '';
  const head = `<thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>`;
  const body = rows.length
    ? `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`
    : `<tbody><tr><td colspan="${headers.length}">${emptyState(opts.emptyTitle || 'Sem dados', opts.emptyMessage || 'Nenhum item disponível para exibição.')}</td></tr></tbody>`;
  return `<div class="table-wrap"><table>${cap}${head}${body}</table></div>`;
}

export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (!ok) throw new Error('execCommand(copy) falhou');
    }
    announce('Conteúdo copiado para a área de transferência.');
    return { ok: true };
  } catch (e) {
    announce('Não foi possível copiar automaticamente. Use a seleção manual do bloco.', 'assertive');
    return { ok: false, error: e?.message || String(e) };
  }
}

export function downloadJson(filename, data) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    announce(`Arquivo ${filename} preparado para download.`);
    return { ok: true };
  } catch (e) {
    announce(`Falha ao gerar download: ${e?.message || e}`, 'assertive');
    return { ok: false, error: e?.message || String(e) };
  }
}
