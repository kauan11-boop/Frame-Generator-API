const BASE = localStorage.getItem('fgua.bridgeUrl') || 'http://127.0.0.1:4174';
const TITLES = {
  overview: ['Visão geral', 'Estado do MCP, do REA e do provedor local de modelo.'],
  reverse: ['Engenharia reversa', 'Aponte um arquivo e um destino; o REA é orquestrado automaticamente.'],
  repair: ['Reparo & transpilação', 'Loop LLM local com testes reais como sinal de recompensa.'],
  jobs: ['Jobs', 'Histórico das execuções de RE, reparo e transpilação.'],
  rea: ['Ferramentas REA', 'Descubra e chame diretamente as ferramentas do MCP REA.'],
  admin: ['Admin & integrações', 'Informações, prompts, ferramentas locais, presets e configuração.'],
};
const FGUA_TOOLS = [
  ['fgua_status', 'Estado de REA, LM Studio e armazenamento'],
  ['fgua_presets', 'CRUD de presets de RE, reparo e transpilação'],
  ['fgua_prompts', 'CRUD e renderização de prompts locais'],
  ['fgua_settings', 'Leitura e atualização de configurações'],
  ['fgua_rea_catalog', 'Descoberta de ferramentas do REA com schemas'],
  ['fgua_rea_call', 'Chamada validada de qualquer ferramenta do REA'],
  ['fgua_reverse_file', 'Pipeline de engenharia reversa com relatório'],
  ['fgua_run_tests', 'Execução limitada com reward binário'],
  ['fgua_repair_code', 'Correção iterativa com LLM + testes'],
  ['fgua_transpile_code', 'Adaptação entre linguagens com testes'],
  ['fgua_jobs', 'Histórico e exportação de jobs'],
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let toastTimer = null;
let offlineNotified = false;

function toast(message, error = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

function setBridgeState(online) {
  const state = $('#bridgeState');
  state.querySelector('.dot').classList.toggle('on', online);
  state.querySelector('span').textContent = online ? 'bridge conectado' : 'bridge desconectado';
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });
  } catch (error) {
    setBridgeState(false);
    if (!offlineNotified) {
      toast(`Bridge local indisponível em ${BASE}. Rode "npm run bridge".`, true);
      offlineNotified = true;
    }
    throw new Error(`bridge offline: ${error.message}`);
  }
  setBridgeState(true);
  offlineNotified = false;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function formObject(form) {
  const out = {};
  for (const [key, value] of new FormData(form).entries()) out[key] = String(value).trim();
  return out;
}

