# Comandos e Operações — Frame-Generator-API

## Desenvolvimento e publicação
- **Servir localmente (estático):** `npx serve .`
  - Abrir: `http://localhost:3000/` (bootstrap) ou `http://localhost:3000/Public/dashboard.html`
- **Publicação:** GitHub Pages (branch/main conforme configuração do repositório), raiz do site com `.nojekyll`.

## Configuração (JSON, padrão)
- `configs/api.json` — contrato/base `/api/v1`, modo (`demo`/`local`/`remote`), backend (local/remote).
- `configs/settings.json` — sistema, UI, provedores e presets.
- `configs/models.json` — formatos suportados e catálogo/config de modelos.
- `configs/generators.json` — geradores registrados/configurados.
- `configs/repacks.json` — repacks/manifests.
- `configs/permissions.json` — papéis e permissões (UI; autorização real requer backend).

## API lógica (contrato `/api/v1`)
- **System/Config:** `GET /api/v1/system/*`, `GET|PUT /api/v1/config`
- **Models/Metadata:** `GET /api/v1/models`, `POST /api/v1/models/load|unload|inspect`, `GET /api/v1/models/metadata`
- **Quantization:** `GET /api/v1/quantization/types`, `POST /api/v1/quantization/analyze|jobs`
- **Generators/Frames/Images/Videos:** `GET /api/v1/generators`, `POST /api/v1/generators/execute`, `POST /api/v1/frames/*`, `POST /api/v1/images/*`, `POST /api/v1/videos/*`
- **Engines:** `GET /api/v1/engines`
- **Repacks/Tools:** `GET|POST /api/v1/repack/*`, `GET|POST /api/v1/tools/*`
- **Jobs:** `GET /api/v1/jobs`, `POST /api/v1/jobs/{id}/cancel`
- **Users/Permissions:** `GET|POST /api/v1/users`, `GET|POST /api/v1/permissions`

> Em GitHub Pages (sem backend), chamadas retornam indisponibilidade explícita; configure `baseUrl` de backend compatível para execução.

## Repacks e ferramentas (multi-ferramenta via JSON)
- **Manifesto de repack (exemplo):** `Public/manifests/sample-repack.json`
- **Importar/validar:** via núcleo (`RepackManager.import/validate`) ou integração de projeto consumindo o manifesto JSON e registrando módulos compatíveis.
- **Ferramentas:** registro em `ToolRegistry` (metadados/handlers quando disponíveis); execução depende de runtime/provedor.

## Modelos (GGUF)
- **Analisar metadados (UI):** Dashboard/Integração → fluxo de análise no núcleo (upload local) ou `ModelLoader.analyzeFile(file)`; parser binário real (GGUF v2/v3), identifica F32/F16/BF16 (sem quantização) e tipos quantizados.
- **Carregar/Descarregar:** requer runtime/provedor compatível (`ModelLoader.loadModel/unloadModel`).

## Integração em projetos/IA
- **Exportar payload:** Dashboard → *Integração* → "Baixar payload de integração (JSON)" (`frame-generator-api-integration.json`).
- **Consumir configs:** `fetch('<site>/configs/api.json')` etc.
- **Master prompt:** `Public/documentation/master-prompt.md`

## Licença
- **MIT** — ver `LICENSE`.
