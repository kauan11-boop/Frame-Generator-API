import { bootCore } from './api.js';
import { esc, pill, pre, pills, setActiveTab, renderError } from './render.js';

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) setActiveTab(b.dataset.tab);
});

async function copyText(text) {
  try { await navigator.clipboard.writeText(String(text ?? '')); } catch {}
}

function getStatus(app){ try { return app?.getStatus ? app.getStatus() : null; } catch { return null; } }

function barChart(items, opts = {}) {
  const data = (items || []).filter(d => (d.value ?? 0) >= 0);
  const w = opts.width || 520, h = opts.height || 180, padL = 90, padR = 16, padT = 10, padB = 24;
  if (!data.length) return `<div class="muted">Sem dados para gráfico.</div>`;
  const max = Math.max(1, ...data.map(d => Number(d.value) || 0));
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const barH = Math.max(10, Math.min(22, (innerH / data.length) - 6));
  const colors = ['#111827','#374151','#6b7280','#2563eb','#059669','#d97706','#dc2626','#7c3aed'];
  const rows = data.map((d, i) => {
    const v = Number(d.value) || 0;
    const bw = Math.round((v / max) * innerW);
    const y = padT + i * (innerH / data.length) + ((innerH / data.length) - barH) / 2;
    const color = d.color || colors[i % colors.length];
    return `
      <text x="${padL - 8}" y="${y + barH * 0.75}" text-anchor="end" font-size="11" fill="#6b7280">${esc(d.label)}</text>
      <rect x="${padL}" y="${y}" width="${innerW}" height="${barH}" rx="4" fill="#f3f4f6"></rect>
      <rect x="${padL}" y="${y}" width="${Math.max(v ? 2 : 0, bw)}" height="${barH}" rx="4" fill="${color}"></rect>
      <text x="${padL + Math.max(v ? 2 : 0, bw) + 6}" y="${y + barH * 0.75}" font-size="11" fill="#374151">${esc(String(v))}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="${esc(opts.title||'Gráfico')}">${rows}</svg>`;
}

function donutChart(items, opts = {}) {
  const data = (items || []).filter(d => (Number(d.value) || 0) > 0);
  const size = opts.size || 180, cx = size / 2, cy = size / 2, r = 62, sw = 22;
  const colors = ['#111827','#2563eb','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#6b7280'];
  if (!data.length) return `<div class="muted">Sem dados para gráfico.</div>`;
  const total = data.reduce((a,d)=>a + (Number(d.value)||0), 0) || 1;
  let offset = 0;
  const circ = 2 * Math.PI * r;
  const segs = data.map((d,i)=>{
    const v = Number(d.value)||0; const frac = v/total; const dash = frac*circ; const gap = circ-dash;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color||colors[i%colors.length]}" stroke-width="${sw}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
    offset += dash; return el;
  }).join('');
  const legend = data.map((d,i)=>`<span class="legend-item"><span class="legend-dot" style="background:${d.color||colors[i%colors.length]}"></span>${esc(d.label)}: <b>${esc(String(d.value))}</b></span>`).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(opts.title||'Gráfico')}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f3f4f6" stroke-width="${sw}"></circle>
    ${segs}
    <text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="18" font-weight="600" fill="#111827">${esc(String(total))}</text>
    <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="10" fill="#6b7280">${esc(opts.centerLabel||'total')}</text>
  </svg><div class="chart-legend">${legend}</div></div>`;
}

function renderOverview(app){
  const s = getStatus(app); const caps = s?.capabilities || app?.caps || {}; const c = caps.capabilities || {};
  const counts = s?.counts || {};
  const tasks = app?.tasks?.list ? app.tasks.list() : (app?.jobs?.list ? app.jobs.list() : []);
  const models = app?.modelRegistry?.list ? app.modelRegistry.list() : [];
  const engines = app?.engines?.list ? app.engines.list() : [];
  const providers = app?.providers?.list ? app.providers.list() : [];
  const generators = app?.generatorRegistry?.list ? app.generatorRegistry.list() : [];

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const sp = document.getElementById('status-pill'); if (sp) { sp.textContent = s?.status || (app?.error ? 'erro' : 'indisponível'); sp.className = 'status ' + (s?.status === 'ready' ? 'ok' : (app?.error ? 'err' : '')); }
  setText('mode-pill', app?.api?.mode || s?.mode || 'demo');
  setText('base', new URL('../', location.href).toString());
  setText('meta', s ? `v${s.version} • ${s.modules?.length||0} módulos • ${s.initialized ? 'inicializado' : 'não inicializado'}` : 'núcleo indisponível');

  const countItems = [
    { label: 'Modelos', value: counts.models ?? models.length },
    { label: 'Geradores', value: counts.generators ?? generators.length },
    { label: 'Engines', value: counts.engines ?? engines.length },
    { label: 'Tarefas', value: counts.tasks ?? tasks.length },
    { label: 'Provedores', value: counts.providers ?? providers.length },
    { label: 'Repacks', value: counts.repacks ?? 0 },
    { label: 'Ferramentas', value: counts.tools ?? 0 },
  ];

  const stateMap = {};
  for (const t of tasks) { const k = t.state || 'Unknown'; stateMap[k] = (stateMap[k]||0)+1; }
  const stateItems = Object.entries(stateMap).map(([k,v])=>({label:k, value:v}));
  if (!stateItems.length) stateItems.push({label:'Sem tarefas', value:0, color:'#d1d5db'});

  const capItems = [
    { label:'WebGPU', value: c.webgpu ? 1 : 0 },
    { label:'WebAssembly', value: c.wasm ? 1 : 0 },
    { label:'WebCodecs', value: c.webcodecs ? 1 : 0 },
    { label:'Workers', value: c.workers ? 1 : 0 },
    { label:'IndexedDB', value: c.indexedDB ? 1 : 0 },
    { label:'OffscreenCanvas', value: c.offscreenCanvas ? 1 : 0 },
  ].map(i=>({ ...i, valueText: i.value ? 'disponível' : 'indisponível' }));

  const engineItems = engines.length ? engines.map(e=>({ label: e.name || e.id, value: (e.available===true || e.state==='available' || e.state==='configured') ? 1 : 0, state: e.available===true?'disponível':(e.available===false?'indisponível':(e.state||'—')) })) : [];

  const providerItems = providers.length ? providers.map(p=>({label:p.name||p.id, value:1, state:p.state||'—'})) : [];

  const overviewEl = document.getElementById('tab-overview'); if (!overviewEl) return;
  overviewEl.innerHTML = `
    <div class="grid">
      <div class="card"><h3>Estado do sistema</h3><div class="kv">
        <div>Status</div><div>${pill(s?.status||'n/d')}</div>
        <div>Modo</div><div>${pill(app?.api?.mode||'demo')}</div>
        <div>Hospedagem</div><div>${pill('GitHub Pages')} ${pill('estático')}</div>
        <div>Backend API</div><div>${pill(app?.api?.baseUrl ? 'configurado' : 'não conectado')}</div>
        <div>Início</div><div class="muted">${esc(s?.startedAt||'—')}</div>
      </div></div>
      <div class="card"><h3>Resumo</h3><div class="kv">
        <div>Modelos</div><div>${pill(counts.models ?? models.length)}</div>
        <div>Geradores</div><div>${pill(counts.generators ?? generators.length)}</div>
        <div>Engines</div><div>${pill(counts.engines ?? engines.length)}</div>
        <div>Tarefas</div><div>${pill(counts.tasks ?? tasks.length)}</div>
        <div>Provedores</div><div>${pill(counts.providers ?? providers.length)}</div>
      </div><p class="section-note">Dados reais do núcleo FGUA (sessão atual no navegador).</p></div>
      <div class="card"><h3>Recursos do navegador</h3>
        <table><thead><tr><th>Capacidade</th><th>Estado</th></tr></thead><tbody>
        ${capItems.map(i=>`<tr><td>${esc(i.label)}</td><td>${pill(i.value?'disponível':'indisponível')}</td></tr>`).join('')}
        </tbody></table>
        <div class="kv mt"><div>CPU cores</div><div>${pill(caps.hardware?.hardwareConcurrency ?? 'n/d')}</div>
        <div>Memória</div><div>${pill(caps.hardware?.deviceMemoryGB ? caps.hardware.deviceMemoryGB+' GB' : 'n/d')}</div></div>
      </div>
    </div>

    <div class="charts-grid mt">
      <div class="card"><h3>Recursos registrados (contagem)</h3>
        ${barChart(countItems, { title: 'Contagens', width: 520, height: 220 })}
      </div>
      <div class="card"><h3>Tarefas por estado</h3>
        ${donutChart(stateItems, { title: 'Estados das tarefas', size: 180, centerLabel: 'tarefas' })}
      </div>
    </div>

    <div class="grid mt">
      <div class="card"><h3>Engines</h3>
        ${engineItems.length ? `<table><thead><tr><th>Engine</th><th>Disponibilidade</th></tr></thead><tbody>${engineItems.map(e=>`<tr><td>${esc(e.label)}</td><td>${pill(e.state)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhuma engine registrada.</p>'}
      </div>
      <div class="card"><h3>Provedores</h3>
        ${providerItems.length ? `<table><thead><tr><th>Provedor</th><th>Estado</th></tr></thead><tbody>${providerItems.map(p=>`<tr><td>${esc(p.label)}</td><td>${pill(p.state)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhum provedor registrado.</p>'}
      </div>
      <div class="card"><h3>Modelos registrados</h3>
        ${models.length ? `<table><thead><tr><th>Nome</th><th>Formato</th><th>Estado</th></tr></thead><tbody>${models.slice(0,8).map(m=>`<tr><td>${esc(m.name||m.fileName||m.id)}</td><td>${pill(m.format||'—')}</td><td>${pill(m.state||'—')}</td></tr>`).join('')}</tbody></table>${models.length>8?`<p class="muted mt">+${models.length-8} outros (ver payload de integração).</p>`:''}` : '<p class="muted">Nenhum modelo analisado/registrado nesta sessão.</p>'}
      </div>
    </div>`;
}

function buildIntegrationPayload(app, siteBase) {
  const s = getStatus(app) || {};
  const models = app?.modelRegistry?.list ? app.modelRegistry.list().map(m=>({id:m.id,name:m.name||m.fileName,format:m.format,architecture:m.architecture,quantization:m.quantization,quantized:m.quantized,unquantized:m.unquantized,precision:m.precision,contextLength:m.contextLength,size:m.size,state:m.state,runtimeCompatible:m.runtimeCompatible||[]})) : [];
  const engines = app?.engines?.list ? app.engines.list() : [];
  const providers = app?.providers?.list ? app.providers.list() : [];
  const generators = app?.generatorRegistry?.list ? app.generatorRegistry.list() : [];
  const contract = app?.api?.getContract ? app.api.getContract() : { base:'/api/v1', namespaces: [] };
  return {
    project: 'Frame-Generator-API',
    site: siteBase,
    generatedAt: new Date().toISOString(),
    mode: app?.api?.mode || 'demo',
    backend: { baseUrl: app?.api?.baseUrl || null, configured: !!app?.api?.baseUrl },
    contract,
    status: { status: s.status, initialized: s.initialized, version: s.version, counts: s.counts || {} },
    capabilities: s.capabilities || app?.caps || {},
    models,
    engines,
    providers,
    generators,
    integration: {
      masterPrompt: siteBase + 'Public/documentation/master-prompt.md',
      commands: siteBase + 'Public/documentation/commands.md',
      configs: {
        api: siteBase + 'configs/api.json',
        models: siteBase + 'configs/models.json',
        generators: siteBase + 'configs/generators.json',
        repacks: siteBase + 'configs/repacks.json',
        permissions: siteBase + 'configs/permissions.json',
        settings: siteBase + 'configs/settings.json'
      },
      license: { type: 'MIT', file: siteBase + 'LICENSE' }
    },
    notes: [
      'Hospedagem estática: /api/v1 é contrato lógico; operações remotas requerem backend/provedor configurado.',
      'Inferência/processamento pesado requer runtime/engine compatível; sem simulação de resultados.',
      'GGUF: metadados analisados no cliente; modelos sem quantização (F32/F16/BF16) identificados quando aplicável. Execução requer runtime/provedor.',
      'Use este payload para integrar informações e endpoints em modelos de IA ou em projetos externos.'
    ]
  };
}

async function renderIntegration(app){
  const siteBase = new URL('../', location.href).toString();
  const payload = buildIntegrationPayload(app, siteBase);
  const contract = payload.contract || { base:'/api/v1', namespaces: [] };
  const endpoints = [
    'GET  /api/v1/models', 'POST /api/v1/models/load', 'POST /api/v1/models/unload', 'GET  /api/v1/models/metadata',
    'GET  /api/v1/quantization/types', 'POST /api/v1/quantization/analyze', 'POST /api/v1/quantization/jobs',
    'GET  /api/v1/generators', 'POST /api/v1/generators/execute', 'POST /api/v1/frames/interpolate', 'POST /api/v1/images/upscale',
    'POST /api/v1/videos/process', 'GET  /api/v1/jobs', 'POST /api/v1/jobs/{id}/cancel',
    'GET  /api/v1/engines', 'GET  /api/v1/repack', 'GET  /api/v1/tools', 'GET  /api/v1/config'
  ];
  const jsExample =
`// Integração com Frame-Generator-API (contrato /api/v1)
// Hospedagem estática: defina baseUrl de um backend compatível quando disponível.
const API_BASE = '${(app?.api?.baseUrl || siteBase + 'api/v1').replace(/'/g, "\\'")}';

async function api(path, options = {}) {
  const res = await fetch(API_BASE.replace(/\\/$/, '') + path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers||{}) },
    ...options
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// Exemplos (requerem backend/provedor compatível):
// const models = await api('/models');
// const job = await api('/generators/execute', { method:'POST', body: JSON.stringify({ generator:'image-generator', input:{...} }) });

// Consumir informações/configurações estáticas publicadas:
// fetch('${siteBase}configs/api.json').then(r=>r.json())
// fetch('${siteBase}configs/models.json').then(r=>r.json())`;

  const projectExample =
`# Uso em projetos (ex.: pipelines de IA / orquestradores)
# 1) Consuma o payload de integração (JSON) para descobrir modelos, engines, provedores e endpoints.
# 2) Configure backend compatível (api.baseUrl) para execução real; sem backend, operações retornam indisponível.
# 3) Envie requisições ao contrato /api/v1 com o gerador/modelo/engine adequados.
# 4) Trate estados: ready, unavailable, requires-provider/runtime (sem resultados simulados).

Payload: exportado por esta aba ("Baixar payload de integração").`;

  let masterPrompt = 'Master prompt indisponível (abra ./documentation/master-prompt.md).';
  const mpCandidates = ['./documentation/master-prompt.md', 'documentation/master-prompt.md', `${siteBase}Public/documentation/master-prompt.md`, `${siteBase}public/documentation/master-prompt.md`, '../Public/documentation/master-prompt.md'];
  let masterPromptUrl = './documentation/master-prompt.md';
  for (const u of mpCandidates) {
    try { const r = await fetch(u, { cache: 'no-store' }); if (r.ok) { masterPrompt = await r.text(); masterPromptUrl = u; break; } } catch {}
  }
  const commandsText = `npx serve .                      # servir localmente (GitHub Pages/estático)\n`+
`# Configs JSON: configs/api.json, settings.json, models.json, generators.json, repacks.json, permissions.json\n`+
`# API lógica: /api/v1/* (contrato; requer backend/provedor para execução remota)\n`+
`# Exportar integração: Dashboard → Integração → Baixar payload (JSON)\n`+
`# Master prompt: Public/documentation/master-prompt.md\n`+
`# Licença: LICENSE (MIT)`;

  const integrationEl = document.getElementById('tab-integration'); if (!integrationEl) return;
  integrationEl.innerHTML = `
    <div class="grid">
      <div class="card"><h3>Integração de API e informações</h3>
        <p class="muted">Aba dedicada para integrar informações e APIs do Frame-Generator-API em <b>modelos de IA</b> ou em <b>projetos</b> que a IA está desenvolvendo/operando. Exporte o payload e use o contrato <code>/api/v1</code> com um backend/provedor compatível quando necessário.</p>
        <div class="kv mt">
          <div>Modo</div><div>${pill(payload.mode)}</div>
          <div>Contrato</div><div><code>${esc(contract.base||'/api/v1')}</code></div>
          <div>Backend</div><div>${pill(payload.backend.configured?'configurado':'não conectado')} <span class="muted">${esc(payload.backend.baseUrl||'')}</span></div>
          <div>Modelos</div><div>${pill(payload.models.length)}</div>
          <div>Engines</div><div>${pill(payload.engines.length)}</div>
          <div>Provedores</div><div>${pill(payload.providers.length)}</div>
        </div>
        <div class="integration-actions">
          <button class="btn primary" id="dl-payload">Baixar payload de integração (JSON)</button>
          <button class="btn" id="copy-payload">Copiar payload</button>
          <a class="btn" id="dl-master" href="./documentation/master-prompt.md" download>Baixar Master Prompt</a>
        </div>
      </div>
      <div class="card"><h3>Conexão (backend/API)</h3>
        <p class="muted">Configure a URL base de um backend compatível para executar operações remotas. Em modo estático/demo, chamadas sem backend retornam indisponibilidade explícita.</p>
        <div class="form-row"><input id="api-base" placeholder="https://seu-backend.exemplo/api/v1" style="min-width:260px" value="${esc(app?.api?.baseUrl||'')}" />
          <select id="api-mode"><option value="demo">demo</option><option value="local">local</option><option value="remote">remote</option></select>
          <button class="btn primary" id="api-save">Aplicar</button></div>
        <div class="muted" id="api-status" style="margin-top:8px">Configuração aplicada apenas nesta sessão do navegador.</div>
        <div class="mt"><div class="chart-title">Namespaces</div>${pills(contract.namespaces||[])||'<span class="muted">—</span>'}</div>
      </div>
    </div>

    <div class="grid mt">
      <div class="card"><h3>Endpoints (contrato /api/v1)</h3>${pre(endpoints)}</div>
      <div class="card"><h3>Recursos para integração</h3>
        <table><thead><tr><th>Tipo</th><th>Itens</th><th>Exemplos</th></tr></thead><tbody>
          <tr><td>Modelos</td><td>${pill(payload.models.length)}</td><td class="muted">${esc(payload.models.slice(0,3).map(m=>m.name||m.id).join(', ')||'—')}</td></tr>
          <tr><td>Engines</td><td>${pill(payload.engines.length)}</td><td class="muted">${esc(payload.engines.slice(0,3).map(e=>e.name||e.id).join(', ')||'—')}</td></tr>
          <tr><td>Provedores</td><td>${pill(payload.providers.length)}</td><td class="muted">${esc(payload.providers.slice(0,3).map(p=>p.name||p.id).join(', ')||'—')}</td></tr>
          <tr><td>Geradores</td><td>${pill(payload.generators.length)}</td><td class="muted">${esc(payload.generators.slice(0,3).map(g=>g.name||g.id).join(', ')||'—')}</td></tr>
        </tbody></table>
        <div class="mt"><div class="chart-title">Configs públicas (estáticas)</div>
          ${pills(['configs/api.json','configs/models.json','configs/generators.json','configs/repacks.json','configs/permissions.json','configs/settings.json'])}
        </div>
      </div>
    </div>

    <div class="grid mt">
      <div class="card"><h3>Comandos necessários</h3>
        <div class="code-block"><button class="btn copy-btn" id="copy-cmd">Copiar</button><pre id="code-cmd">${esc(commandsText)}</pre></div>
        <p class="section-note">Mais detalhes: <a href="./documentation/commands.md">documentation/commands.md</a></p>
      </div>
      <div class="card"><h3>Licença</h3>
        <div class="kv"><div>Tipo</div><div>${pill('MIT')}</div><div>Arquivo</div><div><a href="../LICENSE">LICENSE</a></div><div>Uso</div><div class="muted">Permite uso, cópia, modificação e distribuição conforme termos MIT (ver arquivo).</div></div>
        <p class="section-note">Ao integrar em projetos/IA, mantenha aviso de copyright e licença.</p>
      </div>
    </div>

    <div class="card mt"><h3>Master Prompt (integração IA / projetos)</h3>
      <p class="muted">Prompt para conectar/adaptar esta API e seus componentes em modelos de IA ou em projetos que a IA está criando.</p>
      <div class="code-block"><button class="btn copy-btn" id="copy-master">Copiar</button><pre id="code-master">${esc(masterPrompt)}</pre></div>
    </div>

    <div class="card mt"><h3>Exemplo: integração em código (projetos / modelos de IA)</h3>
      <div class="code-block"><button class="btn copy-btn" id="copy-js">Copiar</button><pre id="code-js">${esc(jsExample)}</pre></div>
    </div>
    <div class="card mt"><h3>Exemplo: uso em projetos de IA</h3>
      <div class="code-block"><button class="btn copy-btn" id="copy-proj">Copiar</button><pre id="code-proj">${esc(projectExample)}</pre></div>
    </div>
    <div class="card mt"><h3>Payload de integração (prévia)</h3>
      <pre id="payload-pre">${esc(JSON.stringify(payload, null, 2))}</pre>
    </div>`;

  const modeSel = document.getElementById('api-mode'); if(modeSel) modeSel.value = app?.api?.mode||'demo';
  document.getElementById('api-save')?.addEventListener('click', async ()=>{
    const base = document.getElementById('api-base')?.value?.trim() || null;
    const mode = document.getElementById('api-mode')?.value || 'demo';
    const r = app?.api?.configure?.({ baseUrl: base, mode });
    document.getElementById('api-status').textContent = 'Configuração aplicada: ' + JSON.stringify(r||{});
    document.getElementById('mode-pill').textContent = app?.api?.mode || mode;
    await renderIntegration(app); // re-render com payload atualizado
  });
  document.getElementById('dl-payload')?.addEventListener('click', ()=>{
    const data = buildIntegrationPayload(app, siteBase);
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'frame-generator-api-integration.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  });
  document.getElementById('copy-payload')?.addEventListener('click', ()=>copyText(JSON.stringify(buildIntegrationPayload(app, siteBase), null, 2)));
  document.getElementById('copy-js')?.addEventListener('click', ()=>copyText(document.getElementById('code-js')?.textContent||''));
  document.getElementById('copy-proj')?.addEventListener('click', ()=>copyText(document.getElementById('code-proj')?.textContent||''));
  document.getElementById('copy-master')?.addEventListener('click', ()=>copyText(document.getElementById('code-master')?.textContent||''));
  document.getElementById('copy-cmd')?.addEventListener('click', ()=>copyText(document.getElementById('code-cmd')?.textContent||''));
  const dlMaster = document.getElementById('dl-master'); if (dlMaster && masterPromptUrl) dlMaster.href = masterPromptUrl;
}

(async () => {
  try {
    const app = await bootCore();
    window.FGUA = app && !app.error ? app : window.FGUA;
    renderOverview(app);
    await renderIntegration(app);
  } catch (e) {
    const sp = document.getElementById('status-pill'); if (sp) { sp.textContent = 'erro'; sp.classList.add('err'); }
    renderError(document.getElementById('tab-overview'), e);
  }
})();
