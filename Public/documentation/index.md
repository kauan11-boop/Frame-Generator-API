# Frame-Generator-API — Documentação

## Visão geral
Plataforma web modular estática (FGUA) para análise e registro de modelos (incl. GGUF, com limites no navegador), inspeção de capacidades/engines/provedores e integração por **contrato lógico** `/api/v1/*`. Execução no navegador com hospedagem alvo em **GitHub Pages**.

> **Interface web atual:** o dashboard oferece visão geral, inspeção de recursos/capacidades, visualização de registros da sessão (modelos, geradores, tarefas quando existentes), configuração de backend na sessão, exportação de payload de integração e acesso a configurações/documentação/artefatos públicos. Não há fluxos completos de upload/execução/gerenciamento administrativo na UI sem runtime/provedor compatível.

## Modos de operação
- **`demo` (padrão):** núcleo local no navegador. Operações que exigem backend/provedor retornam indisponibilidade explícita.
- **`local` / `remote`:** permitem configurar URL base de backend compatível (na sessão/runtime) para operações externas.

> Em todos os modos, inferência, quantização efetiva e processamento pesado **não são simulados**.

## Contrato e configuração
- Contrato lógico: `configs/api.json` (`base`, `mode`, `backend`, `namespaces`) e `ApiController.getContract()`.
- Configurações públicas: `configs/settings.json`, `configs/models.json`, `configs/generators.json`, `configs/repacks.json`, `configs/permissions.json`.
- Payload de integração: exportado pelo dashboard com status, capacidades, recursos registrados e referências.

## Módulos (`src/`)
- **core:** EventBus, ModuleRegistry, LifecycleManager, ApiController, JobManager, ProviderManager, utilitários/contratos.
- **configuration:** JsonManager, SettingsManager.
- **models:** MetadataLoader (GGUF), ModelLoader, ModelRegistry, ModelCompatibility.
- **quantization:** QuantizationAnalyzer, QuantizationManager (análise/planejamento; execução efetiva requer runtime externo).
- **generators:** FrameGenerator, ImageGenerator, VideoGenerator, GeneratorRegistry.
- **processing:** ImageProcessor, VideoProcessor, FrameProcessor.
- **engines:** WebGPUEngine, WebCodecsEngine, ONNXEngine (adapter), BackendAdapter.
- **repacks:** ManifestLoader, RepackManager, ToolRegistry.
- **security:** AuthenticationManager, PermissionManager, ValidationManager (nível de UI/cliente em ambiente estático).
- **storage:** IndexedDBManager, CacheManager, HistoryManager.

## Capacidades e limites
- **GGUF:** parser no navegador com validações de limites e extração de metadados/tensores (sujeito a tamanho/memória do cliente). Carregamento/inferência requer runtime/provedor compatível.
- **ONNX:** dependente de ONNX Runtime Web carregado e compatibilidade de modelo/operadores.
- **WebCodecs/WebGPU:** detectados quando disponíveis; uso efetivo depende de pipeline/modelo/runtime compatível.
- **Jobs:** estados explícitos (`pending`, `queued`, `running`, `succeeded`, `failed`, `cancelled`, `unavailable`).
- **Segurança:** sem fronteira de servidor no frontend estático; não armazenar segredos em arquivos públicos. Autorização confiável requer backend.

## Recursos públicos adicionais
- **Presets:** `Public/presets/default-presets.json` e `configs/settings.json`.
- **Template de tarefa:** `Public/templates/job-template.json`.
- **Manifesto de exemplo:** `Public/manifests/sample-repack.json`.
- **Locales:** `Public/locales/pt-BR.json`, `Public/locales/en-US.json`.

## Workers
Workers em `workers/` e espelho em `Public/workers/` usam protocolo unificado `{id,type,payload}` / `{id,type,ok,state,data?,error?}` e respondem explicitamente para comandos não suportados/indisponíveis no ambiente atual.
