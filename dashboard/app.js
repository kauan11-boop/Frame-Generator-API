const VERSION = '4.1.0';
const DEFAULT_MCP_URL = 'https://kauan11-boop.github.io/Frame-Generator-API/';
const SNAPSHOT_URL = 'dashboard/data/snapshot.json';
const TITLES = {
  overview: ['Visão geral', 'Estado do painel, do conteúdo sincronizado e das integrações.'],
  tools: ['Ferramentas', 'Transformações e inspeções executadas inteiramente no navegador.'],
  playground: ['Playground', 'Execução de JavaScript em um sandbox isolado da página.'],
  reverse: ['Engenharia reversa', 'Aponte um arquivo e um destino; o REA é orquestrado automaticamente.'],
  repair: ['Reparo & transpilação', 'Loop LLM local com testes reais como sinal de recompensa.'],
  jobs: ['Jobs', 'Histórico das execuções de RE, reparo e transpilação.'],
  rea: ['Ferramentas REA', 'Busque e inspecione o catálogo de ferramentas do MCP REA.'],
  mcp: ['MCP por URL', 'Manifesto publicado no GitHub Pages com ferramentas e conteúdos utilizáveis.'],
  guide: ['Guia rápido', 'Arquitetura estática, fluxo recomendado e limites honestos.'],
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
let manifest = null;
let mcpSource = '';
let snapshot = null;
let activeTool = 'json';
let reaQuery = '';
let sandboxReady = false;
let sandboxTimer = null;

function toast(message, error = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

function manifestUrl(raw) {
  const value = (raw || '').trim();
  if (!value) return new URL('mcp.json', location.href).href;
  const base = /^https?:\/\//i.test(value) ? value : new URL(value, location.href).href;
  return new URL('mcp.json', `${base.replace(/\/+$/, '')}/`).href;
}

function setMcpState(loaded) {
  const state = $('#mcpState');
  state.querySelector('.dot').classList.toggle('off', !loaded);
  state.querySelector('span').textContent = loaded ? 'MCP por URL · ativo' : 'MCP por URL';
  const pill = $('#mcpPill');
  pill.textContent = loaded ? 'MCP: pronto' : 'MCP: —';
  pill.classList.toggle('on', loaded);
}

async function fetchManifest(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.tools)) throw new Error('mcp.json sem lista de ferramentas');
  return data;
}

async function connectMcp(raw) {
  const localUrl = manifestUrl('');
  const isLocalPreview = ['localhost', '127.0.0.1'].includes(location.hostname);
  let sameOrigin = false;
  try { sameOrigin = !!raw && new URL(raw, location.href).origin === location.origin; } catch { /* URL inválida */ }
  const url = !raw || isLocalPreview || sameOrigin ? localUrl : manifestUrl(raw);
  mcpSource = url;
  try {
    manifest = await fetchManifest(url);
  } catch (error) {
    if (url === localUrl) throw error;
    manifest = await fetchManifest(localUrl);
    toast('URL remota inacessível; manifesto local carregado.', true);
  }
  localStorage.setItem('fgua.mcpUrl', (raw || '').trim() || DEFAULT_MCP_URL);
  renderManifest();
  setMcpState(true);
  staticStatus();
  return manifest;
}

