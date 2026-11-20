const baseUrl = location.pathname.includes('/admin')
  ? location.origin + location.pathname.replace(/\/admin\/?[^/]*$/, '')
  : location.origin;

async function j(path) {
  const url = path.startsWith('http') ? path : `${baseUrl}/${path.replace(/^\//,'')}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pill = (t) => `<span class="pill">${esc(t)}</span>`;
const pre = (o) => `<pre>${esc(JSON.stringify(o, null, 2))}</pre>`;

function setTab(id) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === `tab-${id}`));
}
document.getElementById('tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab);
});

async function main() {
  document.getElementById('base').textContent = baseUrl;
  try {
    const [discovery, status, models, frames, templates, packages, commands, repack, adapters, prompt] = await Promise.all([
      j('api/v1/index.json'), j('api/v1/system/status.json'), j('api/v1/models/index.json'),
      j('api/v1/frames/index.json'), j('api/v1/frames/templates.json'), j('api/v1/packages/index.json'),
      j('api/v1/commands/index.json'), j('api/v1/repack/index.json'), j('api/v1/adapters/index.json'),
      j('api/v1/prompts/integration.json')
    ]);

    document.getElementById('status-pill').textContent = status.status || 'ok';
    document.getElementById('status-pill').classList.add('ok');
    document.getElementById('meta').textContent = `v${discovery.version} • atualizado ${discovery.sync?.recommended_interval_sec || 60}s • etags ativos`;

    // Overview
    document.getElementById('tab-overview').innerHTML = `
      <div class="grid">
        <div class="card"><h3>Hospedagem & modos</h3><div class="kv">
          <div>Tipo</div><div>${pill('static GitHub Pages')} ${pill('híbrido via adaptadores')}</div>
          <div>Quadros</div><div>${Object.keys(discovery.frame_modes).map(pill).join('')}</div>
          <div>GGUF</div><div>${Object.keys(discovery.gguf_modes).map(pill).join('')}</div>
          <div>Sync</div><div>${esc(discovery.sync.strategy)} (version/etag)</div>
        </div></div>
        <div class="card"><h3>Componentes</h3>${Object.entries(status.components).map(([k,v])=>`<div>${pill(k)} <span class="muted">${esc(v)}</span></div>`).join('')}</div>
        <div class="card"><h3>Limites</h3>
          <div>${pill('sem servidor no Pages')}</div>
          <div>${pill('execução pesada = adapter externo')}</div>
          <div>${pill('GGUF: metadados/índice; pesos não descompiláveis')}</div>
          <div class="warn" style="margin-top:8px">Repack é transparente e auditável (sem mutação oculta de código-fonte).</div>
        </div>
      </div>
      <div class="card" style="margin-top:12px"><h3>Discovery</h3>${pre(discovery)}</div>`;

    // Models
    const mrows = (models.models||[]).map(m => `<tr>
      <td><b>${esc(m.id)}</b><div class="muted">${esc(m.name)}</div></td>
      <td>${pill(m.mode)} ${pill(m.format)} ${pill(m.status)}</td>
      <td>${pill('ctx '+m.context_length)} ${m.quantization?pill(m.quantization):''}</td>
      <td>${Object.entries(m.capabilities||{}).filter(([,v])=>v).map(([k])=>pill(k)).join('')}</td>
      <td>${(m.runners||[]).map(pill).join('')}</td>
    </tr>`).join('');
    document.getElementById('tab-models').innerHTML = `
      <div class="card"><h3>Registro de modelos (metadados completos + carregador)</h3>
        <p class="muted">Suporta: A) runner externo, B) WASM experimental, C) catálogo/metadados. Inspeção GGUF expõe general/architecture/tokenizer/tensors/inspection (sem descompilar pesos).</p>
        <table><thead><tr><th>Modelo</th><th>Modo/Formato</th><th>Contexto/Quant</th><th>Capacidades</th><th>Runners</th></tr></thead><tbody>${mrows}</tbody></table>
      </div>
      <div class="card" style="margin-top:12px"><h3>Esquema de metadados GGUF</h3>${pre(models.gguf_metadata_schema)}</div>
      <div class="card" style="margin-top:12px"><h3>Registro completo</h3>${pre(models)}</div>`;

    // Frames
    document.getElementById('tab-frames').innerHTML = `
      <div class="grid">
        <div class="card"><h3>Modos de geração</h3>${(frames.modes||[]).map(pill).join('')}
          <p class="muted" style="margin-top:8px">Controle por jobs via adapter: ${Object.keys(frames.control||{}).map(pill).join('')}</p>
          <h3 style="margin-top:10px">Defaults</h3>${pre(frames.defaults)}</div>
        <div class="card"><h3>Templates</h3>${(templates.templates||[]).map(t=>`<div style="margin-bottom:8px"><b>${esc(t.title)}</b> ${pill(t.mode)}<div class="muted">${esc(t.id)}</div></div>`).join('')}</div>
      </div>
      <div class="card" style="margin-top:12px"><h3>Templates & exemplos</h3>${pre(templates)}</div>
      <div class="card" style="margin-top:12px"><h3>Orquestrador</h3>${pre(frames)}</div>`;

    // Packages
    const prows = (packages.packages||[]).map(p=>`<tr><td><b>${esc(p.id)}</b><div class="muted">${esc(p.name)}</div></td><td>${pill(p.version)} ${pill(p.type)} ${pill(p.status)}</td><td>${(p.provides||[]).map(pill).join('')}</td><td>${(p.requires||[]).map(pill).join('')||'<span class="muted">—</span>'}</td><td><code>${esc(p.entry)}</code></td></tr>`).join('');
    document.getElementById('tab-packages').innerHTML = `
      <div class="card"><h3>Pacotes e autoajuste</h3>
        <p class="muted">Mecanismo: ${esc(packages.auto_adjust?.mechanism)} — ${esc(packages.auto_adjust?.client_behavior)}</p>
        <table><thead><tr><th>Pacote</th><th>Versão/Tipo</th><th>Provides</th><th>Requires</th><th>Entry</th></tr></thead><tbody>${prows}</tbody></table>
      </div>
      <div class="card" style="margin-top:12px"><h3>Manifesto</h3>${pre(packages)}</div>`;

    // Commands
    const crows = (commands.commands||[]).map(c=>`<tr><td><code>${esc(c.name)}</code></td><td>${pill(c.scope)}</td><td>${(c.transport||[]).map(pill).join('')}</td><td class="muted">${esc(c.description)}</td></tr>`).join('');
    document.getElementById('tab-commands').innerHTML = `
      <div class="card"><h3>Protocolo e restrições</h3>
        <div class="row">${pill('allowlist')} ${pill('schema obrigatório')} ${pill('request_id obrigatório')} ${pill('max '+commands.enforce.max_body_bytes+' bytes')}</div>
        <p class="muted" style="margin-top:8px">Envelope de envio: <code>schemas/command.schema.json</code>. Resposta: <code>schemas/response.schema.json</code>.</p>
        <table><thead><tr><th>Comando</th><th>Escopo</th><th>Transporte</th><th>Descrição</th></tr></thead><tbody>${crows}</tbody></table>
      </div>
      <div class="card" style="margin-top:12px"><h3>Compor envelope (exemplo)</h3>
        <textarea id="cmd-editor">${esc(JSON.stringify({command:'models.list',request_id:'req_demo_001',client:{name:'admin-ui',version:'1.0.0'},auth:{mode:'none'},meta:{dry_run:false},payload:{}}, null, 2))}</textarea>
        <div class="row" style="margin-top:8px"><button class="btn" id="cmd-copy">Copiar JSON</button><span class="muted">Envio real de comandos de escrita/execução requer um adapter configurado.</span></div>
      </div>
      <div class="card" style="margin-top:12px"><h3>Allowlist & restrições</h3>${pre(commands)}</div>`;
    document.getElementById('cmd-copy')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(document.getElementById('cmd-editor').value);
    });

    // Repack
    document.getElementById('tab-repack').innerHTML = `
      <div class="grid">
        <div class="card"><h3>Repack — reconstrução controlada</h3>
          <p class="muted">${esc(repack.description)}</p>
          <div>${Object.entries(repack.principles).filter(([,v])=>v).map(([k])=>pill(k)).join('')}</div>
          <h3 style="margin-top:10px">Controles</h3>${(repack.controls.commands||[]).map(pill).join('')}
        </div>
        <div class="card"><h3>Pipeline</h3>${(repack.pipeline||[]).map(s=>`<div style="margin-bottom:8px"><b>${esc(s.stage)}</b> <span class="muted">→ ${esc(s.output)}</span><div class="muted">${esc(s.desc)}</div></div>`).join('')}</div>
      </div>
      <div class="card" style="margin-top:12px"><h3>Estratégias</h3>${(repack.controls.strategy_enum||[]).map(pill).join('')}</div>
      <div class="card" style="margin-top:12px"><h3>Estado do Repack</h3>${pre(repack)}</div>`;

    // Adapters
    const arows = (adapters.adapters||[]).map(a=>`<tr><td><b>${esc(a.id)}</b><div class="muted">${esc(a.type)}</div></td><td>${(a.modes||[]).map(pill).join('')}</td><td>${(a.supports||[]).slice(0,8).map(pill).join('')}${(a.supports||[]).length>8?pill('+'+((a.supports.length-8))):''}</td><td class="muted">${esc(a.notes||'')}</td></tr>`).join('');
    document.getElementById('tab-adapters').innerHTML = `
      <div class="card"><h3>Adaptadores (todas as opções)</h3>
        <table><thead><tr><th>Adapter</th><th>Modos</th><th>Suporta</th><th>Notas</th></tr></thead><tbody>${arows}</tbody></table>
      </div>
      <div class="card" style="margin-top:12px"><h3>Configurações</h3>${pre(adapters)}</div>`;

    // Integration prompt (ABA dedicada)
    document.getElementById('tab-integration').innerHTML = `
      <div class="card"><h3>Prompt de Integração (IA)</h3>
        <p class="muted">Copie este prompt para integrar a API em outro projeto usando uma IA. Fonte: <code>${esc(prompt.source)}</code></p>
        <textarea id="prompt-text">${esc(prompt.content)}</textarea>
        <div class="row" style="margin-top:8px"><button class="btn" id="prompt-copy">Copiar prompt</button><a class="pill" href="../prompts/integration.md" target="_blank">Abrir .md</a></div>
      </div>
      <div class="card" style="margin-top:12px"><h3>Endpoint do prompt</h3>${pre(prompt)}</div>`;
    document.getElementById('prompt-copy')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(document.getElementById('prompt-text').value);
    });

  } catch (e) {
    document.getElementById('status-pill').textContent = 'erro';
    document.getElementById('tab-overview').innerHTML = `<div class="card"><h3>Erro ao carregar</h3><pre>${esc(e.message)}</pre><p class="muted">Abra via servidor estático (ex.: <code>npx serve .</code>) para permitir fetch dos JSONs.</p></div>`;
  }
}
main();
