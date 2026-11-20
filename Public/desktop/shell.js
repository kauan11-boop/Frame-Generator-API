/**
 * FGUA v2 — Shell Windows 11 (pt-BR)
 * Boot → tela de bloqueio → desktop com taskbar, Start, Quick Settings,
 * Centro de Notificações, ícones e menu de contexto.
 */

import { initFGUA } from '../../src/shell/public-api.js';
import { WindowManager } from './wm.js';

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const icon = id => `<svg><use href="../assets/icons.svg#${id}"/></svg>`;

/* ================= registro de aplicativos ================= */
const APPS = [
  { id: 'explorer', title: 'Explorador de Arquivos', icon: 'i-folder', w: 960, h: 620, pinned: true, desk: false },
  { id: 'models', title: 'Hub de Modelos', icon: 'i-cube', w: 1000, h: 660, pinned: true, desk: true },
  { id: 'frames', title: 'Gerador de Quadros', icon: 'i-film', w: 1020, h: 680, pinned: true, desk: true },
  { id: 'apiconsole', title: 'Console da API', icon: 'i-plug', w: 980, h: 640, pinned: true, desk: false },
  { id: 'terminal', title: 'Terminal FGUA', icon: 'i-terminal', w: 880, h: 520, pinned: true, desk: true },
  { id: 'repacks', title: 'Gerenciador de Repacks', icon: 'i-box', w: 900, h: 600, pinned: true, desk: false },
  { id: 'installer', title: 'Instalador IA', icon: 'i-spark', w: 920, h: 640, pinned: true, desk: false },
  { id: 'users', title: 'Usuários e Permissões', icon: 'i-users', w: 860, h: 580, pinned: false, desk: false },
  { id: 'settings', title: 'Configurações', icon: 'i-gear', w: 940, h: 620, pinned: true, desk: false },
  { id: 'dashboard', title: 'Dashboard FGUA', icon: 'i-grid', w: 960, h: 640, pinned: true, desk: false },
  { id: 'docs', title: 'Documentação', icon: 'i-book', w: 1000, h: 660, pinned: true, desk: true },
  { id: 'about', title: 'Sobre o FGUA', icon: 'i-info', w: 640, h: 520, pinned: false, desk: false }
];

const recents = [];
function pushRecent(title, sub, appId) {
  recents.unshift({ title, sub, appId, at: Date.now() });
  if (recents.length > 8) recents.pop();
  renderRecents();
}
function renderRecents() {
  const box = $('#start-rec .rec-list');
  if (!box) return;
  box.innerHTML = recents.length
    ? recents.map(r => `<div class="rec-item" data-app="${r.appId}">${icon('i-clock')}<div class="txt"><span class="t">${r.title}</span><span class="s">${r.sub}</span></div></div>`).join('')
    : `<div class="rec-item"><div class="txt"><span class="s">Nenhuma atividade recente ainda</span></div></div>`;
  box.querySelectorAll('.rec-item[data-app]').forEach(x => x.onclick = () => openApp(x.dataset.app));
}

/* ================= inicialização ================= */
let FGUA = null;
let wm = null;
let session = null;
const qsState = { wifi: true, bluetooth: false, aviao: false, economia: false };
let volume = 70;
let brightness = 100;

async function boot() {
  // boot splash → lock
  await waitFor('dom');
  let snap;
  try {
    snap = await initFGUA();
    FGUA = window.FGUA;
  } catch (err) {
    showBootError(err);
    return;
  }
  applySettings();
  buildDesktop();
  buildTaskbar();
  buildStart();
  buildQuickSettings();
  buildNotifications();
  wireClock();
  wireLock();
  // pontes de eventos dos apps
  window.addEventListener('fgua:toast', e => { const d = e.detail ?? {}; toast(d.title ?? 'FGUA', d.message ?? '', d.tone ?? 'info'); });
  window.addEventListener('fgua:open-editor', e => {
    wm.open({ id: 'editor-' + Math.random().toString(36).slice(2, 7), title: (e.detail?.title ?? 'Editor') + ' — Editor', icon: 'i-file', w: 720, h: 520, content: e.detail.content });
  });
  window.addEventListener('fgua:open-app', e => { const id = e.detail?.id; if (id) openApp(id); });
  // simula boot real do "sistema operacional"
  await sleep(1100);
  $('#boot').classList.add('hidden');
  setTimeout(() => $('#boot')?.remove(), 500);
}

