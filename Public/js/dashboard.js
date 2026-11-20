import { bootCore, getSiteBase, fetchJson } from './api.js';
import { configUrl } from './config.js';
import { initI18n } from './i18n.js';
import {
  esc, escAttr, formatBytes, formatDate, boolPill, statePill, pills,
  announce, setActiveTab, renderError, emptyState, loadingCard, codeBlock,
  table, copyText, downloadJson
} from './render.js';
import { recordToolUse, recordFeatureUse, getTopTools, getUsageStats } from './usage.js';
import { donutChart } from './charts.js';
import { WebSocketClient } from './websocket.js';
import { generateDiscordFiles, getDiscordOptions, simulateDiscordInteraction } from './discord.js';
import { getReactViteTemplates, getDiscordRuntimeTemplateFiles } from './templates.js';

let app = null;
let staticData = {};
let loadErrors = {};
let masterPrompt = { text: '', url: '', error: null };
let wsClient = null;
let discordState = { form: null, generated: null };

const CONFIG_FILES = [
  { key: 'api', name: 'configs/api.json', desc: 'Contrato lógico /api/v1, modo e backend.' },
  { key: 'models', name: 'configs/models.json', desc: 'Formatos suportados e políticas declarativas de modelos.' },
  { key: 'generators', name: 'configs/generators.json', desc: 'Geradores registrados/configurados.' },
  { key: 'repacks', name: 'configs/repacks.json', desc: 'Repacks/manifests declarados no registro de configuração.' },
  { key: 'permissions', name: 'configs/permissions.json', desc: 'Papéis e permissões de UI (autorização real requer backend).' },
  { key: 'settings', name: 'configs/settings.json', desc: 'Sistema, UI, provedores e presets declarativos.' },
];

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function getStatus() {
  try { return app?.getStatus ? app.getStatus() : null; } catch { return null; }
}

function getSite() { return getSiteBase(); }

async function loadStaticJson(key, relativeCandidates) {
  for (const rel of relativeCandidates) {
    try {
      const url = new URL(rel, import.meta.url).href;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return { ok: true, data: await res.json(), url };
    } catch (e) {
      loadErrors[key] = e?.message || String(e);
    }
  }
  return { ok: false, data: null, url: null };
}

async function loadMasterPrompt() {
  const candidates = [
    '../documentation/master-prompt.md',
    './documentation/master-prompt.md',
    '../../Public/documentation/master-prompt.md',
  ];
  for (const rel of candidates) {
    try {
      const url = new URL(rel, import.meta.url).href;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const text = await res.text();
      masterPrompt = { text, url, error: null };
      return masterPrompt;
    } catch (e) {
      masterPrompt.error = e?.message || String(e);
    }
  }
  masterPrompt = { text: '', url: new URL('../documentation/master-prompt.md', import.meta.url).href, error: masterPrompt.error || 'Arquivo não encontrado.' };
  return masterPrompt;
}

async function loadAllStatic() {
  const [presets, template, sampleManifest, master] = await Promise.all([
    loadStaticJson('presets', ['../presets/default-presets.json']),
    loadStaticJson('jobTemplate', ['../templates/job-template.json']),
    loadStaticJson('sampleManifest', ['../manifests/sample-repack.json']),
    loadMasterPrompt(),
  ]);
  staticData.presets = presets.data;
  staticData.presetsUrl = presets.url;
  staticData.jobTemplate = template.data;
  staticData.jobTemplateUrl = template.url;
  staticData.sampleManifest = sampleManifest.data;
  staticData.sampleManifestUrl = sampleManifest.url;

  // Load configs via fetchJson (configUrl aware) with fallback
  const cfgs = {};
  for (const c of CONFIG_FILES) {
    try {
      cfgs[c.key] = await fetchJson(`configs/${c.key}.json`);
    } catch (e) {
      loadErrors[`config:${c.key}`] = e?.message || String(e);
      cfgs[c.key] = null;
    }
  }
  staticData.configs = cfgs;
  return staticData;
}

function setGlobalStatus(kind, text) {
  const pill = qs('#status-pill');
  const side = qs('#side-status');
  if (pill) {
    pill.textContent = text;
    pill.className = 'status ' + (kind || 'info');
  }
  if (side) {
    side.textContent = text;
    side.className = 'badge ' + (kind || 'info');
  }
}

function updateChrome() {
  const s = getStatus() || {};
  const mode = app?.api?.mode || s?.mode || 'demo';
  const backendConfigured = !!(app?.api?.baseUrl || s?.api?.baseUrl);
  const backendState = s?.backend?.state || (backendConfigured ? 'configurado' : 'não configurado');
  const statusKind = s?.status === 'ready' ? 'ok' : (s?.status === 'degraded' || s?.partiallyInitialized ? 'warn' : (s?.error ? 'err' : 'info'));

  setGlobalStatus(statusKind, s?.status || (app?.error ? 'erro' : 'indisponível'));
  const modePill = qs('#mode-pill'); if (modePill) modePill.textContent = mode;
  const sideMode = qs('#side-mode'); if (sideMode) sideMode.textContent = mode;
  const sideBackend = qs('#side-backend'); if (sideBackend) sideBackend.textContent = backendState;
  const meta = qs('#meta'); if (meta) meta.textContent = `Base do site: ${getSite()}`;
  const updated = qs('#updated-at'); if (updated) updated.textContent = s?.updatedAt ? `Atualizado: ${formatDate(s.updatedAt)}` : '';
}

function renderNotices() {
  const el = qs('#global-notices');
  if (!el) return;
  const notices = [];
  const s = getStatus();
  if (s?.partiallyInitialized || s?.status === 'degraded') {
    notices.push(`<div class="notice warn" role="status"><h3>Núcleo inicializado com avisos</h3><p>Alguns módulos ou configurações podem estar indisponíveis. Consulte o diagnóstico em Visão geral para detalhes e próximos passos.</p></div>`);
  }
  if ((app?.api?.mode || 'demo') === 'demo') {
    notices.push(`<div class="notice info" role="note"><h3>Modo demonstração/estático</h3><p>Operações que exigem servidor, inferência, quantização efetiva ou processamento pesado retornam estado indisponível/requer runtime quando não há backend/provedor compatível. Nenhum resultado é simulado.</p></div>`);
  }
  const cfgFails = CONFIG_FILES.filter((c) => loadErrors[`config:${c.key}`] || s?.config?.diagnostics?.[c.key]?.ok === false);
  if (cfgFails.length) {
    notices.push(`<div class="notice warn" role="status"><h3>Configurações com falha ou fallback</h3><p>Não foi possível carregar/validar: ${esc(cfgFails.map((c) => c.name).join(', '))}. O núcleo pode operar com defaults; verifique os arquivos em <code>configs/</code>.</p></div>`);
  }
  el.innerHTML = notices.join('');
}

function sectionNavButton(targetTab, label) {
  return `<button class="btn" type="button" data-goto-tab="${escAttr(targetTab)}">${esc(label)}</button>`;
}

