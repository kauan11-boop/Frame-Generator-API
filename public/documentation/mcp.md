# MCP Universal — FGUA

## Modelo de execução

O dashboard é estático. O servidor MCP é um processo Node.js independente. O protocolo MCP não exige que o cliente use um modelo de IA: clientes determinísticos também podem descobrir tools, ler resources e chamar operações.

## Instalação

```bash
npm install
npm run check
npm test
```

## stdio

```bash
npm run mcp
```

Exemplo de configuração de host:

```json
{
  "mcpServers": {
    "frame-generator-api": {
      "command": "node",
      "args": ["/absolute/path/Frame-Generator-API/server/index.js"],
      "cwd": "/absolute/path/Frame-Generator-API"
    }
  }
}
```

## HTTP

```bash
npm run mcp:http
```

Endpoint: `http://127.0.0.1:3333/mcp`.

O servidor valida Host e Origin, limita o corpo das requisições e escuta em loopback por padrão. Para permitir que o dashboard no GitHub Pages consulte o health check, adicione a origem exata em `FGUA_MCP_ALLOWED_ORIGINS`. Isso não abre o endpoint MCP para origens arbitrárias.

## Variáveis

- `FGUA_MCP_TRANSPORT=stdio|http`
- `FGUA_MCP_HOST=127.0.0.1`
- `FGUA_MCP_PORT=3333`
- `FGUA_MCP_TOKEN` — bearer token opcional; obrigatório para bind remoto.
- `FGUA_MCP_ALLOW_REMOTE=true` — opt-in explícito para bind remoto.
- `FGUA_MCP_ALLOWED_HOSTS` — hosts HTTP completos autorizados, separados por vírgula.
- `FGUA_MCP_ALLOWED_ORIGINS` — origens exatas autorizadas, separadas por vírgula.
- `LM_STUDIO_BASE_URL`, `OPENAI_BASE_URL`, `OPENAI_API_KEY` — configuração opcional de IA.

Não publique tokens, chaves ou credenciais em arquivos do GitHub. Para produção remota, use HTTPS e OAuth por meio de proxy/gateway confiável.

## Tools / Resources / Prompt

Tools: `fgua_system_status`, `fgua_api_contract`, `fgua_modules_list`, `fgua_catalog_read`, `fgua_ai_status`, `fgua_pipeline_validate`.

Resources: `fgua://system/status`, `fgua://api/contract`, `fgua://catalog/models`, `fgua://catalog/generators`.

Prompt: `fgua_pipeline_design`.

A validação de pipeline não executa processamento. Geradores, quantização e inferência continuam dependentes de engines/provedores implementados e conectados.

## Cliente MCP

`server/client.js` exporta `connectMcpServer({ url, token })`. URLs remotas exigem HTTPS; HTTP é permitido somente para loopback. O objeto retornado expõe `listTools`, `listResources`, `listPrompts`, `callTool`, `readResource`, `getPrompt` e `close`.
