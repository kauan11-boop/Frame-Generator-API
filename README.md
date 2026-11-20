# Frame-Generator-API

**FGUA — Frame Generator Universal Architecture** é uma plataforma modular para análise de modelos de IA, geração e aprimoramento de quadros, processamento de mídia, administração de engines/provedores e integração universal via API e MCP.

- **Frontend:** https://kauan11-boop.github.io/Frame-Generator-API/
- **Dashboard:** https://kauan11-boop.github.io/Frame-Generator-API/public/dashboard.html
- **MCP Universal:** https://kauan11-boop.github.io/Frame-Generator-API/public/mcp.html
- **Licença:** MIT

## Arquitetura

O projeto é dividido em duas partes independentes:

1. **Frontend estático:** HTML, CSS e JavaScript executados no navegador e hospedados no GitHub Pages.
2. **Runtime Node.js:** processo local ou serviço próprio que hospeda MCP Server e MCP Client.

GitHub Pages não executa processos Node.js, endpoints REST dinâmicos nem servidores MCP. O contrato `/api/v1` do frontend continua sendo uma API lógica até que um backend real seja configurado.

## MCP Universal

O runtime implementa MCP com o SDK TypeScript oficial v2 e disponibiliza:

- **Servidor stdio:** integração com hosts MCP que iniciam um processo local.
- **Servidor HTTP:** endpoint Streamable HTTP em `/mcp`, com bind local por padrão.
- **Cliente MCP:** conexão com servidores remotos via HTTPS para descoberta/listagem e chamadas explícitas.
- **Tools:** status, contrato, módulos, catálogos, configuração de IA e validação de pipelines.
- **Resources:** `fgua://system/status`, `fgua://api/contract`, `fgua://catalog/models`, `fgua://catalog/generators`.
- **Prompt:** `fgua_pipeline_design`, que propõe uma estrutura para revisão humana.

### Ferramentas

| Tool | Finalidade |
|---|---|
| `fgua_system_status` | Diagnóstico do runtime |
| `fgua_api_contract` | Contrato lógico da API |
| `fgua_modules_list` | Inventário dos módulos |
| `fgua_catalog_read` | Leitura de catálogos JSON |
| `fgua_ai_status` | Verifica configuração de provedores sem revelar segredos |
| `fgua_pipeline_validate` | Valida a estrutura de um pipeline sem executá-lo |

### Executar localmente

Requer Node.js 20.19+.

```bash
npm install
npm run check
npm test
npm run mcp
```

O comando `npm run mcp` inicia o servidor stdio. Para HTTP local:

```bash
npm run mcp:http
```

- MCP: `http://127.0.0.1:3333/mcp`
- Health: `http://127.0.0.1:3333/health`

Consulte [server/README.md](server/README.md) para configuração de clientes, segurança e implantação.

## IA opcional

O MCP e o runtime funcionam sem LM Studio, chave de API ou modelo de linguagem. Quando desejado, o projeto pode receber configurações de endpoint compatíveis:

- `LM_STUDIO_BASE_URL`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`

O estado de configuração é exposto sem retornar valores secretos. A presença de um endpoint não significa que o provedor foi testado ou que inferência está funcional.

## Estrutura principal

```text
Frame-Generator-API/
├── index.html
├── README.md
├── LICENSE
├── manifest.json
├── package.json
├── src/
│   ├── core/
│   ├── configuration/
│   ├── models/
│   ├── quantization/
│   ├── generators/
│   ├── processing/
│   ├── engines/
│   ├── repacks/
│   ├── security/
│   └── storage/
├── public/
│   ├── dashboard.html
│   ├── mcp.html
│   ├── css/
│   ├── js/
│   └── documentation/
├── configs/
├── server/
│   ├── index.js
│   ├── mcp-server.js
│   ├── http.js
│   ├── client.js
│   ├── runtime.js
│   └── README.md
└── tests/
    └── runtime.test.js
```

## Componentes existentes do frontend

- Core: `EventBus`, `ModuleRegistry`, `LifecycleManager`, `ApiController`.
- Modelos: `ModelLoader`, `MetadataLoader`, `ModelRegistry`, `ModelCompatibility`.
- Quantização: análise, perfis e planejamento.
- Geradores: quadros, imagens e vídeos.
- Engines: WebGPU, WebCodecs, ONNX Runtime Web e adaptador de backend.
- Repacks e ferramentas: manifests, registro e validação.
- Segurança: autenticação e permissões da interface.
- Storage: IndexedDB, cache e histórico.

## Limitações explícitas

- O runtime MCP inicial expõe ferramentas de diagnóstico, descoberta e validação; não afirma que os geradores do navegador estejam executando dentro do processo Node.
- A análise de metadados GGUF ocorre no frontend. Inferência depende de runtime compatível.
- Quantização é analisada/planejada; conversão real requer provedor implementado.
- Geração de quadros, interpolação, upscale e processamento de vídeo exigem engines/provedores reais.
- Não existe interceptação automática do pipeline gráfico de jogos.
- Autenticação remota de produção deve ser fornecida por OAuth/gateway TLS; o token opcional do runtime é uma camada simples para ambientes controlados.
- Nenhum resultado de IA ou processamento é simulado.

## Desenvolvimento

Para servir o frontend localmente:

```bash
npx serve .
```

Abra `http://localhost:3000/` ou `http://localhost:3000/public/dashboard.html`.

## Referências técnicas

- [MCP Specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [GitHub Pages](https://docs.github.com/pages)
- [Git Trees REST API](https://docs.github.com/en/rest/git/trees)
