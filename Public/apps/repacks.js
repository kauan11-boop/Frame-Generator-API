/**
 * FGUA v2 — Gerenciador de Repacks: multi-ferramenta em 1 comando.
 */

import { el, icon, stateBadge, callout, jsonView } from './common.js';

export function mount(FGUA) {
  const router = FGUA.get('router');
  const root = el('div', 'app');
  const side = el('div', 'app-side', `<div class="brand">${icon('i-box')} Repacks</div>`);
  const main = el('div', 'app-main');
  root.append(side, main);

  const prog = el('div', 'progress', '<div style="width:0%"></div>');
  prog.style.display = 'none';

  async function renderList() {
    main.innerHTML = `<h1>Repacks Disponíveis</h1><p class="sub">Conjuntos multi-ferramenta: 1 comando executa todos os passos declarativos via contrato /api/v1.</p>`;
    const r = await router.route('/api/v1/repack/list');
    const cards = el('div', 'cards');
    for (const p of r.data?.repacks ?? []) {
      const c = el('div', 'card', `
        <h4>${p.name} <span class="badge info"><span class="dot"></span>v${p.version}</span></h4>
        <p class="sub">${p.description}</p>
        <p><b>Ferramentas:</b> ${p.tools.map(t => `<code>${t}</code>`).join(' · ')}</p>
        <div style="margin-top:10px">${stateBadge(p.state)}</div>
        <div style="margin-top:12px"><button class="btn primary" data-id="${p.id}">${icon('i-play')} Executar repack</button></div>`);
      c.querySelector('[data-id]').onclick = () => run(p.id);
      cards.appendChild(c);
    }
    main.append(cards, prog);
    const detail = el('div');
    main.appendChild(detail);
  }

  async function run(id) {
    const det = await router.route('/api/v1/repack/get', { method: 'POST', payload: { id } });
    main.querySelectorAll('.card').forEach(c => { if (c.querySelector(`[data-id="${id}"]`)) c.append(el('h3', '', 'Passos declarados'), jsonView(det.data?.steps ?? [])); });
    prog.style.display = '';
    prog.querySelector('div').style.width = '5%';
    const resultBox = el('div');
    main.appendChild(resultBox);
    const r = await router.route('/api/v1/repack/install', { method: 'POST', payload: { id } });
    prog.querySelector('div').style.width = '100%';
    setTimeout(() => prog.style.display = 'none', 800);
    resultBox.innerHTML = '';
    resultBox.appendChild(el('h2', '', `Resultado — ${stateBadge(r.state)} <span class="sub">${r.data?.elapsedMs ?? '?'} ms</span>`));
    resultBox.appendChild(jsonView(r.data ?? r.error));
    if (r.data?.nota) resultBox.appendChild(callout(r.data.nota, 'warn'));
  }

  renderList();
  return root;
}

export default { mount };
