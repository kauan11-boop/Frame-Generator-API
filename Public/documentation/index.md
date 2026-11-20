# Frame-Generator-API — Documentação

- **Projeto:** Frame-Generator-API (FGUA)
- **Responsável:** Kauan Henrique Alves dos Reis
- **Versão:** 2.0.0
- **Licença:** MIT
- **Site:** https://kauan11-boop.github.io/Frame-Generator-API/
- **Repositório:** https://github.com/kauan11-boop/Frame-Generator-API

## Visão geral
Plataforma web modular estática para análise e registro de modelos (incluindo GGUF, com limites no navegador), inspeção de capacidades/engines/provedores e integração por **contrato lógico** `/api/v1/*`. Executa no navegador e é hospedada como site estático no **GitHub Pages**.

> **Estado real:** o projeto prioriza transparência de estado e integração. Operações de inferência, quantização/conversão efetiva e processamento pesado **não são simuladas** e dependem de runtime/engine/provedor/backend compatível.

## Interface web atual (dashboard)
O dashboard inclui:
- **Visão geral:** status do núcleo, diagnóstico de configurações, capacidades do navegador, resumo da sessão e gráfico local de uso de ferramentas/recursos.
- **Recursos e capacidades:** engines detectadas, WebGPU/WebCodecs e provedores registrados/configurados.
- **Modelos (sessão):** modelos analisados/registrados na sessão (**análise ≠ inferência**).
- **Geradores e presets:** geradores registrados, presets declarativos/públicos e template de tarefa.
- **Tarefas:** estados de tarefas da sessão quando criadas via núcleo/integração.
- **Integração e API:** contrato/namespaces, configuração de backend na sessão, cliente utilitário WebSocket (opcional), payload de integração e exemplos.
- **Discord Bot:** configuração e geração de templates `discord.js` (Node.js), com simulação local de comandos/eventos e preview/cópia/download de arquivos embutidos (**sem execução de bot no navegador/gateway**).
- **Configurações e permissões:** arquivos públicos de configuração e papéis/permissões de UI.
- **Documentação e recursos:** docs, master prompt, manifesto de exemplo e notas de limites/privacidade.

> Não há fluxos completos de upload/execução/gerenciamento administrativo na UI sem runtime/provedor compatível.

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
- **Jobs/tarefas:** estados explícitos (`pending`, `queued`, `running`, `succeeded`, `failed`, `cancelled`, `unavailable`).
- **WebSocket (cliente):** utilitário para conectar/enviar/receber mensagens em endpoints externos compatíveis; GitHub Pages não fornece servidor WebSocket.
- **Discord Bot (estúdio):** gera templates e simula comandos/eventos localmente na UI; execução real requer runtime Node.js externo, token seguro e configuração adequada.
- **React demo:** página integrada executada no navegador (ESM/CDN) para consumo de configs/contrato; build/deploy Vite externo é opcional.
- **Segurança e privacidade:** sem fronteira de servidor no frontend estático; autenticação/permissões no cliente são de UI. Não armazenar segredos em arquivos públicos. Autorização confiável requer backend. Informações de hardware podem ser aproximadas ou omitidas pelo navegador.

## Recursos públicos adicionais
- **Presets:** `Public/presets/default-presets.json` e `configs/settings.json`.
- **Template de tarefa:** `Public/templates/job-template.json`.
- **Manifesto de exemplo:** `Public/manifests/sample-repack.json`.
- **Locales:** `Public/locales/pt-BR.json`, `Public/locales/en-US.json`.

## Workers
Workers em `workers/` e espelho em `Public/workers/` usam protocolo unificado `{id,type,payload}` / `{id,type,ok,state,data?,error?}` e respondem explicitamente para comandos não suportados/indisponíveis no ambiente atual.
