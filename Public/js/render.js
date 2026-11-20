export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pill = (t) => `<span class="pill">${esc(t)}</span>`;
export const pre = (o) => `<pre>${esc(typeof o === 'string' ? o : JSON.stringify(o, null, 2))}</pre>`;
export const pills = (arr) => (arr || []).map(pill).join('');

export function setActiveTab(id) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === `tab-${id}`));
}

export function renderError(container, err) {
  const target = container || document.getElementById('tab-overview') || document.querySelector('.container') || document.body;
  const msg = err && err.message ? err.message : (typeof err === 'string' ? err : JSON.stringify(err, null, 2));
  if (target) target.innerHTML = `
    <div class="card error-box">
      <h3>Erro ao carregar dashboard</h3>
      <pre>${esc(msg)}</pre>
      <p class="muted">Sirva o repositório com um servidor estático (ex.: <code>npx serve .</code>) e abra <code>/Public/dashboard.html</code>. O dashboard inicializa o núcleo FGUA e consome conteúdos em <code>src/</code> e <code>configs/</code>.</p>
    </div>`;
}

export function boolPill(v, labelTrue='sim', labelFalse='não') {
  return `<span class="pill">${esc(v ? labelTrue : labelFalse)}</span>`;
}