function showBootError(err) {
  $('#boot').innerHTML = `<div class="name">Falha na inicialização do FGUA</div>
    <div style="color:#ff99a4;font-size:13px;max-width:520px;text-align:center;font-family:var(--font)">${String(err?.message || err)}</div>
    <div style="color:#888;font-size:12px">Verifique se o site está sendo servido por HTTP (não file://) e recarregue.</div>`;
}

function applySettings() {
  const s = FGUA.get('settings');
  session = FGUA.get('security').session();
  document.documentElement.dataset.theme = s.theme ?? 'dark';
  const wp = s.wallpaper ?? 'bloom-dark';
  document.documentElement.style.setProperty('--wallpaper', `url('../assets/wallpapers/${wp}.svg')`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function waitFor(ev) { return Promise.resolve(); }

/* ================= desktop ================= */
function buildDesktop() {
  const wrap = $('#desktop-root');
  wm = new WindowManager($('#win-layer'), { onWindowsChanged: renderTaskbarApps });

  const deskApps = APPS.filter(a => a.desk);
  const box = $('#desktop-icons');
  for (const a of [{ id: 'explorer', title: 'Este Computador', icon: 'i-pc' }, ...deskApps]) {
    const d = el('div', 'desk-icon', `${icon(a.icon)}<span class="label">${a.title}</span>`);
    d.dataset.app = a.id;
    d.addEventListener('click', () => { box.querySelectorAll('.desk-icon').forEach(x => x.classList.remove('selected')); d.classList.add('selected'); });
    d.addEventListener('dblclick', () => openApp(a.id));
    box.appendChild(d);
  }

  wrap.addEventListener('click', e => {
    if (e.target === wrap || e.target.id === 'desktop-icons') {
      box.querySelectorAll('.desk-icon').forEach(x => x.classList.remove('selected'));
      closeFlyouts();
    }
  });

  // menu de contexto (estilo Win11)
  wrap.addEventListener('contextmenu', e => {
    if (e.target.closest('.win') || e.target.closest('#taskbar')) return;
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, [
      { ico: 'i-refresh', label: 'Atualizar', act: () => location.reload() },
      { sep: true },
      { ico: 'i-bright', label: 'Alterar papel de parede', act: cycleWallpaper },
      { ico: 'i-gear', label: 'Personalizar', act: () => openApp('settings', { page: 'person' }) },
      { sep: true },
      { ico: 'i-terminal', label: 'Abrir Terminal', act: () => openApp('terminal') },
      { ico: 'i-info', label: 'Sobre o FGUA', act: () => openApp('about') }
    ]);
  });
}

function cycleWallpaper() {
  const s = FGUA.get('settings');
  const list = ['bloom-dark', 'bloom-light'];
  s.wallpaper = list[(list.indexOf(s.wallpaper ?? 'bloom-dark') + 1) % list.length];
  document.documentElement.style.setProperty('--wallpaper', `url('../assets/wallpapers/${s.wallpaper}.svg')`);
  persist({ wallpaper: s.wallpaper });
  toast('Personalização', `Papel de parede: ${s.wallpaper}`, 'info');
}

function persist(patch) {
  const store = FGUA.get('store');
  const cur = store.get('fgua.config', 'settings-overrides', {});
  store.set('fgua.config', 'settings-overrides', { ...cur, ...patch });
}

function showCtxMenu(x, y, items) {
  hideCtxMenu();
  const m = el('div', 'ctx-menu');
  for (const it of items) {
    if (it.sep) { m.appendChild(el('div', 'sep')); continue; }
    const row = el('div', 'item', `<span class="ico">${icon(it.ico)}</span>${it.label}`);
    row.onclick = () => { hideCtxMenu(); it.act(); };
    m.appendChild(row);
  }
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, window.innerHeight - r.height - 56) + 'px';
  setTimeout(() => document.addEventListener('click', hideCtxMenu, { once: true }), 10);
}
function hideCtxMenu() { document.querySelectorAll('.ctx-menu').forEach(m => m.remove()); }

