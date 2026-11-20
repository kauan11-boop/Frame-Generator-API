/**
 * FGUA v2 — Dashboard (iframe do dashboard standalone).
 */

import { el } from './common.js';

export function mount(FGUA) {
  const root = el('div', 'app');
  root.style.flexDirection = 'column';
  const f = el('iframe');
  f.style.cssText = 'flex:1;border:0;width:100%;background:var(--win-bg)';
  f.src = '../dashboard.html';
  f.setAttribute('title', 'Dashboard FGUA');
  root.appendChild(f);
  return root;
}

export default { mount };
