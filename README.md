# Frame-Generator-API

API unificada **estática** (compatível com GitHub Pages) para orquestração de **modelos de IA**, **geração de quadros** (storyboard, sequência de vídeo e quadros de dados/UI) e **pacotes de conteúdo** autoajustáveis por manifesto.

> **Importante:** GitHub Pages serve apenas arquivos estáticos. Esta API fornece contratos JSON, catálogos, SDK e adaptadores; operações pesadas (inferência GGUF real, geração de imagens/vídeo, descompilação profunda) são executadas por **runners/servidores externos** conectados via adaptadores.

## O que inclui

- **API estática v1** (`/api/v1/*.json`): descoberta, modelos, quadros, pacotes, comandos, repack, adaptadores e status.
- **Carregador + metadados de modelos**: registro com metadados completos (arquitetura GGUF, tokenizer, contexto, capacidades, quantização, origem/licença) e modos de execução (externo, WASM experimental, catálogo).
- **Geração de quadros**: modos `storyboard`, `video_frames` e `data_panels`, com templates e filas/jobs controlados por contrato JSON.
- **Sistema de pacotes/conteúdos**: manifests versionados; clientes se autoajustam por `version`/`etag`/polling.
- **Protocolo de comandos JSON** com restrições de envio/recebimento e validação por schema.
- **Repack**: pipeline auditável de reconstrução/aprimoramento por manifesto (preenchimento de lacunas, merge de overlays, geração de artefatos derivados) — sem auto-modificação oculta do código-fonte.
- **Painel Admin** (`/admin/`): visão e controle dos registros, comandos e estado.
- **Prompt de integração** (`/prompts/integration.md` e `/api/v1/prompts/integration.json`).

## Estrutura

```
api/v1/                 # Endpoints JSON (discovery + recursos)
schemas/                # Contratos JSON (request/response/comando)
sdk/frame-api.js        # SDK cliente (fetch + auto-sync + validação leve)
admin/                  # Painel de administração/visualização
data/                   # Manifests e registros fonte
prompts/integration.md  # Prompt para integrar em projetos com IA
docs/                   # Documentação adicional
```

## Uso rápido (GitHub Pages / estático)

```js
import { FrameGeneratorAPI } from './sdk/frame-api.js';

const api = new FrameGeneratorAPI({ baseUrl: 'https://<user>.github.io/Frame-Generator-API' });
const discovery = await api.discover();
const models = await api.listModels();
const job = await api.createFrameJob({
  mode: 'storyboard',
  prompt: 'Cena de abertura em floresta neon',
  frames: 6,
  model: 'catalog/llama-storyboard-planner',
  adapter: 'external-http'
});
```

## Modos cobertos (todas as opções)

| Área | Opções suportadas |
|---|---|
| Hospedagem/API | A) Estática (Pages) • B) Adaptadores para backend externo (Cloudflare Worker/Node/Python) • C) Híbrido por configuração |
| Geração de quadros | A) Storyboard • B) Sequência de vídeo/frames • C) Quadros de dados/UI • D) Composto/misto |
| Modelos GGUF | A) Metadados + runner externo • B) Loader WASM experimental (limitado) • C) Catálogo/metadados apenas |

## Limites e segurança

- Sem execução de servidor no Pages: inferência/geração real depende de adaptador externo.
- GGUF: metadados e inspeção de estrutura são suportados no registro; “descompilação” de pesos não é viável — o sistema expõe análise/extração de metadados e grafos de tensores quando fornecidos pelo runner.
- Repack é **transparente e auditável** (planos, diffs de manifesto, logs em JSON); não altera código-fonte escondido.
- Comandos seguem allowlist, limites de tamanho e schemas (`schemas/command.schema.json`).

## Desenvolvimento local

Sirva a pasta como site estático (ex.: `npx serve .` ou extensão Live Server) e abra `/admin/`.
