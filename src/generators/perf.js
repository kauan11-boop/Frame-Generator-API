/**
 * FGUA v2 — monitor de desempenho real (FPS medido via rAF) + controlador de pixels.
 * Mede; não inventa. Recomendação de escala conforme o desempenho observado.
 */

export class PerfMonitor {
  constructor({ windowMs = 1000 } = {}) {
    this.windowMs = windowMs;
    this.running = false;
    this.frames = 0;
    this.lastT = 0;
    this.fps = 0;
    this.minFps = Infinity;
    this.maxFps = 0;
    this.samples = [];
    this._raf = null;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running || typeof requestAnimationFrame !== 'function') return false;
    this.running = true;
    this.frames = 0;
    this.lastT = performance.now();
    this._raf = requestAnimationFrame(this._tick);
    return true;
  }

  _tick(t) {
    if (!this.running) return;
    this.frames++;
    const dt = t - this.lastT;
    if (dt >= this.windowMs) {
      this.fps = (this.frames * 1000) / dt;
      this.samples.push(+this.fps.toFixed(1));
      if (this.samples.length > 120) this.samples.shift();
      this.minFps = Math.min(this.minFps, this.fps);
      this.maxFps = Math.max(this.maxFps, this.fps);
      this.frames = 0;
      this.lastT = t;
    }
    this._raf = requestAnimationFrame(this._tick);
  }

  stats() {
    return {
      running: this.running,
      fps: +this.fps.toFixed(1),
      min: this.minFps === Infinity ? null : +this.minFps.toFixed(1),
      max: this.maxFps === 0 ? null : +this.maxFps.toFixed(1),
      media: this.samples.length ? +(this.samples.reduce((a, b) => a + b, 0) / this.samples.length).toFixed(1) : null,
      amostras: [...this.samples]
    };
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    return this.stats();
  }
}

/** controlador de orçamento de pixels: recomenda escala interna (% ) a partir do fps medido */
export class PixelBudgetController {
  constructor({ fpsAlvo = 60, minScalePct = 50, maxScalePct = 100, histerese = 5 } = {}) {
    this.fpsAlvo = fpsAlvo;
    this.minScalePct = minScalePct;
    this.maxScalePct = maxScalePct;
    this.histerese = histerese;
    this.scalePct = maxScalePct;
  }

  /** atualiza com fps medido e devolve a escala recomendada estável */
  update(fpsMedido) {
    if (!Number.isFinite(fpsMedido) || fpsMedido <= 0) return this.scalePct;
    const ratio = fpsMedido / this.fpsAlvo;
    let target;
    if (ratio >= 1) target = this.maxScalePct;
    else target = Math.round(Math.min(this.maxScalePct, Math.max(this.minScalePct, ratio * 100)));
    // histerese para evitar oscilação
    if (Math.abs(target - this.scalePct) >= this.histerese) this.scalePct = target;
    return this.scalePct;
  }

  aplicar(width, height) {
    const w = Math.round(width * this.scalePct / 100);
    const h = Math.round(height * this.scalePct / 100);
    return { width: w, height: h, pixels: w * h };
  }
}

export default { PerfMonitor, PixelBudgetController };
