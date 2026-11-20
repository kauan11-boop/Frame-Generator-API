/**
 * FGUA v2 — Gerenciador de Janelas estilo Windows 11.
 * Drag, resize (8 alças), snap (bordas/ topo), min/max/restore/close,
 * z-order por foco, animações Fluent.
 */

const MIN_W = 340, MIN_H = 220;

export class WindowManager {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.taskbarCb = opts.onWindowsChanged || (() => {});
    this.windows = new Map();
    this.zTop = 10;
    this.cascade = 0;
    this.focused = null;
    this._snapPreview = this._buildPreview();
  }

  _buildPreview() {
    const p = document.createElement('div');
    p.className = 'snap-preview';
    document.body.appendChild(p);
    return p;
  }

  area() {
    const h = document.getElementById('taskbar')?.offsetHeight ?? 48;
    return { w: window.innerWidth, h: window.innerHeight - h };
  }

  open(spec) {
    // spec: {id, title, icon, w, h, content: HTMLElement, app}
    if (!spec?.id) throw new Error('Janela sem id');
    const existing = this.windows.get(spec.id);
    if (existing) { this.restore(existing); this.focus(existing); return existing; }

    const a = this.area();
    const w = Math.min(spec.w ?? 900, a.w - 40);
    const h = Math.min(spec.h ?? 600, a.h - 30);
    const off = (this.cascade++ % 6) * 26;
    let x = Math.max(8, (a.w - w) / 2 + off - 60);
    let y = Math.max(8, (a.h - h) / 2 + off - 30);

    const el = document.createElement('div');
    el.className = 'win opening';
    el.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${++this.zTop}`;
    el.innerHTML = `
      <div class="titlebar">
        <svg class="app-ico"><use href="../assets/icons.svg#${spec.icon || 'i-grid'}"/></svg>
        <span class="title">${this._esc(spec.title || spec.id)}</span>
        <div class="captions">
          <button class="cap-btn min" title="Minimizar"><svg><use href="../assets/icons.svg#i-min"/></svg></button>
          <button class="cap-btn max" title="Maximizar"><svg><use href="../assets/icons.svg#i-max"/></svg></button>
          <button class="cap-btn close" title="Fechar"><svg><use href="../assets/icons.svg#i-close"/></svg></button>
        </div>
      </div>
      <div class="win-body"></div>
      ${['n','s','e','w','ne','nw','se','sw'].map(d => `<div class="rz rz-${d}" data-dir="${d}"></div>`).join('')}`;
    const body = el.querySelector('.win-body');
    if (spec.content instanceof HTMLElement) body.appendChild(spec.content);
    else if (typeof spec.content === 'string') body.innerHTML = spec.content;

    const rec = { id: spec.id, el, title: spec.title || spec.id, icon: spec.icon || 'i-grid', minimized: false, maximized: false, snap: null, app: spec.app ?? null };
    this.windows.set(spec.id, rec);
    this.layer.appendChild(el);
    setTimeout(() => el.classList.remove('opening'), 240);

    this._wireTitlebar(rec);
    this._wireDrag(rec);
    this._wireResize(rec);
    this._focus(rec);
    this.taskbarCb();
    return rec;
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  _wireTitlebar(rec) {
    const [bMin, bMax, bClose] = rec.el.querySelectorAll('.cap-btn');
    bMin.onclick = e => { e.stopPropagation(); this.minimize(rec); };
    bMax.onclick = e => { e.stopPropagation(); this.toggleMaximize(rec); };
    bClose.onclick = e => { e.stopPropagation(); this.close(rec.id); };
    rec.el.querySelector('.titlebar').addEventListener('dblclick', () => this.toggleMaximize(rec));
  }

  focus(rec) { if (rec && !rec.minimized) this._focus(rec); }
  _focus(rec) {
    if (this.focused === rec) return;
    this.focused = rec;
    for (const w of this.windows.values()) w.el.classList.toggle('focused', w === rec);
    rec.el.style.zIndex = ++this.zTop;
    this.taskbarCb();
  }

  minimize(rec) {
    rec.minimized = true;
    rec.el.classList.add('minimizing');
    setTimeout(() => { rec.el.style.display = 'none'; rec.el.classList.remove('minimizing'); }, 170);
    if (this.focused === rec) this.focused = null;
    this.taskbarCb();
  }

  restore(rec) {
    if (!rec.minimized) return;
    rec.minimized = false;
    rec.el.style.display = '';
    this.taskbarCb();
  }

  toggleTaskbar(rec) {
    if (rec.minimized) { this.restore(rec); this.focus(rec); }
    else if (this.focused === rec) { this.minimize(rec); }
    else this.focus(rec);
  }

  toggleMaximize(rec) {
    const a = this.area();
    if (rec.maximized || rec.snap) {
      const b = rec._boundsBefore ?? { x: 80, y: 40, w: 900, h: 600 };
      rec.el.classList.add('snapping');
      this._bounds(rec.el, b);
      rec.el.classList.remove('maximized');
      rec.el.querySelector('.cap-btn.max svg use').setAttribute('href', '../assets/icons.svg#i-max');
      setTimeout(() => rec.el.classList.remove('snapping'), 180);
      rec.maximized = false; rec.snap = null;
    } else {
      rec._boundsBefore = this._readBounds(rec.el);
      rec.el.classList.add('snapping', 'maximized');
      this._bounds(rec.el, { x: 0, y: 0, w: a.w, h: a.h });
      rec.el.querySelector('.cap-btn.max svg use').setAttribute('href', '../assets/icons.svg#i-restore');
      setTimeout(() => rec.el.classList.remove('snapping'), 180);
      rec.maximized = true;
    }
    this._focus(rec);
  }

  snapTo(rec, zone) {
    const a = this.area();
    if (!rec.snap && !rec.maximized) rec._boundsBefore = this._readBounds(rec.el);
    rec.el.classList.add('snapping');
    rec.el.classList.remove('maximized');
    let b;
    if (zone === 'max') { b = { x: 0, y: 0, w: a.w, h: a.h }; rec.maximized = true; rec.snap = null; rec.el.classList.add('maximized'); }
    else if (zone === 'left') { b = { x: 0, y: 0, w: a.w / 2, h: a.h }; rec.maximized = false; rec.snap = 'left'; }
    else if (zone === 'right') { b = { x: a.w / 2, y: 0, w: a.w / 2, h: a.h }; rec.maximized = false; rec.snap = 'right'; }
    this._bounds(rec.el, b);
    rec.el.querySelector('.cap-btn.max svg use').setAttribute('href', rec.maximized ? '../assets/icons.svg#i-restore' : '../assets/icons.svg#i-max');
    setTimeout(() => rec.el.classList.remove('snapping'), 180);
  }

  _readBounds(el) {
    return { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width), h: parseFloat(el.style.height) };
  }
  _bounds(el, b) {
    el.style.left = Math.round(b.x) + 'px';
    el.style.top = Math.round(b.y) + 'px';
    el.style.width = Math.round(b.w) + 'px';
    el.style.height = Math.round(b.h) + 'px';
  }

  _showPreview(zone) {
    const a = this.area();
    const p = this._snapPreview;
    p.style.display = 'block';
    if (zone === 'max') Object.assign(p.style, { left: '4px', top: '4px', width: (a.w - 8) + 'px', height: (a.h - 8) + 'px' });
    if (zone === 'left') Object.assign(p.style, { left: '4px', top: '4px', width: (a.w / 2 - 8) + 'px', height: (a.h - 8) + 'px' });
    if (zone === 'right') Object.assign(p.style, { left: (a.w / 2 + 4) + 'px', top: '4px', width: (a.w / 2 - 8) + 'px', height: (a.h - 8) + 'px' });
  }

  _wireDrag(rec) {
    const tb = rec.el.querySelector('.titlebar');
    let drag = null;
    tb.addEventListener('pointerdown', e => {
      if (e.target.closest('.cap-btn')) return;
      if (e.button !== 0) return;
      this._focus(rec);
      const b = this._readBounds(rec.el);
      drag = { dx: e.clientX - b.x, dy: e.clientY - b.y, moved: false, unmaxed: false };
      tb.setPointerCapture(e.pointerId);
    });
    tb.addEventListener('pointermove', e => {
      if (!drag) return;
      const a = this.area();
      if (!drag.unmaxed && (rec.maximized || rec.snap)) {
        // restaurar ao arrastar janela maximizada (comportamento Win11)
        const b = rec._boundsBefore ?? { x: 80, y: 40, w: 900, h: 600 };
        drag.unmaxed = true;
        rec.maximized = false; rec.snap = null;
        rec.el.classList.remove('maximized');
        rec.el.querySelector('.cap-btn.max svg use').setAttribute('href', '../assets/icons.svg#i-max');
        drag.dx = Math.min(b.w / 2, Math.max(20, e.clientX - b.x));
        this._bounds(rec.el, { x: e.clientX - drag.dx, y: 8, w: b.w, h: b.h });
      }
      if (!drag.moved && Math.hypot(e.movementX, e.movementY) > 2) drag.moved = true;
      const b = this._readBounds(rec.el);
      const nx = Math.min(Math.max(-b.w + 80, e.clientX - drag.dx), a.w - 80);
      const ny = Math.min(Math.max(0, e.clientY - drag.dy), a.h - 36);
      rec.el.style.left = nx + 'px';
      rec.el.style.top = ny + 'px';
      // zonas de snap
      if (e.clientY <= 4) { this._showPreview('max'); drag.zone = 'max'; }
      else if (e.clientX <= 4) { this._showPreview('left'); drag.zone = 'left'; }
      else if (e.clientX >= window.innerWidth - 4) { this._showPreview('right'); drag.zone = 'right'; }
      else { this._snapPreview.style.display = 'none'; drag.zone = null; }
    });
    tb.addEventListener('pointerup', e => {
      if (!drag) return;
      tb.releasePointerCapture?.(e.pointerId);
      if (drag.zone) this.snapTo(rec, drag.zone);
      this._snapPreview.style.display = 'none';
      drag = null;
    });
  }

  _wireResize(rec) {
    for (const h of rec.el.querySelectorAll('.rz')) {
      h.addEventListener('pointerdown', e => {
        e.stopPropagation();
        this._focus(rec);
        const dir = h.dataset.dir;
        const start = { ...this._readBounds(rec.el), px: e.clientX, py: e.clientY };
        h.setPointerCapture(e.pointerId);
        const move = ev => {
          const dx = ev.clientX - start.px, dy = ev.clientY - start.py;
          let { x, y, w, hh } = { x: start.x, y: start.y, w: start.w, hh: start.h };
          if (dir.includes('e')) w = Math.max(MIN_W, start.w + dx);
          if (dir.includes('s')) hh = Math.max(MIN_H, start.h + dy);
          if (dir.includes('w')) { w = Math.max(MIN_W, start.w - dx); x = start.x + (start.w - w); }
          if (dir.includes('n')) { hh = Math.max(MIN_H, start.h - dy); y = start.y + (start.h - hh); }
          this._bounds(rec.el, { x, y, w, h: hh });
        };
        const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); };
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
      });
    }
  }

  close(id) {
    const rec = this.windows.get(id);
    if (!rec) return;
    rec.el.classList.add('closing');
    setTimeout(() => { rec.el.remove(); }, 150);
    this.windows.delete(id);
    if (this.focused === rec) {
      this.focused = null;
      const last = [...this.windows.values()].filter(w => !w.minimized).pop();
      if (last) this._focus(last);
    }
    rec.app?.onClose?.();
    this.taskbarCb();
  }

  closeAll() { for (const id of [...this.windows.keys()]) this.close(id); }
}

export default WindowManager;
