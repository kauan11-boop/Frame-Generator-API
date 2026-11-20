import React, { useEffect, useState } from 'react';

// Base do site estático do Frame-Generator-API (ajuste conforme seu deploy).
const DEFAULT_SITE = 'https://kauan11-boop.github.io/Frame-Generator-API/';

function joinUrl(base, path) {
  const b = base.endsWith('/') ? base : base + '/';
  return new URL(path.replace(/^\//, ''), b).toString();
}

export default function App() {
  const [siteBase, setSiteBase] = useState(DEFAULT_SITE);
  const [apiConfig, setApiConfig] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [apiRes, settingsRes] = await Promise.all([
        fetch(joinUrl(siteBase, 'configs/api.json'), { cache: 'no-store' }),
        fetch(joinUrl(siteBase, 'configs/settings.json'), { cache: 'no-store' }),
      ]);
      if (!apiRes.ok) throw new Error(`Falha ao carregar configs/api.json (${apiRes.status})`);
      if (!settingsRes.ok) throw new Error(`Falha ao carregar configs/settings.json (${settingsRes.status})`);
      setApiConfig(await apiRes.json());
      setSettings(await settingsRes.json());
    } catch (e) {
      setError(e?.message || String(e));
      setApiConfig(null);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="container">
      <header>
        <h1>Frame-Generator-API · React + Vite</h1>
        <p>Exemplo de compatibilidade/integração: consome configurações e contrato público do site estático. Execução de inferência/processamento pesado depende de runtime/provedor/backend compatível.</p>
      </header>

      <section className="card">
        <h2>Origem dos dados (GitHub Pages / estático)</h2>
        <label htmlFor="siteBase">URL base do site</label>
        <div className="row">
          <input id="siteBase" value={siteBase} onChange={(e) => setSiteBase(e.target.value)} placeholder="https://usuario.github.io/repositorio/" />
          <button onClick={load} disabled={loading}>{loading ? 'Carregando…' : 'Recarregar'}</button>
        </div>
        {error ? <p className="error" role="alert">Erro: {error}</p> : null}
      </section>

      <section className="grid">
        <article className="card">
          <h2>Contrato de API (lógico)</h2>
          {apiConfig ? (
            <>
              <p><strong>Base:</strong> <code>{apiConfig.base || '/api/v1'}</code> · <strong>Modo:</strong> {apiConfig.mode || 'demo'}</p>
              <p className="muted">Namespaces declarados: {(apiConfig.namespaces || []).length}</p>
              <pre>{JSON.stringify(apiConfig, null, 2)}</pre>
            </>
          ) : <p className="muted">Sem dados carregados.</p>}
        </article>
        <article className="card">
          <h2>Configurações do sistema</h2>
          {settings ? (
            <>
              <p><strong>Projeto:</strong> {settings?.system?.name || '—'} · <strong>Versão:</strong> {settings?.system?.version || '—'}</p>
              <pre>{JSON.stringify(settings, null, 2)}</pre>
            </>
          ) : <p className="muted">Sem dados carregados.</p>}
        </article>
      </section>

      <footer className="muted">
        <p>Para conectar a um backend WebSocket/REST real, configure a URL e (opcionalmente) um código/token no seu cliente; trate segredos fora do código versionado.</p>
      </footer>
    </main>
  );
}