function renderOverview() {
  const el = qs('#tab-overview');
  if (!el) return;
  const s = getStatus() || {};
  const caps = s.capabilities || {};
  const c = caps.capabilities || {};
  const counts = s.counts || {};
  const diagnostics = s.config?.diagnostics || {};
  const moduleErrors = Array.isArray(s.moduleErrors) ? s.moduleErrors : (Array.isArray(s.errors) ? s.errors : []);
  const tasks = app?.jobs?.list ? app.jobs.list() : [];
  const models = app?.modelRegistry?.list ? app.modelRegistry.list() : [];
  const engines = app?.engines?.list ? app.engines.list() : [];

  const cfgRows = CONFIG_FILES.map((cfg) => {
    const d = diagnostics[cfg.key] || {};
    const ok = d.ok !== false && !loadErrors[`config:${cfg.key}`];
    const status = ok ? 'carregado' : 'falha/fallback';
    const src = d.source ? esc(String(d.source).split('/').slice(-2).join('/')) : '—';
    const err = d.error?.message || loadErrors[`config:${cfg.key}`] || '';
    return [esc(cfg.name), statePill(status), src, err ? `<span class="muted">${esc(err)}</span>` : '—'];
  });

  const capList = [
    ['WebGPU', !!c.webgpu, 'Aceleração GPU no navegador (quando suportada).'],
    ['WebAssembly (WASM)', !!c.wasm, 'Execução de runtimes compilados no navegador.'],
    ['WebCodecs', !!c.webcodecs, 'Acesso a codecs de mídia (quando suportado).'],
    ['Web Workers', !!c.workers, 'Processamento em segundo plano.'],
    ['IndexedDB', !!c.indexedDB, 'Armazenamento local estruturado.'],
    ['OffscreenCanvas', !!c.offscreenCanvas, 'Renderização fora da thread principal (quando suportado).'],
    ['File API / Blob', !!c.fileApi, 'Leitura de arquivos locais selecionados pelo usuário.'],
  ];

  el.innerHTML = `
    <div class="stack">
      <div class="grid">
        <section class="card" aria-labelledby="ov-status-title">
          <h2 id="ov-status-title">Estado da sessão</h2>
          <div class="kv">
            <div>Status do núcleo</div><div>${statePill(s.status || 'indisponível')}</div>
            <div>Versão</div><div><code>${esc(s.version || app?.version || '1.0.0')}</code></div>
            <div>Modo</div><div>${statePill(app?.api?.mode || s.mode || 'demo')}</div>
            <div>Backend (URL definida)</div><div>${statePill(app?.api?.baseUrl ? 'configurado' : 'não configurado')} ${app?.api?.baseUrl ? `<br><code>${esc(app.api.baseUrl)}</code>` : '<span class="muted">Nenhuma URL de backend configurada nesta sessão.</span>'}</div>
            <div>Contrato lógico</div><div><code>${esc(app?.api?.getContract?.()?.base || '/api/v1')}</code> <span class="muted">(sem servidor REST nativo no GitHub Pages)</span></div>
            <div>Iniciado em</div><div>${formatDate(s.startedAt)}</div>
          </div>
          <p class="section-note">"Backend configurado" indica URL definida na sessão; não comprova conectividade sem teste em runtime/backend compatível.</p>
        </section>
        <section class="card" aria-labelledby="ov-counts-title">
          <h2 id="ov-counts-title">Resumo de recursos (sessão)</h2>
          <div class="kv">
            <div>Módulos</div><div>${esc(counts.modules ?? 0)}</div>
            <div>Modelos registrados</div><div>${esc(counts.models ?? models.length)}</div>
            <div>Modelos carregados</div><div>${esc(counts.loadedModels ?? 0)}</div>
            <div>Geradores</div><div>${esc(counts.generators ?? 0)}</div>
            <div>Engines</div><div>${esc(counts.engines ?? engines.length)}</div>
            <div>Provedores</div><div>${esc(counts.providers ?? 0)}</div>
            <div>Tarefas</div><div>${esc(counts.tasks ?? tasks.length)}</div>
            <div>Repacks</div><div>${esc(counts.repacks ?? 0)}</div>
            <div>Ferramentas</div><div>${esc(counts.tools ?? 0)}</div>
          </div>
          <div class="actions mt">${sectionNavButton('resources', 'Ver capacidades e recursos')}${sectionNavButton('integration', 'Ir para integração')}</div>
        </section>
      </div>

      <section class="card" aria-labelledby="ov-usage-title">
        <h2 id="ov-usage-title">Ferramentas e recursos mais utilizados</h2>
        <p class="muted">Gráfico circular com base no uso registrado nesta sessão/navegador (ferramentas do <code>ToolRegistry</code> e ações/seções da interface). O rastreamento é local (localStorage), sem envio automático para servidores.</p>
        ${(() => {
          const top = getTopTools(8);
          const chartData = top.map((i) => ({ label: i.label || i.id, value: i.count, id: i.id }));
          const total = chartData.reduce((a, b) => a + b.value, 0);
          const updatedAt = getUsageStats()?.updatedAt;
          return `
            <div class="grid-2" style="align-items:start">
              <div>
                ${donutChart(chartData, { size: 240, thickness: 36, title: 'Uso de ferramentas e recursos', ariaLabel: 'Gráfico circular de ferramentas e recursos mais utilizados', centerLabel: String(total), centerSub: 'usos' })}
              </div>
              <div>
                ${chartData.length ? table(['Ferramenta/Recurso', 'Categoria', 'Usos', 'Último uso'], chartData.map((d, idx) => {
                  const src = top[idx] || {};
                  return [`<strong>${esc(d.label)}</strong><br><code>${esc(src.id || '')}</code>`, esc(src.category || '—'), esc(d.value), formatDate(src.lastUsedAt)];
                }), 'Ranking de uso', { srCaption: true }) : emptyState('Sem dados de uso ainda', 'Navegue pelas abas ou execute ferramentas registradas para popular o gráfico de uso localmente.')}
                <p class="section-note mt">${updatedAt ? `Última atualização do rastreamento: ${formatDate(updatedAt)}.` : 'Nenhum evento registrado até o momento.'} ${app?.tools?.list ? `Ferramentas registradas disponíveis: ${esc((app.tools.list() || []).length)}.` : ''}</p>
                <div class="actions mt"><button class="btn small" type="button" id="usage-refresh" data-feature="usage-refresh">Atualizar gráfico</button><button class="btn small" type="button" id="usage-clear" data-feature="usage-clear">Limpar rastreamento local</button></div>
              </div>
            </div>`;
        })()}
      </section>

      <section class="card" aria-labelledby="ov-caps-title">
        <h2 id="ov-caps-title">Capacidades do navegador (detecção)</h2>
        <p class="muted">Detecção local para orientar compatibilidade. "Disponível" não garante que uma operação específica será executada sem modelo/runtime/provedor adequado.</p>
        ${table(['Capacidade', 'Estado', 'Impacto prático'], capList.map(([name, ok, impact]) => [esc(name), boolPill(ok), `<span class="muted">${esc(impact)}</span>`]), 'Capacidades detectadas no navegador', { srCaption: true })}
        <div class="kv mt">
          <div>Núcleos lógicos (CPU)</div><div>${esc(caps.hardware?.hardwareConcurrency ?? 'não informado')}</div>
          <div>Memória aproximada</div><div>${esc(caps.hardware?.deviceMemoryGB ? `${caps.hardware.deviceMemoryGB} GB` : 'não informado pelo navegador')}</div>
          <div>Plataforma</div><div>${esc(caps.hardware?.platform ?? 'não informado')}</div>
        </div>
        <p class="section-note">Informações de hardware/navegador são expostas localmente pela API do navegador e podem ser aproximadas ou omitidas por privacidade.</p>
      </section>

      <section class="card" aria-labelledby="ov-cfg-title">
        <h2 id="ov-cfg-title">Diagnóstico de configurações</h2>
        ${table(['Arquivo', 'Estado', 'Origem', 'Observação'], cfgRows, 'Diagnóstico de carregamento das configurações', { srCaption: true })}
        ${moduleErrors.length ? `<div class="notice warn mt"><h3>Erros/avisos de módulos</h3><ul>${moduleErrors.map((e) => `<li>${esc(typeof e === 'string' ? e : (e?.message || JSON.stringify(e)))}</li>`).join('')}</ul></div>` : ''}
      </section>
    </div>`;
}

function renderResources() {
  const el = qs('#tab-resources');
  if (!el) return;
  const s = getStatus() || {};
  const engines = app?.engines?.list ? app.engines.list() : (s.enginesState || []);
  const providers = app?.providers?.list ? app.providers.list() : (s.providersState || []);
  const caps = s.capabilities || {};
  const wc = caps.webcodecs || {};
  const webgpu = caps.webgpu || {};

  const engineRows = engines.length ? engines.map((e) => [
    `<strong>${esc(e.name || e.id || 'Engine')}</strong><br><code>${esc(e.id || '—')}</code>`,
    statePill(e.state || (e.available ? 'available' : 'unavailable')),
    esc(e.reason || e.note || e.type || (e.available === false ? 'Indisponível ou não detectada neste ambiente.' : '—')),
  ]) : null;

  const providerRows = providers.length ? providers.map((p) => [
    `<strong>${esc(p.name || p.id || 'Provedor')}</strong><br><code>${esc(p.id || '—')}</code>`,
    esc(p.type || '—'),
    statePill(p.state || '—'),
    `<span class="muted">${p.url ? esc(p.url) : 'Sem URL configurada.'}${Array.isArray(p.capabilities) && p.capabilities.length ? `<br>Capacidades: ${esc(p.capabilities.join(', '))}` : ''}</span>`,
  ]) : null;

  el.innerHTML = `
    <div class="stack">
      <section class="card" aria-labelledby="res-engines-title">
        <h2 id="res-engines-title">Engines (detecção/estado)</h2>
        <p class="muted">Engines representam mecanismos de execução/integração. Disponibilidade depende do navegador, runtime e configuração.</p>
        ${engineRows ? table(['Engine', 'Estado', 'Detalhes'], engineRows, 'Engines registradas', { srCaption: true }) : emptyState('Nenhuma engine registrada', 'O núcleo não reportou engines nesta sessão. Recarregue o dashboard ou verifique o diagnóstico na Visão geral.', sectionNavButton('overview', 'Abrir diagnóstico'))}
      </section>

      <section class="card" aria-labelledby="res-providers-title">
        <h2 id="res-providers-title">Provedores (registro/configuração)</h2>
        <p class="muted">Provedores definem onde operações podem ser executadas (navegador local, backend externo etc.). Estados como <code>unconfigured</code> ou <code>unavailable</code> indicam que não há execução pronta sem configuração adicional.</p>
        ${providerRows ? table(['Provedor', 'Tipo', 'Estado', 'Detalhes'], providerRows, 'Provedores registrados', { srCaption: true }) : emptyState('Nenhum provedor registrado', 'Nenhum provedor foi encontrado. Verifique configs/settings.json e o estado do núcleo.', sectionNavButton('config', 'Ver configurações'))}
      </section>

      <div class="grid-2">
        <section class="card" aria-labelledby="res-webgpu-title">
          <h2 id="res-webgpu-title">Detalhes WebGPU</h2>
          <div class="kv">
            <div>Disponível</div><div>${boolPill(!!webgpu.available)}</div>
            <div>Estado</div><div>${statePill(webgpu.state || (webgpu.available ? 'available' : 'unavailable'))}</div>
            <div>Motivo/nota</div><div>${esc(webgpu.reason || webgpu.message || '—')}</div>
          </div>
          <p class="section-note">Mesmo com WebGPU disponível, inferência/processamento depende de pipelines, modelos e runtimes compatíveis.</p>
        </section>
        <section class="card" aria-labelledby="res-webcodecs-title">
          <h2 id="res-webcodecs-title">Detalhes WebCodecs / Mídia</h2>
          <div class="kv">
            <div>Disponível</div><div>${boolPill(!!wc.available)}</div>
            <div>VideoDecoder</div><div>${boolPill(!!wc.videoDecoder)}</div>
            <div>VideoEncoder</div><div>${boolPill(!!wc.videoEncoder)}</div>
            <div>VideoFrame</div><div>${boolPill(!!wc.videoFrame)}</div>
          </div>
          <p class="section-note">Suporte a APIs não implica suporte a todos os codecs, perfis ou fluxos de encode/decode.</p>
        </section>
      </div>
    </div>`;
}