function show(selector, value) {
  const el = $(selector);
  if (el) el.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function fillTable(tbody, rows, columns) {
  tbody.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = columns.length;
    td.className = 'muted';
    td.textContent = 'Nenhum registro.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const column of columns) {
      const td = document.createElement('td');
      if (column.action) {
        const btn = document.createElement('button');
        btn.className = 'btn danger';
        btn.textContent = column.label;
        btn.addEventListener('click', column.action(row));
        td.appendChild(btn);
      } else {
        const value = column.get(row);
        td.textContent = value === undefined || value === null || value === '' ? '—' : String(value);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

function setView(name) {
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $$('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  const [title, subtitle] = TITLES[name];
  $('#viewTitle').textContent = title;
  $('#viewSubtitle').textContent = subtitle;
  if (name === 'jobs') refreshJobs();
  if (name === 'rea') refreshRea('');
  if (name === 'admin') { refreshPresets(); refreshPrompts(); refreshStatus(); }
}

function setPill(selector, label, state) {
  const el = $(selector);
  el.textContent = `${label}: ${state}`;
  el.classList.toggle('on', state === 'ok' || state === 'on');
  el.classList.toggle('off', state !== 'ok' && state !== 'on');
}

async function refreshStatus() {
  try {
    const data = await api('/api/status');
    setPill('#reaPill', 'REA', data.rea?.available ? 'ok' : 'off');
    setPill('#llmPill', 'LM Studio', data.llm?.available ? 'ok' : 'off');
    show('#statVersion', data.version || '—');
    $('#statNode').textContent = `Node ${data.node} · ${data.platform}`;
    show('#statRea', data.rea?.available ? 'online' : 'offline');
    $('#statReaTools').textContent = data.rea?.available ? `${data.rea.toolCount} ferramentas` : (data.rea?.error || '');
    show('#statLlm', data.llm?.available ? 'online' : 'offline');
    $('#statModels').textContent = data.llm?.available
      ? (data.llm.models?.join(', ') || 'nenhum modelo carregado')
      : (data.llm?.error || '');
    const counters = $('#storeCounters');
    counters.replaceChildren();
    for (const [label, count] of Object.entries(data.store || {})) {
      const card = document.createElement('article');
      card.className = 'card';
      const small = document.createElement('small');
      small.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = String(count);
      card.append(small, strong);
      counters.appendChild(card);
    }
    fillTable($('#toolsRegistry'), [
      ['MCP REA (stdio)', (data.rea?.command || []).join(' ') || 'origem desconhecida', data.rea?.available ? 'online' : 'offline'],
      ['Bridge FGUA (HTTP)', `${BASE} · 127.0.0.1`, 'online'],
      ...FGUA_TOOLS.map(([name, description]) => [name, description, 'registrado']),
    ].map(([name, command, state]) => ({ name, command, state })), [
      { get: (r) => r.name }, { get: (r) => r.command }, { get: (r) => r.state },
    ]);
    fillTable($('#localToolsTable'), FGUA_TOOLS.map(([name, description]) => ({ name, description })), [
      { get: (r) => r.name }, { get: (r) => r.description },
    ]);
    for (const select of [$('#reversePresets'), $('#repairPresets')]) {
      select.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = select.id === 'reversePresets' ? 'automático' : 'padrão';
      select.appendChild(placeholder);
    }
    const { presets } = await api('/api/presets');
    for (const preset of presets) {
      for (const select of [$('#reversePresets'), $('#repairPresets')]) {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = `${preset.id} · ${preset.kind}`;
        select.appendChild(option);
      }
    }
    const settings = await api('/api/settings');
    for (const field of ['lmStudioUrl', 'model', 'temperature', 'maxIterations']) {
      const input = $(`#settingsForm [name="${field}"]`);
      if (input && settings.settings?.[field] !== undefined) input.value = settings.settings[field];
    }
  } catch (error) {
    setPill('#reaPill', 'REA', 'off');
    setPill('#llmPill', 'LM Studio', 'off');
    console.warn('[FGUA] status:', error.message);
  }
}

async function refreshPresets() {
  try {
    const { presets } = await api('/api/presets');
    fillTable($('#presetsTable'), presets, [
      { get: (r) => r.id }, { get: (r) => r.kind }, { get: (r) => r.name },
      { label: 'remover', action: (r) => async () => {
        try { await api(`/api/presets/${encodeURIComponent(r.id)}`, { method: 'DELETE' }); toast('Preset removido.'); refreshPresets(); }
        catch (error) { toast(error.message, true); }
      } },
    ]);
  } catch (error) { toast(error.message, true); }
}

async function refreshPrompts() {
  try {
    const { prompts } = await api('/api/prompts');
    fillTable($('#promptsTable'), prompts, [
      { get: (r) => r.id }, { get: (r) => r.name },
      { label: 'remover', action: (r) => async () => {
        try { await api(`/api/prompts/${encodeURIComponent(r.id)}`, { method: 'DELETE' }); toast('Prompt removido.'); refreshPrompts(); }
        catch (error) { toast(error.message, true); }
      } },
    ]);
  } catch (error) { toast(error.message, true); }
}

async function refreshJobs() {
  try {
    const { jobs } = await api('/api/jobs');
    fillTable($('#jobsTable'), jobs, [
      { get: (r) => r.id }, { get: (r) => r.type }, { get: (r) => r.status }, { get: (r) => r.createdAt },
    ]);
    $$('#jobsTable tr').forEach((tr) => {
      const id = tr.firstElementChild?.textContent;
      if (!id || id === '—') return;
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', async () => {
        try { show('#jobDetail', await api(`/api/jobs/${encodeURIComponent(id)}`)); }
        catch (error) { toast(error.message, true); }
      });
    });
  } catch (error) { toast(error.message, true); }
}

async function refreshRea(query) {
  try {
    const data = await api(`/api/rea/catalog?query=${encodeURIComponent(query)}&limit=100`);
    $('#reaCount').textContent = `${data.matched}/${data.total}`;
    fillTable($('#reaTable'), data.tools, [
      { get: (r) => r.name }, { get: (r) => r.description },
    ]);
  } catch (error) { toast(error.message, true); }
}

function bindForms() {
  $('#reverseForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    if (values.steps) values.steps = values.steps.split(',').map((s) => s.trim()).filter(Boolean);
    else delete values.steps;
    for (const key of ['outputDir', 'preset']) if (!values[key]) delete values[key];
    $('#reverseStatus').textContent = 'executando…';
    try { show('#reverseResult', await api('/api/reverse', { method: 'POST', body: JSON.stringify(values) })); toast('RE concluído.'); }
    catch (error) { toast(error.message, true); show('#reverseResult', error.message); }
    finally { $('#reverseStatus').textContent = ''; }
  });

  $('#repairForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    const mode = document.querySelector('[data-tabs="mode"] .tab.active')?.dataset.tab || 'repair';
    values.maxIterations = Number(values.maxIterations || 4);
    for (const key of ['instruction', 'preset', 'model', 'outputPath']) if (!values[key]) delete values[key];
    if (mode === 'repair') delete values.targetLanguage;
    $('#repairStatus').textContent = 'executando…';
    try {
      const result = await api(`/api/${mode}`, { method: 'POST', body: JSON.stringify(values) });
      show('#repairResult', result);
      toast(`Loop finalizado: ${result.status}`);
    } catch (error) { toast(error.message, true); show('#repairResult', error.message); }
    finally { $('#repairStatus').textContent = ''; }
  });

  $('#reaSearchForm').addEventListener('submit', (event) => {
    event.preventDefault();
    refreshRea(formObject(event.target).query || '');
  });

  $('#reaCallForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    let args = {};
    try { args = JSON.parse(values.args || '{}'); } catch { toast('Argumentos JSON inválidos.', true); return; }
    $('#reaCallStatus').textContent = 'chamando…';
    try { show('#reaResult', await api('/api/rea/call', { method: 'POST', body: JSON.stringify({ tool: values.tool, args }) })); }
    catch (error) { toast(error.message, true); show('#reaResult', error.message); }
    finally { $('#reaCallStatus').textContent = ''; }
  });

  $('#promptForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    try {
      await api('/api/prompts', { method: 'POST', body: JSON.stringify({ prompt: { id: values.id, name: values.name, body: values.body, variables: [] } }) });
      toast('Prompt salvo.'); event.target.reset(); refreshPrompts();
    } catch (error) { toast(error.message, true); }
  });

  $('#renderForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    try {
      const variables = JSON.parse(values.variables || '{}');
      show('#renderResult', await api('/api/prompts/render', { method: 'POST', body: JSON.stringify({ id: values.id, variables }) }));
    } catch (error) { toast(error.message, true); }
  });

  $('#presetForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    let config = {};
    try { config = JSON.parse(values.config || '{}'); } catch { toast('Config JSON inválido.', true); return; }
    try {
      await api('/api/presets', { method: 'POST', body: JSON.stringify({ preset: {
        id: values.id, name: values.name, kind: values.kind, description: values.description,
        tags: values.tags.split(',').map((t) => t.trim()).filter(Boolean), config,
      } }) });
      toast('Preset salvo.'); event.target.reset(); refreshPresets(); refreshStatus();
    } catch (error) { toast(error.message, true); }
  });

  $('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    const patch = { lmStudioUrl: values.lmStudioUrl, model: values.model };
    if (values.temperature !== '') patch.temperature = Number(values.temperature);
    if (values.maxIterations !== '') patch.maxIterations = Number(values.maxIterations);
    try { await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ patch }) }); toast('Configuração salva.'); }
    catch (error) { toast(error.message, true); }
  });
}

$$('.nav-item').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$$('[data-tabs]').forEach((group) => {
  group.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    group.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    const name = group.dataset.tabs;
    if (name === 'admin') {
      $$('.subpanel').forEach((p) => p.classList.toggle('active', p.dataset.sub === tab.dataset.tab));
      if (tab.dataset.tab === 'presets') refreshPresets();
      if (tab.dataset.tab === 'prompts') refreshPrompts();
    }
    if (name === 'mode') {
      $('.target-lang').classList.toggle('hidden', tab.dataset.tab === 'repair');
    }
  }));
});
$('#sidebarToggle').addEventListener('click', () => $('#sidebar').classList.toggle('collapsed'));
$('#refreshBtn').addEventListener('click', refreshStatus);
$('#jobsRefresh').addEventListener('click', refreshJobs);
$('#presetsRefresh').addEventListener('click', refreshPresets);
$('#promptsRefresh').addEventListener('click', refreshPrompts);
bindForms();
refreshStatus();