function showPayload(selector, tool, args) {
  show(selector, { jsonrpc: '2.0', method: 'tools/call', params: { name: tool, arguments: args } });
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
    if (row.name) tr.dataset.reaName = row.name;
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

async function loadSnapshot() {
  try {
    const response = await fetch(SNAPSHOT_URL, { cache: 'no-store' });
    if (!response.ok) return false;
    snapshot = await response.json();
    renderSnapshot();
    return true;
  } catch {
    return false;
  }
}

function renderSnapshot() {
  if (!snapshot) return;
  const { presets = [], prompts = [], reaTools = [], jobs = [], generatedAt = '' } = snapshot;
  $('#snapshotDate').textContent = generatedAt || '—';
  fillTable($('#presetsTable'), presets, [
    { get: (r) => r.id }, { get: (r) => r.kind }, { get: (r) => r.name }, { get: () => 'somente leitura' },
  ]);
  fillTable($('#promptsTable'), prompts, [
    { get: (r) => r.id }, { get: (r) => r.name }, { get: () => 'somente leitura' },
  ]);
  fillTable($('#reaTable'), reaTools, [
    { get: (r) => r.name }, { get: (r) => r.description },
  ]);
  $('#reaCount').textContent = `${reaTools.length} no snapshot`;
  fillTable($('#jobsTable'), jobs, [
    { get: (r) => r.id }, { get: (r) => r.type }, { get: (r) => r.status }, { get: (r) => r.createdAt },
  ]);
  const counters = $('#storeCounters');
  counters.replaceChildren();
  for (const [label, count] of Object.entries({ presets: presets.length, prompts: prompts.length, reaTools: reaTools.length, jobs: jobs.length })) {
    const card = document.createElement('article');
    card.className = 'card';
    const small = document.createElement('small');
    small.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = String(count);
    card.append(small, strong);
    counters.appendChild(card);
  }
  for (const select of [$('#reversePresets'), $('#repairPresets')]) {
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = select.id === 'reversePresets' ? 'automático' : 'padrão';
    select.appendChild(placeholder);
    for (const preset of presets) {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = `${preset.id} · ${preset.kind}`;
      select.appendChild(option);
    }
  }
  fillTable($('#localToolsTable'), FGUA_TOOLS.map(([name, description]) => ({ name, description })), [
    { get: (r) => r.name }, { get: (r) => r.description },
  ]);
  fillTable($('#toolsRegistry'), [
    ['Conteúdo sincronizado', SNAPSHOT_URL, 'ativo'],
    ['Playground (iframe)', 'sandbox allow-scripts', 'ativo'],
    ['Ferramentas locais', 'Web APIs do navegador', 'ativo'],
    ...FGUA_TOOLS.map(([name, description]) => [name, description, 'registrado']),
  ].map(([name, command, state]) => ({ name, command, state })), [
    { get: (r) => r.name }, { get: (r) => r.command }, { get: (r) => r.state },
  ]);
}

function setPill(selector, label, state) {
  const el = $(selector);
  el.textContent = `${label}: ${state}`;
  el.classList.toggle('on', state === 'ok' || state === 'on');
  el.classList.toggle('off', state === 'off');
}

function staticStatus() {
  show('#statVersion', `v${VERSION}`);
  $('#statNode').textContent = 'GitHub Pages · estático';
  show('#statRea', snapshot ? 'catálogo' : '—');
  $('#statReaTools').textContent = snapshot ? `${snapshot.reaTools?.length || 0} ferramentas no snapshot` : 'snapshot indisponível';
  show('#statLlm', 'MCP stdio');
  $('#statModels').textContent = 'agente local · sem servidor web';
  setPill('#reaPill', 'REA', 'snapshot');
  setPill('#llmPill', 'MCP', manifest ? 'ok' : 'off');
}

function renderManifest() {
  if (!manifest) return;
  const tools = manifest.tools || [];
  const resources = manifest.resources || [];
  const source = mcpSource || manifestUrl('');
  $('#mcpVersion').textContent = `v${manifest.version || '—'}`;
  $('#mcpDescription').textContent = manifest.description || '';
  show('#mcpInfo', {
    name: manifest.name,
    baseUrl: manifest.baseUrl,
    source,
    transport: manifest.transport,
    endpoints: manifest.endpoints,
    callFormat: manifest.callFormat,
  });
  $('#mcpMeta').textContent = `Manifesto: ${manifest.name} v${manifest.version || '—'} · ferramentas: ${tools.length} · conteúdos: ${resources.length}`;
  $('#mcpToolCount').textContent = `${tools.length} ferramentas`;
  fillTable($('#mcpToolsTable'), tools, [
    { get: (r) => r.name }, { get: (r) => r.runtime }, { get: (r) => r.description },
  ]);
  const body = $('#mcpResourcesTable');
  body.replaceChildren();
  for (const resource of resources) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = resource.name;
    const uri = document.createElement('td');
    const link = document.createElement('a');
    link.href = new URL(resource.uri, source).href;
    link.textContent = resource.uri;
    link.target = '_blank';
    link.rel = 'noopener';
    uri.appendChild(link);
    const desc = document.createElement('td');
    desc.textContent = resource.description || '—';
    tr.append(name, uri, desc);
    body.appendChild(tr);
  }
  fillTable($('#toolsRegistry'), [
    ['Manifesto MCP', source, 'ativo'],
    ['Snapshot', SNAPSHOT_URL, 'ativo'],
    ...tools.map((tool) => [tool.name, tool.runtime, 'disponível']),
  ].map(([name, command, state]) => ({ name, command, state })), [
    { get: (r) => r.name }, { get: (r) => r.command }, { get: (r) => r.state },
  ]);
}

