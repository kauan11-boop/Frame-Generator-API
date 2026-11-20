/**
 * FGUA v2 — Configurações do sistema.
 */

import { el, icon, callout } from './common.js';

export function mount(FGUA, opts = {}) {
  const router = FGUA.get('router');
  const settings = FGUA.get('settings');
  const store = FGUA.get('store');
  const root = el('div', 'app');
  const side = el('div', 'app-side', `<div class="brand">${icon('i-gear')} Configurações</div>`);
  const main = el('div', 'app-main');
  root.append(side, main);

  const pages = {
    sistema: { label: 'Sistema', ico: 'i-pc', render: renderSistema },
    person: { label: 'Personalização', ico: 'i-bright', render: renderPerson },
    rede: { label: 'Rede e API', ico: 'i-plug', render: renderRede },
    seguranca: { label: 'Segurança', ico: 'i-shield', render: renderSeg },
    sobre: { label: 'Sobre', ico: 'i-info', render: renderSobre }
  };
  let cur = opts.page && pages[opts.page] ? opts.page : 'sistema';
  function select(k) {
    cur = k;
    side.querySelectorAll('.side-item').forEach(x => x.classList.toggle('sel', x.dataset.k === k));
    main.innerHTML = '';
    pages[k].render(main);
  }
  for (const [k, p] of Object.entries(pages)) {
    const n = el('div', 'side-item', `${icon(p.ico)}${p.label}`);
    n.dataset.k = k;
    n.onclick = () => select(k);
    side.appendChild(n);
  }
  select(cur);

  function persist(patch) {
    const cur = store.get('fgua.config', 'settings-overrides', {});
    store.set('fgua.config', 'settings-overrides', { ...cur, ...patch });
    Object.assign(settings, patch);
  }

  function renderSistema(box) {
    box.appendChild(el('div', '', `<h1>Sistema</h1><p class="sub">Modo de operação e comportamento do shell.</p>`));
    const mode = el('div', 'form-row', `
      <label>Modo de operação</label>
      <select id="s-mode"><option value="demo">demo — sem backend (padrão)</option><option value="local">local — backend/provedor local</option><option value="remote">remote — backend remoto autorizado</option></select>
      <span class="hint">Em demo, operações remotas retornam indisponibilidade explícita (nunca resultado fictício).</span>`);
    mode.querySelector('#s-mode').value = settings.mode;
    mode.querySelector('#s-mode').onchange = e => { persist({ mode: e.target.value }); box.appendChild(callout('Modo atualizado. Em "Rede e API" configure o baseUrl do LM Studio.', '')); };
    box.appendChild(mode);
    const caps = FGUA.get('caps');
    box.appendChild(el('h2', '', 'Capacidades detectadas'));
    box.appendChild(el('div', 'cards', `
      <div class="card"><h4>WebGPU</h4><div class="kv"><span>Status</span><b>${caps.webgpu?.supported ? 'Disponível' : 'Ausente'}</b></div><div class="kv"><span>Adaptador</span><b>${caps.webgpu?.adapter?.vendor ?? '—'}</b></div></div>
      <div class="card"><h4>WebGL 2</h4><div class="kv"><span>Status</span><b>${caps.webgl2?.supported ? 'Disponível' : 'Ausente'}</b></div></div>
      <div class="card"><h4>WebAssembly</h4><div class="kv"><span>SIMD</span><b>${caps.wasm?.simd ? 'Sim' : 'Não'}</b></div></div>
      <div class="card"><h4>WebCodecs</h4><div class="kv"><span>VideoEncoder</span><b>${caps.webcodecs?.videoEncoder ? 'Sim' : 'Não'}</b></div></div>`));
  }

  function renderPerson(box) {
    box.appendChild(el('div', '', `<h1>Personalização</h1><p class="sub">Tema, papel de parede e cor de destaque.</p>`));
    const theme = el('div', 'form-row', `<label>Tema</label>
      <select id="p-theme"><option value="dark">Escuro</option><option value="light">Claro</option></select>`);
    theme.querySelector('#p-theme').value = settings.theme ?? 'dark';
    theme.querySelector('#p-theme').onchange = e => {
      persist({ theme: e.target.value });
      document.documentElement.dataset.theme = e.target.value;
    };
    box.appendChild(theme);
    const wp = el('div', 'form-row', `<label>Papel de parede</label>
      <select id="p-wp"><option value="bloom-dark">Bloom Escuro (padrão)</option><option value="bloom-light">Bloom Claro</option></select>`);
    wp.querySelector('#p-wp').value = settings.wallpaper ?? 'bloom-dark';
    wp.querySelector('#p-wp').onchange = e => {
      persist({ wallpaper: e.target.value });
      document.documentElement.style.setProperty('--wallpaper', `url('../assets/wallpapers/${e.target.value}.svg')`);
    };
    box.appendChild(wp);
    const accent = el('div', 'form-row', `<label>Cor de destaque</label>
      <select id="p-accent">
        <option value="#4cc2ff">Azul padrão</option><option value="#9fd6ff">Azul claro</option>
        <option value="#69dfb2">Menta</option><option value="#ffb900">Dourado</option>
        <option value="#ff8c9e">Rosé</option><option value="#c69cf9">Lilás</option>
      </select>`);
    accent.querySelector('#p-accent').value = settings.accent ?? '#4cc2ff';
    accent.querySelector('#p-accent').onchange = e => {
      persist({ accent: e.target.value });
      document.documentElement.style.setProperty('--accent', e.target.value);
    };
    box.appendChild(accent);
    box.appendChild(callout('Materiais Mica/Acrylic: blur + saturação sobre o papel de parede (backdrop-filter), como no Windows 11.', ''));
  }

  function renderRede(box) {
    box.appendChild(el('div', '', `<h1>Rede e API</h1><p class="sub">Backend compatível e LM Studio.</p>`));
    const form = el('div', 'form-row', `
      <label>LM Studio — baseUrl</label>
      <input type="text" id="n-url" value="${settings.backends?.lmstudio?.baseUrl ?? 'http://localhost:1234'}">
      <label>Backend custom (opcional)</label>
      <input type="text" id="n-custom" value="${settings.backends?.customBackend?.baseUrl ?? ''}" placeholder="https://meu-backend.example">
      <span class="hint">Em modo local/remote, o roteador /api/v1 faz proxy para esse baseUrl quando habilitado.</span>
      <button class="btn primary" id="n-save">Salvar</button>
      <button class="btn" id="n-test">Testar LM Studio</button>`);
    box.appendChild(form);
    const out = el('div');
    box.appendChild(out);
    form.querySelector('#n-save').onclick = () => {
      persist({ backends: { ...settings.backends, lmstudio: { ...settings.backends?.lmstudio, baseUrl: form.querySelector('#n-url').value }, customBackend: { ...settings.backends?.customBackend, baseUrl: form.querySelector('#n-custom').value, enabled: !!form.querySelector('#n-custom').value } } });
      out.innerHTML = '';
      out.appendChild(callout('Configuração salva (persistida localmente).', ''));
    };
    form.querySelector('#n-test').onclick = async () => {
      const ls = router.lmstudio;
      ls.setBaseUrl(form.querySelector('#n-url').value);
      const r = await ls.health();
      out.innerHTML = '';
      out.appendChild(callout(r.ok
        ? `LM Studio online em <code>${r.data.baseUrl}</code> — ${r.data.models} modelo(s).`
        : `${r.error ?? ''}<br><span class="sub">${r.hint ?? 'Inicie o servidor no LM Studio (Developer → Start Server) e habilite CORS.'}</span>`, r.ok ? '' : 'warn'));
    };
    box.appendChild(callout('CORS: no LM Studio, ative Developer → Server Settings → Enable CORS. Com auth, use Authorization: Bearer <token>.', 'warn'));
  }

  function renderSeg(box) {
    box.appendChild(el('div', '', `<h1>Segurança</h1><p class="sub">Travas de UI e políticas locais.</p>`));
    const sec = FGUA.get('security');
    const rm = sec.rolesMatrix();
    box.appendChild(el('div', 'cards', `
      <div class="card"><h4>Política de login</h4>
        <div class="kv"><span>Tentativas máximas</span><b>${rm.data?.policy?.maxFailedLogins ?? 5}</b></div>
        <div class="kv"><span>Bloqueio</span><b>${rm.data?.policy?.lockSeconds ?? 30}s</b></div>
        <div class="kv"><span>Hash</span><b>${rm.data?.policy?.passwordHash ?? 'SHA-256'}</b></div></div>
      <div class="card"><h4>Nível de garantia</h4>
        <p class="sub">Autenticação e permissões são aplicadas na interface e no roteador local. Autorização <b>confiável</b> exige backend.</p></div>`));
    const b = el('button', 'btn', `${icon('i-users')} Abrir Usuários`);
    b.onclick = () => window.dispatchEvent(new CustomEvent('fgua:open-app', { detail: { id: 'users' } }));
    box.appendChild(b);
  }

  function renderSobre(box) {
    box.appendChild(el('div', '', `<h1>Sobre</h1><p class="sub">Frame-Generator-API v2.0.0 — contrato /api/v1 · MIT.</p>`));
    box.appendChild(el('p', '', `Bootado em ${FGUA.get('kernel').bootedAt ?? '—'} · storage: ${store.driver} · locale: ${settings.locale}`));
    const b = el('button', 'btn', 'Abrir documentação');
    b.onclick = () => window.dispatchEvent(new CustomEvent('fgua:open-app', { detail: { id: 'docs' } }));
    box.appendChild(b);
  }

  return root;
}

export default { mount };
