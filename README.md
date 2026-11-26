# FGUA v4.1 — console estático com MCP por URL

Painel que roda **diretamente no GitHub Pages**, sem bridge, servidor ou etapa de build.
O catálogo de ferramentas e conteúdos vem de um manifesto JSON publicado na própria URL do site.

## Um único comando

```bash
npm start
```

Abre a prévia local em `http://localhost:4173` — a mesma página de
`https://kauan11-boop.github.io/Frame-Generator-API/`. O deploy é automático a cada push em
`main`; `index.html`, `mcp.json` e `dashboard/` são publicados por
`.github/workflows/jekyll-gh-pages.yml`.

## MCP por URL

A URL base configurável no painel (`https://kauan11-boop.github.io/Frame-Generator-API/`) aponta
para `mcp.json`. Esse manifesto declara:

- `tools` — 9 ferramentas executadas no navegador (`runtime: browser`) e 11 ferramentas do
  MCP stdio (`runtime: mcp-stdio`, usadas pelo agente).
- `resources` — URLs dos conteúdos: snapshot, playground, interface e o próprio manifesto.
- `endpoints`, `transport` e `callFormat` — formato único de chamada.

Formato de chamada gerado pelos formulários do painel:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "fgua_repair_code", "arguments": { "language": "javascript" } }
}
```

A página não executa processos: as ferramentas `browser` rodam localmente no cliente e as
`mcp-stdio` são chamadas pelo agente através do servidor `mcp-server/src/index.js`, que foi mantido.
Se a URL informada for inacessível (por CORS ou rede), o painel usa automaticamente o `mcp.json`
da mesma origem.

## Ferramentas e conteúdos

- **Locais** — JSON, Base64, URL, hash SHA, UUID v4, regex, texto, datas e cores.
- **Playground** — JavaScript em iframe `sandbox="allow-scripts"`, sem acesso à página ou à rede.
- **REA** — busca no catálogo do snapshot e gerador de chamadas `fgua_rea_call`.
- **MCP** — manifesto, tabela de ferramentas com runtime e links para os recursos publicados.
- **Interface** — tema claro/escuro, responsivo, busca rápida (`Ctrl/⌘ + K`).

Os formulários de engenharia reversa, reparo, presets e prompts **geram chamadas MCP copiáveis**;
nenhuma ação é enviada para servidor algum.

## Arquitetura

```
GitHub Pages ──▶ index.html + mcp.json + dashboard/*
                    │
                    ├─▶ mcp.json (manifesto: ferramentas + conteúdos)
                    ├─▶ dashboard/data/snapshot.json (dados sincronizados)
                    └─▶ dashboard/app.js (ferramentas locais e gerador de chamadas)

prévia local: npm start ──▶ server.js (arquivos estáticos, zero dependências)
agente:       mcp-server/src/index.js (stdio, mantido)
```

O bridge HTTP foi removido: não há mais `127.0.0.1:4174` nem sondas automáticas no navegador.

## Estrutura

- `index.html` — interface do painel.
- `mcp.json` — manifesto MCP por URL.
- `dashboard/styles.css` — tema claro/escuro.
- `dashboard/app.js` — lógica, ferramentas locais e gerador de chamadas.
- `dashboard/playground.html` — sandbox isolado.
- `dashboard/data/snapshot.json` — conteúdo sincronizado.
- `server.js` — servidor estático do `npm start`.
- `mcp-server/` e `config/` — MCP stdio para o agente (não publicado).

## Mapa para agentes (raw files)

Base para leitura direta de qualquer arquivo versionado:
`https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/<caminho>`

```
Frame-Generator-API/
├── .github/workflows/    CI e deploy do GitHub Pages
├── config/               configuração inicial
├── dashboard/            site estático publicado
│   └── data/             conteúdo sincronizado
├── mcp-server/           MCP stdio (não publicado no site)
│   ├── src/engine/       RE, reparo e registro de ferramentas
│   └── tests/            testes de smoke
├── index.html            interface do painel
├── mcp.json              manifesto MCP por URL
├── server.js             prévia local (npm start)
├── package.json          único script npm
├── package-lock.json     lockfile
└── README.md             esta documentação
```

`node_modules/` e `.frame-data/` são locais/gerados e não têm URL raw.

| Caminho | Função | Raw file |
|---|---|---|
| `.github/workflows/ci.yml` | Validação de sintaxe e JSON | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/.github/workflows/ci.yml |
| `.github/workflows/jekyll-gh-pages.yml` | Deploy do site estático | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/.github/workflows/jekyll-gh-pages.yml |
| `.gitignore` | Arquivos ignorados | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/.gitignore |
| `README.md` | Documentação do projeto | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/README.md |
| `config/defaults.json` | Presets, prompts e ajustes padrão | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/config/defaults.json |
| `dashboard/app.js` | Lógica do painel, ferramentas e chamadas MCP | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/dashboard/app.js |
| `dashboard/data/snapshot.json` | Conteúdo sincronizado | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/dashboard/data/snapshot.json |
| `dashboard/playground.html` | Página isolada do sandbox | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/dashboard/playground.html |
| `dashboard/styles.css` | Tema claro/escuro e layout | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/dashboard/styles.css |
| `index.html` | Estrutura das seções do painel | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/index.html |
| `mcp-server/src/config.js` | Constantes e variáveis de ambiente | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/config.js |
| `mcp-server/src/engine/repair.js` | Loop LLM + testes como reward | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/engine/repair.js |
| `mcp-server/src/engine/reverse.js` | Pipeline de engenharia reversa | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/engine/reverse.js |
| `mcp-server/src/engine/tools.js` | Registro das ferramentas MCP | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/engine/tools.js |
| `mcp-server/src/index.js` | Servidor MCP stdio | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/index.js |
| `mcp-server/src/llm.js` | Cliente do provedor local | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/llm.js |
| `mcp-server/src/rea.js` | Cliente do MCP REA | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/rea.js |
| `mcp-server/src/sandbox.js` | Execução limitada de código | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/sandbox.js |
| `mcp-server/src/store.js` | Presets, prompts, jobs e configurações | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/store.js |
| `mcp-server/src/sync.js` | Geração do snapshot.json | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/src/sync.js |
| `mcp-server/tests/smoke.test.mjs` | 8 testes de smoke | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp-server/tests/smoke.test.mjs |
| `mcp.json` | Manifesto MCP por URL | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/mcp.json |
| `package.json` | Metadados e script `npm start` | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/package.json |
| `package-lock.json` | Lockfile de dependências | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/package-lock.json |
| `server.js` | Servidor estático da prévia local | https://raw.githubusercontent.com/kauan11-boop/Frame-Generator-API/refs/heads/main/server.js |

## Limites honestos

- `mcp.json` é declarativo: descreve e aponta ferramentas/conteúdos, mas não executa processos.
- O playground não acessa a rede nem a página principal; execute apenas código confiável.
- O snapshot é um ponto no tempo: novos jobs e alterações locais não aparecem até a sincronização.
- Nenhum segredo deve ser versionado: o manifesto e o snapshot são públicos.
