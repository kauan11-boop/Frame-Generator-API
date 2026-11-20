/**
 * FGUA v2 — Terminal FGUA (CLI completa multi-ferramenta).
 * Um comando acessa todo o contrato /api/v1 + runtime + repacks.
 */

import { el } from './common.js';

export function mount(FGUA) {
  const root = el('div', 'term');
  const out = el('div', 'term-out');
  const inRow = el('div', 'term-in');
  const ps = el('span', 'ps', 'FGUA v2 ›');
  const input = el('input');
  input.autocomplete = 'off';
  input.spellcheck = false;
  inRow.append(ps, input);
  root.append(out, inRow);

  const router = FGUA.get('router');
  const security = FGUA.get('security');
  const settings = FGUA.get('settings');
  const hist = [];
  let hIdx = -1;

  const print = (html, cls = '') => { const d = el('div', cls, html); out.appendChild(d); out.scrollTop = out.scrollHeight; };
  const esc = s => { const d = el('div'); d.textContent = String(s); return d.innerHTML; };

  print(`<span class="info">Frame-Generator-API v2.0.0 — Terminal</span>`);
  print(`<span class="dim">Contrato /api/v1 · modo ${settings.mode} · digite "help" para os comandos.</span>`);

  const HELP = [
    ['help', 'lista os comandos'],
    ['status', 'estado do sistema (system/health)'],
    ['mode <demo|local|remote>', 'define o modo de operação'],
    ['api <endpoint> [json]', 'chama o contrato (ex.: api /api/v1/system/info)'],
    ['models [list|get <id>]', 'catálogo de modelos'],
    ['gguf', 'abre seletor e analisa um .gguf (metadados reais)'],
    ['quant <sizeGB> <quantFrom> <quantTo>', 'estimativa de quantização'],
    ['gen <jogos|imagem|video> [json]', 'plano de geração de quadros'],
    ['budget <w> <h> <fps> [fpsMedido]', 'orçamento de pixels'],
    ['runtime [detect|tfjs|transformers]', 'capacidades e runtimes'],
    ['repack <list|install <id>>', 'repacks multi-ferramenta'],
    ['lmstudio <health|models|chat "msg">', 'LM Studio (modo local)'],
    ['users [list|whoami]', 'usuários e sessão'],
    ['jobs [list|create <genero>]', 'trabalhos planejados'],
    ['fs <ls|read|write> <caminho> [texto]', 'sistema de arquivos virtual'],
    ['notify <msg>', 'dispara notificação'],
    ['open <app>', 'abre aplicativo (explorer, models, frames…)'],
    ['clear', 'limpa o terminal']
  ];

  async function run(line) {
    const parts = line.trim().split(/\s+/);
    const cmd = (parts[0] ?? '').toLowerCase();
    const rest = parts.slice(1);

    try {
      switch (cmd) {
        case '': return;
        case 'help':
          print(HELP.map(([c, d]) => `  <span class="cmd">${c.padEnd(38, ' ')}</span><span class="dim">${d}</span>`).join('\n'));
          return;
        case 'clear': out.innerHTML = ''; return;
        case 'ver':
        case 'version': print('FGUA v2.0.0 (Frame-Generator-API) — contrato /api/v1'); return;
        case 'status': {
          const r = await router.route('/api/v1/system/health');
          print(`<span class="cmd">system/health</span> → ${r.state}`);
          for (const [k, v] of Object.entries(r.data ?? {})) print(`  ${k.padEnd(12)} <span class="${v === 'ready' ? 'ok' : v === 'unavailable' ? 'err' : 'warn'}">${v}</span>`);
          return;
        }
        case 'mode': {
          const m = rest[0];
          if (!m) { print(`modo atual: <span class="info">${settings.mode}</span>`); return; }
          const r = router.setMode(m);
          print(r.ok ? `modo definido para <span class="ok">${m}</span>` : `<span class="err">${esc(r.error)}</span>`);
          return;
        }
        case 'api': {
          if (!rest[0]) { print('<span class="err">uso: api <endpoint> [payload json]</span>'); return; }
          let payload = null;
          if (rest[1]) { try { payload = JSON.parse(rest.slice(1).join(' ')); } catch { print('<span class="err">payload não é JSON válido</span>'); return; } }
          const r = await router.route(rest[0], { method: payload ? 'POST' : 'GET', payload });
          print(`<span class="cmd">${esc(rest[0])}</span> → estado <span class="${r.ok ? 'ok' : 'err'}">${r.state}</span> (${r.meta?.elapsedMs ?? '?'} ms)`);
          print(`<span class="dim">${esc(JSON.stringify(r.data ?? r.error, null, 2))}</span>`);
          return;
        }
        case 'models': {
          if (rest[0] === 'get' && rest[1]) {
            const r = await router.route('/api/v1/models/get', { method: 'POST', payload: { id: rest[1] } });
            print(r.ok ? esc(JSON.stringify(r.data, null, 2)) : `<span class="err">${esc(r.error)}</span>`);
            return;
          }
          const r = await router.route('/api/v1/models/list');
          for (const m of r.data?.builtin ?? []) print(`  ${esc(m.id.padEnd(34))} <span class="dim">${esc(`${m.params} · ${m.quantization} · ${m.sizeGB} GB · ${m.state}`)}</span>`);
          if (r.data?.analisados?.length) print(`  <span class="info">analisados localmente: ${r.data.analisados.map(m => esc(m.name)).join(', ')}</span>`);
          return;
        }
        case 'gguf': {
          const f = await pickGGUF();
          if (!f) { print('<span class="dim">cancelado</span>'); return; }
          print(`analisando <span class="info">${esc(f.name)}</span> (${(f.size / 1024 / 1024).toFixed(1)} MB) — lendo header GGUF…`);
          const r = await FGUA.gguf.parseBlob(f);
          print(`  magic=${r.magic} versão=${r.version} arquitetura=<span class="info">${esc(r.arch ?? '?')}</span>`);
          print(`  quant=<span class="ok">${esc(r.fileTypeLabel ?? '?')}</span> tensores=${r.tensorsCount} kv=${r.kvCount} params≈${r.estimatedWeights ? (r.estimatedWeights / 1e9).toFixed(2) + 'B' : '?'}`);
          return;
        }
        case 'quant': {
          const [sizeGB, from, to] = rest;
          if (!sizeGB || !from || !to) { print('<span class="err">uso: quant <sizeGB> <quantFrom> <quantTo></span>'); return; }
          const r = await router.route('/api/v1/quantization/estimate', { method: 'POST', payload: { sizeBytes: Number(sizeGB) * 1024 ** 3, quantFrom: from, targets: [to] } });
          print(`estado <span class="${r.ok ? 'ok' : 'err'}">${r.state}</span> — ${esc(JSON.stringify(r.data?.targets?.[0] ?? r.error))}`);
          return;
        }
        case 'gen': {
          const genre = rest[0] ?? 'jogos';
          let params = {};
          if (rest[1]) { try { params = JSON.parse(rest.slice(1).join(' ')); } catch { print('<span class="err">params não é JSON</span>'); return; } }
          const r = await router.route('/api/v1/generators/plan', { method: 'POST', payload: { genre, params } });
          print(`<span class="cmd">${esc(genre)}</span> → estado <span class="warn">${r.state}</span>`);
          for (const s of r.data?.steps ?? []) print(`  ${s.seq}. ${esc(s.label)} <span class="${s.state === 'succeeded' ? 'ok' : 'warn'}">[${s.state}]</span>`);
          print(`<span class="dim">${esc(r.data?.aviso ?? '')}</span>`);
          return;
        }
        case 'budget': {
          const [w, h, fps, medido] = rest.map(Number);
          const r = await router.route('/api/v1/frames/budget', { method: 'POST', payload: { width: w, height: h, fpsAlvo: fps, fpsMedido: medido } });
          const d = r.data ?? {};
          print(`pixels/quadro=${esc(d.pixelsPorQuadro)} escala=${esc(d.escalaRecomendadaPct)}% interna=${esc(JSON.stringify(d.resolucaoInternaRecomendada))}`);
          print(`<span class="dim">${esc(d.motivo ?? r.error ?? '')}</span>`);
          return;
        }
        case 'runtime': {
          const sub = rest[0] ?? 'detect';
          if (sub === 'detect') {
            const r = await router.route('/api/v1/engines/detect');
            for (const e of r.data?.engines ?? []) print(`  ${e.ok ? '<span class="ok">✔</span>' : '<span class="err">✖</span>'} ${esc(e.label.padEnd(14))} <span class="dim">${esc(e.detalhe ?? '')}</span>`);
          } else if (sub === 'tfjs') {
            const r = await FGUA.runtime.tfjs.load();
            print(r.ok ? `TF.js pronto: backend <span class="ok">${esc(r.data.backend)}</span>` : `<span class="err">${esc(r.error)}</span>`);
          } else if (sub === 'transformers') {
            const r = await FGUA.runtime.transformers.load();
            print(r.ok ? `Transformers.js pronto: device <span class="ok">${esc(r.data.device)}</span>` : `<span class="err">${esc(r.error)}</span>`);
          } else print('<span class="err">uso: runtime [detect|tfjs|transformers]</span>');
          return;
        }
        case 'repack': {
          if (rest[0] === 'install' && rest[1]) {
            print(`executando repack <span class="info">${esc(rest[1])}</span>…`);
            const r = await router.route('/api/v1/repack/install', { method: 'POST', payload: { id: rest[1] } });
            print(`estado final <span class="${r.ok ? 'ok' : 'warn'}">${r.state}</span> (${r.data?.elapsedMs ?? '?'} ms)`);
            for (const s of r.data?.steps ?? []) print(`  ${s.seq}. ${esc(s.label)} <span class="${s.ok ? 'ok' : s.state === 'requires-runtime' || s.state === 'requires-provider' ? 'warn' : 'err'}">[${s.state}]</span>${s.error ? ` <span class="err">${esc(s.error)}</span>` : ''}`);
            return;
          }
          const r = await router.route('/api/v1/repack/list');
          for (const p of r.data?.repacks ?? []) print(`  ${esc(p.id.padEnd(20))} <span class="dim">${esc(p.description)}</span>`);
          return;
        }
        case 'lmstudio': {
          const sub = rest[0] ?? 'health';
          const ls = router.lmstudio;
          if (sub === 'health') {
            const r = await ls.health();
            print(r.ok ? `LM Studio <span class="ok">online</span> em ${esc(r.data.baseUrl)} (${r.data.models} modelos)` : `<span class="err">offline</span> — ${esc(r.error ?? '')} ${esc(r.hint ?? '')}`);
          } else if (sub === 'models') {
            const r = await ls.listModelsNative();
            if (!r.ok) { print(`<span class="err">${esc(r.error ?? '')}</span> <span class="dim">${esc(r.hint ?? '')}</span>`); return; }
            const models = r.data.models ?? r.data.data ?? [];
            for (const m of models) print(`  ${esc(String(m.id).padEnd(40))} <span class="dim">${esc(`${m.state ?? ''} ${m.quantization ?? ''}`)}</span>`);
          } else if (sub === 'chat') {
            const msg = line.slice(line.indexOf('chat') + 4).trim().replace(/^["']|["']$/g, '');
            const models = await ls.listModelsOpenAI();
            const first = models.ok ? models.data?.data?.[0]?.id : null;
            if (!first) { print(`<span class="err">nenhum modelo disponível no LM Studio</span>`); return; }
            print(`chat com <span class="info">${esc(first)}</span>…`);
            const r = await ls.chat({ model: first, messages: [{ role: 'user', content: msg || 'Olá!' }] });
            print(r.ok ? esc(r.data?.choices?.[0]?.message?.content ?? JSON.stringify(r.data)) : `<span class="err">${esc(r.error ?? '')}</span>`);
          } else print('<span class="err">uso: lmstudio <health|models|chat "msg"></span>');
          return;
        }
        case 'users': {
          if (rest[0] === 'whoami') { print(esc(JSON.stringify(security.session(), null, 2))); return; }
          const r = security.listUsers();
          for (const u of r.data ?? []) print(`  ${esc(u.id.padEnd(14))} ${esc(u.role.padEnd(10))} <span class="dim">${u.comSenha ? 'com senha' : 'sem senha'}</span>`);
          return;
        }
        case 'jobs': {
          if (rest[0] === 'create') {
            const r = await router.route('/api/v1/jobs/create', { method: 'POST', payload: { titulo: 'Job do terminal', genero: rest[1] ?? 'jogos' } });
            print(`job <span class="info">${esc(r.data?.id ?? '')}</span> criado (estado: ${r.state})`);
            return;
          }
          const r = await router.route('/api/v1/jobs/list');
          if (!r.data?.jobs.length) { print('<span class="dim">nenhum job</span>'); return; }
          for (const j of r.data.jobs) print(`  ${esc(j.id.padEnd(16))} ${esc(j.genero.padEnd(8))} <span class="warn">${esc(j.state)}</span>`);
          return;
        }
        case 'fs': {
          const [op, ...p] = rest;
          const path = p[0] ?? '/';
          if (op === 'ls') {
            const r = await router.route('/api/v1/storage/ls', { method: 'POST', payload: { path } });
            if (!r.ok) { print(`<span class="err">${esc(r.error)}</span>`); return; }
            for (const c of r.data.children) print(`  ${c.type === 'dir' ? '<span class="info">dir </span>' : 'file'} ${esc(c.name)}`);
          } else if (op === 'read') {
            const r = await router.route('/api/v1/storage/read', { method: 'POST', payload: { path } });
            print(r.ok ? esc(r.data) : `<span class="err">${esc(r.error)}</span>`);
          } else if (op === 'write') {
            const r = await router.route('/api/v1/storage/write', { method: 'POST', payload: { path, content: p.slice(1).join(' ') } });
            print(r.ok ? `<span class="ok">escrito:</span> ${esc(r.data.path)} (${r.data.size} B)` : `<span class="err">${esc(r.error)}</span>`);
          } else print('<span class="err">uso: fs <ls|read|write> <caminho> [texto]</span>');
          return;
        }
        case 'notify': {
          FGUA.get('bus').notify('Terminal', rest.join(' ') || 'Olá do terminal!', 'info');
          return;
        }
        case 'open': {
          const map = { explorer: 'explorer', models: 'models', frames: 'frames', terminal: 'terminal', api: 'apiconsole', repacks: 'repacks', users: 'users', settings: 'settings', docs: 'docs', installer: 'installer', dashboard: 'dashboard', about: 'about' };
          const id = map[rest[0]];
          if (!id) { print('<span class="err">uso: open <explorer|models|frames|api|repacks|users|settings|docs|installer|dashboard></span>'); return; }
          window.dispatchEvent(new CustomEvent('fgua:open-app', { detail: { id } }));
          print(`abrindo <span class="info">${esc(id)}</span>…`);
          return;
        }
        default:
          print(`<span class="err">comando desconhecido: ${esc(cmd)}</span> — digite <span class="cmd">help</span>`);
      }
    } catch (err) {
      print(`<span class="err">erro: ${esc(err?.message || err)}</span>`);
    }
  }

  function pickGGUF() {
    return new Promise(resolve => {
      const inp = el('input');
      inp.type = 'file'; inp.accept = '.gguf'; inp.style.display = 'none';
      inp.onchange = () => { resolve(inp.files[0] ?? null); inp.remove(); };
      document.body.appendChild(inp); inp.click();
    });
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const line = input.value;
      print(`<span class="cmd">FGUA v2 › ${esc(line)}</span>`);
      if (line.trim()) { hist.push(line); hIdx = hist.length; run(line); }
      input.value = '';
    } else if (e.key === 'ArrowUp') {
      if (hIdx > 0) { hIdx--; input.value = hist[hIdx] ?? ''; e.preventDefault(); }
    } else if (e.key === 'ArrowDown') {
      if (hIdx < hist.length - 1) { hIdx++; input.value = hist[hIdx] ?? ''; } else { hIdx = hist.length; input.value = ''; }
      e.preventDefault();
    }
  });
  setTimeout(() => input.focus(), 150);

  return root;
}

export default { mount };