/* ================= taskbar ================= */
function buildTaskbar() {
  $('#tb-start').innerHTML = icon('i-win');
  $('#tb-start').onclick = () => toggleFlyout('#start');
  $('#tb-search').innerHTML = icon('i-search');
  $('#tb-search').onclick = () => { toggleFlyout('#start'); setTimeout(() => $('#start-search input')?.focus(), 120); };
  $('#tb-tray-icons').innerHTML = `<span class="tray-icons">${icon('i-bt')}${icon('i-wifi')}</span>`;
  $('#tb-tray-btn').onclick = () => toggleFlyout('#qs');
  $('#show-desk').onclick = () => { for (const w of wm.windows.values()) wm.minimize(w); };
}

function wireClock() {
  const c = $('#tb-clock');
  const upd = () => {
    const n = new Date();
    c.innerHTML = `<span>${n.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><span>${n.toLocaleDateString('pt-BR')}</span>`;
    const lc = $('#lock .clock');
    if (lc) lc.innerHTML = `<div class="h">${n.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div><div class="d">${n.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>`;
  };
  upd();
  setInterval(upd, 1000);
}

function openApp(id, opts = {}) {
  const def = APPS.find(a => a.id === id);
  if (!def) { toast('Erro', `App desconhecido: ${id}`, 'err'); return; }
  closeFlyouts();
  pushRecent(def.title, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), id);
  import(`../apps/${id}.js`)
    .then(mod => {
      const content = mod.mount(FGUA, opts);
      wm.open({ id, title: def.title, icon: def.icon, w: def.w, h: def.h, content });
    })
    .catch(err => {
      console.error(`[shell] app ${id} falhou:`, err);
      toast(def.title, `Falha ao abrir: ${err?.message || err}`, 'err');
    });
}

function renderTaskbarApps() {
  const box = $('#tb-apps');
  box.innerHTML = '';
  for (const rec of wm.windows.values()) {
    const b = el('button', 'tb-btn' + (rec.minimized ? '' : '') + (wm.focused === rec ? ' active' : ' running'), `${icon(rec.icon)}<span class="ind"></span><span class="tooltip">${rec.title}</span>`);
    b.onclick = () => wm.toggleTaskbar(rec);
    box.appendChild(b);
  }
}

/* ================= flyouts ================= */
function toggleFlyout(sel) {
  const target = $(sel);
  const wasOpen = target.classList.contains('open');
  closeFlyouts();
  if (!wasOpen) {
    target.classList.add('open');
    if (sel === '#notif') renderNotifList();
    if (sel === '#start') { $('#start-search input').value = ''; filterStart(''); }
  }
}
function closeFlyouts() { document.querySelectorAll('.flyout.open').forEach(f => f.classList.remove('open')); hideCtxMenu(); $('#power-menu')?.remove(); }
document.addEventListener('click', e => {
  if (!e.target.closest('.flyout') && !e.target.closest('#taskbar')) closeFlyouts();
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFlyouts(); });