function localReaSearch(query) {
  const tools = snapshot?.reaTools || [];
  const term = query.trim().toLowerCase();
  const matched = term
    ? tools.filter((tool) => `${tool.name} ${tool.description || ''}`.toLowerCase().includes(term))
    : tools;
  $('#reaCount').textContent = `${matched.length}/${tools.length} · snapshot`;
  fillTable($('#reaTable'), matched, [
    { get: (r) => r.name }, { get: (r) => r.description },
  ]);
}

function refreshRea(query) {
  reaQuery = query;
  localReaSearch(query);
}

function refreshPresets() {
  fillTable($('#presetsTable'), snapshot?.presets || [], [
    { get: (r) => r.id }, { get: (r) => r.kind }, { get: (r) => r.name }, { get: () => 'snapshot' },
  ]);
}

function refreshPrompts() {
  fillTable($('#promptsTable'), snapshot?.prompts || [], [
    { get: (r) => r.id }, { get: (r) => r.name }, { get: () => 'snapshot' },
  ]);
}

function refreshJobs() {
  const jobs = snapshot?.jobs || [];
  fillTable($('#jobsTable'), jobs, [
    { get: (r) => r.id }, { get: (r) => r.type }, { get: (r) => r.status }, { get: (r) => r.createdAt },
  ]);
  bindJobRows(jobs);
}

function bindJobRows(jobs) {
  $$('#jobsTable tr').forEach((tr) => {
    const id = tr.firstElementChild?.textContent;
    if (!id || id === '—') return;
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => show('#jobDetail', jobs.find((item) => item.id === id) || { id }));
  });
}

