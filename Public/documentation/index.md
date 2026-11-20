# Frame-Generator-API — Documentação

## Visão geral
Plataforma web modular (FGUA) para gerenciamento de modelos de IA (incl. análise GGUF), geração/aprimoramento de quadros (imagem, vídeo, jogo), engines, repacks, ferramentas, usuários e tarefas, com **API lógica central** (`/api/v1/*`) e núcleo executando no navegador. Hospedagem alvo: **GitHub Pages** (estático).

## Modos de operação
- **Demonstração (padrão):** núcleo local no navegador, análise local suportada, operações remotas sem backend retornam estado indisponível.
- **Local:** conectar backend local via configuração (`configs/api.json` / `configs/settings.json`).
- **Remoto:** conectar API/backend remoto configurado.

## Módulos principais (`src/`)
- **core:** ApiController, ModuleRegistry, EventBus, LifecycleManager
- **configuration:** JsonManager, SettingsManager
- **models:** ModelLoader, MetadataLoader (GGUF), ModelRegistry, ModelCompatibility
- **quantization:** QuantizationManager, QuantizationAnalyzer
- **generators:** FrameGenerator, ImageGenerator, VideoGenerator, GeneratorRegistry
- **processing:** ImageProcessor, VideoProcessor, FrameProcessor
- **engines:** WebGPUEngine, WebCodecsEngine, ONNXEngine (adapter), BackendAdapter
- **repacks:** RepackManager, ToolRegistry, ManifestLoader
- **security:** AuthenticationManager, PermissionManager, ValidationManager
- **storage:** IndexedDBManager, CacheManager, HistoryManager

## Formatos e capacidades (resumo)
- **GGUF:** leitura binária real de cabeçalho/metadados/KVs e índice de tensores no cliente. Execução/inferência e quantização efetiva requerem runtime/provedor compatível.
- **ONNX:** suporte condicionado ao ONNX Runtime Web e compatibilidade do modelo/operadores.
- **Mídia (WebCodecs):** pipeline de decodificação/codificação quando suportado; inferência de IA depende de engine/modelo compatível.
- **WebGPU:** detectado e utilizado por runtimes compatíveis quando disponível.

## Segurança e limites
- GitHub Pages é estático: sem fronteira de segurança de servidor no frontend.
- Não armazenar credenciais/segredos em arquivos públicos.
- Arquivos de modelo são tratados como dados (não executáveis). Validação no cliente; autorização confiável requer backend.
- O sistema não simula processamento de IA; estados `requires-provider`/`unavailable` indicam dependências ausentes.
