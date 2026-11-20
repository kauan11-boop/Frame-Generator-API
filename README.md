# Frame-Generator-API

API unificada **estática** (compatível com GitHub Pages) para orquestração de **modelos de IA**, **geração de quadros** (storyboard, sequência de vídeo e quadros de dados/UI) e **pacotes de conteúdo** autoajustáveis por manifesto.

> **Importante:** GitHub Pages serve apenas arquivos estáticos. Esta API fornece contratos JSON, catálogos, SDK e adaptadores; operações pesadas (inferência GGUF real, geração de imagens/vídeo, descompilação profunda) são executadas por **runners/servidores externos** conectados via adaptadores.

## Estrutura

- **`public/`** — interface web (landing + dashboard) organizada em `css/`, `js/` e `assets/`, consumindo a API estática em `src/api/v1/`.
- **`src/`** — núcleo da API/conteúdos, organizado em 15 pastas:
  - `api/` (endpoints estáticos `v1/*.json`), `schemas/`, `sdk/`, `data/`, `prompts/`, `scripts/` (repack/validate, **sem alterações de lógica**), `docs/`, `assets/`, `config/`, `adapters/`, `models/`, `frames/`, `packages/`, `repack/`, `interface/` (referência organizacional da camada de UI).
- **Raiz** — `index.html` (redireciona para `public/`), `README.md`, `.github/`.

## O que inclui

- **API estática v1** (`src/api/v1/*.json`): descoberta, modelos, quadros, pacotes, comandos, repack, adaptadores, conteúdo e status.
- **Carregador + metadados de modelos**: GGUF (general/architecture/tokenizer/tensors/inspection) e modos A (runner externo), B (WASM experimental) e C (catálogo).
- **Geração de quadros**: `storyboard`, `video_frames`, `data_panels` e `composite`, com templates e controle por contrato JSON.
- **Pacotes/conteúdos autoajustáveis**: manifests versionados; clientes se reidratam por `version`/`etag`.
- **Protocolo de comandos JSON** com allowlist e validação por schema.
- **Repack**: pipeline auditável (scan→diff→plan→simulate→apply→verify), sem alteração oculta do código-fonte.
- **Prompt de integração**: `src/prompts/integration.md` e `src/api/v1/prompts/integration.json` (aba no dashboard).

## Uso rápido

```js
import { FrameGeneratorAPI } from './src/sdk/frame-api.js';

const api = new FrameGeneratorAPI({ baseUrl: 'https://<user>.github.io/Frame-Generator-API/src' });
const discovery = await api.discover();
const models = await api.listModels();
```

## Desenvolvimento e validação

- Servir localmente: `npx serve .` e abrir `/public/` (ou `/` que redireciona).
- Validar manifests/schemas: `node src/scripts/validate.mjs`
- Repack (auditável): `node src/scripts/repack.mjs verify` (ou `scan|plan|simulate|apply --plan <id> --approve`)

## Modos cobertos (todas as opções)

| Área | Opções suportadas |
|---|---|
| Hospedagem/API | A) Estática (Pages) • B) Adaptadores para backend externo • C) Híbrido |
| Geração de quadros | A) Storyboard • B) Sequência de vídeo/frames • C) Quadros de dados/UI • D) Composto/misto |
| Modelos GGUF | A) Metadados + runner externo • B) Loader WASM experimental (limitado) • C) Catálogo/metadados apenas |

## Limites e segurança

- Sem execução de servidor no Pages: inferência/geração real depende de adaptador externo.
- GGUF: metadados e inspeção de estrutura/índice de tensores suportados; **não há descompilação de pesos**.
- Repack é **transparente e auditável** (planos, simulação, aprovação, derivados); não altera código-fonte escondido.
- Comandos seguem allowlist, limites de tamanho e schemas.