function renderModels() {
  const el = qs('#tab-models');
  if (!el) return;
  const models = app?.modelRegistry?.list ? app.modelRegistry.list() : [];
  const loaded = app?.modelLoader?.listLoaded ? app.modelLoader.listLoaded() : [];
  const supported = staticData.configs?.models?.defaults?.supportedFormats || ['gguf','onnx','safetensors','bin','pt','pth','json-manifest'];

  const rows = models.map((m) => [
    `<strong>${esc(m.name || m.fileName || m.id)}</strong><br><code>${esc(m.id)}</code>`,
    esc(m.format || '—'),
    esc(m.architecture || '—'),
    esc(m.quantization || m.precision || '—'),
    m.size ? `${esc(formatBytes(m.size))}` : '—',
    statePill(m.state || 'registered'),
    `<span class="muted">${esc((m.runtimeCompatible || []).join(', ') || '—')}${Array.isArray(m.warnings) && m.warnings.length ? `<br>Avisos: ${esc(m.warnings[0])}${m.warnings.length > 1 ? ` (+${m.warnings.length - 1})` : ''}` : ''}</span>`,
  ]);

  const loadedInfo = loaded.length ? `<p><strong>Carregados nesta sessão:</strong> ${esc(loaded.join(', '))}</p>` : '<p class="muted">Nenhum modelo marcado como carregado nesta sessão.</p>';

  el.innerHTML = `
    <div class="stack">
      <section class="card" aria-labelledby="models-info-title">
        <h2 id="models-info-title">Análise e registro de modelos (estado real)</h2>
        <div class="notice info">
          <h3>O que esta UI oferece</h3>
          <ul>
            <li>Exibe modelos <strong>registrados/analisados nesta sessão</strong> pelo núcleo, quando houver.</li>
            <li>Formatos declarados em configuração: ${pills(supported)}.</li>
            <li>Análise de metadados GGUF pode ocorrer no navegador (com limites de tamanho/memória). <strong>Análise não é inferência.</strong></li>
          </ul>
        </div>
        <div class="notice warn mt">
          <h3>Limitações importantes</h3>
          <ul>
            <li>Esta interface web estática <strong>não inclui</strong> um fluxo completo de upload/execução de inferência por padrão.</li>
            <li>Carregamento de pesos e inferência requerem runtime/provedor compatível (local ou backend) configurado.</li>
            <li>Quantização/conversão efetiva não é executada no cliente estático; arquivos originais devem ser preservados.</li>
          </ul>
        </div>
        <p class="section-note mt">Para integrações programáticas, use o núcleo exposto (<code>window.FGUA</code> / <code>FGUA_APP</code>), APIs do <code>ModelLoader</code>/<code>ModelRegistry</code> e o payload de integração, respeitando estados retornados.</p>
      </section>

      <section class="card" aria-labelledby="models-list-title">
        <h2 id="models-list-title">Modelos na sessão</h2>
        ${loadedInfo}
        ${rows.length ? table(['Modelo', 'Formato', 'Arquitetura', 'Quantização/Precisão', 'Tamanho', 'Estado', 'Runtime/avisos'], rows, 'Modelos registrados na sessão', { srCaption: true }) : emptyState('Nenhum modelo registrado nesta sessão', 'Quando um modelo for analisado/registrado pelo núcleo nesta sessão, ele aparecerá aqui com metadados e estado. Em modo demo, é esperado não haver modelos carregados.', sectionNavButton('integration', 'Ver opções de integração'))}
      </section>
    </div>`;
}

function renderGenerators() {
  const el = qs('#tab-generators');
  if (!el) return;
  const generators = app?.generatorRegistry?.list ? app.generatorRegistry.list() : [];
  const presetsFromConfig = staticData.configs?.settings?.presets || [];
  const presetsPublic = staticData.presets?.presets || [];
  const template = staticData.jobTemplate;

  const genRows = generators.map((g) => [
    `<strong>${esc(g.name || g.id)}</strong><br><code>${esc(g.id)}</code>`,
    esc(g.category || '—'),
    statePill(g.enabled === false ? 'disabled' : (g.status || 'registered')),
    `<span class="muted">${esc(g.engine ? `Engine preferencial: ${g.engine}` : 'Sem engine preferencial definida.')}</span>`,
  ]);

  const renderPresetRows = (items, sourceLabel) => (items || []).map((p) => [
    `<strong>${esc(p.name || p.id)}</strong><br><code>${esc(p.id || '—')}</code>`,
    esc(p.category || '—'),
    `<code>${esc(JSON.stringify(p.config || {}))}</code>`,
    esc(sourceLabel),
  ]);

  const presetRows = [...renderPresetRows(presetsFromConfig, 'configs/settings.json'), ...renderPresetRows(presetsPublic, 'Public/presets/default-presets.json')];

  el.innerHTML = `
    <div class="stack">
      <section class="card" aria-labelledby="gen-reg-title">
        <h2 id="gen-reg-title">Geradores registrados</h2>
        <p class="muted">Registro de geradores planejados/suportados pelo núcleo. Registro não implica execução disponível sem engine/modelo/provedor compatível.</p>
        ${genRows.length ? table(['Gerador', 'Categoria', 'Estado', 'Detalhes'], genRows, 'Geradores registrados', { srCaption: true }) : emptyState('Nenhum gerador registrado', 'Verifique configs/generators.json e o bootstrap do núcleo.', sectionNavButton('config', 'Ver configurações'))}
      </section>

      <section class="card" aria-labelledby="gen-presets-title">
        <h2 id="gen-presets-title">Presets (configuração e artefatos públicos)</h2>
        <p class="muted">Presets são parâmetros reutilizáveis. Podem existir em <code>configs/settings.json</code> e/ou em <code>Public/presets/default-presets.json</code>; diferenças refletem as fontes atuais do repositório e devem ser tratadas conforme o seu fluxo de integração.</p>
        ${presetRows.length ? table(['Preset', 'Categoria', 'Configuração', 'Fonte'], presetRows, 'Presets disponíveis', { srCaption: true }) : emptyState('Nenhum preset encontrado', 'Não foram encontrados presets nas fontes esperadas.', sectionNavButton('config', 'Ver configurações'))}
      </section>

      <section class="card" aria-labelledby="gen-template-title">
        <h2 id="gen-template-title">Template de tarefa (artefato público)</h2>
        ${template ? `
          <div class="kv">
            <div>ID</div><div><code>${esc(template.id || '—')}</code></div>
            <div>Nome</div><div>${esc(template.name || '—')}</div>
            <div>Tipo</div><div>${esc(template.type || '—')}</div>
            <div>Campos</div><div>${pills(template.fields || []) || '<span class="muted">—</span>'}</div>
          </div>
          ${codeBlock('job-template-json', JSON.stringify(template, null, 2), 'Copiar template JSON')}
          <p class="section-note">Template de referência para estruturar tarefas em integrações; não executa processamento por si só.</p>
        ` : emptyState('Template indisponível', 'Não foi possível carregar Public/templates/job-template.json.', '')}
      </section>
    </div>`;
}

function renderJobs() {
  const el = qs('#tab-jobs');
  if (!el) return;
  const jobs = app?.jobs?.list ? app.jobs.list() : [];
  const rows = jobs.map((j) => [
    `<code>${esc(j.id)}</code>`,
    esc(j.type || j.category || '—'),
    statePill(j.state || '—'),
    `${esc(j.progress ?? 0)}%`,
    formatDate(j.createdAt),
    formatDate(j.completedAt),
    `<span class="muted">${esc(j.message || j.error?.message || '—')}</span>`,
  ]);

  el.innerHTML = `
    <div class="stack">
      <section class="card" aria-labelledby="jobs-title">
        <h2 id="jobs-title">Tarefas da sessão</h2>
        <p class="muted">Tarefas são gerenciadas em memória nesta sessão. Estados refletem execução real reportada pelo núcleo (ex.: <code>unavailable</code>, <code>requires-provider/runtime</code>, <code>failed</code>, <code>cancelled</code>, <code>succeeded</code>). Nenhuma execução é simulada.</p>
        ${rows.length ? table(['ID', 'Tipo', 'Estado', 'Progresso', 'Criada', 'Concluída', 'Mensagem'], rows, 'Tarefas da sessão', { srCaption: true }) : emptyState('Nenhuma tarefa nesta sessão', 'Tarefas aparecerão aqui quando criadas por integrações ou componentes do núcleo. Em uso apenas visual/demo, é normal que a lista esteja vazia.', sectionNavButton('integration', 'Ver integração e contrato'))}
      </section>
      <section class="card" aria-labelledby="jobs-help-title">
        <h2 id="jobs-help-title">Como criar/acompanhar tarefas</h2>
        <ul class="prose">
          <li>Use a API do núcleo exposta em <code>window.FGUA.jobs</code> (quando disponível) em ambientes compatíveis.</li>
          <li>Para execução real, configure engine/provedor/backend apropriados; sem eles, tarefas podem terminar como indisponíveis por design.</li>
          <li>Consulte o payload de integração e a documentação para contratos, requisitos e limites.</li>
        </ul>
      </section>
    </div>`;
}

