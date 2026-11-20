import { bootCore, loadLegacy } from './api.js';
import { CONFIG } from './config.js';
import { esc, pill, pre, pills, setActiveTab, renderError } from './render.js';

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) setActiveTab(b.dataset.tab);
});

async function copyFrom(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try { await navigator.clipboard.writeText(el.value || el.textContent || ''); } catch {}
}

function renderOverview(app, legacy) {
  const s = app?.getStatus ? app.getStatus() : null;
  const caps = s?.capabilities || app?.caps || {};
  const c = caps.capabilities || {};
  const mods = s?.modules || [];
  const legacyStatus = legacy?.status || legacy?.system_status;
  document.getElementById('status-pill').textContent = s?.status || (app?.error ? 'erro' : 'indisponível');
  document.getElementById('status-pill').classList.add(s?.status === 'ready' ? 'ok' : (app?.error ? 'err' : ''));
  document.getElementById('base').textContent = new URL('../src', location.href).toString();
  document.getElementById('meta').textContent = s ? `FGUA ${s.version} • módulos ${mods.length} • pronto ${s.initialized ? 'sim' : 'não'}` : 'FGUA não inicializado';

  const counts = s?.counts || {};
  document.getElementById('tab-overview').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Sistema (núcleo FGUA)</h3><div class="kv">
        <div>Status</div><div>${pill(s?.status || 'n/d')}</div>
        <div>Inicializado</div><div>${pill(String(!!s?.initialized))}</div>
        <div>Início</div><div class="muted">${esc(s?.startedAt || '—')}</div>
        <div>Hospedagem</div><div>${pill('GitHub Pages')} ${pill('estático')}</div>
      </div></div>
      <div class="card"><h3>Contagens</h3><div class="kv">
        <div>Modelos</div><div>${pill(counts.models ?? 0)}</div>
        <div>Tarefas</div><div>${pill(counts.tasks ?? 0)}</div>
        <div>Provedores</div><div>${pill(counts.providers ?? 0)}</div>
        <div>Engines</div><div>${pill(counts.engines ?? 0)}</div>
        <div>Ferramentas</div><div>${pill(counts.tools ?? 0)}</div>
        <div>Repacks</div><div>${pill(counts.repacks ?? 0)}</div>
        <div>Controladores</div><div>${pill(counts.controllers ?? 0)}</div>
      </div></div>
      <div class="card"><h3>Compatibilidade</h3>
        ${pills(Object.entries(c).filter(([,v])=>v).map(([k])=>k)) || '<span class="muted">n/d</span>'}
        <div class="kv mt"><div>WebGPU</div><div>${pill(app?.webgpuInfo?.available ? 'disponível' : 'indisponível')} <span class="muted">${esc(app?.webgpuInfo?.reason || '')}</span></div>
        <div>CPU cores</div><div>${pill(caps.hardware?.hardwareConcurrency ?? 'n/d')}</div>
        <div>Memória (dev)</div><div>${pill(caps.hardware?.deviceMemoryGB ? caps.hardware.deviceMemoryGB+' GB' : 'n/d')}</div></div>
      </div>
    </div>
    <div class="card mt"><h3>Módulos registrados</h3>
      <table><thead><tr><th>Módulo</th><th>Categoria</th><th>Registrado em</th></tr></thead>
      <tbody>${mods.map(m=>`<tr><td><b>${esc(m.name)}</b></td><td>${pill(m.meta?.category||'—')}</td><td class="muted">${esc(m.meta?.registeredAt||'—')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Nenhum módulo</td></tr>'}</tbody></table>
    </div>
    ${legacyStatus ? `<div class="card mt"><h3>Conteúdo controlado (manifesto legado)</h3>${pre(legacyStatus)}</div>` : ''}
    <div class="card mt"><h3>Estado do núcleo</h3>${pre(s || { error: app?.error?.message || 'indisponível' })}</div>`;
}

function renderModels(app, legacy) {
  const reg = app?.modelRegistry?.list ? app.modelRegistry.list() : [];
  const legacyModels = legacy?.models;
  document.getElementById('tab-models').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Analisar modelo (GGUF/arquivo local)</h3>
        <p class="muted">Parser GGUF real no navegador (cabeçalho, metadados e índice de tensores). Nenhum arquivo é enviado automaticamente a servidores.</p>
        <input type="file" id="model-file" />
        <div class="row"><button class="btn primary" id="model-analyze">Analisar</button><span class="muted" id="model-analyze-status"></span></div>
      </div>
      <div class="card"><h3>Registro de modelos (núcleo)</h3>
        <div class="kv"><div>Total</div><div>${pill(reg.length)}</div><div>Carregados</div><div>${pill(app?.modelLoader?.listLoaded?.().length || 0)}</div></div>
        <p class="muted mt">Carregamento/execução de inferência requer runtime ou provedor compatível.</p>
      </div>
    </div>
    <div class="card mt"><h3>Modelos registrados</h3>
      ${reg.length ? `<table><thead><tr><th>ID/Nome</th><th>Formato</th><th>Arquitetura</th><th>Quantização</th><th>Estado</th><th>Tamanho</th></tr></thead><tbody>${reg.map(m=>`<tr><td><b>${esc(m.id)}</b><div class="muted">${esc(m.name)}</div></td><td>${pill(m.format||'—')}</td><td>${pill(m.architecture||'—')}</td><td>${pill(m.quantization||'—')}</td><td>${pill(m.state||'—')}</td><td class="muted">${esc(m.sizeHuman||m.size||'—')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhum modelo registrado ainda. Analise um arquivo GGUF para registrar metadados.</p>'}
    </div>
    <div class="card mt"><h3>Resultado da análise</h3><pre id="model-analysis-out">Nenhuma análise executada.</pre></div>
    ${legacyModels ? `<div class="card mt"><h3>Catálogo legado controlado</h3>${pre(legacyModels)}</div>` : ''}`;

  const btn = document.getElementById('model-analyze');
  btn?.addEventListener('click', async () => {
    const input = document.getElementById('model-file');
    const out = document.getElementById('model-analysis-out');
    const st = document.getElementById('model-analyze-status');
    const file = input?.files?.[0];
    if (!file) { st.textContent = 'Selecione um arquivo.'; return; }
    if (!app?.modelLoader) { st.textContent = 'ModelLoader indisponível.'; return; }
    st.textContent = 'Analisando…';
    try {
      const res = await app.modelLoader.analyzeFile(file);
      out.textContent = JSON.stringify(res, null, 2);
      st.textContent = res.ok ? 'Análise concluída e registrada.' : 'Análise concluída com avisos.';
      // atualiza a aba para refletir registro
      renderModels(app, legacy);
      // restaura saída (renderModels recria elementos)
      const out2 = document.getElementById('model-analysis-out');
      const st2 = document.getElementById('model-analyze-status');
      if (out2) out2.textContent = JSON.stringify(res, null, 2);
      if (st2) st2.textContent = res.ok ? 'Análise concluída e registrada.' : 'Análise concluída com avisos.';
    } catch (e) {
      out.textContent = JSON.stringify({ ok:false, error: e.message }, null, 2);
      st.textContent = 'Falha na análise.';
    }
  });
}

function renderFrames(app, legacy) {
  const engines = app?.engines?.list ? app.engines.list() : [];
  const gens = app?.config?.get ? (app.config.get('generators')?.generators || []) : [];
  const legacyFrames = legacy?.frames; const legacyTemplates = legacy?.templates;
  document.getElementById('tab-frames').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Geradores / Engines registrados</h3>
        <table><thead><tr><th>Engine</th><th>Categoria</th><th>Status</th><th>Capacidades</th></tr></thead>
        <tbody>${engines.map(e=>`<tr><td><b>${esc(e.name||e.id)}</b><div class="muted">${esc(e.id)}</div></td><td>${pill(e.category||'—')}</td><td>${pill(e.status||'—')}</td><td>${pills((e.capabilities||[]).slice(0,6))}${(e.capabilities||[]).length>6?pill('+'+((e.capabilities.length-6))):''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhum engine</td></tr>'}</tbody></table>
      </div>
      <div class="card"><h3>Geradores configurados</h3>${pre(gens)}</div>
    </div>
    <div class="card mt"><h3>Planejamento (UniversalFrameGenerator)</h3>
      <p class="muted">Gera um plano de operações por categoria. Execução real requer engine/provedor compatível (nenhuma simulação de resultado).</p>
      <div class="row"><button class="btn primary" id="plan-image">Plano imagem</button><button class="btn" id="plan-video">Plano vídeo</button><button class="btn" id="plan-game">Plano jogo</button></div>
      <pre id="plan-out" class="mt">Selecione um tipo para gerar plano.</pre>
    </div>
    ${legacyFrames ? `<div class="card mt"><h3>Conteúdo legado: orquestração de quadros</h3>${pre(legacyFrames)}</div>` : ''}
    ${legacyTemplates ? `<div class="card mt"><h3>Conteúdo legado: templates</h3>${pre(legacyTemplates)}</div>` : ''}`;
  const setPlan = (cat) => { const p = app?.universalGenerator?.plan({ category: cat, upscale:true, interpolate: cat!=='image' }); document.getElementById('plan-out').textContent = JSON.stringify(p, null, 2); };
  document.getElementById('plan-image')?.addEventListener('click', ()=>setPlan('image'));
  document.getElementById('plan-video')?.addEventListener('click', ()=>setPlan('video'));
  document.getElementById('plan-game')?.addEventListener('click', ()=>setPlan('game'));
}

function renderPackages(app, legacy) {
  const tools = app?.tools?.list ? app.tools.list() : [];
  const repacks = app?.repacks?.list ? app.repacks.list() : [];
  const ctrls = app?.controllers?.list ? app.controllers.list() : [];
  const legacyPkgs = legacy?.packages;
  document.getElementById('tab-packages').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Ferramentas</h3>${tools.length?pre(tools):'<p class="muted">Nenhuma ferramenta registrada.</p>'}</div>
      <div class="card"><h3>Repacks</h3>${repacks.length?pre(repacks):'<p class="muted">Nenhum repack registrado.</p>'}</div>
    </div>
    <div class="card mt"><h3>Controladores</h3>
      <table><thead><tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Status</th></tr></thead>
      <tbody>${ctrls.map(c=>`<tr><td><code>${esc(c.id)}</code></td><td>${esc(c.name)}</td><td>${pill(c.type||'—')}</td><td>${pill(c.status||'—')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table>
    </div>
    ${legacyPkgs ? `<div class="card mt"><h3>Conteúdo legado: pacotes</h3>${pre(legacyPkgs)}</div>` : ''}`;
}

function renderCommands(app, legacy) {
  const tasks = app?.tasks?.list ? app.tasks.list() : [];
  const legacyCmd = legacy?.commands;
  document.getElementById('tab-commands').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Fila de tarefas (núcleo)</h3>
        <div class="kv"><div>Total</div><div>${pill(tasks.length)}</div></div>
        ${tasks.length ? `<table class="mt"><thead><tr><th>ID</th><th>Categoria</th><th>Estado</th><th>Progresso</th></tr></thead><tbody>${tasks.map(t=>`<tr><td><code>${esc(t.id)}</code></td><td>${pill(t.category||'—')}</td><td>${pill(t.state)}</td><td>${pill((t.progress??0)+'%')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted mt">Nenhuma tarefa criada.</p>'}
      </div>
      <div class="card"><h3>Contrato de API lógica</h3>
        <p class="muted">Em GitHub Pages os endpoints REST são contrato; requisições sem backend/provedor retornam estado indisponível explícito.</p>
        ${pre(app?.api?.getContract ? app.api.getContract() : {})}
      </div>
    </div>
    ${legacyCmd ? `<div class="card mt"><h3>Conteúdo legado: comandos/protocolo</h3>${pre(legacyCmd)}</div>` : ''}`;
}

function renderRepack(app, legacy) {
  const repacks = app?.repacks?.list ? app.repacks.list() : [];
  const quant = app?.quantization ? { profiles: app.quantization.getProfiles(), jobs: app.quantization.listJobs ? app.quantization.listJobs() : [] } : {};
  const legacyRepack = legacy?.repack;
  document.getElementById('tab-repack').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Repack Manager (núcleo)</h3>${repacks.length?pre(repacks):'<p class="muted">Nenhum repack registrado.</p>'}</div>
      <div class="card"><h3>Quantization Manager</h3>
        <p class="muted">Análise/estimativa/planejamento disponíveis; conversão real requer runtime/provedor compatível (sem conversão fictícia).</p>
        ${pre(quant.profiles || [])}
      </div>
    </div>
    ${legacyRepack ? `<div class="card mt"><h3>Conteúdo legado: Repack (pipeline de manifests)</h3>${pre(legacyRepack)}</div>` : ''}`;
}

function renderAdapters(app, legacy) {
  const providers = app?.providers?.list ? app.providers.list() : [];
  const legacyAdapters = legacy?.adapters;
  document.getElementById('tab-adapters').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Provedores registrados</h3>
        <table><thead><tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Estado</th></tr></thead>
        <tbody>${providers.map(p=>`<tr><td><code>${esc(p.id)}</code></td><td>${esc(p.name)}</td><td>${pill(p.type)}</td><td>${pill(p.state||'—')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table>
      </div>
      <div class="card"><h3>Configuração de provedores</h3>${pre(app?.config?.get ? app.config.get('providers') : {})}</div>
    </div>
    ${legacyAdapters ? `<div class="card mt"><h3>Conteúdo legado: adaptadores</h3>${pre(legacyAdapters)}</div>` : ''}`;
}

function renderIntegration(app, legacy) {
  const users = app?.users?.list ? app.users.list() : [];
  const perms = app?.config?.get ? app.config.get('permissions') : {};
  const prompt = legacy?.prompt;
  document.getElementById('tab-integration').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Usuários e permissões (UI)</h3>
        <p class="muted">Controle no cliente para administração da interface. Em hospedagem estática, autenticação/autorização confiáveis exigem backend externo. Sem senhas/segredos armazenados.</p>
        <table><thead><tr><th>ID</th><th>Nome</th><th>Papel</th></tr></thead>
        <tbody>${users.map(u=>`<tr><td><code>${esc(u.id)}</code></td><td>${esc(u.name)}</td><td>${pill(u.role)}</td></tr>`).join('')}</tbody></table>
        <div class="mt">${pre(perms)}</div>
      </div>
      <div class="card"><h3>Logs recentes</h3>${pre(app?.logger?.getRecent ? app.logger.getRecent(50) : [])}</div>
    </div>
    <div class="card mt"><h3>Prompt de Integração (IA)</h3>
      ${prompt ? `<textarea id="prompt-text">${esc(prompt.content)}</textarea><div class="row"><button class="btn primary" id="prompt-copy">Copiar prompt</button></div><div class="mt">${pre(prompt)}</div>` : '<p class="muted">Manifesto de prompt não encontrado.</p>'}
    </div>`;
  document.getElementById('prompt-copy')?.addEventListener('click', () => copyFrom('prompt-text'));
}

(async () => {
  const overview = document.getElementById('tab-overview');
  try {
    const [app, legacy] = await Promise.all([bootCore(), loadLegacy()]);
    window.FGUA = app && !app.error ? app : window.FGUA;
    renderOverview(app, legacy);
    renderModels(app, legacy);
    renderFrames(app, legacy);
    renderPackages(app, legacy);
    renderCommands(app, legacy);
    renderRepack(app, legacy);
    renderAdapters(app, legacy);
    renderIntegration(app, legacy);
  } catch (e) {
    document.getElementById('status-pill').textContent = 'erro';
    document.getElementById('status-pill').classList.add('err');
    renderError(overview, e);
  }
})();
