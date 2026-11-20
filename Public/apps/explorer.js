/**
 * FGUA v2 — Explorador de Arquivos (sistema de arquivos virtual).
 */

import { el, icon, bytes } from './common.js';

export function mount(FGUA) {
  const root = el('div', 'app');
  const vfs = FGUA.get('vfs');

  const side = el('div', 'app-side');
  const main = el('div', 'app-main');
  main.style.padding = '0';
  main.style.display = 'flex';
  main.style.flexDirection = 'column';
  root.append(side, main);

  const places = [
    { path: '/', label: 'Este Computador', ico: 'i-pc' },
    { path: '/Documentos', label: 'Documentos', ico: 'i-folder' },
    { path: '/Modelos', label: 'Modelos', ico: 'i-cube' },
    { path: '/Downloads', label: 'Downloads', ico: 'i-download' },
    { path: '/Projetos', label: 'Projetos', ico: 'i-grid' },
    { path: '/Repacks', label: 'Repacks', ico: 'i-box' }
  ];
  side.innerHTML = `<div class="brand">${icon('i-folder')} Explorador</div>`;
  let curPath = '/';

  const toolbar = el('div', 'app-toolbar');
  const crumb = el('div', 'ex-crumb');
  const btnNewDir = el('button', 'btn', `${icon('i-plus')} Nova pasta`);
  const btnNewFile = el('button', 'btn', `${icon('i-file')} Novo arquivo`);
  const btnUpload = el('button', 'btn', `${icon('i-upload')} Importar`);
  const btnDelete = el('button', 'btn', `${icon('i-trash')} Excluir`);
  toolbar.append(crumb, btnNewDir, btnNewFile, btnUpload, btnDelete);

  const grid = el('div', 'ex-grid');
  main.append(toolbar, grid);

  let selected = null;

  function renderCrumb(path) {
    crumb.innerHTML = '';
    const parts = path === '/' ? [] : path.slice(1).split('/');
    const rootC = el('span', 'c', 'FGUA');
    rootC.onclick = () => nav('/');
    crumb.appendChild(rootC);
    let acc = '';
    for (const p of parts) {
      acc += '/' + p;
      crumb.appendChild(el('span', '', `${icon('i-chev-r')}`)).style.cssText = 'width:10px;height:10px;color:var(--txt-tertiary)';
      const c = el('span', 'c', p);
      const target = acc;
      c.onclick = () => nav(target);
      crumb.appendChild(c);
    }
  }

  async function nav(path) {
    curPath = path;
    selected = null;
    renderCrumb(path);
    const r = await vfs.ls(path);
    grid.innerHTML = '';
    if (!r.ok) { grid.innerHTML = `<div class="empty">${icon('i-info')}<span>${r.error}</span></div>`; return; }
    const items = r.data.children;
    if (!items.length) {
      grid.innerHTML = `<div class="empty">${icon('i-folder')}<span>Esta pasta está vazia</span></div>`;
      return;
    }
    for (const item of items) {
      const isDir = item.type === 'dir';
      const node = el('div', 'ex-item' + (isDir ? ' dir' : ''), `${icon(isDir ? 'i-folder' : 'i-file')}<span class="n">${item.name}</span>`);
      node.onclick = () => { grid.querySelectorAll('.ex-item').forEach(x => x.classList.remove('sel')); node.classList.add('sel'); selected = item; };
      node.ondblclick = () => isDir ? nav(joined(path, item.name)) : openFile(joined(path, item.name));
      grid.appendChild(node);
    }
  }

  const joined = (p, n) => (p === '/' ? '' : p) + '/' + n;

  async function openFile(path) {
    const res = await vfs.readFile(path);
    if (!res.ok) { alert(res.error); return; }
    const content = res.data instanceof Blob ? '(arquivo binário — use o Hub de Modelos para .gguf)' : String(res.data);
    const win = el('div', 'app');
    win.style.flexDirection = 'column';
    const ta = el('textarea', '');
    ta.style.cssText = 'flex:1;background:var(--win-bg);color:var(--txt-primary);border:0;outline:none;padding:14px;font-family:\'Cascadia Code\',Consolas,monospace;font-size:12.5px;resize:none';
    ta.value = content instanceof Blob ? '' : content;
    const bar = el('div', 'app-toolbar', `<span style="font-size:12px;color:var(--txt-secondary)">${path}</span>`);
    const bSave = el('button', 'btn primary', 'Salvar');
    bSave.onclick = async () => { await vfs.writeFile(path, ta.value); toast('Explorador', `${path} salvo.`, 'ok'); };
    bar.appendChild(bSave);
    win.append(bar, ta);
    // abre em janela filha via WM público
    window.dispatchEvent(new CustomEvent('fgua:open-editor', { detail: { title: path.split('/').pop(), content: win } }));
  }

  function toast(title, msg, tone) {
    window.dispatchEvent(new CustomEvent('fgua:toast', { detail: { title, message: msg, tone } }));
  }

  btnNewDir.onclick = async () => {
    const name = prompt('Nome da nova pasta:');
    if (!name) return;
    await vfs.mkdir(joined(curPath, name));
    nav(curPath);
  };
  btnNewFile.onclick = async () => {
    const name = prompt('Nome do novo arquivo (ex.: notas.txt):');
    if (!name) return;
    await vfs.writeFile(joined(curPath, name), '');
    nav(curPath);
  };
  btnUpload.onclick = async () => {
    const files = await pickFiles();
    if (!files) return;
    for (const f of files) await vfs.writeFile(joined(curPath, f.name), f, { mime: f.type });
    toast('Explorador', `${files.length} arquivo(s) importado(s) para ${curPath}.`, 'ok');
    nav(curPath);
  };
  async function pickFiles() {
    return new Promise(resolve => {
      const inp = el('input');
      inp.type = 'file'; inp.multiple = true; inp.style.display = 'none';
      inp.onchange = () => { resolve([...inp.files]); inp.remove(); };
      document.body.appendChild(inp); inp.click();
    });
  }
  btnDelete.onclick = async () => {
    if (!selected) { toast('Explorador', 'Selecione um item primeiro.', 'warn'); return; }
    const path = joined(curPath, selected.name);
    if (!confirm(`Excluir "${path}"?`)) return;
    await vfs.remove(path);
    nav(curPath);
  };

  for (const p of places) {
    const n = el('div', 'side-item' + (p.path === '/' ? ' sel' : ''), `${icon(p.ico)}${p.label}`);
    n.onclick = () => { side.querySelectorAll('.side-item').forEach(x => x.classList.remove('sel')); n.classList.add('sel'); nav(p.path); };
    side.appendChild(n);
  }

  nav('/');
  return root;
}

export default { mount };
