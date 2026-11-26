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

## Limites honestos

- `mcp.json` é declarativo: descreve e aponta ferramentas/conteúdos, mas não executa processos.
- O playground não acessa a rede nem a página principal; execute apenas código confiável.
- O snapshot é um ponto no tempo: novos jobs e alterações locais não aparecem até a sincronização.
- Nenhum segredo deve ser versionado: o manifesto e o snapshot são públicos.