function renderIntegration() {
  const el = qs('#tab-integration');
  if (!el) return;
  const s = getStatus() || {};
  const contract = app?.api?.getContract ? app.api.getContract() : (staticData.configs?.api ? { base: staticData.configs.api.base || '/api/v1', namespaces: staticData.configs.api.namespaces || [] } : { base: '/api/v1', namespaces: [] });
  const namespaces = Array.isArray(contract.namespaces) ? contract.namespaces : [];
  const site = getSite();
  const payload = app?.getIntegrationPayload ? app.getIntegrationPayload(site) : { project: 'Frame-Generator-API', generatedAt: new Date().toISOString(), site, contract, status: s, capabilities: s.capabilities || {}, models: [], engines: [], providers: [], generators: [], notes: ['Payload gerado sem núcleo completo.'] };

  const backendUrl = app?.api?.baseUrl || '';
  const mode = app?.api?.mode || 'demo';

  const commandsText = `# Servir localmente (site estático)\n`+
`npx serve .\n`+
`# Abrir: http://localhost:3000/  ou  http://localhost:3000/Public/dashboard.html\n\n`+
`# Verificação do repositório\n`+
`npm run lint:syntax\n`+
`npm run check:json\n`+
`npm test\n`+
`npm run ci\n\n`+
`# Arquivos úteis\n`+
`# Configs: configs/api.json, settings.json, models.json, generators.json, repacks.json, permissions.json\n`+
`# Docs:   Public/documentation/index.html, commands.html, master-prompt.md\n`+
`# Contrato lógico: ${contract.base || '/api/v1'} (requere backend/provedor compatível para execução remota)\n`;

  const escapeJsSingle = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  const jsExample = `// Exemplo: consumir informações públicas e respeitar estados reais\nconst siteBase = '${escapeJsSingle(site)}';\n\nasync function getPublicJson(path) {\n  const res = await fetch(new URL(path, siteBase));\n  if (!res.ok) throw new Error('Falha ao carregar ' + path + ': ' + res.status);\n  return res.json();\n}\n\n// Config/contrato publicados estaticamente\nconst apiConfig = await getPublicJson('configs/api.json');\n\n// Para operações remotas, configure um backend compatível (não incluído no GitHub Pages)\nconst BACKEND_BASE_URL = '${escapeJsSingle(backendUrl)}'; // vazio => sem backend configurado\n\nasync function callBackend(contractPath, init = {}) {\n  if (!BACKEND_BASE_URL) {\n    return { ok: false, state: 'unavailable', error: { code: 'BACKEND_UNAVAILABLE', message: 'Backend não configurado.' } };\n  }\n  const url = new URL(contractPath, BACKEND_BASE_URL.endsWith('/') ? BACKEND_BASE_URL : BACKEND_BASE_URL + '/');\n  const res = await fetch(url, { headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) }, ...init });\n  const data = await res.json().catch(() => null);\n  return data ?? { ok: res.ok, state: res.ok ? 'ok' : 'error' };\n}\n`;

  el.innerHTML = `
    <div class="stack">
      <section class="card" aria-labelledby="int-contract-title">
        <h2 id="int-contract-title">Contrato lógico e estado de integração</h2>
        <div class="grid">
          <div>
            <div class="kv">
              <div>Contrato base</div><div><code>${esc(contract.base || '/api/v1')}</code></div>
              <div>Modo atual (sessão)</div><div>${statePill(mode)}</div>
              <div>URL de backend</div><div>${backendUrl ? `<code>${esc(backendUrl)}</code>` : '<span class="muted">Não configurada</span>'}</div>
              <div>Backend reportado</div><div>${statePill(s?.backend?.state || (backendUrl ? 'configurado' : 'unconfigured'))}</div>
            </div>
            <p class="section-note">Em GitHub Pages, <code>/api/v1/*</code> é um contrato lógico. Chamadas reais exigem backend compatível acessível pela rede/CORS conforme seu ambiente.</p>
          </div>
          <div>
            <h3 style="font-size:0.9375rem;margin:0 0 8px">Namespaces declarados</h3>
            ${namespaces.length ? `<div>${pills(namespaces)}</div>` : emptyState('Sem namespaces declarados', 'Verifique configs/api.json.')}
          </div>
        </div>
      </section>

      <section class="card" aria-labelledby="int-config-title">
        <h2 id="int-config-title">Configurar backend (apenas nesta sessão)</h2>
        <p class="muted">Defina a URL base de um backend compatível para testes/integração. A configuração não é persistida entre recarregamentos e não valida conectividade automaticamente.</p>
        <form id="api-config-form" class="form-row" novalidate>
          <div class="field" style="flex:2 1 320px">
            <label for="api-base-url">URL base do backend</label>
            <input id="api-base-url" name="api-base-url" type="url" inputmode="url" placeholder="https://seu-backend.exemplo" value="${escAttr(backendUrl)}" autocomplete="off" />
            <div class="help-text" id="api-base-help">Use a origem/base esperada pelo seu backend compatível. Deixe vazio para permanecer sem backend.</div>
          </div>
          <div class="field" style="flex:1 1 180px">
            <label for="api-mode">Modo</label>
            <select id="api-mode" name="api-mode">
              <option value="demo" ${mode === 'demo' ? 'selected' : ''}>demo (sem backend)</option>
              <option value="local" ${mode === 'local' ? 'selected' : ''}>local</option>
              <option value="remote" ${mode === 'remote' ? 'selected' : ''}>remote</option>
            </select>
            <div class="help-text">Afeta como o núcleo resolve o backend para operações remotas.</div>
          </div>
          <div class="field" style="flex:0 0 auto;min-width:auto">
            <button class="btn primary" id="api-save" type="submit">Aplicar na sessão</button>
          </div>
        </form>
        <div id="api-status" class="notice info mt" role="status" aria-live="polite">Nenhuma alteração aplicada nesta sessão ainda.</div>
      </section>

      <section class="card" aria-labelledby="ws-title">
        <h2 id="ws-title">WebSocket (utilitário cliente, opcional)</h2>
        <p class="muted">Conecte-se a um endpoint WebSocket compatível quando disponível. O código/token é opcional: você pode conectar sem código ou informar um código para autenticação (enviado como parâmetro de consulta <code>code</code> e, ao abrir, como mensagem <code>{type:"auth",code}</code>, conforme suporte do servidor). Não armazene segredos em arquivos públicos.</p>
        <div class="notice info" role="note"><p style="margin:0"><strong>Hospedagem estática:</strong> o GitHub Pages não fornece servidor WebSocket. Esta seção é um cliente utilitário para backends/serviços externos compatíveis.</p></div>
        <form id="ws-form" class="stack mt" novalidate>
          <div class="form-row">
            <div class="field" style="flex:2 1 320px">
              <label for="ws-url">URL WebSocket</label>
              <input id="ws-url" name="ws-url" type="url" inputmode="url" placeholder="wss://seu-servidor.exemplo/socket" autocomplete="off" />
              <div class="help-text">Use <code>ws://</code> ou <code>wss://</code>. Deixe vazio se não for utilizar.</div>
            </div>
            <div class="field" style="flex:1 1 220px">
              <label for="ws-code">Código/token (opcional)</label>
              <input id="ws-code" name="ws-code" type="text" placeholder="Opcional" autocomplete="off" />
              <div class="help-text">Pode ser deixado em branco. Evite tokens sensíveis em ambientes compartilhados.</div>
            </div>
          </div>
          <div class="actions">
            <button class="btn primary" id="ws-connect" type="submit">Conectar</button>
            <button class="btn" id="ws-disconnect" type="button">Desconectar</button>
            <span id="ws-state" class="badge info">desconectado</span>
          </div>
        </form>
        <div class="form-row mt" style="align-items:flex-end">
          <div class="field" style="flex:1 1 320px">
            <label for="ws-message">Mensagem</label>
            <input id="ws-message" name="ws-message" type="text" placeholder='{"type":"ping"} ou texto' autocomplete="off" />
          </div>
          <div class="field" style="flex:0 0 auto;min-width:auto">
            <button class="btn" id="ws-send" type="button">Enviar</button>
          </div>
        </div>
        <details class="disclosure mt" open>
          <summary>Log e mensagens</summary>
          <div class="details-body"><pre id="ws-log" class="wrap" aria-live="polite">Sem eventos WebSocket.</pre></div>
        </details>
      </section>

      <section class="card" aria-labelledby="int-payload-title">
        <h2 id="int-payload-title">Payload de integração</h2>
        <p class="muted">Resumo exportável do estado atual, capacidades, recursos registrados e referências de configs/docs. Útil para agentes, pipelines e ferramentas externas.</p>
        <div class="actions">
          <button class="btn primary" id="dl-payload" type="button">Baixar payload (JSON)</button>
          <button class="btn" id="copy-payload" type="button" data-copy-target="payload-pre" data-copy-label="Copiar payload JSON">Copiar payload</button>
        </div>
        <details class="disclosure mt" open>
          <summary>Prévia do payload (JSON)</summary>
          <div class="details-body">${codeBlock('payload-pre', JSON.stringify(payload, null, 2), 'Copiar payload JSON')}</div>
        </details>
      </section>

      <div class="grid-2">
        <section class="card" aria-labelledby="int-cmd-title">
          <h2 id="int-cmd-title">Comandos e verificação</h2>
          ${codeBlock('code-cmd', commandsText, 'Copiar comandos')}
          <p class="section-note mt">Integrações integradas ao navegador (sem pasta externa): demo React em <code>Public/react-vite.html</code>; estúdio/simulador/gerador Discord e templates embutidos na aba <strong>Discord Bot</strong>.</p>
          <div class="actions mt"><a class="btn" href="./react-vite.html" target="_blank" rel="noopener noreferrer">Abrir demo React (navegador)</a>${sectionNavButton('discord', 'Abrir Discord Bot')}</div>
        </section>
        <section class="card" aria-labelledby="int-example-title">
          <h2 id="int-example-title">Exemplo de integração (JavaScript)</h2>
          ${codeBlock('code-js', jsExample, 'Copiar exemplo JS')}
          <p class="section-note">O exemplo trata ausência de backend como estado indisponível. Adapte autenticação, CORS e tratamento de erros ao seu backend real.</p>
        </section>
      </div>
    </div>`;
}

