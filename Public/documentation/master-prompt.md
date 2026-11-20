# Frame-Generator-API — Master Prompt de Integração (IA / Projetos)

Use este prompt ao integrar o **Frame-Generator-API** em um modelo de IA, agente, pipeline ou projeto. Trate-o como referência de contexto e limites reais (não como garantia de execução sem runtime/provedor compatível).

## Identidade e escopo
- **Nome:** Frame-Generator-API (FGUA)
- **Responsável:** Kauan Henrique Alves dos Reis
- **Versão:** 2.0.0
- **Licença:** MIT
- **Objetivo:** núcleo web modular para análise/registro de modelos, inspeção de capacidades/recursos e planejamento/integração de fluxos de geração e aprimoramento de quadros (imagem, vídeo, jogo) sob um **contrato lógico** (`/api/v1/*`).
- **Runtime:** HTML5, CSS3, JavaScript (ES Modules), execução no navegador.
- **Hospedagem:** GitHub Pages (site estático). **Não há servidor REST nativo** no host.
- **Interface web atual:** dashboard informativo/integrativo (estado da sessão, recursos/capacidades, modelos, geradores/presets, tarefas, integração/API, estúdio Discord, configurações/permissões e documentação/recursos). Não presume execução completa de todas as operações pela UI.
- **Site:** https://kauan11-boop.github.io/Frame-Generator-API/
- **Dashboard:** https://kauan11-boop.github.io/Frame-Generator-API/Public/dashboard.html
- **Repositório:** https://github.com/kauan11-boop/Frame-Generator-API

## Arquitetura (estado atual)
- `src/` (núcleo modular): `core`, `configuration`, `models`, `quantization`, `generators`, `processing`, `engines`, `repacks`, `security`, `storage`.
- `Public/`: dashboard/UI, documentação (HTML/MD), assets, manifests, presets, templates, locales, workers e demo React integrada.
- `configs/`: `api.json`, `models.json`, `generators.json`, `repacks.json`, `permissions.json`, `settings.json`.
- `workers/` e `Public/workers/`: workers com protocolo unificado.
- `tests/` e `scripts/`: validações e testes automatizados (`npm run ci`).
- `CHANGELOG.md`: histórico de revisões e validações relevantes.

## Contrato lógico `/api/v1`
Namespaces declarados podem incluir: `/api/v1/system/`, `models/`, `metadata/`, `quantization/`, `generators/`, `frames/`, `images/`, `videos/`, `engines/`, `repack/`, `tools/`, `users/`, `permissions/`, `config/`, `jobs/`, `storage/`.

Modos:
- `demo` (padrão): sem backend conectado; operações remotas retornam indisponibilidade explícita.
- `local` / `remote`: conectar `baseUrl` de backend compatível para execução real.

## Capacidades e limites reais (obrigatório respeitar)
- **GGUF:** análise de metadados no cliente com parser e validações de limites (sujeito a tamanho/memória do navegador). Carregamento/inferência real requer runtime/provedor compatível.
- **Quantização:** identificação, estimativa e planejamento disponíveis; **conversão/quantização efetiva requer runtime externo**. Arquivo original deve ser preservado. **Sem conversão fictícia.**
- **Geração/processamento (imagem/vídeo/frames):** planejamento/análise e estados explícitos; execução real depende de engine/modelo/provedor/pipeline compatível. **Sem simulação de resultados.**
- **Engines:** detecção de WebGPU/WebCodecs, adapter ONNX Web (quando runtime disponível) e backend configurável.
- **Tarefas (jobs):** estados explícitos (`pending`, `queued`, `running`, `succeeded`, `failed`, `cancelled`, `unavailable`) conforme execução real reportada.
- **WebSocket (cliente UI/utilitário):** conecta a endpoints externos compatíveis (`ws://`/`wss://`) com código/token opcional; não há servidor WebSocket no GitHub Pages.
- **Discord Bot (estúdio UI):** gera templates `discord.js` (Node.js) e fornece simulação local de comandos/eventos na interface; **não conecta ao gateway do Discord nem executa bot no navegador**.
- **React demo:** exemplo integrado executado no navegador via ESM/CDN (dependência externa de rede no runtime).
- **Segurança:** autenticação/permissões em nível de UI no cliente estático. **Autorização confiável exige backend.** Não armazenar segredos em arquivos públicos.
- **Jogos:** não afirmar interceptação automática de pipeline gráfico; usar apenas integrações/capturas autorizadas e compatíveis.

## Integração recomendada
1. Consumir `configs/*.json` e o **payload de integração** exportado pelo dashboard para descobrir capacidades, recursos e contrato.
2. Configurar backend/provedor compatível quando for necessária execução real.
3. Selecionar engine/modelo/provedor conforme formato, operação e capacidades detectadas.
4. Tratar estados explicitamente: `ready`, `planned`, `analyzed`, `requires-provider`, `requires-runtime`, `unavailable`, `invalid`, `failed`, `cancelled`, `succeeded`.
5. Validar manifests/configs antes de uso e respeitar limites de ambiente estático.

## Recursos úteis
- Dashboard: `/Public/dashboard.html`
- Documentação: `/Public/documentation/index.html`, `/Public/documentation/commands.html`
- Demo React (navegador): `/Public/react-vite.html`
- Configs: `/configs/*.json`
- Artefatos públicos: `/Public/presets/default-presets.json`, `/Public/templates/job-template.json`, `/Public/manifests/sample-repack.json`
- Locales: `/Public/locales/pt-BR.json`, `/Public/locales/en-US.json`
- Licença: `LICENSE` (MIT)
- Histórico: `CHANGELOG.md`
- Verificação local: `npm run ci`
