# Comandos e operações — Frame-Generator-API

Referência prática para executar, verificar e integrar o projeto em ambiente estático (GitHub Pages/local).

## Desenvolvimento e verificação

```bash
npx serve .
# Abrir: http://localhost:3000/  (página inicial) ou  http://localhost:3000/Public/dashboard.html

npm run lint:syntax   # checagem de sintaxe JS/MJS
npm run check:json    # validação de JSONs (configs, manifests, presets, locales, templates, package/manifest)
npm test              # testes automatizados (Node --test)
npm run ci            # lint:syntax + check:json + test
```

## Configuração (JSON)
- `configs/api.json` — contrato/base `/api/v1`, modo (`demo`/`local`/`remote`) e backend.
- `configs/settings.json` — sistema, UI e provedores/presets declarativos.
- `configs/models.json` — formatos/catálogo e políticas declarativas.
- `configs/generators.json` — geradores registrados/configurados.
- `configs/repacks.json` — repacks/manifests declarados.
- `configs/permissions.json` — papéis/permissões de UI (autorização real requer backend).

## Contrato lógico `/api/v1`
Namespaces declarados podem incluir: `/api/v1/system/`, `models/`, `metadata/`, `quantization/`, `generators/`, `frames/`, `images/`, `videos/`, `engines/`, `repack/`, `tools/`, `users/`, `permissions/`, `config/`, `jobs/`, `storage/`.

> Em hospedagem estática sem backend, operações remotas retornam estado indisponível explícito. Configure `baseUrl` de backend compatível para execução real.

## Integração e recursos da interface
- **Payload de integração:** Dashboard → *Integração e API* → baixar/copiar payload (JSON).
- **Configuração de backend (sessão):** definir URL e modo no dashboard. A UI não valida conectividade automaticamente; execução real depende de backend/runtimes compatíveis.
- **WebSocket (cliente utilitário):** Dashboard → *Integração e API* → informar URL (`ws://`/`wss://`) e, opcionalmente, código/token. Recurso para endpoints externos compatíveis (sem servidor WebSocket no GitHub Pages).
- **Discord Bot (estúdio):** Dashboard → *Discord Bot* → configurar, gerar templates `discord.js` (Node.js), simular comandos/eventos localmente e copiar/baixar arquivos. **Não executa bot no navegador nem conecta ao gateway do Discord.**
- **Demo React (navegador):** `Public/react-vite.html` consome `configs/api.json` e `configs/settings.json` via ESM/CDN (requer rede para dependências externas).
- **Artefatos públicos:** `Public/presets/default-presets.json`, `Public/templates/job-template.json`, `Public/manifests/sample-repack.json`, `Public/locales/*.json`.
- **Documentação:** `Public/documentation/index.html`, `Public/documentation/commands.html`.
- **Master prompt:** `Public/documentation/master-prompt.md`.

## Workers
- `workers/*.worker.js` e `Public/workers/processing.worker.js` usam protocolo unificado `{id,type,payload}` / `{id,type,ok,state,data?,error?}`.
- `ping` responde `pong`; comandos não suportados retornam estados explícitos (ex.: `unsupported`, `unavailable`, `requires-provider`).

## Publicação
- GitHub Pages com artefato estático (`.github/workflows/jekyll-gh-pages.yml`) e `.nojekyll`.
- CI de qualidade em `.github/workflows/ci.yml`.