function renderDiscord() {
  const el = qs('#tab-discord');
  if (!el) return;
  const opts = getDiscordOptions();
  const defaults = {
    name: 'Meu Bot Discord',
    packageName: 'meu-bot-discord',
    clientId: 'COLOQUE_SEU_CLIENT_ID',
    intents: opts.defaultIntents.slice(),
    events: ['ready', 'interactionCreate', 'messageCreate'],
    prefix: '!',
    useSlash: true,
    usePrefix: true,
    commands: [{ name: 'ping', description: 'Responde com Pong!', response: 'Pong!' }],
    description: 'Bot Discord gerado pelo configurador do Frame-Generator-API.',
    nodeVersion: '>=18'
  };
  const form = { ...defaults, ...(discordState.form || {}) };
  discordState.form = form;
  if (!discordState.generated) discordState.generated = generateDiscordFiles(form);
  if (!Array.isArray(discordState.simLog)) discordState.simLog = [];
  const gen = discordState.generated;
  const fileOptions = (gen.files || []).map((f, i) => '<option value="' + i + '">' + esc(f.path) + '</option>').join('');
  const selectedIndex = Math.min(Math.max(0, Number(discordState.selectedFile || 0)), Math.max(0, (gen.files || []).length - 1));
  discordState.selectedFile = selectedIndex;
  const selectedFile = (gen.files || [])[selectedIndex] || { path: '', content: '' };

  const intentChecks = opts.intents.map((it) => {
    const checked = (form.intents || []).includes(it) ? 'checked' : '';
    return '<label style="display:inline-flex;align-items:center;gap:6px;margin:4px 10px 4px 0;font-size:0.875rem"><input type="checkbox" name="discord-intent" value="' + escAttr(it) + '" ' + checked + ' /> <code>' + esc(it) + '</code></label>';
  }).join('');
  const eventChecks = opts.events.map((ev) => {
    const checked = (form.events || []).includes(ev) ? 'checked' : '';
    return '<label style="display:inline-flex;align-items:center;gap:6px;margin:4px 10px 4px 0;font-size:0.875rem"><input type="checkbox" name="discord-event" value="' + escAttr(ev) + '" ' + checked + ' /> <code>' + esc(ev) + '</code></label>';
  }).join('');

  const filesList = (gen.files || []).length ? '<ul>' + gen.files.map((f) => '<li><code>' + esc(f.path) + '</code></li>').join('') + '</ul>' : '<p class="muted">—</p>';
  const preview = (gen.files && gen.files.length) ? codeBlock('dc-file-preview', selectedFile.content || '', 'Copiar conteúdo') : emptyState('Nenhum arquivo gerado', 'Clique em "Gerar/atualizar templates".');

  el.innerHTML = ''
    + '<div class="stack">'
    + '  <section class="card" aria-labelledby="discord-intro-title">'
    + '    <h2 id="discord-intro-title">Sistema avançado de configuração de bots Discord</h2>'
    + '    <div class="notice info" role="note">'
    + '      <h3>Execução e limites</h3>'
    + '      <ul>'
    + '        <li>Este configurador gera <strong>templates e conteúdos discord.js (Node.js)</strong> para você executar em um ambiente Node externo. <strong>Não executa bots no navegador/GitHub Pages.</strong></li>'
    + '        <li>Não insira tokens reais em arquivos versionados. Use <code>.env</code>/segredos no ambiente de execução do bot.</li>'
    + '        <li>Intents privilegiados (ex.: <code>GuildMembers</code>, <code>MessageContent</code>, <code>GuildPresences</code>) exigem ativação no Developer Portal e podem exigir verificação.</li>'
    + '      </ul>'
    + '    </div>'
    + '    <p class="section-note mt">Conteúdos integrados diretamente no código do navegador: configuração, geração de arquivos, simulação de comandos/eventos e templates embutidos (preview/cópia/download). Para conexão real ao Discord, exporte os templates e execute em runtime Node.js externo com token seguro.</p>'
    + '  </section>'
    + '  <section class="card" aria-labelledby="discord-form-title">'
    + '    <h2 id="discord-form-title">Configuração do bot e conteúdos</h2>'
    + '    <form id="discord-form" class="stack" novalidate>'
    + '      <div class="grid-2">'
    + '        <div class="field"><label for="dc-name">Nome do bot/projeto</label><input id="dc-name" name="name" type="text" value="' + escAttr(form.name) + '" /></div>'
    + '        <div class="field"><label for="dc-pkg">Nome do pacote (npm)</label><input id="dc-pkg" name="packageName" type="text" value="' + escAttr(form.packageName) + '" /></div>'
    + '        <div class="field"><label for="dc-client">Client ID (placeholder/valor)</label><input id="dc-client" name="clientId" type="text" value="' + escAttr(form.clientId) + '" /></div>'
    + '        <div class="field"><label for="dc-node">Versão Node (engines)</label><input id="dc-node" name="nodeVersion" type="text" value="' + escAttr(form.nodeVersion) + '" /></div>'
    + '        <div class="field"><label for="dc-prefix">Prefixo (comandos por mensagem)</label><input id="dc-prefix" name="prefix" type="text" value="' + escAttr(form.prefix) + '" /></div>'
    + '        <div class="field"><label for="dc-desc">Descrição</label><input id="dc-desc" name="description" type="text" value="' + escAttr(form.description) + '" /></div>'
    + '      </div>'
    + '      <div class="form-row">'
    + '        <label style="display:inline-flex;align-items:center;gap:8px"><input type="checkbox" id="dc-slash" name="useSlash" ' + (form.useSlash ? 'checked' : '') + ' /> Habilitar slash commands (recomendado)</label>'
    + '        <label style="display:inline-flex;align-items:center;gap:8px"><input type="checkbox" id="dc-prefix-enabled" name="usePrefix" ' + (form.usePrefix ? 'checked' : '') + ' /> Habilitar comandos por prefixo</label>'
    + '      </div>'
    + '      <div><h3 style="font-size:0.9375rem;margin:8px 0">Intents</h3><div>' + intentChecks + '</div></div>'
    + '      <div><h3 style="font-size:0.9375rem;margin:8px 0">Eventos</h3><div>' + eventChecks + '</div></div>'
    + '      <div><h3 style="font-size:0.9375rem;margin:8px 0">Comando personalizado (slash) — adicional</h3>'
    + '        <div class="grid-2">'
    + '          <div class="field"><label for="dc-cmd-name">Nome</label><input id="dc-cmd-name" type="text" value="' + escAttr((form.commands && form.commands[0] && form.commands[0].name) || 'ping') + '" placeholder="ex.: status" /></div>'
    + '          <div class="field"><label for="dc-cmd-desc">Descrição</label><input id="dc-cmd-desc" type="text" value="' + escAttr((form.commands && form.commands[0] && form.commands[0].description) || 'Responde com Pong!') + '" placeholder="Descrição do comando" /></div>'
    + '          <div class="field" style="grid-column:1/-1"><label for="dc-cmd-resp">Resposta</label><input id="dc-cmd-resp" type="text" value="' + escAttr((form.commands && form.commands[0] && form.commands[0].response) || 'Pong!') + '" placeholder="Texto de resposta" /></div>'
    + '        </div>'
    + '      </div>'
    + '      <div class="actions">'
    + '        <button class="btn primary" id="dc-generate" type="submit">Gerar/atualizar templates</button>'
    + '        <button class="btn" id="dc-download-config" type="button">Baixar config (JSON)</button>'
    + '        <button class="btn" id="dc-download-file" type="button">Baixar arquivo selecionado</button>'
    + '        <button class="btn" id="dc-copy-file" type="button">Copiar arquivo selecionado</button>'
    + '      </div>'
    + '    </form>'
    + '  </section>'
    + '  <section class="card" aria-labelledby="discord-files-title">'
    + '    <h2 id="discord-files-title">Arquivos gerados (prévia)</h2>'
    + '    <p class="muted">Selecione um arquivo para visualizar, copiar ou baixar. Os arquivos são gerados no navegador a partir da configuração atual.</p>'
    + '    <div class="form-row"><div class="field" style="flex:1 1 320px"><label for="dc-file-select">Arquivo</label><select id="dc-file-select">' + fileOptions + '</select></div></div>'
    + '    <div class="mt">' + preview + '</div>'
    + '    <details class="disclosure mt"><summary>Lista de arquivos gerados</summary><div class="details-body">' + filesList + '</div></details>'
    + '  </section>'
    + '  <section class="card" aria-labelledby="discord-sim-title">'
    + '    <h2 id="discord-sim-title">Simulador de comandos e eventos (navegador)</h2>'
    + '    <p class="muted">Teste comandos configurados localmente no navegador (ex.: <code>/ping</code>, <code>' + esc(form.prefix || '!') + 'ping</code> ou mensagens). Isto simula respostas/eventos de UI; não conecta ao gateway do Discord.</p>'
    + '    <div class="form-row" style="align-items:flex-end">'
    + '      <div class="field" style="flex:1 1 320px"><label for="dc-sim-input">Entrada</label><input id="dc-sim-input" type="text" placeholder="/ping ou ' + escAttr(form.prefix || '!') + 'ping" /></div>'
    + '      <div class="field" style="flex:0 0 auto;min-width:auto"><button class="btn primary" id="dc-sim-run" type="button">Simular</button></div>'
    + '      <div class="field" style="flex:0 0 auto;min-width:auto"><button class="btn" id="dc-sim-clear" type="button">Limpar</button></div>'
    + '    </div>'
    + '    <pre id="dc-sim-log" class="wrap mt" aria-live="polite">' + esc((discordState.simLog || []).join('\n') || 'Sem simulações.') + '</pre>'
    + '  </section>'
    + '  <section class="card" aria-labelledby="discord-embedded-title">'
    + '    <h2 id="discord-embedded-title">Templates integrados (conteúdo embutido)</h2>'
    + '    <p class="muted">Fontes/templates embutidos diretamente no código do app para consulta, cópia e download (sem pasta externa). Inclui referência Node.js do bot e fontes React+Vite; a demo React executa no navegador.</p>'
    + '    <div class="actions mt"><a class="btn primary" href="./react-vite.html" target="_blank" rel="noopener noreferrer">Abrir demo React (navegador)</a></div>'
    + (() => {
        const all = [...getDiscordRuntimeTemplateFiles(), ...getReactViteTemplates()];
        const idx = Math.min(Math.max(0, Number(discordState.embeddedIndex || 0)), Math.max(0, all.length - 1));
        discordState.embeddedIndex = idx;
        const opts = all.map((f, i) => '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>' + esc(f.path) + '</option>').join('');
        const cur = all[idx] || { path: '', content: '' };
        return ''
          + '    <div class="form-row mt"><div class="field" style="flex:1 1 320px"><label for="dc-embed-select">Arquivo embutido</label><select id="dc-embed-select">' + opts + '</select></div></div>'
          + '    <div class="actions mt"><button class="btn" id="dc-embed-copy" type="button">Copiar embutido</button><button class="btn" id="dc-embed-download" type="button">Baixar embutido</button></div>'
          + '    <div class="mt">' + codeBlock('dc-embed-preview', cur.content || '', 'Copiar conteúdo') + '</div>';
      })()
    + '  </section>'
    + '</div>';
}