/* ================= Start menu ================= */
function buildStart() {
  const grid = $('#start-pins');
  grid.innerHTML = APPS.map(a => `<div class="pin" data-app="${a.id}">${icon(a.icon)}<span class="lbl">${a.title}</span></div>`).join('');
  grid.querySelectorAll('.pin').forEach(p => p.onclick = () => openApp(p.dataset.app));
  $('#start-rec .rec-list') ?? $('#start-rec').appendChild(el('div', 'rec-list'));
  renderRecents();

  $('#start-search input').oninput = e => filterStart(e.target.value);
  $('#start-user').innerHTML = `<span class="avatar">${session?.avatar ?? 'A'}</span><span>${session?.name ?? 'Usuário'}</span>`;
  $('#start-user').onclick = () => openApp('users');
  $('#start-power').innerHTML = icon('i-power');
  $('#start-power').onclick = e => {
    e.stopPropagation();
    $('#power-menu')?.remove();
    const pm = el('div', 'ctx-menu', `
      <div class="item" data-p="lock"><span class="ico">${icon('i-lock')}</span>Bloquear</div>
      <div class="item" data-p="restart"><span class="ico">${icon('i-refresh')}</span>Reiniciar</div>
      <div class="item" data-p="off"><span class="ico">${icon('i-power')}</span>Desligar</div>`);
    pm.id = 'power-menu';
    document.body.appendChild(pm);
    const r = pm.getBoundingClientRect();
    pm.style.left = Math.min(window.innerWidth - r.width - 8, window.innerWidth / 2 + 250) + 'px';
    pm.style.top = (window.innerHeight - 48 - r.height - 10) + 'px';
    pm.querySelectorAll('.item').forEach(x => x.onclick = () => {
      const p = x.dataset.p;
      closeFlyouts();
      if (p === 'lock') showLock(true);
      if (p === 'restart') location.reload();
      if (p === 'off') { $('#boot')?.remove(); location.reload(); }
    });
    setTimeout(() => document.addEventListener('click', () => $('#power-menu')?.remove(), { once: true }), 10);
  };
}

function filterStart(q) {
  const term = (q ?? '').toLowerCase().trim();
  $('#start-pins').innerHTML = APPS
    .filter(a => !term || a.title.toLowerCase().includes(term))
    .map(a => `<div class="pin" data-app="${a.id}">${icon(a.icon)}<span class="lbl">${a.title}</span></div>`).join('');
  $('#start-pins').querySelectorAll('.pin').forEach(p => p.onclick = () => openApp(p.dataset.app));
}

/* ================= Quick Settings ================= */
function buildQuickSettings() {
  const tiles = [
    { k: 'wifi', ico: 'i-wifi', label: 'Wi-Fi' },
    { k: 'bluetooth', ico: 'i-bt', label: 'Bluetooth' },
    { k: 'aviao', ico: 'i-plane', label: 'Modo avião' },
    { k: 'economia', ico: 'i-battery', label: 'Economia' },
    { k: 'tema', ico: 'i-bright', label: 'Tema claro' },
    { k: 'modo', ico: 'i-plug', label: `Modo ${FGUA.get('settings').mode}` }
  ];
  const g = $('#qs-grid');
  g.innerHTML = tiles.map(t => `<div class="qs-tile" data-k="${t.k}">${icon(t.ico)}<span>${t.label}</span></div>`).join('');
  const sync = () => {
    for (const t of tiles) {
      const node = g.querySelector(`[data-k="${t.k}"]`);
      const on = t.k === 'tema' ? document.documentElement.dataset.theme === 'light'
        : t.k === 'modo' ? FGUA.get('settings').mode !== 'demo'
        : qsState[t.k];
      node.classList.toggle('on', !!on);
    }
  };
  g.querySelectorAll('.qs-tile').forEach(node => {
    node.onclick = () => {
      const k = node.dataset.k;
      if (k === 'tema') {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        persist({ theme: next });
        toast('Personalização', `Tema ${next === 'dark' ? 'escuro' : 'claro'} aplicado`, 'info');
      } else if (k === 'modo') {
        openApp('settings', { page: 'rede' });
        return;
      } else {
        qsState[k] = !qsState[k];
        toast('Conexões', `${node.textContent}: ${qsState[k] ? 'ativado' : 'desativado'} (simulado em nível de shell)`, 'info');
      }
      sync();
    };
  });
  sync();

  $('#qs-bright').value = brightness;
  $('#qs-vol').value = volume;
  $('#qs-bright').oninput = e => {
    brightness = +e.target.value;
    $('#desktop-root').style.filter = brightness < 100 ? `brightness(${brightness / 100})` : '';
  };
  $('#qs-vol').oninput = e => { volume = +e.target.value; };
  $('#qs-battery').textContent = navigator.getBattery ? '…' : 'Bateria';
  if (navigator.getBattery) navigator.getBattery().then(b => {
    const txt = () => `${Math.round(b.level * 100)}%`;
    $('#qs-battery').textContent = txt();
  }).catch(() => { $('#qs-battery').textContent = '100%'; });
  else $('#qs-battery').textContent = '100%';
  $('#qs-gear').onclick = () => { closeFlyouts(); openApp('settings'); };
  $('#qs-mode-badge').textContent = `Modo: ${FGUA.get('settings').mode}`;
}

