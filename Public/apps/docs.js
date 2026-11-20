/**
 * FGUA v2 — Documentação (app): lê as páginas standalone de /Public/documentation.
 */

import { el, icon } from './common.js';

export function mount(FGUA) {
  const docs = [
    { id: 'index', label: 'Visão geral', ico: 'i-book' },
    { id: 'architecture', label: 'Arquitetura', ico: 'i-grid' },
    { id: 'api-contract', label: 'Contrato /api/v1', ico: 'i-plug' },
    { id: 'commands', label: 'Comandos', ico: 'i-terminal' },
    { id: 'limits', label: 'Limites reais', ico: 'i-shield' },
    { id: 'master-prompt', label: 'Master Prompt IA', ico: 'i-spark' },
    { id: 'license', label: 'Licença', ico: 'i-key' }
  ];
  const root = el('div', 'app');
  const side = el('div', 'app-side', `<div class="brand">${icon('i-book')} Documentação</div>`);
  const main = el('div', 'app-main');
  root.append(side, main);
  main.style.padding = '0';

  const iframe = el('iframe');
  iframe.style.cssText = 'flex:1;border:0;width:100%;background:var(--win-bg)';
  iframe.setAttribute('title', 'Documentação');
  main.appendChild(iframe);

  function open(id) {
    side.querySelectorAll('.side-item').forEach(x => x.classList.toggle('sel', x.dataset.k === id));
    iframe.src = `../documentation/${id}.html`;
  }
  for (const d of docs) {
    const n = el('div', 'side-item', `${icon(d.ico)}${d.label}`);
    n.dataset.k = d.id;
    n.onclick = () => open(d.id);
    side.appendChild(n);
  }
  open('index');
  return root;
}

export default { mount };