function renderConfig() {
  const el = qs('#tab-config');
  if (!el) return;
  const diagnostics = getStatus()?.config?.diagnostics || {};
  const configs = staticData.configs || {};
  const permissions = configs.permissions || null;
  const settings = configs.settings || null;
  const repacks = configs.repacks || null;

  const rows = CONFIG_FILES.map((c) => {
    const d = diagnostics[c.key] || {};
    const ok = d.ok !== false && configs[c.key];
    const url = new URL(`../../${c.name}`, import.meta.url).href;
    return [
      `<strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.desc)}</span>`,
      statePill(ok ? 'carregado' : 'falha/fallback'),
      `<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">Abrir JSON</a>`,
      d.error?.message ? `<span class="muted">${esc(d.error.message)}</span>` : '—',
    ];
  });

  const roleRows = permissions?.roles ? Object.entries(permissions.roles).map(([role, def]) => [
    `<strong>${esc(role)}</strong>`,
    pills(def?.allow || []),
  ]) : [];

  el.innerHTML = `
    <div class="stack">
      <section class="card" aria-labelledby="cfg-files-title">
        <h2 id="cfg-files-title">Arquivos de configuração públicos</h2>
        <p class="muted">Arquivos JSON servidos estaticamente. São carregados pelo núcleo (quando possível) e podem ser consumidos por integrações. Não armazene segredos em arquivos públicos.</p>
        ${table(['Arquivo / descrição', 'Estado no núcleo', 'Acesso', 'Observação'], rows, 'Configurações públicas', { srCaption: true })}
      </section>

      <div class="grid-2">
        <section class="card" aria-labelledby="cfg-perms-title">
          <h2 id="cfg-perms-title">Permissões (nível de UI)</h2>
          <p class="muted">${esc(permissions?.note || 'Em hospedagem estática, permissões/papéis são informativos para UI; autorização confiável requer backend.')}</p>
          ${roleRows.length ? table(['Papel', 'Permissões permitidas'], roleRows, 'Papéis e permissões', { srCaption: true }) : emptyState('Permissões não carregadas', 'Não foi possível carregar configs/permissions.json.')}
        </section>
        <section class="card" aria-labelledby="cfg-sys-title">
          <h2 id="cfg-sys-title">Sistema e provedores declarados</h2>
          <div class="kv">
            <div>Nome</div><div>${esc(settings?.system?.name || '—')}</div>
            <div>Versão (config)</div><div>${esc(settings?.system?.version || '—')}</div>
            <div>Hospedagem</div><div>${esc(settings?.system?.hosting || '—')}</div>
            <div>Site</div><div>${settings?.system?.site ? `<a href="${escAttr(settings.system.site)}" target="_blank" rel="noopener noreferrer">${esc(settings.system.site)}</a>` : '—'}</div>
          </div>
          <h3 class="mt" style="font-size:0.9375rem">Provedores em settings.json</h3>
          ${(settings?.providers || []).length ? `<ul>${settings.providers.map((p) => `<li><strong>${esc(p.name || p.id)}</strong> — tipo: ${esc(p.type || '—')}, estado declarado: ${statePill(p.state || '—')}${p.url ? `, URL: <code>${esc(p.url)}</code>` : ''}</li>`).join('')}</ul>` : emptyState('Nenhum provedor declarado', 'configs/settings.json não contém provedores declarados.')}
        </section>
      </div>

      <section class="card" aria-labelledby="cfg-repacks-title">
        <h2 id="cfg-repacks-title">Repacks declarados (config)</h2>
        ${(repacks?.repacks?.length || repacks?.manifests?.length) ? `<pre>${esc(JSON.stringify(repacks, null, 2))}</pre>` : emptyState('Nenhum repack declarado em configs/repacks.json', 'Para exemplos de manifesto, consulte a aba Documentação e recursos.', sectionNavButton('docs', 'Abrir documentação e recursos'))}
      </section>
    </div>`;
}

