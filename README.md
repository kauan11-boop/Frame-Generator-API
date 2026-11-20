# Frame-Generator-API

Plataforma web modular para **carregamento/análise de modelos de IA**, **geração e aprimoramento de quadros** (imagem/vídeo/jogo) e **administração unificada** (API lógica, geradores, engines, repacks, ferramentas, usuários e tarefas), projetada para execução estática no navegador e hospedagem no **GitHub Pages**.

- **Domínio:** https://kauan11-boop.github.io/Frame-Generator-API/
- **Interface/Dashboard:** https://kauan11-boop.github.io/Frame-Generator-API/Public/dashboard.html

> **Hospedagem estática:** não há servidor REST no GitHub Pages. O frontend expõe uma **API lógica central** (`/api/v1/*` como contrato), opera em **modo demonstração/local** e pode ser conectado a **backend local/remoto** configurável. Processamento pesado/inferência real depende de engines, runtimes ou provedores compatíveis; operações indisponíveis retornam estado explícito (**sem simulação**).

## Estrutura

```text
Frame-Generator-API/
├── index.html
├── README.md
├── LICENSE
├── manifest.json
├── src/                         (10 pastas)
│   ├── core/                    ApiController.js, ModuleRegistry.js, EventBus.js, LifecycleManager.js
│   ├── configuration/           JsonManager.js, SettingsManager.js
│   ├── models/                  ModelLoader.js, MetadataLoader.js, ModelRegistry.js, ModelCompatibility.js
│   ├── quantization/            QuantizationManager.js, QuantizationAnalyzer.js
│   ├── generators/              FrameGenerator.js, ImageGenerator.js, VideoGenerator.js, GeneratorRegistry.js
│   ├── processing/              ImageProcessor.js, VideoProcessor.js, FrameProcessor.js
│   ├── engines/                 WebGPUEngine.js, WebCodecsEngine.js, ONNXEngine.js, BackendAdapter.js
│   ├── repacks/                 RepackManager.js, ToolRegistry.js, ManifestLoader.js
│   ├── security/                AuthenticationManager.js, PermissionManager.js, ValidationManager.js
│   └── storage/                 IndexedDBManager.js, CacheManager.js, HistoryManager.js
├── Public/                      (interface e recursos)
│   ├── css/ js/ images/ icons/ components/ dashboard/ models/ generators/ tools/
│   ├── repacks/ themes/ templates/ workers/ manifests/ presets/ documentation/
│   └── locales/ assets/
└── configs/
    ├── api.json
    ├── models.json
    ├── generators.json
    ├── repacks.json
    ├── permissions.json
    └── settings.json
```

## Implementado (base funcional)

- **Core unificado:** `EventBus`, `ModuleRegistry`, `LifecycleManager`, `ApiController` (contrato `/api/v1`, modos demo/local/remoto, adaptadores).
- **Modelos:** detecção de formato, **parser GGUF real** no navegador (assinatura/cabeçalho, versão, metadados KV e índice de tensores/tipos/dimensões/offsets), registro, compatibilidade e carregamento condicionado a runtime/provedor.
- **Quantização:** identificação, análise, estimativa e planejamento; conversão delegada a runtime/provedor compatível (arquivo original preservado, sem conversão fictícia).
- **Geradores/Processamento:** `FrameGenerator`, `ImageGenerator`, `VideoGenerator`, processadores de imagem/vídeo/quadros, planejamento e análise local; execução de inferência/processamento avançado requer engine/provedor compatível.
- **Engines:** detecção/estado de `WebGPU`, `WebCodecs`, adaptador `ONNX Runtime Web` (quando runtime carregado) e `BackendAdapter` configurável.
- **Repacks/Ferramentas:** `ManifestLoader` (validação), `ToolRegistry`, `RepackManager` (importação/registro/validação).
- **Segurança/Usuários (UI):** `AuthenticationManager`, `PermissionManager`, `ValidationManager` (validação de arquivos/JSON/endpoints; controle de UI em ambiente estático).
- **Storage/Jobs:** `IndexedDBManager`, `CacheManager`, `HistoryManager` e gerenciador de tarefas/estados no núcleo.
- **Dashboard (sidebar, 15 áreas):** Dashboard, Frame/Game/Image/Video Generator, Model Manager, GGUF Loader, Metadata, Quantization, Engine Manager, Repack Manager, Tool Manager, API Manager, User Manager e Settings — integrados ao núcleo (estado, capacidades, análise GGUF, registro, planos, tarefas, engines/provedores, manifests, configs, usuários/permissões e logs).

## Desenvolvimento local

```bash
npx serve .
```
- Abrir `http://localhost:3000/` (bootstrap) ou `http://localhost:3000/Public/dashboard.html`.

## Configuração e integração

- Ajuste `configs/api.json` e `configs/settings.json` para apontar backend local/remoto quando disponível.
- `/api/v1/*` representa o **contrato lógico** da plataforma; em GitHub Pages, sem backend, o cliente retorna estado indisponível explícito para operações remotas.
- Modelos GGUF: análise/metadados no cliente; pesos/inferência dependem de runtime compatível. Arquivos originais não são modificados na inspeção.

## Limites e segurança

- Não há interceptação automática de pipeline gráfico de jogos, nem inferência/quantização “mágica” no navegador sem runtime compatível.
- Resultados de IA/processamento pesado não são simulados; quando indisponíveis, o sistema informa requisito/provedor.
- Autenticação/autorização confiáveis exigem backend; não armazenar credenciais/segredos em arquivos públicos. Arquivos de modelo são tratados como dados (não executáveis).

## Licença

MIT — ver `LICENSE`.
