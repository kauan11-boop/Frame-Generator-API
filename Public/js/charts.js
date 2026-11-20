// Lightweight SVG chart helpers (no external dependencies).

import { esc } from './render.js';

const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#ea580c', '#4f46e5', '#0f766e', '#be185d'];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const sweep = Math.max(0, endAngle - startAngle);
  if (sweep >= 359.999) {
    // Full circle: draw two arcs to avoid SVG issues
    const topO = polarToCartesian(cx, cy, rOuter, 0);
    const botO = polarToCartesian(cx, cy, rOuter, 180);
    const topI = polarToCartesian(cx, cy, rInner, 0);
    const botI = polarToCartesian(cx, cy, rInner, 180);
    return [
      `M ${topO.x} ${topO.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${botO.x} ${botO.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${topO.x} ${topO.y}`,
      `M ${topI.x} ${topI.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${botI.x} ${botI.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${topI.x} ${topI.y}`,
      'Z'
    ].join(' ');
  }
  const startO = polarToCartesian(cx, cy, rOuter, endAngle);
  const endO = polarToCartesian(cx, cy, rOuter, startAngle);
  const startI = polarToCartesian(cx, cy, rInner, startAngle);
  const endI = polarToCartesian(cx, cy, rInner, endAngle);
  const large = sweep > 180 ? 1 : 0;
  return [
    `M ${startO.x} ${startO.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 0 ${endO.x} ${endO.y}`,
    `L ${startI.x} ${startI.y}`,
    `A ${rInner} ${rInner} 0 ${large} 1 ${endI.x} ${endI.y}`,
    'Z',
  ].join(' ');
}

export function donutChart(data = [], options = {}) {
  const items = (Array.isArray(data) ? data : [])
    .map((d, i) => ({
      label: String(d?.label ?? d?.id ?? `Item ${i + 1}`),
      value: Math.max(0, Number(d?.value ?? d?.count ?? 0) || 0),
      color: d?.color || PALETTE[i % PALETTE.length],
      id: d?.id || String(i),
    }))
    .filter((d) => d.value > 0);

  const size = Math.max(160, Number(options.size) || 220);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = (size / 2) - 8;
  const rInner = Math.max(24, rOuter - (Number(options.thickness) || 34));
  const total = items.reduce((a, b) => a + b.value, 0);
  const title = options.title || 'Distribuição';
  const ariaLabel = options.ariaLabel || title;

  if (!items.length || total <= 0) {
    return `
      <div class="chart-wrap" role="img" aria-label="${esc(ariaLabel)}: sem dados">
        <svg class="chart" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
          <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="#f3f4f6" stroke="#e5e7eb" />
          <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#fff" />
          <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="#6b7280" font-size="13" font-family="system-ui, sans-serif">Sem dados</text>
        </svg>
        <p class="muted" style="margin:0">Nenhum uso registrado ainda nesta sessão/navegador.</p>
      </div>`;
  }

  let angle = 0;
  const slices = items.map((item) => {
    const sweep = (item.value / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const path = arcPath(cx, cy, rOuter, rInner, start, end);
    const pct = ((item.value / total) * 100);
    return { ...item, path, pct, start, end };
  });

  const paths = slices.map((s) => `<path d="${s.path}" fill="${s.color}" stroke="#fff" stroke-width="1"><title>${esc(s.label)}: ${esc(s.value)} (${esc(s.pct.toFixed(1))}%)</title></path>`).join('');
  const centerLabel = options.centerLabel || `${total}`;
  const centerSub = options.centerSub || 'usos';
  const legend = `
    <div class="chart-legend" aria-label="Legenda do gráfico">
      ${slices.map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span><span><strong>${esc(s.label)}</strong>: ${esc(s.value)} <span class="muted">(${esc(s.pct.toFixed(1))}%)</span></span></span>`).join('')}
    </div>`;

  const srList = slices.map((s) => `${s.label}: ${s.value} (${s.pct.toFixed(1)}%)`).join('; ');
  return `
    <div class="chart-wrap">
      <svg class="chart" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(ariaLabel)}. ${esc(srList)}">
        <title>${esc(title)}</title>
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="var(--surface, #fff)" />
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-strong, #111827)" font-size="20" font-weight="700" font-family="system-ui, sans-serif">${esc(centerLabel)}</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" dominant-baseline="middle" fill="var(--muted, #4b5563)" font-size="12" font-family="system-ui, sans-serif">${esc(centerSub)}</text>
      </svg>
      ${legend}
    </div>`;
}
