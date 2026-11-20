# Frame-Generator-API

API unificada **estática** (compatível com GitHub Pages) para orquestração de **modelos de IA**, **geração de quadros** (storyboard, sequência de vídeo e quadros de dados/UI) e **pacotes de conteúdo** autoajustáveis por manifesto.

> **Importante:** GitHub Pages serve apenas arquivos estáticos. Esta API fornece contratos JSON, catálogos, SDK e adaptadores; operações pesadas (inferência GGUF real, geração de imagens/vídeo, descompilação profunda) são executadas por **runners/servidores externos** conectados via adaptadores.

## Domínio (GitHub Pages)

- **Site/Interface:** https://kauan11-boop.github.io/Frame-Generator-API/ (redireciona para `Public/`)
- **Dashboard:** https://kauan11-boop.github.io/Frame-Generator-API/Public/dashboard.html
- **Discovery (API):** https://kauan11-boop.github.io/Frame-Generator-API/src/03_API/v1/index.json
- **Base da API (SDK):** `https://kauan11-boop.github.io/Frame-Generator-API/src`

## Arquitetura

```text
Frame-Generator-API/
├── src/
│   ├── 01_Core/
│   ├── 02_Configuration/
│   ├── 03_API/
│   ├── 04_FrameEngine/
│   ├── 05_FrameGeneration/
│   ├── 06_Interpolation/
│   ├── 07_Rendering/
│   ├── 08_Queue/
│   ├── 09_Processing/
│   ├── 10_Storage/
│   ├── 11_Models/
│   ├── 12_Validation/
│   ├── 13_Logging/
│   ├── 14_Security/
│   └── 15_Integration/
│
├── Public/
│   ├── index.html
│   ├── css/
│   ├── js/
│   ├── assets/
│   └── components/
│
└── README.md
```

### Mapeamento principal

- **`Public/`** — interface web moderna/minimalista (landing + dashboard) consumindo `src/03_API/v1/`.
- **`src/03_API/v1/`** — endpoints estáticos da API (discovery, modelos, quadros, pacotes, comandos, repack, adaptadores, conteúdo, status, prompts).
- **`src/12_Validation/`** — schemas JSON (command/response/frame-job).
- **`src/15_Integration/`** — SDK e organização de integração/adaptadores/interface.
- **`src/10_Storage/`** — dados/manifests, índices e artefatos do Repack.
- **`src/09_Processing/`** — scripts de processamento (`repack.mjs`, `validate.mjs`).
- **`src/02_Configuration/`** — configurações e prompts de integração.
- **`src/11_Models/`**, **`src/05_FrameGeneration/`**, **`src/04_FrameEngine/`**, **`src/06_Interpolation/`**, **`src/07_Rendering/`**, **`src/08_Queue/`**, **`src/01_Core/`**, **`src/13_Logging/`**, **`src/14_Security/`** — organização por domínio para evolução do sistema.

## O que inclui

- **API estática v1**: discovery, modelos, quadros, pacotes, comandos, repack, adaptadores, conteúdo e status.
- **Carregador + metadados de modelos**: GGUF (general/architecture/tokenizer/tensors/inspection) e modos A (runner externo), B (WASM experimental) e C (catálogo).
- **Geração de quadros**: `storyboard`, `video_frames`, `data_panels` e `composite`, com templates e controle por contrato JSON.
- **Pacotes/conteúdos autoajustáveis**: manifests versionados; clientes se reidratam por `version`/`etag`.
- **Protocolo de comandos JSON** com allowlist e validação por schema.
- **Repack**: pipeline auditável (scan→diff→plan→simulate→apply→verify), sem alteração oculta do código-fonte.
- **Prompt de integração**: `src/02_Configuration/prompts/integration.md` e `src/03_API/v1/prompts/integration.json` (aba no dashboard).

## Uso rápido

```js
import { FrameGeneratorAPI } from './src/15_Integration/sdk/frame-api.js';

const api = new FrameGeneratorAPI({ baseUrl: 'https://kauan11-boop.github.io/Frame-Generator-API/src' });
const discovery = await api.discover();
const models = await api.listModels();
```

## Desenvolvimento e validação

- Servir localmente: `npx serve .` e abrir `/Public/` (ou `/` que redireciona).
- Validar manifests/schemas: `node src/09_Processing/validate.mjs`
- Repack (auditável): `node src/09_Processing/repack.mjs verify` (ou `scan|plan|simulate|apply --plan <id> --approve`)

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
