/**
 * FGUA v2 — Console da API: navegador do contrato /api/v1 + cliente LM Studio.
 */

import { el, icon, stateBadge, jsonView, callout, table } from './common.js';

export function mount(FGUA) {
  const router = FGUA.get('router');
  const settings = FGUA.get('settings');
  const root = el('div', 'app');
  const side = el('div', 'app-side', `<div class="brand">${icon('i-plug')} Console da API</div>`);
  const main = el('div', 'app-main');
  root.append(side, main);

  /* barra superior: modo */
  const modeBar = el('div', 'app-toolbar', `
    <span style="font-size:12px;color:var(--txt-secondary)">Modo:</span>
    <select id="ac-mode"><option value="demo">demo</option><option value="local">local</option><option value="remote">remote</option></select>
    <span class="sub" id="ac-mode-note"></span>`);
  main.appendChild(modeBar);
  const modeSel = modeBar.querySelector('#ac-mode');
  modeSel.value = settings.mode;
  const noteMode = () => { modeBar.querySelector('#ac-mode-note').textContent = settings.mode === 'demo' ? 'sem backend: operações remotas retornam indisponibilidade explícita' : settings.mode === 'local' ? 'backend/provedor local (ex.: LM Studio :1234)' : 'backend remoto autorizado'; };
  noteMode();
  modeSel.onchange = async () => { await router.setMode(modeSel.value); noteMode(); };

  /* seção: contrato /api/v1 */
  const cWrap = el('div', '');
  main.appendChild(cWrap);
  (async () => {
    cWrap.appendChild(el('h1', '', 'Contrato lógico /api/v1'));
    const r = await router.route('/api/v1/tools/list');
    const tools = r.data?.ferramentas ?? [];
    cWrap.appendChild(callout(`${tools.length} endpoints em ${Object.keys(settings).length ? Object.keys(FGUA.get('config').api.namespaces).length : 0} namespaces. Guard de permissões por namespace ativo.`));
    const box = el('div', '');
    cWrap.appendChild(box);
    for (const t of tools.slice(0, 999)) {
      const row = el('div', 'card', `<h4><code>${t.path}</code> <span class="badge info"><span class="dot"></span>${t.method}</span></h4><p class="sub">${t.description}</p><p>${stateBadge(t.state)}</p>`);
      row.style.cursor = 'pointer';
      row.onclick = () => runRequest(t.path, t.method === 'POST' ? {} : null);
      box.appendChild(row);
    }
  })();

  /* executor de request */
  const runArea = el('div');
  function runRequest(path, payload) {
    runArea.innerHTML = '';
    runArea.appendChild(el('h2', '', `Executar ${path}`));
    const inp = el('div', 'form-row', `<label>Payload JSON (para POST)</label>`);
    const ta = el('textarea');
    ta.value = payload ? JSON.stringify(payload, null, 2) : '{}';
    inp.appendChild(ta);
    const btn = el('button', 'btn primary', `${icon('i-play')} Enviar`);
    const out = el('div');
    btn.onclick = async () => {
      let p = null;
      try { p = JSON.parse(ta.value || 'null'); } catch { out.innerHTML = ''; out.appendChild(callout('JSON inválido', 'err')); return; }
      out.innerHTML = 'Executando…';
      const r = await router.route(path, { method: payload != null ? 'POST' : 'GET', payload: p });
      out.innerHTML = '';
      out.appendChild(el('p', '', `${stateBadge(r.state)} <span class="sub">${r.meta?.elapsedMs} ms · modo ${r.meta?.mode}</span>`));
      out.appendChild(jsonView(r.data ?? r.error));
    };
    runArea.append(inp, btn, out);
    main.appendChild(runArea);
    runArea.scrollIntoView({ behavior: 'smooth' });
  }

  /* seção LM Studio */
  const lsBox = el('div');
  main.appendChild(lsBox);
  (async () => {
    const cfg = settings.backends?.lmstudio ?? {};
    lsBox.appendChild(el('h1', '', 'LM Studio (modo local)'));
    lsBox.appendChild(callout(`Compatível com OpenAI: <code>GET /v1/models</code>, <code>POST /v1/chat/completions</code>, <code>POST /v1/completions</code>, <code>POST /v1/embeddings</code> · Nativa v1: <code>/api/v1/chat</code>, <code>/api/v1/models/load</code> · v0 legado: <code>/api/v0/models</code>. Porta padrão <b>1234</b>. CORS obrigatório: Developer → Server Settings → Enable CORS.`));
    const form = el('div', 'form-row', `
      <label>baseUrl do LM Studio</label>
      <input type="text" id="ls-url" value="${cfg.baseUrl ?? 'http://localhost:1234'}">
      <label>Token Bearer (opcional — Manage Tokens)</label>
      <input type="password" id="ls-token" placeholder="lm-studio-…">`);
    const ls = router.lmstudio;
    const actions = el('div', '', `<div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn primary" id="ls-health">Testar conexão</button>
      <button class="btn" id="ls-models">Listar modelos (v1/v0)</button>
      <button class="btn" id="ls-openai">Listar modelos (OpenAI)</button>
    </div>`);
    const out = el('div', '');
    lsBox.append(form, actions, out);

    const apply = () => { ls.setBaseUrl(form.querySelector('#ls-url').value); ls.setToken(form.querySelector('#ls-token').value); };
    form.querySelector('#ls-url').onchange = apply;
    form.querySelector('#ls-token').onchange = apply;

    const show = (r, label) => {
      out.innerHTML = '';
      out.appendChild(el('p', '', `${label}: ${stateBadge(r.state)}`));
      if (!r.ok && r.error) out.appendChild(callout(r.error + (r.hint ? `<br><span class="sub">${r.hint}</span>` : ''), 'err'));
      out.appendChild(jsonView(r.data));
    };

    actions.querySelector('#ls-health').onclick = async () => { apply(); show(await ls.health(), 'health'); };
    actions.querySelector('#ls-models').onclick = async () => { apply(); show(await ls.listModelsNative(), 'GET /api/v1/models'); };
    actions.querySelector('#ls-openai').onclick = async () => { apply(); show(await ls.listModelsOpenAI(), 'GET /v1/models'); };

    // chat de teste
    lsBox.appendChild(el('h2', '', 'Chat de teste (/v1/chat/completions)'));
    const chatBox = el('div', 'form-row', `
      <label>Mensagem</label>
      <input type="text" id="ls-msg" value="Explique o contrato /api/v1 em uma frase.">
      <label><span class="sw"><input type="checkbox" id="ls-stream" checked><i></i></span> Streaming (SSE)</label>`);
    const chatBtn = el('button', 'btn primary', `${icon('i-play')} Enviar`);
    const chatOut = el('div', 'json-view', '');
    chatOut.style.userSelect = 'text';
    chatBtn.onclick = async () => {
      apply();
      const models = await ls.listModelsOpenAI();
      if (!models.ok) { chatOut.textContent = `Falha: ${models.error ?? ''} ${models.hint ?? ''}`; return; }
      const model = models.data?.data?.[0]?.id;
      if (!model) { chatOut.textContent = 'Nenhum modelo carregado no LM Studio.'; return; }
      chatOut.textContent = `Modelo: ${model}\n`;
      const r = await ls.chat({
        model,
        messages: [{ role: 'user', content: chatBox.querySelector('#ls-msg').value }],
        stream: chatBox.querySelector('#ls-stream').checked,
        onToken: tok => { chatOut.textContent += tok; chatOut.scrollTop = chatOut.scrollHeight; }
      });
      if (!r.ok) chatOut.textContent += `\n[erro] ${r.error ?? ''}`;
    };
    lsBox.append(chatBox, chatBtn, chatOut);
  })();

  return root;
}

export default { mount };
