### BASE-PLATE ###
# Frame-Generator-API — Master Prompt de Integração (IA / Projetos) v2

Use este prompt ao integrar o **Frame-Generator-API** em um modelo de IA, agente,
pipeline ou projeto. A versão personalizada (com modo/baseUrl/escopo atuais) é
gerada pelo app **Instalador IA** do shell Windows 11.

## Identidade e escopo
- **Nome:** Frame-Generator-API (FGUA) — v2.0.0
- **Objetivo:** núcleo web modular para análise/registro de modelos, inspeção de
  capacidades/recursos e planejamento/integração de fluxos de geração e
  aprimoramento de quadros (imagem, vídeo, jogo) sob um **contrato lógico** (`/api/v1/*`).
- **Runtime:** HTML5, CSS3, JavaScript (ES Modules), execução no navegador.
- **Hospedagem:** GitHub Pages (site estático). **Não há servidor REST nativo** no host.
- **Interface:** shell de sistema operacional Windows 11 (taskbar, Start menu,
  Quick Settings, Centro de Notificações, janelas com snap) + 12 apps integrados.
- **Site:** https://kauan11-boop.github.io/Frame-Generator-API/
- **Repositório:** https://github.com/kauan11-boop/Frame-Generator-API

## Arquitetura (v2)
- `src/` (núcleo modular — 10 pastas): `core`, `config`, `models`, `runtime`,
  `api`, `generators`, `repacks`, `security`, `storage`, `shell`.
- `Public/` (interface — 10 pastas): `desktop`, `apps`, `styles`, `assets`,
  `documentation`, `presets`, `templates`, `manifests`, `locales`, `workers`.
- `configs/` (JSON único editável): `api.json`, `models.json`, `generators.json`,
  `repacks.json`, `permissions.json`, `settings.json`.
- `tests/` e `scripts/`: validações e testes automatizados (`npm run ci`).

## Contrato lógico `/api/v1`
Namespaces: `system`, `models`, `metadata`, `quantization`, `generators`,
`frames`, `images`, `videos`, `engines`, `repack`, `tools`, `users`,
`permissions`, `config`, `jobs`, `storage`.

Modos:
- `demo` (padrão): sem backend conectado; operações remotas retornam
  indisponibilidade explícita.
- `local` / `remote`: conectar `baseUrl` de backend compatível (ex.: LM Studio)
  para execução real.

## Capacidades e limites reais (obrigatório respeitar)
- **GGUF:** análise de metadados no cliente com parser binário (magic 0x46554747,
  header, KV, tensores; orçamento de header 32 MB). Carregamento/inferência real
  requer runtime/provedor compatível.
- **Quantização:** identificação, estimativa e planejamento disponíveis;
  **conversão/quantização efetiva requer runtime externo**. Arquivo original deve
  ser preservado. **Sem conversão fictícia.**
- **Geração/processamento (imagem/vídeo/frames):** planejamento/análise e estados
  explícitos; execução real depende de engine/modelo/provedor/pipeline compatível.
  **Sem simulação de resultados.**
- **Engines:** detecção de WebGPU/WebGL/WASM(WebCodecs), adaptadores TensorFlow.js
  e Transformers.js sob demanda via CDN, adapter ONNX Web (quando runtime
  disponível) e backend configurável.
- **Segurança:** autenticação/permissões em nível de UI no cliente estático.
  **Autorização confiável exige backend.** Não armazenar segredos em arquivos públicos.
- **Jogos:** não afirmar interceptação automática de pipeline gráfico; usar apenas
  integrações/capturas autorizadas e compatíveis.

## Integração recomendada
1. Consumir `configs/*.json` e o **payload de integração** exportado pelo dashboard
   para descobrir capacidades, recursos e contrato.
2. Configurar backend/provedor compatível quando for necessária execução real
   (LM Studio: `http://localhost:1234` + **CORS habilitado**).
3. Selecionar engine/modelo/provedor conforme formato, operação e capacidades
   detectadas.
4. Tratar estados explicitamente: `ready`, `planned`, `analyzed`,
   `requires-provider`, `requires-runtime`, `unavailable`, `invalid`, `failed`,
   `cancelled`, `succeeded`.
5. Validar manifests/configs antes de uso e respeitar limites de ambiente estático.
   Verificação: `npm run ci`.

## LM Studio
- Compatível com OpenAI: `GET /v1/models`, `POST /v1/chat/completions`,
  `POST /v1/completions`, `POST /v1/embeddings`, `POST /v1/responses`.
- REST nativa v1 (LM Studio 0.4+): `GET /api/v1/models`, `POST /api/v1/chat`,
  `POST /api/v1/models/load`, `POST /api/v1/models/unload`.
- REST v0 (legado 0.3.6+): `GET /api/v0/models`, `GET /api/v0/models/{model}`,
  `POST /api/v0/chat/completions`, `POST /api/v0/completions`, `POST /api/v0/embeddings`.
- CORS obrigatório para acesso do navegador; autenticação opcional via
  `Authorization: Bearer <token>` (Manage Tokens no LM Studio).

## Repacks multi-ferramenta
Um comando instala/executa vários passos declarativos: `POST /api/v1/repack/install`
com `{ "id": "gguf-analyst" }` executa metadados → estimativa → plano → registro,
registrando o estado real de cada passo.

## Recursos úteis
- Área de trabalho: `/Public/desktop/index.html`
- Dashboard: `/Public/dashboard.html`
- Documentação: `/Public/documentation/index.html`, `/Public/documentation/commands.html`
- Configs: `/configs/*.json`
- Presets/template/manifest (públicos): `/Public/presets/default-presets.json`,
  `/Public/templates/job-template.json`, `/Public/manifests/sample-repack.json`
- Licença: `LICENSE` (MIT)
- Verificação local: `npm run ci`
