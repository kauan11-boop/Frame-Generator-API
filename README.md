# FGUA v4 — console estático para GitHub Pages

Painel avançado que roda **diretamente no GitHub Pages**, sem servidor, build ou etapas intermediárias.
Ferramentas de transformação, playground isolado, busca no catálogo do REA e conteúdo sincronizado
funcionam inteiramente no navegador.

## Um único comando

```bash
npm start
```

Ele abre a prévia local do site em `http://localhost:4173` — a mesma página publicada em
`https://kauan11-boop.github.io/Frame-Generator-API/`. Não é preciso instalar dependências nem
executar qualquer outro comando: o servidor de prévia usa apenas a biblioteca padrão do Node.

O deploy é automático: cada push em `main` publica `index.html` e `dashboard/` via
`.github/workflows/jekyll-gh-pages.yml`.

## O que funciona no navegador

- **Ferramentas locais** — JSON (formatar/minificar/validar), Base64, URL, hash SHA, UUID v4,
  regex, estatísticas de texto, conversão de datas e cores. Nada sai do navegador.
- **Playground** — execução de JavaScript em iframe com `sandbox="allow-scripts"`, sem acesso à
  página, ao armazenamento local ou à rede; saída via `console.*` e timeout de 3 segundos.
- **Catálogo do REA** — busca instantânea nos nomes e descrições do snapshot, com detalhe de cada
  ferramenta ao clicar na linha.
- **Conteúdo sincronizado** — presets, prompts, jobs e catálogo carregados de
  `dashboard/data/snapshot.json`, servido pelo próprio GitHub Pages.
- **Interface** — tema claro/escuro, layout responsivo, busca rápida (`Ctrl/⌘ + K`) e navegação
  por seções.
- **Operação opcional** — engenharia reversa, reparo/transpilação e chamadas ao REA continuam
  disponíveis quando um integrador local está ativo; basta clicar no indicador de modo no topo.
  Nunca são pré-requisito para abrir o painel.

## Arquitetura

```
GitHub Pages ──▶ index.html + dashboard/*
                    │
                    ├─▶ dashboard/app.js (lógica e ferramentas)
                    ├─▶ dashboard/data/snapshot.json (conteúdo versionado)
                    └─▶ dashboard/playground.html (iframe isolado)

 prévia local: npm start ──▶ server.js (arquivos estáticos, zero dependências)
 integração local opcional ──▶ mcp-server/* (fora do escopo do GitHub Pages)
```

Páginas estáticas não iniciam processos nem leem arquivos do disco. Por isso todas as ações
necessárias ao dia a dia foram trazidas para o cliente, e as operações que exigem runtime local
são tratadas como extensão — nunca como dependência de inicialização.

## Estrutura

- `index.html` — interface e seções do painel.
- `dashboard/styles.css` — design system claro/escuro.
- `dashboard/app.js` — estado, snapshot, ferramentas, playground e busca.
- `dashboard/playground.html` — página isolada do sandbox.
- `dashboard/data/snapshot.json` — conteúdo sincronizado.
- `server.js` — servidor estático usado pelo `npm start`.
- `mcp-server/` e `config/` — runtime opcional de MCP, REA e LLM (não publicado no site).

## Limites honestos

- O playground não tem acesso à rede nem à página principal; ainda assim, execute apenas código
  de origem confiável.
- O snapshot é um ponto no tempo: novos jobs e alterações locais não aparecem até ser sincronizado.
- WASM é alvo de análise, não um interpretador universal de outras linguagens.
- Nenhum segredo deve ser versionado: o conteúdo do snapshot é público.
