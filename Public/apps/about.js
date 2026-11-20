/**
 * FGUA v2 — Sobre o sistema.
 */

import { el, icon, callout } from './common.js';

export function mount(FGUA) {
  const root = el('div', 'app');
  const main = el('div', 'app-main');
  root.appendChild(main);
  const snap = FGUA.snapshot();
  const caps = FGUA.get('caps');
  main.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px">
      <svg style="width:56px;height:56px"><use href="../assets/icons.svg#i-win"/></svg>
      <div><h1 style="margin:0">Frame-Generator-API</h1><p class="sub" style="margin:2px 0 0">FGUA v2.0.0 — núcleo web modular · shell Windows 11 · contrato /api/v1</p></div>
    </div>
    <p>Um sistema operacional web completo para análise de modelos de IA (.GGUF), quantização (estimativa/plano),
    geração e aprimoramento de quadros (jogos, imagem, vídeo) e integração com LM Studio — 100% no navegador,
    hospedado como site estático.</p>
    <h2>Sessão</h2>
    <div class="kv"><span>Usuário</span><b>${snap.session?.name ?? '—'}</b></div>
    <div class="kv"><span>Papel</span><b>${snap.session?.role ?? '—'}</b></div>
    <div class="kv"><span>Modo</span><b>${snap.mode}</b></div>
    <div class="kv"><span>Bootado em</span><b>${snap.bootedAt ?? '—'}</b></div>
    <h2>Ambiente</h2>
    <div class="kv"><span>WebGPU</span><b>${caps.webgpu?.supported ? 'Disponível' : 'Ausente'}</b></div>
    <div class="kv"><span>WebGL 2</span><b>${caps.webgl2?.supported ? 'Disponível' : 'Ausente'}</b></div>
    <div class="kv"><span>WASM SIMD</span><b>${caps.wasm?.simd ? 'Sim' : 'Não'}</b></div>
    <div class="kv"><span>WebCodecs</span><b>${caps.webcodecs?.videoEncoder ? 'Sim' : 'Não'}</b></div>
    <h2>Créditos e licença</h2>`;
  main.appendChild(callout('MIT License © kauan11-boop — veja LICENSE. Tecnologias: GGUF (ggml-org), TensorFlow.js, Transformers.js (Hugging Face), LM Studio API (OpenAI-compat + REST v1/v0), Fluent Design (Microsoft).'));
  return root;
}

export default { mount };