function renderDocs() {
  const el = qs('#tab-docs');
  if (!el) return;
  const sampleManifest = staticData.sampleManifest;
  const docs = [
    { title: 'Documentação (índice)', href: './documentation/index.html', desc: 'Visão geral, módulos, capacidades, limites e referências.' },
    { title: 'Comandos e operações', href: './documentation/commands.html', desc: 'Execução local, verificação, contrato e publicação.' },
    { title: 'Master prompt (Markdown)', href: masterPrompt.url || './documentation/master-prompt.md', desc: 'Prompt técnico para integração com IA/agentes/projetos.' },
    { title: 'README do repositório', href: '../README.md', desc: 'Resumo do projeto, estrutura, limites e verificação.' },
  ];

  const mpContent = masterPrompt.text ? codeBlock('master-prompt-pre', masterPrompt.text, 'Copiar master prompt', { wrap: true }) : emptyState('Master prompt não carregado', `Não foi possível carregar o master prompt automaticamente. ${masterPrompt.error ? 'Motivo: ' + masterPrompt.error : ''}`, `<a class="btn" href="./documentation/master-prompt.md" target="_blank" rel="noopener noreferrer">Abrir arquivo</a>`);

  el.innerHTML = `
    <div class="stack">
      <section class="card" aria-labelledby="docs-links-title">
        <h2 id="docs-links-title">Documentação e guias</h2>
        <div class="table-wrap"><table><caption class="sr-only">Documentos disponíveis</caption><thead><tr><th scope="col">Documento</th><th scope="col">Descrição</th><th scope="col">Acesso</th></tr></thead><tbody>
          ${docs.map((d) => `<tr><td><strong>${esc(d.title)}</strong></td><td class="muted">${esc(d.desc)}</td><td><a href="${escAttr(d.href)}" target="_blank" rel="noopener noreferrer">Abrir</a></td></tr>`).join('')}
        </tbody></table></div>
        <p class="section-note">Alguns arquivos são servidos como Markdown/JSON estático; a visualização depende do navegador/servidor. Use "Abrir" para acessar o conteúdo original.</p>
      </section>

      <section class="card" aria-labelledby="docs-master-title">
        <h2 id="docs-master-title">Master prompt (referência)</h2>
        <p class="muted">Conteúdo orientado a integração técnica. Revise e adapte antes de usar em agentes ou pipelines.</p>
        ${mpContent}
      </section>

      <div class="grid-2">
        <section class="card" aria-labelledby="docs-manifest-title">
          <h2 id="docs-manifest-title">Manifesto de repack (exemplo)</h2>
          ${sampleManifest ? `${codeBlock('sample-manifest-pre', JSON.stringify(sampleManifest, null, 2), 'Copiar manifesto de exemplo')}<p class="section-note">Exemplo em <code>Public/manifests/sample-repack.json</code>. Importação/ativação depende de fluxos e runtime compatíveis; o registro em <code>configs/repacks.json</code> pode estar vazio.</p>` : emptyState('Manifesto de exemplo indisponível', 'Não foi possível carregar Public/manifests/sample-repack.json.')}
        </section>
        <section class="card" aria-labelledby="docs-privacy-title">
          <h2 id="docs-privacy-title">Privacidade, segurança e limites</h2>
          <ul class="prose">
            <li><strong>Processamento local:</strong> análises realizadas pelo núcleo no navegador ocorrem no cliente, mas dependem dos arquivos/configurações fornecidos e das APIs do navegador.</li>
            <li><strong>Sem backend confiável embutido:</strong> autenticação/permissões no frontend são controles de UI; não trate como fronteira de segurança.</li>
            <li><strong>Sem segredos em público:</strong> não coloque tokens/chaves em configs, manifests ou URLs versionadas.</li>
            <li><strong>Sem simulação:</strong> inferência, quantização efetiva e pipelines pesados exigem runtime/provedor compatível e devem reportar estados reais.</li>
          </ul>
        </section>
      </div>
    </div>`;
}

function renderAll() {
  renderOverview();
  renderResources();
  renderModels();
  renderGenerators();
  renderJobs();
  renderIntegration();
  renderConfig();
  renderDiscord();
  renderDocs();
  wireInteractions();
  renderNotices();
  updateChrome();
}

function wireInteractions() {
  // Copy buttons (delegation)
  document.removeEventListener('click', handleCopyClick);
  document.addEventListener('click', handleCopyClick);
  document.removeEventListener('click', handleGotoClick);
  document.addEventListener('click', handleGotoClick);

  const dl = qs('#dl-payload');
  if (dl) {
    dl.onclick = () => {
      const payload = app?.getIntegrationPayload ? app.getIntegrationPayload(getSite()) : { error: 'Núcleo indisponível' };
      downloadJson('frame-generator-api-integration.json', payload);
    };
  }

  const form = qs('#api-config-form');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const baseInput = qs('#api-base-url');
      const modeSel = qs('#api-mode');
      const statusEl = qs('#api-status');
      const raw = (baseInput?.value || '').trim();
      const modeVal = modeSel?.value || 'demo';
      let baseUrl = null;
      if (raw) {
        try {
          const u = new URL(raw);
          baseUrl = u.toString().replace(/\/$/, '');
        } catch {
          if (statusEl) {
            statusEl.className = 'notice err mt';
            statusEl.textContent = 'URL inválida. Informe uma URL absoluta válida (ex.: https://seu-backend.exemplo) ou deixe em branco.';
          }
          baseInput?.focus();
          announce('URL de backend inválida.', 'assertive');
          return;
        }
      }
      try {
        const normalizedBaseUrl = baseUrl ? String(baseUrl).replace(/\/+$/, '') : null;
        if (app?.api?.configure) {
          app.api.configure({
            baseUrl: normalizedBaseUrl,
            mode: modeVal,
            backend: { remoteUrl: normalizedBaseUrl, localUrl: normalizedBaseUrl, connected: false },
          });
        }
        if (app?.backend?.configure) {
          app.backend.configure({ baseUrl: normalizedBaseUrl, type: modeVal === 'local' ? 'local' : 'remote' });
        }
      } catch (err) {
        if (statusEl) {
          statusEl.className = 'notice err mt';
          statusEl.textContent = `Falha ao aplicar configuração: ${err?.message || err}`;
        }
        return;
      }
      if (statusEl) {
        statusEl.className = 'notice ok mt';
        statusEl.textContent = baseUrl
          ? `Configuração aplicada nesta sessão: modo ${modeVal}, URL ${baseUrl}. Conectividade real não verificada.`
          : `Configuração aplicada nesta sessão: modo ${modeVal}, sem URL de backend.`;
      }
      announce('Configuração de backend aplicada na sessão.');
      updateChrome();
      // Re-render only integration payload preview and notices
      const pre = qs('#payload-pre');
      if (pre && app?.getIntegrationPayload) pre.textContent = JSON.stringify(app.getIntegrationPayload(getSite()), null, 2);
      renderNotices();
    };
  }

  // Usage chart actions
  const usageRefresh = qs('#usage-refresh');
  if (usageRefresh) usageRefresh.onclick = () => { recordFeatureUse('usage-refresh', { label: 'Atualizar gráfico de uso', category: 'ação' }); renderOverview(); wireInteractions(); announce('Gráfico de uso atualizado.'); };
  const usageClear = qs('#usage-clear');
  if (usageClear) usageClear.onclick = () => {
    try { localStorage.removeItem('fgua:usage:v1'); } catch {}
    recordFeatureUse('usage-clear', { label: 'Limpar rastreamento', category: 'ação' });
    renderOverview(); wireInteractions();
    announce('Rastreamento local de uso limpo.');
  };

  // WebSocket utilities
  if (!wsClient) wsClient = new WebSocketClient();
  const renderWsState = () => {
    if (!wsClient) return;
    const wsStateEl = qs('#ws-state');
    if (!wsStateEl) return;
    const st = wsClient.getStatus();
    wsStateEl.textContent = st.state;
    wsStateEl.className = 'badge ' + (st.state === 'open' ? 'ok' : st.state === 'error' ? 'err' : st.state === 'connecting' ? 'warn' : 'info');
  };
  const appendWsLog = (line) => {
    const wsLogEl = qs('#ws-log');
    if (!wsLogEl) return;
    const prev = wsLogEl.textContent === 'Sem eventos WebSocket.' ? '' : wsLogEl.textContent + '\n';
    wsLogEl.textContent = (prev + line).split('\n').slice(-120).join('\n');
  };
  if (!wsClient._uiBound) {
    wsClient.on('state', () => renderWsState());
    wsClient.on('log', (item) => appendWsLog('[' + item.at + '] ' + (item.level || 'info').toUpperCase() + ' ' + (item.message || '')));
    wsClient.on('message', (msg) => appendWsLog('[mensagem] ' + (typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.parsed ?? msg.raw))));
    wsClient._uiBound = true;
  }
  const wsForm = qs('#ws-form');
  const wsDisconnect = qs('#ws-disconnect');
  const wsSend = qs('#ws-send');
  if (wsForm) wsForm.onsubmit = (e) => {
    e.preventDefault();
    const url = (qs('#ws-url')?.value || '').trim();
    const code = (qs('#ws-code')?.value || '').trim();
    wsClient.configure({ url: url || null, code: code || '' });
    const res = wsClient.connect();
    recordFeatureUse('ws-connect', { label: 'WebSocket: conectar', category: 'integração' });
    if (!res.ok) appendWsLog('[erro] ' + (res.error?.message || 'Falha ao conectar'));
    renderWsState();
  };
  if (wsDisconnect) wsDisconnect.onclick = () => {
    wsClient.disconnect(true);
    recordFeatureUse('ws-disconnect', { label: 'WebSocket: desconectar', category: 'integração' });
    appendWsLog('[info] Desconexão solicitada.');
    renderWsState();
  };
  if (wsSend) wsSend.onclick = () => {
    const raw = (qs('#ws-message')?.value || '').trim();
    if (!raw) return;
    let payload = raw;
    try { payload = JSON.parse(raw); } catch {}
    const res = wsClient.send(payload);
    recordFeatureUse('ws-send', { label: 'WebSocket: enviar', category: 'integração' });
    if (!res || !res.ok) appendWsLog('[erro] ' + (res?.error?.message || 'Falha ao enviar'));
  };
  renderWsState();

  // Discord configurator
  const dcForm = qs('#discord-form');
  if (dcForm) dcForm.onsubmit = (e) => {
    e.preventDefault();
    const intents = qsa('input[name="discord-intent"]:checked', dcForm).map((i) => i.value);
    const events = qsa('input[name="discord-event"]:checked', dcForm).map((i) => i.value);
    const form = {
      name: (qs('#dc-name')?.value || '').trim(),
      packageName: (qs('#dc-pkg')?.value || '').trim(),
      clientId: (qs('#dc-client')?.value || '').trim(),
      nodeVersion: (qs('#dc-node')?.value || '').trim(),
      prefix: (qs('#dc-prefix')?.value || '!').trim(),
      description: (qs('#dc-desc')?.value || '').trim(),
      useSlash: !!qs('#dc-slash')?.checked,
      usePrefix: !!qs('#dc-prefix-enabled')?.checked,
      intents,
      events,
      commands: [{
        name: (qs('#dc-cmd-name')?.value || 'ping').trim(),
        description: (qs('#dc-cmd-desc')?.value || 'Responde com Pong!').trim(),
        response: (qs('#dc-cmd-resp')?.value || 'Pong!').trim(),
      }],
    };
    discordState.form = form;
    discordState.generated = generateDiscordFiles(form);
    discordState.selectedFile = 0;
    recordFeatureUse('discord-generate', { label: 'Discord: gerar templates', category: 'discord' });
    renderDiscord();
    wireInteractions();
    announce('Templates do bot Discord gerados/atualizados.');
  };
  const dcSelect = qs('#dc-file-select');
  if (dcSelect) dcSelect.onchange = () => {
    discordState.selectedFile = Number(dcSelect.value || 0);
    recordFeatureUse('discord-select-file', { label: 'Discord: selecionar arquivo', category: 'discord' });
    renderDiscord();
    wireInteractions();
  };
  const dcDownloadConfig = qs('#dc-download-config');
  if (dcDownloadConfig) dcDownloadConfig.onclick = () => {
    recordFeatureUse('discord-download-config', { label: 'Discord: baixar config', category: 'discord' });
    downloadJson('discord-bot-config.json', discordState.generated?.config || discordState.form || {});
  };
  const dcDownloadFile = qs('#dc-download-file');
  if (dcDownloadFile) dcDownloadFile.onclick = () => {
    const f = (discordState.generated?.files || [])[Number(discordState.selectedFile || 0)];
    if (!f) return;
    try {
      const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (f.path.split('/').pop() || 'arquivo.txt');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      recordFeatureUse('discord-download-file', { label: 'Discord: baixar arquivo', category: 'discord' });
      announce('Arquivo preparado para download.');
    } catch (e) { announce('Falha ao baixar arquivo.', 'assertive'); }
  };
  const dcCopyFile = qs('#dc-copy-file');
  if (dcCopyFile) dcCopyFile.onclick = async () => {
    const f = (discordState.generated?.files || [])[Number(discordState.selectedFile || 0)];
    if (!f) return;
    await copyText(f.content);
    recordFeatureUse('discord-copy-file', { label: 'Discord: copiar arquivo', category: 'discord' });
  };

  const dcSimRun = qs('#dc-sim-run');
  if (dcSimRun) dcSimRun.onclick = () => {
    const input = (qs('#dc-sim-input')?.value || '').trim();
    const cfg = discordState.form || discordState.generated?.config || {};
    const res = simulateDiscordInteraction(cfg, input);
    const lines = (res.events || []).map((ev) => `[${ev.at}] ${(ev.type || 'info').toUpperCase()} ${ev.message || ''}`);
    if (res.output && res.output.response != null) lines.push(`[resposta] ${res.output.response}`);
    discordState.simLog = [...(discordState.simLog || []), `> ${input || '(vazio)'}`, ...lines, ''].slice(-200);
    recordFeatureUse('discord-simulate', { label: 'Discord: simular comando', category: 'discord' });
    renderDiscord();
    wireInteractions();
  };
  const dcSimClear = qs('#dc-sim-clear');
  if (dcSimClear) dcSimClear.onclick = () => {
    discordState.simLog = [];
    recordFeatureUse('discord-sim-clear', { label: 'Discord: limpar simulador', category: 'discord' });
    renderDiscord();
    wireInteractions();
  };

  const dcEmbedSelect = qs('#dc-embed-select');
  if (dcEmbedSelect) dcEmbedSelect.onchange = () => {
    discordState.embeddedIndex = Number(dcEmbedSelect.value || 0);
    renderDiscord();
    wireInteractions();
  };
  const getEmbeddedAll = () => [...getDiscordRuntimeTemplateFiles(), ...getReactViteTemplates()];
  const dcEmbedCopy = qs('#dc-embed-copy');
  if (dcEmbedCopy) dcEmbedCopy.onclick = async () => {
    const f = getEmbeddedAll()[Number(discordState.embeddedIndex || 0)];
    if (!f) return;
    await copyText(f.content);
    recordFeatureUse('discord-embed-copy', { label: 'Copiar template embutido', category: 'integração' });
  };
  const dcEmbedDownload = qs('#dc-embed-download');
  if (dcEmbedDownload) dcEmbedDownload.onclick = () => {
    const f = getEmbeddedAll()[Number(discordState.embeddedIndex || 0)];
    if (!f) return;
    try {
      const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (f.path.split('/').pop() || 'template.txt');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      recordFeatureUse('discord-embed-download', { label: 'Baixar template embutido', category: 'integração' });
      announce('Arquivo preparado para download.');
    } catch (e) { announce('Falha ao baixar arquivo.', 'assertive'); }
  };

}

