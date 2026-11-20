import { bootCore, loadLegacy } from './api.js';
import { esc, pill, pre, pills, setActiveTab, renderError } from './render.js';

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) setActiveTab(b.dataset.tab);
});

async function copyText(text) {
  try { await navigator.clipboard.writeText(text || ''); } catch {}
}

function fmtBytes(n){ if(!Number.isFinite(n)) return '—'; const u=['B','KB','MB','GB','TB']; let i=0,v=n; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(i?2:0)} ${u[i]}`; }
function getStatus(app){ try { return app?.getStatus ? app.getStatus() : null; } catch { return null; } }

function renderDashboard(app){
  const s = getStatus(app); const caps = s?.capabilities || app?.caps || {}; const c = caps.capabilities || {};
  const counts = s?.counts || {};
  const tasks = app?.tasks?.list ? app.tasks.list() : [];
  const running = tasks.filter(t=>['Processing','Loading','Running','Queued'].includes(t.state)).length;
  document.getElementById('status-pill').textContent = s?.status || (app?.error ? 'erro' : 'indisponível');
  document.getElementById('status-pill').className = 'status ' + (s?.status === 'ready' ? 'ok' : (app?.error ? 'err' : ''));
  document.getElementById('mode-pill').textContent = app?.api?.mode || s?.mode || 'demo';
  document.getElementById('base').textContent = new URL('../', location.href).toString();
  document.getElementById('meta').textContent = s ? `v${s.version} • ${s.modules?.length||0} módulos • ${s.initialized ? 'inicializado' : 'não inicializado'}` : 'núcleo indisponível';

  const engines = app?.engines?.list ? app.engines.list() : [];
  document.getElementById('tab-dashboard').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Estado do sistema</h3><div class="kv">
        <div>Status</div><div>${pill(s?.status||'n/d')}</div>
        <div>Modo</div><div>${pill(app?.api?.mode||'demo')}</div>
        <div>Hospedagem</div><div>${pill('GitHub Pages')} ${pill('estático')}</div>
        <div>Início</div><div class="muted">${esc(s?.startedAt||'—')}</div>
        <div>Backend</div><div>${pill(app?.api?.baseUrl ? 'configurado' : 'não conectado')}</div>
      </div></div>
      <div class="card"><h3>Recursos e contagens</h3><div class="kv">
        <div>Modelos</div><div>${pill(counts.models??0)} <span class="muted">(carregados: ${counts.loadedModels??0})</span></div>
        <div>Geradores</div><div>${pill(counts.generators??0)}</div>
        <div>Engines</div><div>${pill(counts.engines??engines.length)}</div>
        <div>Tarefas</div><div>${pill(counts.tasks??tasks.length)} <span class="muted">(ativas: ${running})</span></div>
        <div>Repacks</div><div>${pill(counts.repacks??0)}</div>
        <div>Ferramentas</div><div>${pill(counts.tools??0)}</div>
        <div>Usuários</div><div>${pill(counts.users??0)}</div>
      </div></div>
      <div class="card"><h3>Compatibilidade / recursos</h3>
        ${pills(Object.entries(c).filter(([,v])=>v).map(([k])=>k)) || '<span class="muted">n/d</span>'}
        <div class="kv mt">
          <div>WebGPU</div><div>${pill(app?.webgpuInfo?.available?'disponível':'indisponível')} <span class="muted">${esc(app?.webgpuInfo?.reason||'')}</span></div>
          <div>WebCodecs</div><div>${pill(app?.codecsInfo?.available?'disponível':'indisponível')}</div>
          <div>CPU cores</div><div>${pill(caps.hardware?.hardwareConcurrency ?? 'n/d')}</div>
          <div>Memória (navegador)</div><div>${pill(caps.hardware?.deviceMemoryGB ? caps.hardware.deviceMemoryGB+' GB' : 'n/d')}</div>
        </div>
      </div>
    </div>
    <div class="card mt"><h3>Engines registrados (resumo)</h3>
      <table><thead><tr><th>Engine</th><th>ID</th><th>Disponível/Estado</th><th>Detalhes</th></tr></thead>
      <tbody>${engines.map(e=>`<tr><td><b>${esc(e.name||e.id)}</b></td><td><code>${esc(e.id)}</code></td><td>${pill(e.available===true?'disponível':(e.available===false?'indisponível':(e.state||'—')))}</td><td class="muted">${esc(e.reason||e.runtime||e.type||'—')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table>
    </div>
    <div class="card mt"><h3>Histórico de tarefas</h3>${tasks.length?`<table><thead><tr><th>ID</th><th>Tipo</th><th>Engine</th><th>Estado</th><th>Progresso</th><th>Criado</th></tr></thead><tbody>${tasks.slice().reverse().slice(0,20).map(t=>`<tr><td><code>${esc(t.id)}</code></td><td>${pill(t.type||t.category||'—')}</td><td class="muted">${esc(t.engine||'—')}</td><td>${pill(t.state)}</td><td>${pill((t.progress??0)+'%')}</td><td class="muted">${esc(t.createdAt||'')}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Nenhuma tarefa registrada.</p>'}</div>`;
}

function renderGeneratorSection(app, tabId, category, title, desc){
  const gens = app?.generatorRegistry?.list ? app.generatorRegistry.list() : [];
  const g = gens.find(x=>x.id===category || x.category===category) || null;
  const presets = (app?.config?.get ? (app.config.get('settings')?.presets || []) : []).filter(p=>p.category===category || (category==='frame' && true));
  const el = document.getElementById('tab-'+tabId);
  const isGame = category==='game';
  el.innerHTML = `
    <div class="grid">
      <div class="card"><h3>${esc(title)}</h3>
        <p class="muted">${esc(desc)}</p>
        <div class="kv mt"><div>Gerador</div><div>${g?pill(g.id):pill('não registrado')}</div><div>Categoria</div><div>${pill(category)}</div><div>Estado</div><div>${pill(g?.enabled!==false?'habilitado':'desabilitado')}</div></div>
        ${isGame ? '<p class="section-note">Jogos: requer imagens/frames recebidos por integração autorizada, captura fornecida pelo usuário ou backend especializado. Sem interceptação automática de pipeline gráfico.</p>' : ''}
      </div>
      <div class="card"><h3>Configuração / Presets</h3>
        ${presets.length?`<table><thead><tr><th>ID</th><th>Nome</th><th>Config</th></tr></thead><tbody>${presets.slice(0,8).map(p=>`<tr><td><code>${esc(p.id)}</code></td><td>${esc(p.name)}</td><td><code>${esc(JSON.stringify(p.config||{}))}</code></td></tr>`).join('')}</tbody></table>`:'<p class="muted">Sem presets específicos (use os padrões em Settings/Presets).</p>'}
      </div>
    </div>
    <div class="card mt"><h3>Planejar / Solicitar execução</h3>
      <p class="muted">A execução real depende de engine/modelo/provedor compatível. O sistema retorna plano e estado explícito (sem simulação).</p>
      <div class="form-row">
        <label>Entrada (opcional): <input type="file" id="${tabId}-file" ${category==='image'?'accept="image/*"':(category==='video'?'accept="video/*"':'')}></label>
        ${category!=='image'?'<label>FPS alvo: <input type="number" id="'+tabId+'-fps" value="60" min="1" style="width:90px"></label>':''}
        ${category==='image'?'<label>Escala: <input type="number" id="'+tabId+'-scale" value="2" min="1" step="1" style="width:80px"></label>':''}
        <button class="btn" id="${tabId}-plan">Gerar plano</button>
        <button class="btn primary" id="${tabId}-run">Solicitar execução</button>
      </div>
      <pre id="${tabId}-out" class="mt">Aguardando ação.</pre>
    </div>`;

  const out = ()=>document.getElementById(`${tabId}-out`);
  const getInput = ()=>document.getElementById(`${tabId}-file`)?.files?.[0]||null;
  document.getElementById(`${tabId}-plan`)?.addEventListener('click', async ()=>{
    const req = { category, input: getInput(), targetFps: Number(document.getElementById(`${tabId}-fps`)?.value)||null, scale: Number(document.getElementById(`${tabId}-scale`)?.value)||null, interpolate: category!=='image', upscale: category==='image', enhance:true };
    try { const plan = app?.frameGenerator?.plan ? app.frameGenerator.plan(req) : app?.universalGenerator?.plan?.(req); out().textContent = JSON.stringify({ ok:true, plan }, null, 2); }
    catch(e){ out().textContent = JSON.stringify({ok:false,error:e.message},null,2); }
  });
  document.getElementById(`${tabId}-run`)?.addEventListener('click', async ()=>{
    const input = getInput();
    try {
      let res;
      if (category==='image' && app?.imageGenerator?.process) res = await app.imageGenerator.process({ input, scale: Number(document.getElementById(`${tabId}-scale`)?.value)||2, enhance:true });
      else if (category==='video' && app?.videoGenerator?.process) res = await app.videoGenerator.process({ input, targetFps: Number(document.getElementById(`${tabId}-fps`)?.value)||60, interpolate:true });
      else if (app?.frameGenerator?.execute) res = await app.frameGenerator.execute({ category, input, targetFps: Number(document.getElementById(`${tabId}-fps`)?.value)||60 });
      else res = { ok:false, state:'unavailable', message:'Gerador indisponível.' };
      out().textContent = JSON.stringify(res, null, 2);
      // atualizar dashboard/tarefas se criadas externamente
    } catch(e){ out().textContent = JSON.stringify({ok:false,error:e.message},null,2); }
  });
}

function renderModelManager(app){
  const reg = app?.modelRegistry?.list ? app.modelRegistry.list() : [];
  const loaded = app?.modelLoader?.listLoaded ? app.modelLoader.listLoaded() : [];
  const el = document.getElementById('tab-model-manager');
  el.innerHTML = `
    <div class="grid">
      <div class="card"><h3>Model Manager</h3><div class="kv">
        <div>Registrados</div><div>${pill(reg.length)}</div>
        <div>Carregados (sessão)</div><div>${pill(loaded.length)}</div>
        <div>Formatos suportados (análise)</div><div>${pills(['gguf','onnx','safetensors*','bin/pt/pth*','json-manifest'])}</div>
      </div><p class="section-note">* Análise binária completa no cliente disponível para GGUF; outros formatos podem ter análise parcial. Inferência requer runtime/provedor compatível.</p></div>
      <div class="card"><h3>Ações</h3>
        <p class="muted">Carregar/descarregar modelos de inferência depende de runtime conectado. Aqui: registro, inspeção e gerenciamento de estado.</p>
        <div class="form-row"><button class="btn" id="mm-refresh">Atualizar lista</button></div>
      </div>
    </div>
    <div class="card mt"><h3>Modelos registrados</h3>
      ${reg.length?`<table><thead><tr><th>Nome/ID</th><th>Formato</th><th>Arquitetura</th><th>Quantização/Tipos</th><th>Tamanho</th><th>Estado</th><th>Ação</th></tr></thead><tbody>${reg.map(m=>`<tr><td><b>${esc(m.name||m.fileName||m.id)}</b><div class="muted"><code>${esc(m.id)}</code></div></td><td>${pill(m.format||'—')}</td><td>${pill(m.architecture||'—')}</td><td>${pill(m.quantization||'—')} ${pills((m.tensorTypes||[]).slice(0,3))}</td><td class="muted">${esc(m.sizeHuman||fmtBytes(m.size)||'—')}</td><td>${pill(m.state||'—')}</td><td><button class="btn" data-unload="${esc(m.id)}">Descarregar</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">Nenhum modelo. Use GGUF Loader ou analise um arquivo para registrar.</p>'}
    </div>`;
  el.querySelector('#mm-refresh')?.addEventListener('click', ()=>renderModelManager(app));
  el.querySelectorAll('[data-unload]').forEach(btn=>btn.addEventListener('click', async ()=>{
    await app?.modelLoader?.unloadModel?.(btn.getAttribute('data-unload')); renderModelManager(app);
  }));
}

function renderGguf(app){
  const el = document.getElementById('tab-gguf');
  el.innerHTML = `
    <div class="grid">
      <div class="card"><h3>GGUF Loader</h3>
        <p class="muted">Leitura binária real: valida assinatura GGUF, versão, metadados KV e índice de tensores (tipos/dimensões/offsets). Não carrega pesos na memória; arquivo original não é modificado.</p>
        <div class="form-row"><input type="file" id="gguf-file" accept=".gguf,application/octet-stream" /><button class="btn primary" id="gguf-analyze">Analisar GGUF</button></div>
        <div class="muted" id="gguf-status" style="margin-top:8px"></div>
      </div>
      <div class="card"><h3>Compatibilidade / observações</h3>
        <ul class="muted" style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">
          <li>Identifica arquitetura, quantização/tipos de tensor, contagens e metadados quando presentes.</li>
          <li>Modelos F32/F16/BF16 (não quantizados) diferenciados pelos tipos de tensor quando disponíveis.</li>
          <li>Execução de inferência GGUF no navegador requer runtime/provedor compatível (ex.: backend/serviço especializado).</li>
        </ul>
      </div>
    </div>
    <div class="card mt"><h3>Resultado da análise</h3><pre id="gguf-out">Nenhuma análise.</pre></div>`;
  document.getElementById('gguf-analyze')?.addEventListener('click', async ()=>{
    const file = document.getElementById('gguf-file')?.files?.[0]; const out=document.getElementById('gguf-out'); const st=document.getElementById('gguf-status');
    if(!file){ st.textContent='Selecione um arquivo .gguf.'; return; }
    if(!app?.modelLoader){ st.textContent='ModelLoader indisponível.'; return; }
    st.textContent='Analisando…';
    try{ const res = await app.modelLoader.analyzeFile(file); out.textContent = JSON.stringify(res,null,2); st.textContent = res.ok?'Análise concluída (modelo registrado quando aplicável).':'Concluído com avisos/erro.'; }
    catch(e){ out.textContent=JSON.stringify({ok:false,error:e.message},null,2); st.textContent='Falha na análise.'; }
  });
}

function renderMetadata(app){
  const reg = app?.modelRegistry?.list ? app.modelRegistry.list() : [];
  const el = document.getElementById('tab-metadata');
  const options = reg.map(m=>`<option value="${esc(m.id)}">${esc((m.name||m.fileName||m.id)+' ['+(m.format||'?')+']')}</option>`).join('');
  el.innerHTML = `
    <div class="grid">
      <div class="card"><h3>Metadata Viewer</h3>
        <p class="muted">Inspecione metadados extraídos de modelos registrados (incl. GGUF: KV, arquitetura, tensores). Campos desconhecidos preservados na leitura.</p>
        <div class="form-row"><label>Modelo: <select id="meta-select"><option value="">— selecione —</option>${options}</select></label><button class="btn" id="meta-show">Exibir</button><button class="btn" id="meta-export">Exportar JSON</button></div>
      </div>
      <div class="card"><h3>Cache / informações</h3><div class="kv"><div>Modelos com metadados</div><div>${pill(reg.filter(m=>m.metadata).length)}</div><div>Cache em memória</div><div>${pill('ativo (sessão)')}</div></div>
      <p class="section-note">Exportação gera download do JSON de metadados do modelo selecionado (somente leitura/inspeção).</p></div>
    </div>
    <div class="card mt"><h3>Metadados</h3><pre id="meta-out">Selecione um modelo para visualizar.</pre></div>`;
  const getSel = ()=> app?.modelRegistry?.get?.(document.getElementById('meta-select')?.value);
  document.getElementById('meta-show')?.addEventListener('click', ()=>{
    const m=getSel(); document.getElementById('meta-out').textContent = m?JSON.stringify({id:m.id,name:m.name,format:m.format,architecture:m.architecture,quantization:m.quantization,contextLength:m.contextLength,size:m.size,sizeHuman:m.sizeHuman,tensorTypes:m.tensorTypes,state:m.state,metadata:m.metadata},null,2):'Modelo não encontrado.';
  });
  document.getElementById('meta-export')?.addEventListener('click', ()=>{
    const m=getSel(); if(!m) return; const blob=new Blob([JSON.stringify(m.metadata||m,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`metadata-${(m.id||'model')}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
}

function renderQuantization(app){
  const reg = app?.modelRegistry?.list ? app.modelRegistry.list() : [];
  const profiles = app?.quantization?.getProfiles ? app.quantization.getProfiles() : [];
  const jobs = app?.quantization?.listJobs ? app.quantization.listJobs() : [];
  const options = reg.map(m=>`<option value="${esc(m.id)}">${esc((m.name||m.fileName||m.id))}</option>`).join('');
  const pOpts = profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.id)} (${esc(p.bits||'?')} bits)</option>`).join('');
  document.getElementById('tab-quantization').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Quantization Manager</h3>
        <p class="muted">Identificação, análise, estimativa e planejamento. Conversão real exige runtime/ferramenta externa compatível (arquivo original preservado). Sem conversão fictícia.</p>
        <div class="form-row"><label>Modelo: <select id="q-model"><option value="">— selecione —</option>${options}</select></label><label>Alvo: <select id="q-target">${pOpts||'<option>Q4_K</option>'}</select></label><button class="btn" id="q-analyze">Analisar</button><button class="btn primary" id="q-plan">Gerar plano</button></div>
      </div>
      <div class="card"><h3>Perfis/tipos reconhecidos</h3>${pre(profiles)}</div>
    </div>
    <div class="card mt"><h3>Resultado</h3><pre id="q-out">Aguardando.</pre></div>
    <div class="card mt"><h3>Jobs de quantização</h3>${jobs.length?pre(jobs):'<p class="muted">Nenhum job.</p>'}</div>`;
  const getModel = ()=> app?.modelRegistry?.get?.(document.getElementById('q-model')?.value);
  document.getElementById('q-analyze')?.addEventListener('click', async ()=>{
    const m=getModel(); const t=document.getElementById('q-target')?.value||'Q4_K';
    document.getElementById('q-out').textContent = m ? JSON.stringify(app.quantization.analyze(m,t),null,2) : 'Selecione um modelo registrado.';
  });
  document.getElementById('q-plan')?.addEventListener('click', async ()=>{
    const m=getModel(); const t=document.getElementById('q-target')?.value||'Q4_K';
    if(!m){ document.getElementById('q-out').textContent='Selecione um modelo registrado.'; return; }
    const res = await app.quantization.plan(m,t,null);
    document.getElementById('q-out').textContent = JSON.stringify(res,null,2);
  });
}

function renderEngines(app){
  const list = app?.engines?.list ? app.engines.list() : [];
  const selDemo = app?.engines?.select ? app.engines.select({operation:'video', format:'onnx'}) : null;
  document.getElementById('tab-engines').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Engine Manager</h3><p class="muted">Detecta suporte/disponibilidade e seleciona engine com base em formato, operação e recursos. Não seleciona por nome de GPU.</p>
        <div class="kv"><div>Engines</div><div>${pill(list.length)}</div><div>Seleção (exemplo)</div><div>${selDemo?pill(selDemo.id||'nenhum'):'—'}</div></div>
        ${selDemo?`<p class="section-note">Motivo: ${esc(selDemo.reason||'—')}</p>`:''}
      </div>
      <div class="card"><h3>Backend / adaptadores</h3><div class="kv">
        <div>Backend URL</div><div class="muted">${esc(app?.backend?.baseUrl||'não configurado')}</div>
        <div>Estado backend</div><div>${pill(app?.backend?.state||'unconfigured')}</div>
        <div>ONNX Runtime Web</div><div>${pill(app?.onnx?.detect?.().available?'detectado':'não carregado')}</div>
      </div><p class="section-note">Configure backend local/remoto em Settings/API Manager quando disponível.</p></div>
    </div>
    <div class="card mt"><h3>Engines detectadas</h3>
      <table><thead><tr><th>Nome</th><th>ID</th><th>Disponível</th><th>Detalhes</th></tr></thead>
      <tbody>${list.map(e=>`<tr><td><b>${esc(e.name||e.id)}</b></td><td><code>${esc(e.id)}</code></td><td>${pill(e.available===true?'sim':(e.available===false?'não':(e.state||'—')))}</td><td><code>${esc(JSON.stringify(e))}</code></td></tr>`).join('')}</tbody></table>
    </div>`;
}

async function renderRepacks(app){
  const repacks = app?.repacks?.list ? app.repacks.list() : [];
  let sample = null; try{ const r = await fetch('./manifests/sample-repack.json',{cache:'no-store'}); if(r.ok) sample = await r.json(); }catch{}
  document.getElementById('tab-repacks').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Repack Manager</h3><p class="muted">Carrega/valida manifests JSON, registra ferramentas e administra repacks. Não executa código arbitrário de manifests.</p>
        <div class="form-row"><button class="btn primary" id="repack-import-sample">Importar manifesto de exemplo</button><button class="btn" id="repack-refresh">Atualizar</button></div>
        <div class="muted" id="repack-status" style="margin-top:8px"></div>
      </div>
      <div class="card"><h3>Manifesto de exemplo</h3>${sample?pre(sample):'<p class="muted">Nenhum manifesto de exemplo encontrado.</p>'}</div>
    </div>
    <div class="card mt"><h3>Repacks registrados</h3>${repacks.length?`<table><thead><tr><th>ID</th><th>Nome</th><th>Versão</th><th>Habilitado</th><th>Módulos</th><th>Validação</th></tr></thead><tbody>${repacks.map(r=>{const v=app.repacks.validate(r.id); return `<tr><td><code>${esc(r.id)}</code></td><td>${esc(r.name)}</td><td>${pill(r.version||'—')}</td><td>${pill(String(r.enabled!==false))}</td><td>${pill((r.modules||[]).length)}</td><td>${pill(v?.ok?'ok':'inválido')}</td></tr>`;}).join('')}</tbody></table>`:'<p class="muted">Nenhum repack registrado.</p>'}</div>`;
  document.getElementById('repack-refresh')?.addEventListener('click', ()=>renderRepacks(app));
  document.getElementById('repack-import-sample')?.addEventListener('click', async ()=>{
    const st=document.getElementById('repack-status'); if(!sample){ st.textContent='Manifesto de exemplo indisponível.'; return; }
    try{ const res = app.repacks.import(JSON.parse(JSON.stringify(sample))); st.textContent = res.ok?'Manifesto importado e registrado.':'Falha: '+(res.errors||[]).join('; '); renderRepacks(app);}catch(e){ st.textContent='Erro: '+e.message; }
  });
}

function renderTools(app){
  const tools = app?.tools?.list ? app.tools.list() : [];
  document.getElementById('tab-tools').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Tool Manager</h3><p class="muted">Registro e administração de ferramentas expostas por repacks/módulos. Execução depende de handler/provedor compatível.</p>
        <div class="kv"><div>Ferramentas</div><div>${pill(tools.length)}</div></div>
      </div>
      <div class="card"><h3>Registrar ferramenta (metadado)</h3>
        <div class="form-row"><input id="tool-id" placeholder="id (ex.: tool.demo)" /><input id="tool-name" placeholder="nome" /><button class="btn primary" id="tool-add">Registrar</button></div>
        <div class="muted" id="tool-status" style="margin-top:8px"></div>
      </div>
    </div>
    <div class="card mt"><h3>Ferramentas registradas</h3>${tools.length?`<table><thead><tr><th>ID</th><th>Nome</th><th>Habilitada</th><th>Handler</th><th>Estado</th></tr></thead><tbody>${tools.map(t=>`<tr><td><code>${esc(t.id)}</code></td><td>${esc(t.name||'—')}</td><td>${pill(String(t.enabled!==false))}</td><td>${pill(t.hasHandler?'sim':'não')}</td><td>${pill(t.status||'—')}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Nenhuma ferramenta registrada.</p>'}</div>`;
  document.getElementById('tool-add')?.addEventListener('click', ()=>{
    const id=document.getElementById('tool-id')?.value?.trim(); const name=document.getElementById('tool-name')?.value?.trim();
    const st=document.getElementById('tool-status'); if(!id){ st.textContent='Informe um id.'; return; }
    try{ app.tools.register({id,name:name||id}); st.textContent='Ferramenta registrada.'; renderTools(app);}catch(e){ st.textContent='Erro: '+e.message; }
  });
}

function renderApi(app){
  const contract = app?.api?.getContract ? app.api.getContract() : {base:'/api/v1', namespaces:[]};
  const endpoints = [
    'GET /api/v1/models','POST /api/v1/models/load','POST /api/v1/models/unload','GET /api/v1/models/metadata','POST /api/v1/models/inspect',
    'GET /api/v1/quantization/types','POST /api/v1/quantization/analyze','POST /api/v1/quantization/jobs',
    'GET /api/v1/generators','POST /api/v1/generators/execute','GET /api/v1/generators/status',
    'POST /api/v1/frames/interpolate','POST /api/v1/frames/enhance','POST /api/v1/images/upscale','POST /api/v1/images/enhance',
    'POST /api/v1/videos/process','POST /api/v1/videos/interpolate','GET /api/v1/jobs','POST /api/v1/jobs/{id}/cancel',
    'GET /api/v1/repack','POST /api/v1/repack/load','GET /api/v1/tools','GET /api/v1/users','GET /api/v1/permissions','GET /api/v1/config'
  ];
  document.getElementById('tab-api').innerHTML = `
    <div class="grid">
      <div class="card"><h3>API Manager</h3>
        <p class="muted">API lógica central (<code>/api/v1</code>). Em GitHub Pages (estático) o frontend usa ApiClient; chamadas sem backend retornam indisponibilidade explícita.</p>
        <div class="kv"><div>Modo</div><div>${pill(app?.api?.mode||'demo')}</div><div>Base URL</div><div class="muted">${esc(app?.api?.baseUrl||'— (não conectado)')}</div><div>Contrato base</div><div><code>${esc(contract.base||'/api/v1')}</code></div></div>
      </div>
      <div class="card"><h3>Configurar backend</h3>
        <div class="form-row"><input id="api-base" placeholder="https://backend.exemplo/api" style="min-width:260px" value="${esc(app?.api?.baseUrl||'')}" />
          <select id="api-mode"><option value="demo">demo</option><option value="local">local</option><option value="remote">remote</option></select>
          <button class="btn primary" id="api-save">Aplicar</button></div>
        <div class="muted" id="api-status" style="margin-top:8px">Altera apenas a sessão atual no navegador (UI).</div>
      </div>
    </div>
    <div class="card mt"><h3>Namespaces</h3>${pills(contract.namespaces||[])}</div>
    <div class="card mt"><h3>Endpoints (contrato)</h3>${pre(endpoints)}</div>`;
  const modeSel = document.getElementById('api-mode'); if(modeSel) modeSel.value = app?.api?.mode||'demo';
  document.getElementById('api-save')?.addEventListener('click', ()=>{
    const base = document.getElementById('api-base')?.value?.trim() || null;
    const mode = document.getElementById('api-mode')?.value || 'demo';
    const r = app?.api?.configure?.({ baseUrl: base, mode });
    document.getElementById('api-status').textContent = 'Configuração aplicada: ' + JSON.stringify(r||{});
    document.getElementById('mode-pill').textContent = app?.api?.mode || mode;
  });
}

function renderUsers(app){
  const users = app?.auth?.listUsers ? app.auth.listUsers() : (app?.users?.list ? app.users.list() : []);
  const roles = (app?.permissions?.roles) ? Object.keys(app.permissions.roles) : (app?.config?.get ? Object.keys(app.config.get('permissions')?.roles||{}) : ['Administrator','Developer','User','Viewer']);
  document.getElementById('tab-users').innerHTML = `
    <div class="grid">
      <div class="card"><h3>User Manager (UI)</h3>
        <p class="muted">Administração de perfis/preferências no cliente. Autenticação/autorização confiáveis devem ser validadas no backend. Sem credenciais em arquivos públicos.</p>
        <div class="kv"><div>Usuário atual</div><div>${pill(app?.auth?.me?.()?.name||'—')}</div><div>Total</div><div>${pill(users.length)}</div></div>
      </div>
      <div class="card"><h3>Adicionar usuário (local/UI)</h3>
        <div class="form-row"><input id="u-name" placeholder="Nome" /><select id="u-role">${roles.map(r=>`<option>${esc(r)}</option>`).join('')}</select><button class="btn primary" id="u-add">Adicionar</button></div>
        <div class="muted" id="u-status" style="margin-top:8px"></div>
      </div>
    </div>
    <div class="card mt"><h3>Usuários</h3><table><thead><tr><th>ID</th><th>Nome</th><th>Papel</th><th>Ativo</th></tr></thead><tbody>${users.map(u=>`<tr><td><code>${esc(u.id)}</code></td><td>${esc(u.name)}</td><td>${pill(u.role)}</td><td>${pill(String(u.active!==false))}</td></tr>`).join('')}</tbody></table></div>
    <div class="card mt"><h3>Permissões (config)</h3>${pre(app?.config?.get ? app.config.get('permissions') : app?.permissions?.roles || {})}</div>`;
  document.getElementById('u-add')?.addEventListener('click', ()=>{
    const name=document.getElementById('u-name')?.value?.trim()||'Usuário'; const role=document.getElementById('u-role')?.value||'Viewer';
    try{ app?.auth?.createUser?.({name,role}); document.getElementById('u-status').textContent='Usuário adicionado (sessão local).'; renderUsers(app);}catch(e){ document.getElementById('u-status').textContent='Erro: '+e.message; }
  });
}

async function renderSettings(app){
  const cfgs = app?.config?.list ? app.config.list() : (app?.settings?.list ? app.settings.list() : []);
  let presets = null, locales = null;
  try{ const r=await fetch('./presets/default-presets.json',{cache:'no-store'}); if(r.ok) presets=await r.json(); }catch{}
  try{ const r=await fetch('./locales/pt-BR.json',{cache:'no-store'}); if(r.ok) locales=await r.json(); }catch{}
  const logs = app?.logger?.getRecent ? app.logger.getRecent(60) : [];
  document.getElementById('tab-settings').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Configurações carregadas</h3>
        <div class="kv"><div>Arquivos/configs</div><div>${pill(cfgs.length)}</div><div>Tema</div><div>${pill('claro / minimalista')}</div></div>
        <div class="mt">${pills(cfgs)}</div>
      </div>
      <div class="card"><h3>Presets</h3>${presets?pre(presets):'<p class="muted">Presets padrão não encontrados.</p>'}</div>
    </div>
    <div class="card mt"><h3>Config: api.json</h3>${pre(app?.config?.get?app.config.get('api'):app?.settings?.get?.('api'))}</div>
    <div class="card mt"><h3>Config: settings.json</h3>${pre(app?.config?.get?app.config.get('settings'):app?.settings?.get?.('settings'))}</div>
    <div class="card mt"><h3>Localidade (exemplo)</h3>${locales?pre(locales):'<p class="muted">—</p>'}</div>
    <div class="card mt"><h3>Logs recentes</h3>${logs.length?pre(logs):'<p class="muted">Sem logs.</p>'}</div>`;
}

(async () => {
  const overview = document.getElementById('tab-dashboard');
  try {
    const [app, legacy] = await Promise.all([bootCore(), loadLegacy()]);
    window.FGUA = app && !app.error ? app : window.FGUA;

    renderDashboard(app);
    renderGeneratorSection(app, 'frame', 'frame', 'Universal Frame Generator', 'Ponto de entrada unificado para operações de quadros/imagem/vídeo com seleção de engine e planejamento.');
    renderGeneratorSection(app, 'game', 'game', 'Game Frame Generator', 'Interpolação/geração de quadros para jogos a partir de frames recebidos por integração autorizada.');
    renderGeneratorSection(app, 'image', 'image', 'Image Generator', 'Aprimoramento de imagens (upscale, denoise, nitidez, restauração) via modelos/engines compatíveis.');
    renderGeneratorSection(app, 'video', 'video', 'Video Generator', 'Processamento de vídeo (interpolação, upscale, aprimoramento) com pipeline de mídia e engine compatível.');
    renderModelManager(app);
    renderGguf(app);
    renderMetadata(app);
    renderQuantization(app);
    renderEngines(app);
    await renderRepacks(app);
    renderTools(app);
    renderApi(app);
    renderUsers(app);
    await renderSettings(app);
  } catch (e) {
    document.getElementById('status-pill').textContent = 'erro';
    document.getElementById('status-pill').classList.add('err');
    renderError(overview, e);
  }
})();