/* ================= Notificações ================= */
const notifs = [];
function buildNotifications() {
  const bus = FGUA.get('bus');
  bus.on('notify', n => {
    if (!n) return;
    notifs.unshift({ title: n.title, message: n.message, tone: n.tone, at: n.at ?? Date.now() });
    if (notifs.length > 40) notifs.pop();
    showToast(n.title, n.message, n.tone);
    if ($('#notif').classList.contains('open')) renderNotifList();
  });
  bus.on('security:denied', p => toast('Segurança', `Permissão negada: ${p?.perm ?? '?'}`, 'warn'));
}

function renderNotifList() {
  const box = $('#notif-list');
  box.innerHTML = notifs.length
    ? notifs.map(n => `<div class="notif-card ${n.tone}"><div class="t"><span class="tone">${n.title}</span><time>${new Date(n.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></div><div class="m">${n.message}</div></div>`).join('')
    : `<div class="empty">${icon('i-info')}<span>Sem novas notificações</span></div>`;
  renderCalendar();
}

function renderCalendar() {
  const cal = $('#notif .cal-grid');
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // segunda = 0
  const days = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  let cells = '';
  for (const d of ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']) cells += `<span class="dow">${d}</span>`;
  for (let i = 0; i < startDow; i++) cells += `<span class="day other">${prevDays - startDow + 1 + i}</span>`;
  for (let d = 1; d <= days; d++) cells += `<span class="day${d === now.getDate() ? ' today' : ''}">${d}</span>`;
  for (let i = 1; cells.split('<span').length - 1 < 49; i++) cells += `<span class="day other">${i}</span>`;
  cal.innerHTML = cells;
  $('#notif .cal-title').textContent = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function showToast(title, message, tone = 'info') {
  const t = el('div', 'toast', `<div class="t">${title}</div><div class="m">${message}</div>`);
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 220); }, 4200);
}

/* ================= Lock screen ================= */
function wireLock() {
  showLock(false);
}
function showLock(immediate) {
  const lock = $('#lock');
  lock.classList.remove('hidden');
  lock.querySelector('.login').style.display = 'none';
  lock.querySelector('.clock').style.display = '';
  lock.querySelector('.hint').textContent = 'Clique para desbloquear';
  const unlock = () => {
    const sec = FGUA.get('security');
    const user = allUsersForLock().find(u => u.id === session?.userId);
    const needsPass = !!user?.comSenha;
    if (!needsPass) {
      lock.classList.add('hidden');
      return;
    }
    lock.querySelector('.clock').style.display = 'none';
    lock.querySelector('.hint').textContent = '';
    const lg = lock.querySelector('.login');
    lg.style.display = 'flex';
    lg.querySelector('.who').textContent = user?.name ?? 'Usuário';
    const inp = lg.querySelector('input');
    inp.value = '';
    setTimeout(() => inp.focus(), 100);
  };
  lock.querySelector('.clock').onclick = unlock;
  lock.querySelector('.hint').onclick = unlock;
  lock.querySelector('.login button').onclick = () => {
    const sec = FGUA.get('security');
    const r = sec.login(session?.userId, lock.querySelector('.login input').value);
    if (r.ok) lock.classList.add('hidden');
    else lock.querySelector('.login .msg').textContent = r.error;
  };
  lock.querySelector('.login input').onkeydown = e => { if (e.key === 'Enter') lock.querySelector('.login button').click(); };
}
function allUsersForLock() {
  const r = FGUA.get('security').listUsers();
  return r.data ?? [];
}

/* ================= atalhos globais ================= */
document.addEventListener('keydown', e => {
  if (e.key === 'Meta' && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleFlyout('#start'); }
});

boot();
