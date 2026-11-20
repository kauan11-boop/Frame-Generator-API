import { loadAll } from './api.js';
import { CONFIG } from './config.js';
import { esc, pill, pre, pills, setActiveTab, renderError } from './render.js';

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) setActiveTab(b.dataset.tab);
});

async function copyFrom(id) {
  const el = document.getElementById(id);
  if (!el) return;
  await navigator.clipboard.writeText(el.value || el.textContent || '');
}

function render(d) {
  const { discovery, status, models, frames, templates, packages, commands, repack, adapters, prompt, content } = d;

  document.getElementById('status-pill').textContent = status.status || 'ok';
  document.getElementById('status-pill').classList.add('ok');
  document.getElementById('base').textContent = new URL(CONFIG.API_V1, location.href).toString();
  document.getElementById('meta').textContent = `v${discovery.version} • sync ${discovery.sync?.recommended_interval_sec || 60}s • etag/version`;

  document.getElementById('tab-overview').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Hospedagem & modos</h3><div class="kv">
        <div>Tipo</div><div>${pill('static GitHub Pages')} ${pill('híbrido via adaptadores')}</div>
        <div>Quadros</div><div>${pills(Object.keys(discovery.frame_modes || {}))}</div>
        <div>GGUF</div><div>${pills(Object.keys(discovery.gguf_modes || {}))}</div>
        <div>Sync</div><div>${esc(discovery.sync?.strategy)} (version/etag)</div>
      </div></div>
      <div class="card"><h3>Componentes</h3>${Object.entries(status.components || {}).map(([k,v])=>`<div>${pill(k)} <span class="muted">${esc(v)}</span></div>`).join('')}</div>
      <div class="card"><h3>Limites</h3>
        <div>${pill('sem servidor no Pages')}</div>
        <div>${pill('execução pesada = adapter externo')}</div>
        <div>${pill('GGUF: metadados/índice; sem pesos')}</div>
        <div class="warn mt">Repack transparente e auditável (sem mutação oculta de código-fonte).</div>
      </div>
    </div>
    ${content ? `<div class="card mt"><h3>Catálogo de conteúdos</h3><div class="kv"><div>Categorias</div><div>${pills((content.categories||[]).map(c=>c.id))}</div></div>${pre(content)}</div>` : ''}
    <div class="card mt"><h3>Discovery</h3>${pre(discovery)}</div>`;

  const mrows = (models.models||[]).map(m => `<tr>
    <td><b>${esc(m.id)}</b><div class="muted">${esc(m.name)}</div></td>
    <td>${pill(m.mode)} ${pill(m.format)} ${pill(m.status)}</td>
    <td>${pill('ctx '+m.context_length)} ${m.quantization?pill(m.quantization):''}</td>
    <td>${pills(Object.entries(m.capabilities||{}).filter(([,v])=>v).map(([k])=>k))}</td>
    <td>${pills(m.runners||[])}</td></tr>`).join('');
  document.getElementById('tab-models').innerHTML = `
    <div class="card"><h3>Registro de modelos (metadados completos + carregador)</h3>
      <p class="muted">A) runner externo, B) WASM experimental, C) catálogo/metadados. Inspeção GGUF: general/architecture/tokenizer/tensors/inspection (sem descompilar pesos).</p>
      <table><thead><tr><th>Modelo</th><th>Modo/Formato</th><th>Contexto/Quant</th><th>Capacidades</th><th>Runners</th></tr></thead><tbody>${mrows}</tbody></table>
    </div>
    <div class="card mt"><h3>Esquema de metadados GGUF</h3>${pre(models.gguf_metadata_schema)}</div>
    <div class="card mt"><h3>Registro completo</h3>${pre(models)}</div>`;

  document.getElementById('tab-frames').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Modos de geração</h3>${pills(frames.modes||[])}
        <p class="muted mt">Controle por jobs via adapter: ${pills(Object.keys(frames.control||{}))}</p>
        <h3 class="mt">Defaults</h3>${pre(frames.defaults)}</div>
      <div class="card"><h3>Templates</h3>${(templates.templates||[]).map(t=>`<div style="margin-bottom:8px"><b>${esc(t.title)}</b> ${pill(t.mode)}<div class="muted">${esc(t.id)}</div></div>`).join('')}</div>
    </div>
    <div class="card mt"><h3>Templates & exemplos</h3>${pre(templates)}</div>
    <div class="card mt"><h3>Orquestrador</h3>${pre(frames)}</div>`;

  const prows = (packages.packages||[]).map(p=>`<tr><td><b>${esc(p.id)}</b><div class="muted">${esc(p.name)}</div></td><td>${pill(p.version)} ${pill(p.type)} ${pill(p.status)}</td><td>${pills(p.provides||[])}</td><td>${pills(p.requires||[])||'<span class="muted">—</span>'}</td><td><code>${esc(p.entry)}</code></td></tr>`).join('');
  document.getElementById('tab-packages').innerHTML = `
    <div class="card"><h3>Pacotes e autoajuste</h3>
      <p class="muted">Mecanismo: ${esc(packages.auto_adjust?.mechanism)} — ${esc(packages.auto_adjust?.client_behavior)}</p>
      <table><thead><tr><th>Pacote</th><th>Versão/Tipo</th><th>Provides</th><th>Requires</th><th>Entry</th></tr></thead><tbody>${prows}</tbody></table>
    </div>
    <div class="card mt"><h3>Manifesto</h3>${pre(packages)}</div>`;

  const crows = (commands.commands||[]).map(c=>`<tr><td><code>${esc(c.name)}</code></td><td>${pill(c.scope)}</td><td>${pills(c.transport||[])}</td><td class="muted">${esc(c.description)}</td></tr>`).join('');
  const sample = {command:'models.list',request_id:'req_demo_001',client:{name:'public-ui',version:'1.0.0'},auth:{mode:'none'},meta:{dry_run:false},payload:{}};
  document.getElementById('tab-commands').innerHTML = `
    <div class="card"><h3>Protocolo e restrições</h3>
      <div class="row">${pill('allowlist')} ${pill('schema obrigatório')} ${pill('request_id obrigatório')} ${pill('max '+(commands.enforce?.max_body_bytes||0)+' bytes')}</div>
      <p class="muted mt">Envelope: <code>schemas/command.schema.json</code> • Resposta: <code>schemas/response.schema.json</code></p>
      <table><thead><tr><th>Comando</th><th>Escopo</th><th>Transporte</th><th>Descrição</th></tr></thead><tbody>${crows}</tbody></table>
    </div>
    <div class="card mt"><h3>Compor envelope (exemplo)</h3>
      <textarea id="cmd-editor">${esc(JSON.stringify(sample, null, 2))}</textarea>
      <div class="row"><button class="btn primary" id="cmd-copy">Copiar JSON</button><span class="muted">Escrita/execução real requer adapter configurado.</span></div>
    </div>
    <div class="card mt"><h3>Allowlist & restrições</h3>${pre(commands)}</div>`;
  document.getElementById('cmd-copy')?.addEventListener('click', () => copyFrom('cmd-editor'));

  document.getElementById('tab-repack').innerHTML = `
    <div class="grid">
      <div class="card"><h3>Repack — reconstrução controlada</h3>
        <p class="muted">${esc(repack.description)}</p>
        <div>${pills(Object.entries(repack.principles||{}).filter(([,v])=>v).map(([k])=>k))}</div>
        <h3 class="mt">Controles</h3>${pills(repack.controls?.commands||[])}
      </div>
      <div class="card"><h3>Pipeline</h3>${(repack.pipeline||[]).map(s=>`<div style="margin-bottom:8px"><b>${esc(s.stage)}</b> <span class="muted">→ ${esc(s.output)}</span><div class="muted">${esc(s.desc)}</div></div>`).join('')}</div>
    </div>
    <div class="card mt"><h3>Estratégias</h3>${pills(repack.controls?.strategy_enum||[])}</div>
    <div class="card mt"><h3>Estado do Repack</h3>${pre(repack)}</div>`;

  const arows = (adapters.adapters||[]).map(a=>`<tr><td><b>${esc(a.id)}</b><div class="muted">${esc(a.type)}</div></td><td>${pills(a.modes||[])}</td><td>${pills((a.supports||[]).slice(0,8))}${(a.supports||[]).length>8?pill('+'+((a.supports.length-8))):''}</td><td class="muted">${esc(a.notes||'')}</td></tr>`).join('');
  document.getElementById('tab-adapters').innerHTML = `
    <div class="card"><h3>Adaptadores (todas as opções)</h3>
      <table><thead><tr><th>Adapter</th><th>Modos</th><th>Suporta</th><th>Notas</th></tr></thead><tbody>${arows}</tbody></table>
    </div>
    <div class="card mt"><h3>Configurações</h3>${pre(adapters)}</div>`;

  document.getElementById('tab-integration').innerHTML = `
    <div class="card"><h3>Prompt de Integração (IA)</h3>
      <p class="muted">Copie este prompt para integrar a API em outro projeto usando uma IA. Fonte: <code>${esc(prompt.source)}</code></p>
      <textarea id="prompt-text">${esc(prompt.content)}</textarea>
      <div class="row"><button class="btn primary" id="prompt-copy">Copiar prompt</button><a class="btn" href="${CONFIG.PROMPTS_SRC}" target="_blank" rel="noopener">Abrir .md</a></div>
    </div>
    <div class="card mt"><h3>Endpoint do prompt</h3>${pre(prompt)}</div>`;
  document.getElementById('prompt-copy')?.addEventListener('click', () => copyFrom('prompt-text'));
}

(async () => {
  const overview = document.getElementById('tab-overview');
  try {
    const data = await loadAll();
    render(data);
  } catch (e) {
    document.getElementById('status-pill').textContent = 'erro';
    document.getElementById('status-pill').classList.add('err');
    renderError(overview, e);
  }
})();