function setView(name) {
  if (!TITLES[name]) return;
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $$('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  const [title, subtitle] = TITLES[name];
  $('#viewTitle').textContent = title;
  $('#viewSubtitle').textContent = subtitle;
  if (name === 'jobs') refreshJobs();
  if (name === 'rea') refreshRea(reaQuery);
  if (name === 'admin') { refreshPresets(); refreshPrompts(); }
  if (name === 'mcp') renderManifest();
}

/* ---------- Ferramentas locais ---------- */

const TOOLS = [
  {
    id: 'json', label: 'JSON', hint: 'Formata, minifica ou valida JSON.',
    fields: [{ name: 'text', label: 'JSON', textarea: true, value: '{"nome":"FGUA","versao":4,"ativo":true}' }],
    options: [['format', 'Formatar'], ['minify', 'Minificar'], ['validate', 'Validar']],
    run: (values) => {
      const parsed = JSON.parse(values.text);
      if (values.option === 'minify') return JSON.stringify(parsed);
      if (values.option === 'validate') return `JSON válido · ${Array.isArray(parsed) ? `${parsed.length} itens` : `${Object.keys(parsed).length} chaves`}`;
      return JSON.stringify(parsed, null, 2);
    },
  },
  {
    id: 'base64', label: 'Base64', hint: 'Codifica e decodifica UTF-8.',
    fields: [{ name: 'text', label: 'Texto', textarea: true, value: 'FGUA · Frame Generator API' }],
    options: [['encode', 'Codificar'], ['decode', 'Decodificar']],
    run: (values) => {
      if (values.option === 'decode') {
        const bytes = Uint8Array.from(atob(values.text.replace(/\s/g, '')), (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      }
      const bytes = new TextEncoder().encode(values.text);
      return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    },
  },
  {
    id: 'url', label: 'URL', hint: 'Codifica e decodifica componentes de URL.',
    fields: [{ name: 'text', label: 'Texto', textarea: true, value: 'https://exemplo.test/a b?x=1&y=2' }],
    options: [['encode', 'Codificar'], ['decode', 'Decodificar']],
    run: (values) => values.option === 'decode' ? decodeURIComponent(values.text) : encodeURIComponent(values.text),
  },
  {
    id: 'hash', label: 'Hash', hint: 'Digests SHA via Web Crypto.',
    fields: [{ name: 'text', label: 'Texto', textarea: true, value: 'fgua' }],
    options: [['SHA-256', 'SHA-256'], ['SHA-384', 'SHA-384'], ['SHA-512', 'SHA-512']],
    run: async (values) => {
      const data = new TextEncoder().encode(values.text);
      const digest = await crypto.subtle.digest(values.option, data);
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    },
  },
  {
    id: 'uuid', label: 'UUID', hint: 'Gera identificadores v4 com crypto.randomUUID.',
    fields: [{ name: 'text', label: 'Quantidade (1–100)', value: '5' }],
    run: (values) => {
      const count = Math.min(100, Math.max(1, parseInt(values.text, 10) || 1));
      return Array.from({ length: count }, () => crypto.randomUUID()).join('\n');
    },
  },
  {
    id: 'regex', label: 'Regex', hint: 'Testa um padrão e lista as correspondências.',
    fields: [
      { name: 'pattern', label: 'Padrão', value: '\\b\\w{4,}\\b' },
      { name: 'flags', label: 'Flags', value: 'gi' },
      { name: 'text', label: 'Texto', textarea: true, value: 'FGUA gera relatórios com evidências verificáveis.' },
    ],
    run: (values) => {
      const flags = [...new Set([...values.flags].filter((f) => 'gimsuyd'.includes(f)))].join('');
      const regex = new RegExp(values.pattern, flags);
      const matches = [];
      let match;
      while ((match = regex.exec(values.text)) !== null && matches.length < 100) {
        matches.push(`[${match.index}] ${match[0]}${match[1] ? ` → ${match[1]}` : ''}`);
        if (!flags.includes('g')) break;
        if (match[0] === '') regex.lastIndex += 1;
      }
      return matches.length ? matches.join('\n') : 'Nenhuma correspondência.';
    },
  },
  {
    id: 'text', label: 'Texto', hint: 'Conta caracteres, palavras, linhas e bytes.',
    fields: [{ name: 'text', label: 'Texto', textarea: true, value: 'Painel estático.\nSem servidor.\nTudo no navegador.' }],
    run: (values) => {
      const text = values.text;
      return [
        `Caracteres: ${[...text].length}`,
        `Palavras: ${(text.match(/\S+/g) || []).length}`,
        `Linhas: ${text.split(/\r\n|\r|\n/).length}`,
        `Parágrafos: ${text.split(/\n\s*\n/).filter(Boolean).length}`,
        `Bytes (UTF-8): ${new TextEncoder().encode(text).length}`,
      ].join('\n');
    },
  },
  {
    id: 'date', label: 'Data', hint: 'Converte epoch e ISO para formatos legíveis.',
    fields: [{ name: 'text', label: 'Epoch (s/ms) ou ISO', value: '1764084000' }],
    run: (values) => {
      const raw = values.text.trim();
      let ms = /^\d+$/.test(raw) ? (raw.length <= 10 ? Number(raw) * 1000 : Number(raw)) : Date.parse(raw);
      if (!Number.isFinite(ms)) throw new Error('Data não reconhecida.');
      const date = new Date(ms);
      return [`ISO: ${date.toISOString()}`, `UTC: ${date.toUTCString()}`, `Local: ${date.toLocaleString('pt-BR')}`, `Epoch ms: ${date.getTime()}`].join('\n');
    },
  },
  {
    id: 'color', label: 'Cor', hint: 'Converte entre HEX, RGB e HSL.',
    fields: [{ name: 'text', label: 'HEX, rgb(...) ou hsl(...)', value: '#6ee7a8' }],
    run: (values) => {
      const input = values.text.trim();
      let r, g, b;
      if (/^#?[\da-f]{3}$|^#?[\da-f]{6}$/i.test(input)) {
        const hex = input.replace('#', '');
        const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
        [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
      } else {
        const parts = (input.match(/[\d.]+/g) || []).map(Number);
        if (parts.length < 3) throw new Error('Cor não reconhecida.');
        if (/^hsl/i.test(input)) {
          [r, g, b] = hslToRgb(parts[0], parts[1] / 100, parts[2] / 100);
        } else {
          [r, g, b] = parts;
        }
      }
      if ([r, g, b].some((v) => !Number.isFinite(v) || v < 0 || v > 255)) throw new Error('Canais inválidos.');
      const hex = `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
      const [h, s, l] = rgbToHsl(r, g, b);
      return [`HEX: ${hex}`, `RGB: rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`, `HSL: hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`].join('\n');
    },
  },
];

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function rgbToHsl(r, g, b) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}

function renderTools() {
  const tabs = $('#toolTabs');
  const workspace = $('#toolWorkspace');
  tabs.replaceChildren();
  workspace.replaceChildren();
  for (const tool of TOOLS) {
    const tab = document.createElement('button');
    tab.className = 'tab' + (tool.id === activeTool ? ' active' : '');
    tab.textContent = tool.label;
    tab.dataset.tool = tool.id;
    tab.addEventListener('click', () => {
      activeTool = tool.id;
      $$('#toolTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tool === tool.id));
      $$('.tool-card').forEach((card) => card.classList.toggle('hidden', card.dataset.tool !== tool.id));
    });
    tabs.appendChild(tab);

    const card = document.createElement('article');
    card.className = 'tool-card' + (tool.id === activeTool ? '' : ' hidden');
    card.dataset.tool = tool.id;
    const head = document.createElement('div');
    head.className = 'tool-head';
    const title = document.createElement('strong');
    title.textContent = `${tool.label} · ${tool.hint}`;
    const select = document.createElement('select');
    select.style.width = 'auto';
    for (const [value, label] of tool.options || [['run', 'Executar']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    select.value = (tool.options || [['run', 'Executar']])[0][0];
    head.append(title, select);
    card.appendChild(head);

    for (const field of tool.fields) {
      const label = document.createElement('label');
      label.className = 'hint';
      label.textContent = field.label;
      const input = field.textarea ? document.createElement('textarea') : document.createElement('input');
      input.name = field.name;
      input.value = field.value;
      if (field.textarea) input.rows = 5;
      label.appendChild(input);
      card.appendChild(label);
    }

    const actions = document.createElement('div');
    actions.className = 'tool-actions';
    const run = document.createElement('button');
    run.className = 'btn primary small';
    run.textContent = 'Executar';
    const copy = document.createElement('button');
    copy.className = 'btn ghost small';
    copy.textContent = 'Copiar resultado';
    actions.append(run, copy);
    card.appendChild(actions);
    const result = document.createElement('pre');
    result.className = 'code tool-result';
    result.textContent = '—';
    card.appendChild(result);

    run.addEventListener('click', async () => {
      const values = { option: select.value };
      for (const field of tool.fields) values[field.name] = card.querySelector(`[name="${field.name}"]`).value;
      try {
        result.textContent = await tool.run(values);
      } catch (error) {
        result.textContent = `${error.name}: ${error.message}`;
        toast(error.message, true);
      }
    });
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(result.textContent);
        toast('Resultado copiado.');
      } catch {
        toast('Não foi possível copiar neste navegador.', true);
      }
    });
    workspace.appendChild(card);
  }
}

/* ---------- Playground ---------- */

function resetSandbox() {
  const old = $('#playgroundFrame');
  const frame = old.cloneNode(true);
  old.replaceWith(frame);
  sandboxReady = false;
  frame.addEventListener('load', () => { sandboxReady = true; $('#playgroundStatus').textContent = 'sandbox pronto'; });
}

function runPlayground() {
  const frame = $('#playgroundFrame');
  const output = $('#playgroundOutput');
  if (!sandboxReady) { toast('Sandbox ainda carregando.', true); return; }
  output.textContent = '';
  $('#playgroundStatus').textContent = 'executando…';
  clearTimeout(sandboxTimer);
  sandboxTimer = setTimeout(() => {
    output.textContent += '\n[timeout] execução interrompida';
    $('#playgroundStatus').textContent = 'tempo limite';
    resetSandbox();
  }, 3000);
  frame.contentWindow.postMessage({ type: 'fgua:run', code: $('#playgroundInput').value }, '*');
}

window.addEventListener('message', (event) => {
  if (event.source !== $('#playgroundFrame')?.contentWindow) return;
  const { type, level, text, value, failed } = event.data || {};
  if (type === 'fgua:log') {
    const output = $('#playgroundOutput');
    output.textContent += (output.textContent === '' ? '' : '\n') + `[${level}] ${text}`;
  }
  if (type === 'fgua:done') {
    clearTimeout(sandboxTimer);
    const output = $('#playgroundOutput');
    if (value !== null) output.textContent += (output.textContent === '' ? '' : '\n') + `→ ${value}`;
    if (output.textContent === '') output.textContent = '(sem saída)';
    $('#playgroundStatus').textContent = failed ? 'erro' : 'concluído';
  }
});

/* ---------- Busca rápida ---------- */

function openPalette() {
  $('#palette').hidden = false;
  $('#paletteInput').value = '';
  renderPalette('');
  $('#paletteInput').focus();
}

function renderPalette(term) {
  const items = [
    ...Object.entries(TITLES).map(([id, [label, hint]]) => ({ view: id, label, hint })),
    ...TOOLS.map((tool) => ({ view: 'tools', tool: tool.id, label: `Ferramenta · ${tool.label}`, hint: tool.hint })),
  ];
  const query = term.trim().toLowerCase();
  const matches = query ? items.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query)) : items;
  const results = $('#paletteResults');
  results.replaceChildren();
  if (!matches.length) {
    results.textContent = 'Nenhum resultado.';
    return;
  }
  for (const item of matches.slice(0, 12)) {
    const button = document.createElement('button');
    button.textContent = item.label;
    const small = document.createElement('small');
    small.textContent = item.tool ? 'ir para ferramenta' : item.view;
    button.appendChild(small);
    button.addEventListener('click', () => {
      setView(item.view);
      if (item.tool) {
        const tab = $(`#toolTabs .tab[data-tool="${item.tool}"]`);
        tab?.click();
      }
      closePalette();
    });
    results.appendChild(button);
  }
}

function closePalette() { $('#palette').hidden = true; }

/* ---------- Tema e atalhos ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('fgua.theme', theme);
  $('#themeToggle').textContent = theme === 'dark' ? '◐' : '◑';
}

/* ---------- Formulários de integração opcional ---------- */

function formObject(form) {
  const out = {};
  for (const [key, value] of new FormData(form).entries()) out[key] = String(value).trim();
  return out;
}

function bindForms() {
  $('#mcpForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await connectMcp($('#mcpUrlInput').value);
      toast('Manifesto MCP carregado.');
    } catch (error) {
      toast(`Falha ao carregar mcp.json: ${error.message}`, true);
    }
  });

  $('#reverseForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    if (values.steps) values.steps = values.steps.split(',').map((s) => s.trim()).filter(Boolean);
    else delete values.steps;
    for (const key of ['outputDir', 'preset']) if (!values[key]) delete values[key];
    showPayload('#reverseResult', 'fgua_reverse_file', values);
    $('#reverseStatus').textContent = 'pronto para copiar';
    toast('Chamada MCP gerada.');
  });

  $('#repairForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    const mode = document.querySelector('[data-tabs="mode"] .tab.active')?.dataset.tab || 'repair';
    values.maxIterations = Number(values.maxIterations || 4);
    for (const key of ['instruction', 'preset', 'model', 'outputPath']) if (!values[key]) delete values[key];
    if (mode === 'repair') delete values.targetLanguage;
    showPayload('#repairResult', mode === 'repair' ? 'fgua_repair_code' : 'fgua_transpile_code', values);
    $('#repairStatus').textContent = 'pronto para copiar';
    toast('Chamada MCP gerada.');
  });

  $('#reaSearchForm').addEventListener('submit', (event) => {
    event.preventDefault();
    refreshRea(formObject(event.target).query || '');
  });

  $('#reaCallForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    let args = {};
    try { args = JSON.parse(values.args || '{}'); } catch { toast('Argumentos JSON inválidos.', true); return; }
    showPayload('#reaResult', 'fgua_rea_call', { tool: values.tool, args });
    $('#reaCallStatus').textContent = 'pronto para copiar';
    toast('Chamada MCP gerada.');
  });

  $('#promptForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    showPayload('#promptResult', 'fgua_prompts', {
      action: 'save',
      prompt: { id: values.id, name: values.name, body: values.body, variables: [] },
    });
    $('#promptStatus').textContent = 'pronto para copiar';
    toast('Chamada MCP gerada.');
  });

  $('#renderForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    try {
      const variables = JSON.parse(values.variables || '{}');
      const prompt = (snapshot?.prompts || []).find((item) => item.id === values.id);
      if (!prompt) throw new Error('Prompt não encontrado no snapshot.');
      show('#renderResult', prompt.body.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`));
    } catch (error) { toast(error.message, true); }
  });

  $('#presetForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    let config = {};
    try { config = JSON.parse(values.config || '{}'); } catch { toast('Config JSON inválido.', true); return; }
    showPayload('#presetResult', 'fgua_presets', {
      action: 'save',
      preset: {
        id: values.id, name: values.name, kind: values.kind, description: values.description,
        tags: values.tags.split(',').map((t) => t.trim()).filter(Boolean), config,
      },
    });
    $('#presetStatus').textContent = 'pronto para copiar';
    toast('Chamada MCP gerada.');
  });

  $('#settingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = formObject(event.target);
    const patch = { lmStudioUrl: values.lmStudioUrl, model: values.model };
    if (values.temperature !== '') patch.temperature = Number(values.temperature);
    if (values.maxIterations !== '') patch.maxIterations = Number(values.maxIterations);
    const current = JSON.parse(localStorage.getItem('fgua.settings') || '{}');
    localStorage.setItem('fgua.settings', JSON.stringify({ ...current, ...patch }));
    $('#settingsStatus').textContent = 'salvo localmente';
    toast('Configuração salva neste navegador.');
  });
}

/* ---------- Ligações ---------- */

$$('.nav-item').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$$('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)));
$$('[data-tabs]').forEach((group) => {
  group.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    group.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    const name = group.dataset.tabs;
    if (name === 'admin') {
      $$('.subpanel').forEach((p) => p.classList.toggle('active', p.dataset.sub === tab.dataset.tab));
      if (tab.dataset.tab === 'presets') refreshPresets();
      if (tab.dataset.tab === 'prompts') refreshPrompts();
    }
    if (name === 'mode') $('.target-lang').classList.toggle('hidden', tab.dataset.tab === 'repair');
  }));
});

$('#sidebarToggle').addEventListener('click', () => $('#sidebar').classList.toggle('collapsed'));
$('#themeToggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('#refreshBtn').addEventListener('click', async () => {
  await loadSnapshot();
  try { await connectMcp($('#mcpUrlInput').value); }
  catch (error) { toast(`Falha ao carregar mcp.json: ${error.message}`, true); }
  staticStatus();
});
$$('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
  const target = $(button.dataset.copy);
  if (!target) return;
  try { await navigator.clipboard.writeText(target.textContent); toast('Copiado.'); }
  catch { toast('Não foi possível copiar neste navegador.', true); }
}));
$('#mcpToolsTable').addEventListener('click', (event) => {
  const name = event.target.closest('tr')?.firstElementChild?.textContent;
  if (!name || !manifest) return;
  show('#mcpToolDetail', manifest.tools.find((tool) => tool.name === name) || { name });
});
$('#jobsRefresh').addEventListener('click', refreshJobs);
$('#presetsRefresh').addEventListener('click', refreshPresets);
$('#promptsRefresh').addEventListener('click', refreshPrompts);
$('#paletteBtn').addEventListener('click', openPalette);
$('#paletteInput').addEventListener('input', (event) => renderPalette(event.target.value));
$('#paletteInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('#paletteResults button')?.click();
});
$('#palette').addEventListener('click', (event) => { if (event.target.id === 'palette') closePalette(); });
$('#playgroundRun').addEventListener('click', runPlayground);
$('#playgroundClear').addEventListener('click', () => {
  $('#playgroundInput').value = '';
  $('#playgroundOutput').textContent = '—';
  $('#playgroundStatus').textContent = '';
});
$('#playgroundInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); runPlayground(); }
});
$('#reaTable').addEventListener('click', (event) => {
  const name = event.target.closest('tr')?.dataset.reaName;
  if (!name || !snapshot) return;
  show('#reaResult', snapshot.reaTools.find((tool) => tool.name === name) || { name });
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); }
  if (event.key === 'Escape') closePalette();
});

applyTheme(localStorage.getItem('fgua.theme') || 'dark');
$('#mcpUrlInput').value = localStorage.getItem('fgua.mcpUrl') || DEFAULT_MCP_URL;
for (const [key, value] of Object.entries(JSON.parse(localStorage.getItem('fgua.settings') || '{}'))) {
  const input = $(`#settingsForm [name="${key}"]`);
  if (input && value !== undefined) input.value = value;
}
renderTools();
bindForms();
resetSandbox();
staticStatus();
await loadSnapshot();
try { await connectMcp($('#mcpUrlInput').value); }
catch (error) { toast(`Falha ao carregar mcp.json: ${error.message}`, true); }
