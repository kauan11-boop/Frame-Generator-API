export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pill = (t) => `<span class="pill">${esc(t)}</span>`;
export const pre = (o) => `<pre>${esc(JSON.stringify(o, null, 2))}</pre>`;
export const pills = (arr) => (arr || []).map(pill).join('');

export function setActiveTab(id) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === `tab-${id}`));
}

export function renderError(container, err) {
  container.innerHTML = `
    <div class="card error-box">
      <h3>Erro ao carregar dados</h3>
      <pre>${esc(err.message || err)}</pre>
      <p class="muted">Sirva o repositório com um servidor estático (ex.: <code>npx serve .</code>) e abra <code>/public/dashboard.html</code>. A interface consome a API em <code>src/api/v1</code>.</p>
    </div>`;
}
