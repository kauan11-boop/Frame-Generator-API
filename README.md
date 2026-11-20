# Frame-Generator-API (FGUA) v2 — versão definitiva

Núcleo web modular com **shell de sistema operacional Windows 11** para análise/registro de
modelos de IA, inspeção de capacidades/recursos e planejamento/integração de fluxos de
geração e aprimoramento de quadros (jogos, imagem, vídeo) sob um **contrato lógico `/api/v1/*`**.

- **Runtime:** HTML5 + CSS3 + JavaScript (ES Modules), 100% no navegador.
- **Hospedagem:** GitHub Pages (estático). Sem servidor REST nativo no host.
- **Modos:** `demo` (padrão, sem backend) · `local` · `remote` (backend compatível via `baseUrl`).
- **Verificação local:** `npm run ci`

## Arquitetura (limites respeitados: SRC ≤ 10 pastas · PUBLIC ≤ 20 pastas)

```
Frame-Generator-API/
├── index.html            # Boot → shell Windows 11
├── configs/              # JSON único de configuração (6 arquivos)
├── src/                  # Núcleo (10 pastas)
│   ├── core/             # kernel, barramento de eventos, máquina de estados
│   ├── config/           # carregador/validador de configs JSON
│   ├── models/           # parser GGUF, metadados, quantizador/planejador
│   ├── runtime/          # detecção WebGPU/WebGL/WASM, adaptadores TF.js e Transformers.js
│   ├── api/              # roteador /api/v1, cliente LM Studio (OpenAI-compat + REST nativa)
│   ├── generators/       # planejador de quadros (jogos/imagem/vídeo) + controlador de pixels
│   ├── repacks/          # gerenciador de repacks multi-ferramenta
│   ├── security/         # usuários, permissões, sessão (UI-level)
│   ├── storage/          # armazenamento local + sistema de arquivos virtual
│   └── shell/            # ponte pública window.FGUA
├── Public/               # Interface (10 pastas)
│   ├── desktop/          # shell Windows 11 (boot, lock, taskbar, start, janelas…)
│   ├── apps/             # 12 aplicativos do sistema
│   ├── styles/           # win11.css + apps.css
│   ├── assets/           # wallpapers (SVG) e ícones (sprite SVG)
│   ├── documentation/    # páginas de documentação standalone
│   ├── presets/          # presets padrão
│   ├── templates/        # template de job + Master Prompt de integração IA
│   ├── manifests/        # manifest de repack de exemplo
│   ├── locales/          # pt-BR / en-US
│   ├── workers/          # worker de parsing GGUF
│   └── dashboard.html    # dashboard informativo standalone (fallback)
├── tests/                # validações e testes automatizados
└── scripts/              # serve.mjs (localhost:4173) e ci.mjs
```

## Comandos necessários

```bash
npm run start   # servidor local em http://localhost:4173
npm run ci      # CI completa (valida configs, manifests, testes e referências)
npm run test    # apenas testes unitários
```

## Integração com IA (Instalador)

Abra o app **Instalador IA** dentro do sistema (Iniciar → Instalador IA) ou leia
`Public/templates/master-prompt-integration.md`. A especificação machine-readable está em
`Public/templates/integration-spec.json`.

## Limites reais (obrigatório respeitar)

- **GGUF:** análise de metadados no cliente (sujeito a memória do navegador). Inferência real requer runtime/provedor.
- **Quantização:** identificação, estimativa e planejamento; conversão efetiva requer runtime externo. Arquivo original sempre preservado. Sem conversão fictícia.
- **Geração/processamento:** planejamento/análise e estados explícitos; execução real depende de engine/modelo/provedor compatível. Sem simulação de resultados.
- **Segurança:** autenticação/permissões em nível de UI; autorização confiável exige backend. Sem segredos em arquivos públicos.
- **Jogos:** sem interceptação automática de pipeline gráfico; apenas integrações autorizadas.

## Estados explícitos

`ready` · `planned` · `analyzed` · `requires-provider` · `requires-runtime` · `unavailable` · `invalid` · `failed` · `cancelled` · `succeeded`

## LM Studio (modo local)

Padrão `http://localhost:1234`. Endpoints suportados pelo cliente:
- Compatíveis com OpenAI: `GET /v1/models`, `POST /v1/chat/completions`, `POST /v1/completions`, `POST /v1/embeddings`, `POST /v1/responses`
- REST nativa v1: `GET /api/v1/models`, `POST /api/v1/chat`, `POST /api/v1/models/load`, `POST /api/v1/models/unload`
- REST v0 (legado): `GET /api/v0/models`, `POST /api/v0/chat/completions`, `POST /api/v0/embeddings`

No LM Studio: **Developer → Server Settings → Enable CORS** (obrigatório para acesso do navegador) e, opcionalmente, **Require Authentication** (token Bearer em `Authorization`).

## Licença

MIT — veja `LICENSE`.