function handleCopyClick(e) {
  const btn = e.target.closest('[data-copy-target]');
  if (!btn) return;
  const id = btn.getAttribute('data-copy-target');
  const el = id ? document.getElementById(id) : null;
  const label = btn.getAttribute('data-copy-label') || 'Copiar';
  if (!el) return;
  copyText(el.textContent || '').then((res) => {
    const original = btn.textContent;
    btn.textContent = res.ok ? 'Copiado' : 'Falha ao copiar';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = label || original; btn.disabled = false; }, 1800);
  });
}

function handleGotoClick(e) {
  const btn = e.target.closest('[data-goto-tab]');
  if (!btn) return;
  const tab = btn.getAttribute('data-goto-tab');
  if (tab) {
    setActiveTab(tab, { focus: true });
    recordFeatureUse('tab:' + tab, { label: `Aba: ${tab}`, category: 'navegação' });
    qs('#main-content')?.focus({ preventScroll: false });
  }
}

function syncTabsOrientation() {
  const list = qs('#tabs');
  if (!list) return;
  const vertical = window.matchMedia('(min-width: 901px)').matches;
  list.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
}

function setupTabs() {
  const tabsContainer = qs('#tabs');
  if (!tabsContainer) return;
  const getTabs = () => qsa('[role="tab"][data-tab]', tabsContainer);
  syncTabsOrientation();
  window.addEventListener('resize', syncTabsOrientation, { passive: true });

  tabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('[role="tab"][data-tab]');
    if (!btn) return;
    setActiveTab(btn.dataset.tab, { focus: false });
    recordFeatureUse('tab:' + btn.dataset.tab, { label: `Aba: ${btn.dataset.tab}`, category: 'navegação' });
  });

  tabsContainer.addEventListener('keydown', (e) => {
    const tabs = getTabs();
    const current = e.target.closest('[role="tab"][data-tab]');
    if (!current) return;
    const idx = tabs.indexOf(current);
    if (idx < 0) return;
    let nextIdx = idx;
    const key = e.key;
    const isVertical = tabsContainer.getAttribute('aria-orientation') === 'vertical';
    if (key === 'ArrowRight' || (isVertical && key === 'ArrowDown')) nextIdx = (idx + 1) % tabs.length;
    else if (key === 'ArrowLeft' || (isVertical && key === 'ArrowUp')) nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (key === 'Home') nextIdx = 0;
    else if (key === 'End') nextIdx = tabs.length - 1;
    else if (key === 'Enter' || key === ' ') { e.preventDefault(); setActiveTab(current.dataset.tab, { focus: false }); return; }
    else return;
    e.preventDefault();
    const next = tabs[nextIdx];
    if (next) setActiveTab(next.dataset.tab, { focus: true });
  });
}

function applyInitialTabFromHash() {
  const hash = (location.hash || '').replace('#', '').trim();
  const valid = ['overview', 'resources', 'models', 'generators', 'jobs', 'integration', 'discord', 'config', 'docs'];
  const tab = valid.includes(hash) ? hash : 'overview';
  setActiveTab(tab);
  recordFeatureUse('tab:' + tab, { label: `Aba: ${tab}`, category: 'navegação' });
}

async function main() {
  setupTabs();
  applyInitialTabFromHash();
  qs('#tab-overview').innerHTML = loadingCard('Inicializando dashboard');

  await initI18n(document.documentElement.lang || 'pt-BR');

  try {
    app = await bootCore();
  } catch (e) {
    app = { error: e };
  }

  await loadAllStatic();

  if (!app || app.error) {
    setGlobalStatus('err', 'erro');
    updateChrome();
    renderAll();
    renderError(qs('#tab-overview'), app?.error || new Error('Falha ao inicializar o núcleo.'));
    announce('Falha ao inicializar o núcleo do dashboard.', 'assertive');
    return;
  }

  try { if (typeof window !== 'undefined') window.FGUA = app; } catch {}
  try {
    if (app?.tools && typeof app.tools.execute === 'function' && !app.tools._usageWrapped) {
      const _exec = app.tools.execute.bind(app.tools);
      app.tools.execute = async (id, input = {}, ctx = {}) => {
        const res = await _exec(id, input, ctx);
        try { recordToolUse(id, { label: String(id), category: 'tool', source: 'ToolRegistry' }); } catch {}
        return res;
      };
      app.tools._usageWrapped = true;
    }
  } catch {}
  renderAll();
  announce('Dashboard carregado.');
}

main().catch((e) => {
  console.error(e);
  setGlobalStatus('err', 'erro');
  renderError(qs('#tab-overview'), e);
});
