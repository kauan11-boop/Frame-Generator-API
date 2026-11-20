/**
 * FGUA v2 — Hub de Modelos: catálogo, carregador GGUF real, quantizador e runtimes.
 */

import { el, icon, stateBadge, jsonView, table, bytes, callout, pickFile } from './common.js';

export function mount(FGUA) {
  const router = FGUA.get('router');
  const root = el('div', 'app');
  const side = el('div', 'app-side', `<div class="brand">${icon('i-cube')} Hub de Modelos</div>`);
  const main = el('div', 'app-main');
  root.append(side, main);

  const pages = {
    catalogo: { label: 'Catálogo', ico: 'i-grid', render: renderCatalogo },
    gguf: { label: 'Carregar .GGUF', ico: 'i-upload', render: renderGGUF },
    quant: { label: 'Quantização', ico: 'i-chart', render: renderQuant },
    runtimes: { label: 'Runtimes', ico: 'i-spark', render: renderRuntimes },
    registrados: { label: 'Analisados', ico: 'i-file', render: renderRegistrados }
  };

  let current = 'catalogo';
  function select(key) {
    current = key;
    side.querySelectorAll('.side-item').forEach(x => x.classList.toggle('sel', x.dataset.k === key));
    main.innerHTML = '';
    pages[key].render(main);
  }
  for (const [k, p] of Object.entries(pages)) {
    const n = el('div', 'side-item', `${icon(p.ico)}${p.label}`);
    n.dataset.k = k;
    n.onclick = () => select(k);
    side.appendChild(n);
  }
  select('catalogo');

  /* ---------- Catálogo ---------- */
  async function renderCatalogo(box) {
    box.appendChild(el('div', '', `<h1>Catálogo de Modelos</h1><p class="sub">configs/models.json + modelos analisados localmente. Execução real exige provedor (estado "requires-provider").</p>`));
    const r = await router.route('/api/v1/models/list');
    const cards = el('div', 'cards');
    for (const m of r.data?.builtin ?? []) {
      const c = el('div', 'card', `
        <h4>${m.name}</h4>
        <p class="sub">${m.family} · ${m.format.toUpperCase()} · ${m.params} · ${m.context.toLocaleString('pt-BR')} tokens de contexto</p>
        <div class="kv"><span>Quantização</span><b>${m.quantization}</b></div>
        <div class="kv"><span>Tamanho aprox.</span><b>${m.sizeGB} GB</b></div>
        <div class="kv"><span>Capacidades</span><b>${m.capabilities.join(', ')}</b></div>
        <div style="margin-top:10px">${stateBadge(m.state)}</div>`);
      cards.appendChild(c);
    }
    box.appendChild(cards);
    box.appendChild(callout('Carregue um arquivo .GGUF na aba "Carregar .GGUF" para análise real de metadados (parser binário no cliente, nenhum arquivo sai do navegador).'));
  }

  /* ---------- GGUF ---------- */
  function renderGGUF(box) {
    box.appendChild(el('div', '', `<h1>Carregador .GGUF</h1><p class="sub">Parser binário real: magic 0x46554747, header, metadados KV (tipos 0–12) e tensor infos.</p>`));
    const btn = el('button', 'btn primary', `${icon('i-upload')} Selecionar arquivo .GGUF`);
    const area = el('div', '');
    const prog = el('div', 'progress', '<div style="width:0%"></div>');
    prog.style.display = 'none';
    box.append(btn, prog, area);

    btn.onclick = async () => {
      const f = await pickFile({ accept: '.gguf' });
      if (!f) return;
      area.innerHTML = '';
      prog.style.display = '';
      prog.querySelector('div').style.width = '10%';
      try {
        const t0 = performance.now();
        const g = await FGUA.gguf.parseBlob(f, { onProgress: p => { prog.querySelector('div').style.width = Math.min(90, 10 + (p.loaded / Math.max(1, Math.min(p.fileBytes, 16 * 1024 * 1024))) * 80) + '%'; } });
        const dt = Math.round(performance.now() - t0);
        prog.querySelector('div').style.width = '100%';
        const paramsB = g.estimatedWeights ? (g.estimatedWeights / 1e9).toFixed(2) + 'B' : '—';
        area.appendChild(el('div', 'cards', `
          <div class="card"><h4>${g.fileName}</h4>
            <div class="kv"><span>Tamanho</span><b>${bytes(g.fileSize)}</b></div>
            <div class="kv"><span>Header</span><b>${bytes(g.headerBytes)}</b></div>
            <div class="kv"><span>Versão GGUF</span><b>${g.version}</b></div>
            <div class="kv"><span>Arquitetura</span><b>${g.arch ?? '—'}</b></div>
            <div class="kv"><span>Quantização</span><b>${g.fileTypeLabel ?? '—'}</b></div>
            <div class="kv"><span>Tensores</span><b>${g.tensorsCount}</b></div>
            <div class="kv"><span>Metadados KV</span><b>${g.kvCount}</b></div>
            <div class="kv"><span>Parâmetros (estimativa)</span><b>${paramsB}</b></div>
            <div class="kv"><span>Peso dos tensores (estimativa)</span><b>${bytes(g.estimatedBytes)}</b></div>
            <div class="kv"><span>Analisado em</span><b>${dt} ms</b></div>
            <div style="margin-top:10px">${stateBadge('analyzed')}</div>
          </div>`));
        // metadados principais
        const keys = Object.keys(g.kv).filter(k => !k.startsWith('tokenizer.ggml.'));
        const rows = keys.slice(0, 60).map(k => [`<code>${k}</code>`, `<code>${String(JSON.stringify(g.kv[k])).slice(0, 120)}</code>`]);
        area.appendChild(el('h2', '', 'Metadados (principais)'));
        area.appendChild(table(['Chave', 'Valor'], rows));
        if (g.kv['tokenizer.ggml.tokens']) area.appendChild(callout(`Vocabulário detectado: ${g.kv['tokenizer.ggml.tokens'].truncated ? `${g.kv['tokenizer.ggml.tokens'].length} tokens (amostra exibida)` : `${g.kv['tokenizer.ggml.tokens'].length} tokens`} — ver aba "Analisados" para registrar este modelo.`, ''));
        // tensores (amostra)
        area.appendChild(el('h2', '', `Tensores (${g.tensorsCount} — amostra)`));
        area.appendChild(table(['Nome', 'Dimensões', 'Tipo', 'Offset'], g.tensors.slice(0, 25).map(t => [`<code>${t.name}</code>`, `[${t.dims.join(', ')}]`, t.type, t.offset])));
        // botão registrar
        const regBtn = el('button', 'btn primary', `${icon('i-plus')} Registrar no catálogo local`);
        regBtn.onclick = async () => {
          const r = await router.route('/api/v1/models/register', { method: 'POST', payload: {
            id: `gguf-${Date.now().toString(36)}`,
            name: g.fileName,
            format: 'gguf',
            fileName: g.fileName,
            fileSize: g.fileSize,
            arch: g.arch,
            quantization: g.fileTypeLabel,
            context: g.kv[`${g.arch}.context_length`] ?? null,
            tensorsCount: g.tensorsCount,
            estimatedWeights: g.estimatedWeights
          }});
          box.appendChild(callout(r.ok ? `Registrado como <code>${r.data.id}</code>.` : `Falha: ${r.error}`, r.ok ? '' : 'err'));
        };
        area.appendChild(regBtn);
      } catch (err) {
        prog.style.display = 'none';
        area.appendChild(callout(`Falha no parsing GGUF: ${err?.message || err}`, 'err'));
        area.appendChild(callout('Verifique se o arquivo é GGUF válido. O parser lê apenas o header (orçamento de 32 MB) — nunca o corpo completo.', 'warn'));
      }
    };
  }

  /* ---------- Quantização ---------- */
  function renderQuant(box) {
    box.appendChild(el('div', '', `<h1>Quantizador</h1><p class="sub">Identificação, estimativa e planejamento. Conversão efetiva requer runtime externo — arquivo original sempre preservado.</p>`));
    const form = el('div', 'form-row', `
      <label>Tamanho do arquivo (GB)</label>
      <input type="number" id="q-size" value="4.68" step="0.01" min="0.01">
      <label>Quantização de origem</label>
      <select id="q-from"></select>
      <label>Estimativa de destino</label>
      <select id="q-to" multiple size="8" style="height:auto;min-height:170px"></select>`);
    const fromSel = form.querySelector('#q-from');
    const toSel = form.querySelector('#q-to');
    for (const q of FGUA.quantizer.QUANT_TABLE) {
      fromSel.appendChild(new Option(q.label, q.label));
      toSel.appendChild(new Option(`${q.label} (${q.bitsPerWeight} bpw aprox.)`, q.label));
    }
    fromSel.value = 'F16';
    toSel.selectedOptions && (toSel.querySelector('option') && null);
    box.appendChild(form);
    const btn = el('button', 'btn primary', `${icon('i-chart')} Estimar`);
    const out = el('div', '');
    box.append(btn, out);

    btn.onclick = async () => {
      const sizeBytes = Number(form.querySelector('#q-size').value) * 1024 ** 3;
      const targets = [...toSel.selectedOptions].map(o => o.value);
      const r = await router.route('/api/v1/quantization/estimate', { method: 'POST', payload: { sizeBytes, quantFrom: fromSel.value, targets } });
      out.innerHTML = '';
      if (!r.ok) { out.appendChild(callout(r.error, 'err')); return; }
      out.appendChild(el('p', '', `Estado: ${stateBadge(r.state)} · parâmetros estimados: <b>${r.data.paramsHuman}</b>`));
      out.appendChild(table(['Quantização', 'Tamanho estimado', 'Economia vs. original'], r.data.targets.map(t => [t.quant, t.sizeHuman, t.savingPct != null ? `${t.savingPct}%` : '—'])));
      const planBtn = el('button', 'btn', `${icon('i-play')} Gerar plano de conversão (${fromSel.value} → Q4_K_M)`);
      planBtn.onclick = async () => {
        const pr = await router.route('/api/v1/quantization/plan', { method: 'POST', payload: { quantFrom: fromSel.value, quantTo: 'Q4_K_M', sizeBytes } });
        out.innerHTML = '';
        out.appendChild(el('p', '', `Estado: ${stateBadge(pr.state)} ${pr.data?.originalPreservado ? '· <b>arquivo original preservado</b>' : ''}`));
        out.appendChild(callout(pr.data?.comandoSugerido ?? '', 'warn'));
        out.appendChild(jsonView(pr.data));
      };
      out.appendChild(planBtn);
    };
  }

  /* ---------- Runtimes ---------- */
  function renderRuntimes(box) {
    box.appendChild(el('div', '', `<h1>Runtimes IA (WebGPU + WebGL + WASM)</h1><p class="sub">TensorFlow.js e Transformers.js carregados sob demanda via CDN. Sem simulação: falha vira estado explícito.</p>`));
    const caps = FGUA.get('caps');
    box.appendChild(table(['Engine', 'Status', 'Detalhe'], [
      ['WebGPU', caps.webgpu?.supported ? 'Disponível' : 'Indisponível', caps.webgpu?.adapter?.vendor ?? caps.webgpu?.motivo ?? '—'],
      ['WebGL 2', caps.webgl2?.supported ? 'Disponível' : 'Indisponível', caps.webgl2?.renderer ?? '—'],
      ['WebGL', caps.webgl?.supported ? 'Disponível' : 'Indisponível', caps.webgl?.renderer ?? '—'],
      ['WebAssembly', caps.wasm?.supported ? 'Disponível' : 'Indisponível', caps.wasm?.simd ? 'com SIMD' : 'sem SIMD'],
      ['WebCodecs', caps.webcodecs?.videoEncoder ? 'Disponível' : 'Indisponível', 'vídeo/áudio de baixo nível']
    ]));

    const rowTf = el('div', 'cards', `
      <div class="card" id="tf-card">
        <h4>TensorFlow.js (@tensorflow/tfjs)</h4>
        <p class="sub">Backend preferido: WebGL → CPU. WebGPU quando o suporte do navegador permitir.</p>
        <div style="margin-top:10px;display:flex;gap:8px" id="tf-actions"><button class="btn primary" id="tf-load">Carregar runtime</button></div>
        <div id="tf-out" style="margin-top:10px"></div>
      </div>
      <div class="card" id="tr-card">
        <h4>Transformers.js (Hugging Face)</h4>
        <p class="sub">Pipelines reais do HF Hub (device: webgpu quando possível, senão wasm). Modelos baixados sob demanda.</p>
        <div style="margin-top:10px;display:flex;gap:8px"><button class="btn primary" id="tr-load">Carregar runtime</button></div>
        <div id="tr-out" style="margin-top:10px"></div>
      </div>`);
    box.appendChild(rowTf);

    rowTf.querySelector('#tf-load').onclick = async () => {
      const out = rowTf.querySelector('#tf-out');
      out.innerHTML = 'Carregando…';
      const r = await FGUA.runtime.tfjs.load();
      out.innerHTML = r.ok
        ? callout(`TF.js pronto — backend: <b>${r.data.backend}</b>. Backends disponíveis: ${(r.data.backendsDisponiveis ?? []).join(', ')}`, '')
        : callout(r.error + (r.hint ? `<br>${r.hint}` : ''), 'warn');
    };
    rowTf.querySelector('#tr-load').onclick = async () => {
      const out = rowTf.querySelector('#tr-out');
      out.innerHTML = 'Carregando…';
      const r = await FGUA.runtime.transformers.load();
      out.innerHTML = r.ok
        ? callout(`Transformers.js pronto — device: <b>${r.data.device}</b> (versão ${r.data.version})`, '')
        : callout(r.error, 'warn');
    };

    box.appendChild(el('h2', '', 'Teste real (quando runtime carregado)'));
    const testBtn = el('button', 'btn', `${icon('i-play')} Teste de sentimento (Transformers.js)`);
    const tOut = el('div', '');
    box.append(testBtn, tOut);
    testBtn.onclick = async () => {
      tOut.innerHTML = 'Criando pipeline… (baixa modelo do HF Hub na 1ª execução)';
      const p = await FGUA.runtime.transformers.pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
      if (!p.ok) { tOut.innerHTML = ''; tOut.appendChild(callout(p.error, 'warn')); return; }
      const r = await FGUA.runtime.transformers.infer(p.data.pipeline, 'I love using this API!');
      tOut.innerHTML = r.ok ? jsonView(r.data) : '';
      if (!r.ok) tOut.appendChild(callout(r.error, 'err'));
    };
  }

  /* ---------- Analisados ---------- */
  async function renderRegistrados(box) {
    box.appendChild(el('div', '', `<h1>Modelos Analisados</h1><p class="sub">Registrados localmente após parsing GGUF (IndexedDB/localStorage — nunca sai do navegador).</p>`));
    const r = await router.route('/api/v1/models/list');
    const custom = r.data?.analisados ?? [];
    if (!custom.length) { box.appendChild(el('div', 'empty', `${icon('i-file')}<span>Nenhum modelo analisado ainda. Use a aba "Carregar .GGUF".</span>`)); return; }
    box.appendChild(table(['Nome', 'Arquitetura', 'Quantização', 'Tensores', 'Parâmetros', 'Tamanho'], custom.map(m => [
      m.name, m.arch ?? '—', m.quantization ?? '—', m.tensorsCount ?? '—',
      m.paramsEstimate ? (m.paramsEstimate / 1e9).toFixed(2) + 'B' : '—', m.fileSizeHuman ?? '—'
    ])));
    const clr = el('button', 'btn danger', `${icon('i-trash')} Limpar lista`);
    clr.onclick = () => { const s = FGUA.get('store'); s.set('fgua.models', 'custom', []); box.innerHTML = ''; renderRegistrados(box); };
    box.appendChild(clr);
  }

  return root;
}

export default { mount };
