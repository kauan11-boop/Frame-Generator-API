/**
 * FGUA v2 — Usuários e Permissões (nível UI; autorização confiável exige backend).
 */

import { el, icon, callout, table, stateBadge } from './common.js';

export function mount(FGUA) {
  const security = FGUA.get('security');
  const router = FGUA.get('router');
  const root = el('div', 'app');
  const main = el('div', 'app-main');
  root.appendChild(main);

  function render() {
    main.innerHTML = `<h1>Usuários e Permissões</h1><p class="sub">Controle de acesso em nível de interface. Travas por namespace ativas no contrato /api/v1.</p>`;
    const sess = security.session();
    main.appendChild(el('div', 'cards', `
      <div class="card"><h4>Sessão atual</h4>
        <div class="kv"><span>Usuário</span><b>${sess?.name ?? '—'}</b></div>
        <div class="kv"><span>Papel</span><b>${sess?.role ?? '—'}</b></div>
        <div class="kv"><span>Desde</span><b>${sess?.at ? new Date(sess.at).toLocaleString('pt-BR') : '—'}</b></div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" id="u-lock">${icon('i-lock')} Bloquear sessão</button>
          <button class="btn" id="u-pass">${icon('i-key')} Definir senha</button>
        </div></div>`));

    main.appendChild(el('h2', '', 'Usuários'));
    const r = security.listUsers();
    main.appendChild(table(['Usuário', 'ID', 'Papel', 'Senha', 'Tipo'], r.data.map(u => [
      `<span style="display:inline-flex;align-items:center;gap:8px"><span class="avatar" style="width:24px;height:24px;font-size:11px">${u.avatar}</span>${u.name}</span>`,
      `<code>${u.id}</code>`, u.role, u.comSenha ? 'com senha' : 'sem senha', u.builtIn ? 'embutido' : 'local'
    ])));

    const addForm = el('div', 'form-row', `
      <label>Novo usuário</label>
      <input type="text" id="u-id" placeholder="id (ex.: kauan)">
      <input type="text" id="u-name" placeholder="nome completo">
      <select id="u-role"><option value="admin">Administrador</option><option value="operador">Operador</option><option value="visitante">Visitante</option></select>
      <input type="password" id="u-pass1" placeholder="senha (opcional)">
      <button class="btn primary" id="u-add">${icon('i-plus')} Criar usuário</button>`);
    main.appendChild(addForm);
    addForm.querySelector('#u-add').onclick = async () => {
      const r2 = security.createUser({
        id: addForm.querySelector('#u-id').value.trim(),
        name: addForm.querySelector('#u-name').value.trim(),
        role: addForm.querySelector('#u-role').value,
        password: addForm.querySelector('#u-pass1').value || null
      });
      main.appendChild(callout(r2.ok ? `Usuário <b>${r2.data.name}</b> criado.` : r2.error, r2.ok ? '' : 'err'));
      render();
    };

    main.appendChild(el('h2', '', 'Matriz de permissões (papéis)'));
    (async () => {
      const rm = await router.route('/api/v1/permissions/roles');
      const roles = rm.data?.roles ?? {};
      const permSet = [...new Set(Object.values(roles).flatMap(x => x.permissions))];
      main.appendChild(table(['Permissão', ...Object.values(roles).map(r => r.label)], permSet.map(p => [
        `<code>${p}</code>`,
        ...Object.values(roles).map(r => r.permissions.includes(p) || r.permissions.includes('*') ? '<span style="color:var(--ok)">✔</span>' : '<span style="color:var(--txt-tertiary)">—</span>')
      ])));
      main.appendChild(el('h2', '', 'Guard por namespace'));
      const ng = rm.data?.namespaceGuard ?? {};
      main.appendChild(table(['Namespace', 'Permissão exigida'], Object.entries(ng).map(([k, v]) => [`<code>/api/v1/${k}/</code>`, `<code>${v}</code>`])));
      main.appendChild(callout('Senhas são SHA-256 + salt no cliente (UI-level). Para autorização confiável, valide no backend.', 'warn'));
    })();

    main.querySelector('#u-lock').onclick = () => window.dispatchEvent(new CustomEvent('fgua:lock-screen'));
    main.querySelector('#u-pass').onclick = async () => {
      const pwd = prompt('Nova senha para ' + (sess?.name ?? 'sessão') + ' (vazio = remover senha):');
      if (pwd === null) return;
      const r3 = await security.setPassword(sess.userId, pwd);
      main.appendChild(callout(r3.ok ? (pwd ? 'Senha definida.' : 'Senha removida.') : r3.error, r3.ok ? '' : 'err'));
    };
  }
  render();
  return root;
}

export default { mount };
