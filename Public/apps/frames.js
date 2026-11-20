/**
 * FGUA v2 — Gerador de Quadros: 1 API para vários gêneros (jogos, imagem, vídeo).
 * Controlador de pixels por desempenho medido + planos com estados explícitos.
 */

import { el, icon, stateBadge, table, callout, jsonView, pickFile, bytes } from './common.js';

export function mount(FGUA) {
  const router = FGUA.get('router');
  const root = el('div', 'app');
  const side = el('div', 'app-side', `<div class="brand">${icon('i-film')} Gerador de Quadros</div>`);
  const main = el('div', 'app-main');
  root.append(side, main);

  const pages = {
    jogos: { label: 'Jogos (fps)', ico: 'i-play', render: renderJogos },
    imagem: { label: 'Imagem (foto)', ico: 'i-upload', render: renderImagem },
    video: { label: 'Vídeo (.mp4)', ico: 'i-film', render: renderVideo },
    perf: { label: 'Desempenho', ico: 'i-chart', render: renderPerf },
    jobs: { label: 'Jobs', ico: 'i-clock', render: renderJobs }
  };
  let current = 'jogos';
  function select(k) {
    current = k;
    side.querySelectorAll('.side-item').forEach(x => x.classList.toggle('sel', x.dataset.k === k));
    main.innerHTML = '';
    pages[k].render(main);
  }
  for (const [k, p] of Object.entries(pages)) {
    const n = el('div', 'side-item', `${icon(p.ico)}${p.label}`);
    n.dataset.k = k;
    n.onclick = () => select(k);
    side.appendChild(n);
  }
  select('jogos');

  /* ---------- Jogos ---------- */
  function renderJogos(box) {
    box.appendChild(el('div', '', `<h1>Quadros para Jogos</h1><p class="sub">Planeja interpolação de quadros (ex.: 30→120 fps). Não intercepta pipeline gráfico — apenas integrações autorizadas.</p>`));
    const form = el('div', 'form-row', `
      <label>FPS de origem</label>
      <select id="g-from"><option>30</option><option selected>60</option><option>90</option><option>120</option></select>
      <label>FPS alvo</label>
      <select id="g-to"><option>60</option><option>90</option><option selected>120</option><option>144</option><option>240</option></select>
      <label>Resolução base</label>
      <select id="g-res"><option value="1280x720">1280×720</option><option value="1920x1080" selected>1920×1080</option><option value="2560x1440">2560×1440</option><option value="3840x2160">3840×2160</option></select>`);
    box.appendChild(form);
    const btn = el('button', 'btn primary', `${icon('i-play')} Gerar plano`);
    const out = el('div');
    box.append(btn, out);
    btn.onclick = async () => {
      const [w, h] = form.querySelector('#g-res').value.split('x').map(Number);
      const r = await router.route('/api/v1/frames/plan', { method: 'POST', payload: {
        genre: 'jogos', params: { fpsOrigem: Number(form.querySelector('#g-from').value), fpsAlvo: Number(form.querySelector('#g-to').value), base: { width: w, height: h } }
      }});
      out.innerHTML = '';
      if (!r.ok) { out.appendChild(callout(r.error, 'err')); return; }
      out.appendChild(el('p', '', `Estado: ${stateBadge(r.state)} · engines disponíveis: <b>${r.data.engines.disponiveis.join(', ') || '—'}</b>`));
      const d = await router.route('/api/v1/frames/budget', { method: 'POST', payload: { width: w, height: h, fpsAlvo: Number(form.querySelector('#g-to').value) } });
      out.appendChild(el('h3', '', 'Orçamento de pixels'));
      out.appendChild(jsonView(d.data));
      out.appendChild(callout('Este plano define os passos; a execução real de interpolação exige runtime/engine conectada (estado requires-runtime).', 'warn'));
      const jobBtn = el('button', 'btn', `${icon('i-plus')} Registrar como job`);
      jobBtn.onclick = async () => {
        const j = await router.route('/api/v1/jobs/create', { method: 'POST', payload: { titulo: `Jogos ${form.querySelector('#g-from').value}→${form.querySelector('#g-to').value} fps`, genero: 'jogos', plano: r.data } });
        out.appendChild(callout(`Job <code>${j.data?.id}</code> criado (${j.state}).`));
      };
      out.appendChild(jobBtn);
    };
  }

  /* ---------- Imagem ---------- */
  function renderImagem(box) {
    box.appendChild(el('div', '', `<h1>Aprimoramento de Fotos</h1><p class="sub">Análise real da imagem no cliente + plano de upscaling. Sem simulação de resultado.</p>`));
    const btn = el('button', 'btn primary', `${icon('i-upload')} Selecionar imagem (PNG/JPG/WebP)`);
    const out = el('div');
    box.append(btn, out);
    btn.onclick = async () => {
      const f = await pickFile({ accept: 'image/*' });
      if (!f) return;
      out.innerHTML = '';
      const r = await router.route('/api/v1/images/probe', { method: 'POST', payload: { file: f } });
      // probe real direto pelo planner (o roteador não recebe File)
      const probe = await FGUA.get('router').planner.probeImage(f);
      if (!probe.ok) { out.appendChild(callout(probe.error, 'err')); return; }
      const d = probe.data;
      out.appendChild(el('div', 'cards', `
        <div class="card"><h4>${d.name}</h4>
          <div class="kv"><span>Dimensões</span><b>${d.width}×${d.height}</b></div>
          <div class="kv"><span>Pixels</span><b>${d.pixels.toLocaleString('pt-BR')}</b></div>
          <div class="kv"><span>Tamanho</span><b>${bytes(d.sizeBytes)}</b></div>
          <div style="margin-top:10px">${stateBadge('analyzed')}</div></div>`));
      const scale = el('div', 'form-row', `
        <label>Fator de escala desejado</label>
        <select id="i-scale"><option>1.5</option><option selected>2</option><option>3</option><option>4</option></select>`);
      out.appendChild(scale);
      const planBtn = el('button', 'btn', `${icon('i-chart')} Gerar plano de aprimoramento`);
      planBtn.onclick = async () => {
        const p = await router.route('/api/v1/images/plan', { method: 'POST', payload: { params: { fatoresEscala: Number(scale.querySelector('#i-scale').value) } } });
        out.appendChild(el('h3', '', 'Plano'));
        out.appendChild(jsonView(p.data));
        out.appendChild(callout('Para upscaling REAL, carregue Transformers.js no Hub de Modelos (Runtimes) e conecte um modelo compatível; o navegador não inventa pixels.', 'warn'));
      };
      out.appendChild(planBtn);
    };
  }

  /* ---------- Vídeo ---------- */
  function renderVideo(box) {
    box.appendChild(el('div', '', `<h1>Melhoria de Filmes e Séries (.mp4)</h1><p class="sub">Sonda real de metadados via navegador + plano de pipeline. Processamento pesado fica para runtime externo.</p>`));
    const btn = el('button', 'btn primary', `${icon('i-upload')} Selecionar vídeo (.mp4/.webm)`);
    const out = el('div');
    box.append(btn, out);
    btn.onclick = async () => {
      const f = await pickFile({ accept: 'video/*' });
      if (!f) return;
      out.innerHTML = 'Sondando vídeo…';
      const probe = await FGUA.get('router').planner.probeVideo(f);
      out.innerHTML = '';
      if (!probe.ok) { out.appendChild(callout(probe.error, 'err')); return; }
      const d = probe.data;
      out.appendChild(el('div', 'cards', `
        <div class="card"><h4>${d.name}</h4>
          <div class="kv"><span>Duração</span><b>${d.durationS ?? '—'} s</b></div>
          <div class="kv"><span>Resolução</span><b>${d.width ?? '—'}×${d.height ?? '—'}</b></div>
          <div class="kv"><span>Tamanho</span><b>${d.sizeHuman}</b></div>
          <div style="margin-top:10px">${stateBadge('analyzed')}</div></div>`));
      const form = el('div', 'form-row', `
        <label>FPS alvo</label>
        <select id="v-fps"><option>24</option><option>30</option><option selected>60</option><option>120</option></select>
        <label>Escala</label>
        <select id="v-scale"><option value="1">1× (manter)</option><option value="1.5">1.5×</option><option value="2">2×</option></select>`);
      out.appendChild(form);
      const pBtn = el('button', 'btn', `${icon('i-chart')} Gerar plano`);
      pBtn.onclick = async () => {
        const p = await router.route('/api/v1/videos/plan', { method: 'POST', payload: { params: { fpsAlvo: Number(form.querySelector('#v-fps').value), fatoresEscala: Number(form.querySelector('#v-scale').value) } } });
        out.appendChild(jsonView(p.data));
        out.appendChild(callout('Aprimoramento real de vídeo usa WebCodecs/pipeline externo; aqui o plano fica registrado como job (estado planned).', 'warn'));
        const j = await router.route('/api/v1/jobs/create', { method: 'POST', payload: { titulo: `Vídeo ${d.name} → ${form.querySelector('#v-fps').value} fps`, genero: 'video', plano: p.data } });
        out.appendChild(callout(`Job <code>${j.data?.id}</code> criado.`));
      };
      out.appendChild(pBtn);
    };
  }

  /* ---------- Desempenho ---------- */
  function renderPerf(box) {
    box.appendChild(el('div', '', `<h1>Desempenho medido (rAF)</h1><p class="sub">FPS real medido + controlador de pixels: gera mais quadros OU menos pixels — nunca estoura o orçamento.</p>`));
    const metrics = el('div', 'metrics', `
      <div class="metric"><div class="v" id="pf-fps">—</div><div class="l">FPS medido</div></div>
      <div class="metric"><div class="v" id="pf-min">—</div><div class="l">FPS mínimo</div></div>
      <div class="metric"><div class="v" id="pf-max">—</div><div class="l">FPS máximo</div></div>
      <div class="metric"><div class="v" id="pf-scale">100%</div><div class="l">Escala recomendada</div></div>`);
    const canvas = el('canvas');
    canvas.style.cssText = 'width:100%;border-radius:8px;border:1px solid var(--divider);display:block;background:#000';
    const row = el('div', '', '');
    const startBtn = el('button', 'btn primary', `${icon('i-play')} Iniciar medição + cena de teste`);
    const stopBtn = el('button', 'btn', `Parar`);
    const fpsTarget = el('select', '', '<option>60</option><option selected>90</option><option>120</option><option>144</option>');
    const wrap = el('div', 'form-row', `<label>FPS alvo</label>`);
    wrap.appendChild(fpsTarget);
    row.append(startBtn, stopBtn, wrap);
    box.append(metrics, row, canvas, callout('A cena acima é uma renderização real (WebGL/canvas 2D) de partículas — serve para medir desempenho; não é "IA gerando quadros".'));

    let raf = null;
    const perf = FGUA.perf.shared;
    let ctrl = new FGUA.perf.PixelBudgetController({ fpsAlvo: 90 });
    let particles = [];
    let lastW = 0, lastH = 0, scale = 100;

    function resizeCanvas() {
      const w = canvas.clientWidth || 800;
      const h = Math.round(w * 0.45);
      canvas.width = Math.round(w * scale / 100);
      canvas.height = Math.round(h * scale / 100);
      lastW = canvas.width; lastH = canvas.height;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function scene() {
      const ctx = canvas.getContext('2d');
      const t = performance.now();
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!particles.length) {
        for (let i = 0; i < 160; i++) particles.push({ x: Math.random() * lastW, y: Math.random() * lastH, vx: (Math.random() - .5) * 90, vy: (Math.random() - .5) * 90, r: 1.5 + Math.random() * 3 });
      }
      const dt = 1 / 60;
      for (const p of particles) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0 || p.x > lastW) p.vx *= -1;
        if (p.y < 0 || p.y > lastH) p.vy *= -1;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, 'rgba(76,194,255,.9)');
        g.addColorStop(1, 'rgba(76,194,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = `${12 / (scale / 100)}px monospace`;
      ctx.fillText(`${canvas.width}×${canvas.height} @ ${scale}%`, 12, 20);
      raf = requestAnimationFrame(scene);
    }

    const tick = setInterval(() => {
      if (!perf.running) return;
      const s = perf.stats();
      metrics.querySelector('#pf-fps').textContent = s.fps ?? '—';
      metrics.querySelector('#pf-min').textContent = s.min ?? '—';
      metrics.querySelector('#pf-max').textContent = s.max ?? '—';
      ctrl.fpsAlvo = Number(fpsTarget.value);
      scale = ctrl.update(s.fps);
      metrics.querySelector('#pf-scale').textContent = `${scale}%`;
      resizeCanvas();
    }, 500);

    startBtn.onclick = () => {
      perf.start();
      if (!raf) raf = requestAnimationFrame(scene);
    };
    stopBtn.onclick = () => {
      perf.stop();
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      clearInterval(tick);
      const s = perf.stats();
      metrics.querySelector('#pf-fps').textContent = s.fps ?? '—';
    };
  }

  /* ---------- Jobs ---------- */
  async function renderJobs(box) {
    box.appendChild(el('div', '', `<h1>Jobs Planejados</h1><p class="sub">Trabalhos registrados a partir de planos. Estados: planned → cancelled/failed/succeeded.</p>`));
    const r = await router.route('/api/v1/jobs/list');
    const jobs = r.data?.jobs ?? [];
    if (!jobs.length) { box.appendChild(el('div', 'empty', `${icon('i-clock')}<span>Nenhum job. Gere um plano nas abas de gênero.</span>`)); return; }
    box.appendChild(table(['ID', 'Título', 'Gênero', 'Estado', 'Ação'], jobs.map(j => [
      `<code>${j.id}</code>`, j.titulo, j.genero, stateBadge(j.state),
      `<button class="btn" data-cancel="${j.id}">Cancelar</button>`
    ])));
    box.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
      await router.route('/api/v1/jobs/cancel', { method: 'POST', payload: { id: b.dataset.cancel } });
      box.innerHTML = '';
      renderJobs(box);
    });
  }

  return root;
}

export default { mount };
