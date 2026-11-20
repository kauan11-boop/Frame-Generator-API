# Frame-Generator-API

Plataforma web modular e estática para **análise/registro de modelos** (incl. metadados GGUF no navegador, com limites), inspeção de capacidades/engines/provedores e **integração unificada** por contrato lógico (`/api/v1/*`). Projetada para execução no navegador e hospedagem no **GitHub Pages**.

- **Site:** https://kauan11-boop.github.io/Frame-Generator-API/
- **Dashboard:** https://kauan11-boop.github.io/Frame-Generator-API/Public/dashboard.html
- **Documentação:** https://kauan11-boop.github.io/Frame-Generator-API/Public/documentation/index.html
- **Licença:** MIT (`LICENSE`)

> **Hospedagem estática:** não há servidor REST nativo no GitHub Pages. O frontend expõe um **contrato lógico** `/api/v1/*` e opera em modos `demo`/`local`/`remote`. Operações de inferência, carregamento real de pesos, quantização efetiva e processamento pesado dependem de **runtime/engine/provedor compatível** configurado; quando indisponíveis, o sistema retorna estado explícito (**sem simulação de resultados**).

## Interface web atual (estado real)
O dashboard oferece:
- **Visão geral:** status do núcleo, diagnóstico de configs, capacidades do navegador e resumo de recursos da sessão.
- **Recursos e capacidades:** engines detectadas e provedores registrados/configurados.
- **Modelos (sessão):** modelos analisados/registrados na sessão atual, com metadados/estado quando disponíveis (análise ≠ inferência).
- **Geradores e presets:** geradores registrados, presets declarativos/públicos e template de tarefa.
- **Tarefas:** lista/estados de tarefas da sessão (quando criadas via núcleo/integração).
- **Integração e API:** contrato/namespaces, configuração de backend na sessão, exportação/cópia de payload e exemplos.
- **Configurações e permissões:** acesso aos arquivos de configuração públicos e visão das permissões de UI.
- **Documentação e recursos:** links para docs, master prompt, manifesto de exemplo e notas de limites/privacidade.

> Não há fluxos completos de upload/execução/gerenciamento administrativo na UI sem runtime/provedor compatível. A interface prioriza transparência de estado e integração.

## Estrutura (resumo)

```text
Frame-Generator-API/
├── index.html                     # página inicial (entrada principal)
├── Public/                        # UI, dashboard, documentação, assets e artefatos públicos
│   ├── dashboard.html
│   ├── js/ css/ icons/ images/
│   ├── documentation/             # HTML e Markdown
│   ├── workers/ manifests/ presets/ templates/ locales/
├── src/                           # núcleo modular (10 pastas)
│   ├── core/ configuration/ models/ quantization/ generators/
│   ├── processing/ engines/ repacks/ security/ storage/
├── configs/                       # configuração JSON (api, models, generators, repacks, permissions, settings)
├── workers/                       # workers (protocolo unificado)
├── archive/                       # conteúdo legado/arquivado (não é fonte de verdade do runtime ativo)
├── tests/ scripts/ .github/workflows/
└── manifest.json
```

## Desenvolvimento e verificação

```bash
npx serve .
# abrir / ou /Public/dashboard.html

npm run ci
# executa: lint:syntax, check:json, test
```

Scripts úteis:
- `npm run lint:syntax` — checagem de sintaxe JS/MJS
- `npm run check:json` — validação de JSONs (configs, manifests, presets, locales, templates)
- `npm test` — testes automatizados (Node test runner)

## Configuração e artefatos públicos
- `configs/api.json`, `configs/settings.json`, `configs/models.json`, `configs/generators.json`, `configs/repacks.json`, `configs/permissions.json`
- `Public/presets/default-presets.json`, `Public/templates/job-template.json`, `Public/manifests/sample-repack.json`
- `Public/locales/pt-BR.json`, `Public/locales/en-US.json`

> Em ambiente estático, aplique backend compatível para execução remota/local conforme seu cenário. Não armazene segredos em arquivos públicos.

## Limites reais (importante)
- Sem backend em GitHub Pages: endpoints `/api/v1/*` são contrato lógico; chamadas remotas retornam indisponível quando não configuradas.
- Não há inferência/quantização/conversão/processamento pesado no navegador sem runtime compatível.
- Não há interceptação automática de pipeline gráfico de jogos; integrações devem ser autorizadas e providas por componentes compatíveis.
- Controles de usuário/permissão no cliente são de UI apenas (não são fronteira de segurança).

## Deploy
O repositório inclui `.nojekyll` e workflow para publicação estática no GitHub Pages (`.github/workflows/jekyll-gh-pages.yml`) e workflow de CI (`.github/workflows/ci.yml`).
