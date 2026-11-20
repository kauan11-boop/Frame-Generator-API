/**
 * FGUA v2 — Instalador IA: gera o Master Prompt de integração do projeto
 * com a IA (Passo a passo + spec JSON + licença + comandos).
 */

import { el, icon, callout, jsonView } from './common.js';

export function mount(FGUA) {
  const router = FGUA.get('router');
  const settings = FGUA.get('settings');
  const root = el('div', 'app');
  const main = el('div', 'app-main');
  root.appendChild(main);

  let step = 1;
  const stepsEl = el('div', 'wizard-steps');
  main.appendChild(el('div', '', `<h1>Instalador IA — integração do Frame-Generator-API</h1><p class="sub">Gera o prompt master personalizado com as configurações atuais para integrar este sistema a qualquer modelo/agent de IA.</p>`));
  main.appendChild(stepsEl);
  const body = el('div');
  main.appendChild(body);

  function renderSteps() {
    stepsEl.innerHTML = [1, 2, 3, 4, 5].map(i => `<span class="wstep ${i === step ? 'now' : i < step ? 'done' : ''}">${i < step ? '✔ ' : ''}Passo ${i}</span>`).join('');
  }

  function render() {
    renderSteps();
    body.innerHTML = '';
    if (step === 1) {
      body.appendChild(el('div', '', `<h2>Passo 1 — Entenda o sistema</h2>`));
      body.appendChild(callout(`O FGUA é um núcleo web estático (GitHub Pages) com <b>contrato lógico /api/v1</b>, estados explícitos e modo <b>${settings.mode}</b>. Nada é simulado: geração real exige provider/runtime compatível.`));
      const b = el('button', 'btn primary', 'Avançar');
      b.onclick = () => { step = 2; render(); };
      body.appendChild(b);
    } else if (step === 2) {
      body.appendChild(el('div', '', `<h2>Passo 2 — Escolha o modo de conexão</h2>`));
      const sel = el('div', 'form-row', `
        <label>Modo para a integração</label>
        <select id="w-mode"><option value="demo">demo</option><option value="local">local (LM Studio)</option><option value="remote">remote</option></select>
        <label>baseUrl (para local/remote)</label>
        <input type="text" id="w-url" value="${settings.backends?.lmstudio?.baseUrl ?? 'http://localhost:1234'}">`);
      sel.querySelector('#w-mode').value = settings.mode;
      body.appendChild(sel);
      const b = el('button', 'btn primary', 'Avançar');
      b.onclick = () => { step = 3; render(); };
      body.appendChild(b);
    } else if (step === 3) {
      body.appendChild(el('div', '', `<h2>Passo 3 — Escopo da integração</h2>`));
      const sel = el('div', 'form-row', `
        <label>O que a IA deve integrar?</label>
        <select id="w-scope">
          <option value="tudo">Tudo (contrato completo /api/v1)</option>
          <option value="models">Hub de modelos + GGUF + quantização</option>
          <option value="frames">Gerador de quadros (jogos/imagem/vídeo)</option>
          <option value="repack">Repacks multi-ferramenta</option>
          <option value="lmstudio">Ponte LM Studio</option>
        </select>`);
      body.appendChild(sel);
      const b = el('button', 'btn primary', 'Gerar Master Prompt');
      b.onclick = () => { step = 4; render(); };
      body.appendChild(b);
    } else if (step === 4) {
      const mode = main.querySelector('#w-mode')?.value ?? settings.mode;
      const url = main.querySelector('#w-url')?.value ?? '';
      const scope = main.querySelector('#w-scope')?.value ?? 'tudo';
      body.appendChild(el('div', '', `<h2>Passo 4 — Seu Master Prompt</h2>`));
      const pre = el('div', 'json-view', '');
      pre.style.maxHeight = '380px';
      pre.textContent = buildPrompt(mode, url, scope);
      const actions = el('div', '', `<div style="display:flex;gap:8px;margin:10px 0">
        <button class="btn primary" id="w-copy">Copiar prompt</button>
        <button class="btn" id="w-dl-md">Baixar .md</button>
        <button class="btn" id="w-dl-json">Baixar spec .json</button></div>`);
      body.appendChild(pre);
      body.appendChild(actions);
      actions.querySelector('#w-copy').onclick = async () => {
        try { await navigator.clipboard.writeText(pre.textContent); body.appendChild(callout('Prompt copiado para a área de transferência.', '')); }
        catch { body.appendChild(callout('Não foi possível copiar automaticamente; selecione o texto manualmente.', 'warn')); }
      };
      actions.querySelector('#w-dl-md').onclick = () => download('FGUA-master-prompt.md', pre.textContent);
      actions.querySelector('#w-dl-json').onclick = () => download('FGUA-integration-spec.json', JSON.stringify(buildSpec(), null, 2));
      body.appendChild(callout(`Modo: <b>${mode}</b> · baseUrl: <b>${url || '—'}</b> · escopo: <b>${scope}</b>`, ''));
      const b = el('button', 'btn primary', 'Avançar');
      b.onclick = () => { step = 5; render(); };
      body.appendChild(b);
    } else if (step === 5) {
      body.appendChild(el('div', '', `<h2>Passo 5 — Validar a integração</h2>`));
      body.appendChild(callout(`No terminal do projeto: <code>npm run ci</code> valida configs, manifests e testes. No navegador, abra o Console da API e verifique os 46+ endpoints.`));
      body.appendChild(el('h3', '', 'Comandos necessários'));
      body.appendChild(el('div', 'json-view', `npm install        # instala dependências de desenvolvimento\nnpm run serve      # sobe http://localhost:4173\nnpm run ci         # CI completa (valida tudo)\nnpm run test       # testes unitários\n\ngit init && git add . && git commit -m "FGUA v2"\ngit remote add origin https://github.com/kauan11-boop/Frame-Generator-API.git\ngit push -u origin main   # publica no GitHub Pages`));
      body.appendChild(el('h3', '', 'Licença'));
      body.appendChild(callout('MIT — livre para uso, modificação e redistribuição com atribuição. Arquivo LICENSE incluído no pacote.'));
      const b = el('button', 'btn', 'Recomeçar');
      b.onclick = () => { step = 1; render(); };
      body.appendChild(b);
    }
  }

  async function await_json() { return buildSpec(); }
  function buildSpec() {
    return {
      identity: { name: 'Frame-Generator-API', acronym: 'FGUA', version: '2.0.0', runtime: 'HTML5+CSS3+JS (ES Modules)', hosting: 'GitHub Pages (estático)', license: 'MIT' },
      contract: '/api/v1',
      mode: settings.mode,
      baseUrl: settings.backends?.lmstudio?.baseUrl ?? null,
      namespaces: Object.keys(FGUA.get('config').api.namespaces),
      states: FGUA.states.STATES,
      limits: {
        gguf: 'análise de metadados no cliente; inferência real exige runtime/provedor',
        quantization: 'planejamento/estimativa; conversão efetiva apenas em runtime externo; original preservado',
        generation: 'planejamento/análise; execução real depende de engine/modelo/provedor compatível; sem simulação',
        security: 'UI-level; autorização confiável exige backend; sem segredos em arquivos públicos',
        games: 'sem interceptação automática de pipeline gráfico; apenas integrações autorizadas'
      },
      resources: {
        dashboard: '/Public/dashboard.html', desktop: '/Public/desktop/index.html',
        documentation: '/Public/documentation/index.html', configs: '/configs/*.json',
        masterPrompt: '/Public/templates/master-prompt-integration.md'
      },
      verify: 'npm run ci'
    };
  }
  function buildPrompt(mode, url, scope) {
    const scopeTxt = {
      tudo: 'todo o contrato /api/v1 (16 namespaces)',
      models: 'Hub de Modelos: parser GGUF, metadados e quantização (estimativa/plano)',
      frames: 'Gerador de Quadros: jogos, imagem e vídeo com controlador de pixels',
      repack: 'Repacks multi-ferramenta (1 comando → vários passos)',
      lmstudio: 'ponte com LM Studio (OpenAI-compat /v1 + REST nativa /api/v1 e /api/v0)'
    }[scope] ?? 'todo o contrato';
    return `# Master Prompt de Integração — Frame-Generator-API (FGUA) v2

## Objetivo
Integrar o Frame-Generator-API (núcleo web modular com contrato lógico /api/v1) em um modelo de IA, agente, pipeline ou projeto, cobrindo ${scopeTxt}.

## Identidade e escopo
- Nome: Frame-Generator-API (FGUA) — versão 2.0.0
- Runtime: HTML5, CSS3, JavaScript (ES Modules), execução no navegador
- Hospedagem: GitHub Pages (site estático). Não há servidor REST nativo no host.
- Site: https://kauan11-boop.github.io/Frame-Generator-API/
- Repositório: https://github.com/kauan11-boop/Frame-Generator-API

## Modo de operação desta integração
- Modo: ${mode}${mode !== 'demo' ? `\n- baseUrl: ${url}` : '\n- Operações remotas retornam indisponibilidade explícita (nunca resultado simulado).'}

## Regras obrigatórias (respeite os limites reais)
1. GGUF: apenas análise de metadados no cliente (parser binário, header/KV/tensores). Inferência real requer runtime/provedor compatível.
2. Quantização: identificação, estimativa e planejamento apenas. Conversão efetiva requer runtime externo (ex.: llama.cpp llama-quantize). O arquivo original é sempre preservado. Sem conversão fictícia.
3. Geração/processamento (imagem/vídeo/frames): planejamento/análise e estados explícitos. Sem simulação de resultados.
4. Engines: detecção de WebGPU/WebGL/WASM/WebCodecs; adaptadores TensorFlow.js e Transformers.js sob demanda (CDN); backend configurável.
5. Segurança: autenticação/permissões em nível de UI. Autorização confiável exige backend. Não armazenar segredos em arquivos públicos.
6. Jogos: não interceptar pipeline gráfico automaticamente; usar apenas integrações/capturas autorizadas.
7. Estados obrigatórios: ready, planned, analyzed, requires-provider, requires-runtime, unavailable, invalid, failed, cancelled, succeeded.
8. Fonte de dados: JSON (configs/*.json). Validar manifests/configs antes de uso.

## Contrato lógico /api/v1
Namespaces: system, models, metadata, quantization, generators, frames, images, videos, engines, repack, tools, users, permissions, config, jobs, storage.
- Cada endpoint: { path, method, state, permission } — guards por namespace em configs/permissions.json.

## Integração recomendada (passos)
1. Consumir configs/*.json e o payload de integração exportado pelo dashboard.
2. Configurar backend/provedor compatível quando for necessária execução real (${mode === 'demo' ? 'modo demo: nenhum backend necessário' : `baseUrl: ${url}` }).
3. Selecionar engine/modelo/provedor conforme formato, operação e capacidades detectadas.
4. Tratar estados explicitamente (ver lista acima).
5. Validar com "npm run ci" após qualquer mudança.

## LM Studio (execução real)
- Compatível com OpenAI: GET /v1/models · POST /v1/chat/completions · POST /v1/completions · POST /v1/embeddings
- REST nativa v1 (0.4+): GET /api/v1/models · POST /api/v1/chat · POST /api/v1/models/load · POST /api/v1/models/unload
- REST v0 (legado): GET /api/v0/models · POST /api/v0/chat/completions · POST /api/v0/embeddings
- CORS obrigatório: Developer → Server Settings → Enable CORS. Auth opcional: Authorization: Bearer <token>.

## Licença e comandos
- Licença MIT (arquivo LICENSE). Atribuição apreciada.
- Comandos: npm install · npm run serve (http://localhost:4173) · npm run ci · npm run test
`;
  }
  function download(name, text) {
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  render();
  return root;
}

export default { mount };
