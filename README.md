# Frame-Generator-API

Plataforma web modular e estática (FGUA) para **análise e registro de modelos** (incluindo metadados GGUF no navegador, com limites), inspeção de **capacidades/engines/provedores**, gestão de configurações públicas e **integração unificada** por contrato lógico (`/api/v1/*`). Projetada para execução no navegador e hospedagem no **GitHub Pages**.

- **Responsável:** Kauan Henrique Alves dos Reis
- **Versão:** 2.0.0
- **Licença:** MIT (`LICENSE`)
- **Site:** https://kauan11-boop.github.io/Frame-Generator-API/
- **Dashboard:** https://kauan11-boop.github.io/Frame-Generator-API/Public/dashboard.html
- **Documentação:** https://kauan11-boop.github.io/Frame-Generator-API/Public/documentation/index.html
- **Repositório:** https://github.com/kauan11-boop/Frame-Generator-API
- **Histórico de alterações:** `CHANGELOG.md`

> **Hospedagem estática:** não há servidor REST nativo no GitHub Pages. O frontend expõe um **contrato lógico** `/api/v1/*` e opera em modos `demo`/`local`/`remote`. Operações de inferência, carregamento real de pesos, quantização/conversão efetiva e processamento pesado dependem de **runtime/engine/provedor/backend compatível** configurado; quando indisponíveis, o sistema retorna estado explícito (**sem simulação de resultados**).

## Interface web atual (estado real)
O dashboard oferece:
- **Visão geral:** status do núcleo, diagnóstico de configurações, capacidades do navegador, resumo de recursos da sessão e gráfico local de uso de ferramentas/recursos.
- **Recursos e capacidades:** engines detectadas, detalhes de WebGPU/WebCodecs e provedores registrados/configurados.
- **Modelos (sessão):** modelos analisados/registrados na sessão atual, com metadados/estado quando disponíveis (**análise ≠ inferência**).
- **Geradores e presets:** geradores registrados, presets declarativos/públicos e template de tarefa.
- **Tarefas:** lista e estados de tarefas da sessão (quando criadas via núcleo/integração).
- **Integração e API:** contrato/namespaces, configuração de backend na sessão, cliente utilitário WebSocket (opcional), exportação/cópia/download de payload e exemplos.
- **Discord Bot:** estúdio no navegador para configurar e gerar templates `discord.js` (Node.js), com **simulação local de comandos/eventos** e preview/cópia/download de arquivos embutidos. **Não executa bot no navegador nem conecta ao gateway do Discord.**
- **Configurações e permissões:** acesso aos arquivos públicos de configuração e visão das permissões/papéis de UI.
- **Documentação e recursos:** documentação, master prompt, manifesto de exemplo e notas de limites/privacidade/segurança.

> Não há fluxos completos de upload/execução/gerenciamento administrativo na UI sem runtime/provedor compatível. A interface prioriza transparência de estado, integração e geração de artefatos/configurações.

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
- **Configurações:** `configs/api.json`, `configs/settings.json`, `configs/models.json`, `configs/generators.json`, `configs/repacks.json`, `configs/permissions.json`
- **Artefatos UI/docs:** `Public/presets/default-presets.json`, `Public/templates/job-template.json`, `Public/manifests/sample-repack.json`
- **Internacionalização (base):** `Public/locales/pt-BR.json`, `Public/locales/en-US.json`
- **Demonstração integrada:** `Public/react-vite.html` (executa no navegador via ESM/CDN; requer rede para dependências externas)

> Em ambiente estático, aplique backend compatível para execução remota/local conforme seu cenário. Não armazene segredos em arquivos públicos (tokens, chaves, credenciais). Para WebSocket/Discord reais, use endpoints e runtimes externos seguros.

## Limites reais (importante)
- **Sem backend em GitHub Pages:** endpoints `/api/v1/*` são contrato lógico; operações remotas retornam indisponível quando não configuradas.
- **Sem execução simulada:** inferência, quantização/conversão efetiva e processamento pesado de imagem/vídeo não são executados no navegador sem runtime/provedor compatível.
- **WebSocket/Discord:** o cliente WebSocket é utilitário para endpoints externos compatíveis; o estúdio Discord gera templates e simula comandos/eventos localmente na UI, mas **não** conecta ao gateway nem executa bot em ambiente estático.
- **Jogos:** não há interceptação automática de pipeline gráfico; integrações devem ser autorizadas e providas por componentes compatíveis.
- **Segurança:** controles de usuário/permissão no cliente são de UI apenas (não são fronteira de segurança). Autenticação/autorização confiáveis exigem backend.

## Deploy
- **GitHub Pages:** publicação estática via `.github/workflows/jekyll-gh-pages.yml` com `.nojekyll`.
- **CI:** verificação automática em `.github/workflows/ci.yml` (`lint:syntax`, `check:json`, `test`).
