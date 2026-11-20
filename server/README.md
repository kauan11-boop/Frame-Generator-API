# FGUA Universal MCP Runtime

O runtime MCP é um processo Node.js separado do frontend GitHub Pages.

## Requisitos

- Node.js 20.19 ou superior
- npm
- Conexão com a internet na primeira instalação das dependências

## Instalação

Na raiz do repositório:

```bash
npm install
npm run check
npm test
```

## Transporte local (stdio)

```bash
npm run mcp
```

Exemplo de configuração para um host MCP que inicia processos locais:

```json
{
  "mcpServers": {
    "frame-generator-api": {
      "command": "node",
      "args": ["/CAMINHO/ABSOLUTO/Frame-Generator-API/server/index.js"],
      "cwd": "/CAMINHO/ABSOLUTO/Frame-Generator-API"
    }
  }
}
```

O processo stdio não escreve logs no stdout; mensagens de diagnóstico são enviadas ao stderr.

## Transporte HTTP local

```bash
npm run mcp:http
```

- Endpoint MCP: `http://127.0.0.1:3333/mcp`
- Health check: `http://127.0.0.1:3333/health`
- Bind padrão: loopback (não expõe a porta à rede local).

### Acesso remoto

Não exponha o serviço diretamente à internet. Para implantação remota, use proxy reverso com TLS, autenticação OAuth adequada e restrições de origem/rede. O modo remoto requer explicitamente:

- `FGUA_MCP_HOST` com endereço de bind desejado;
- `FGUA_MCP_ALLOW_REMOTE=true`;
- `FGUA_MCP_TOKEN` com pelo menos 32 caracteres;
- `FGUA_MCP_ALLOWED_ORIGINS` com origens autorizadas separadas por vírgula.

O token simples é uma proteção adicional para ambiente controlado, não substitui OAuth nem um gateway TLS em produção.

## Ferramentas MCP

| Ferramenta | Função |
|---|---|
| `fgua_system_status` | Diagnóstico do runtime |
| `fgua_api_contract` | Contrato lógico /api/v1 |
| `fgua_modules_list` | Inventário de módulos |
| `fgua_catalog_read` | Catálogos JSON |
| `fgua_ai_status` | Estado de configuração de IA, sem revelar segredos |
| `fgua_pipeline_validate` | Validação estrutural de pipeline, sem execução |

## Resources

- `fgua://system/status`
- `fgua://api/contract`
- `fgua://catalog/models`
- `fgua://catalog/generators`

## Prompt

- `fgua_pipeline_design`: gera uma especificação para revisão, não executa etapas.

## MCP Client

`server/client.js` exporta `connectMcpServer({ url, token })` para conectar a servidores remotos via Streamable HTTP, listar tools/resources/prompts, ler resources, obter prompts e chamar tools. HTTP é aceito somente em loopback; servidores remotos devem usar HTTPS.

## Modo sem IA

O protocolo MCP não exige um modelo de IA. Qualquer cliente MCP determinístico pode listar e chamar as ferramentas. O runtime também pode ser iniciado e testado sem LM Studio ou chave de provedor.

## Limitações declaradas

O runtime MCP desta versão lê catálogos e configurações do repositório e oferece validação de pipeline. Ele não afirma executar inferência GGUF, quantização, geração de imagem/vídeo, interceptação de jogos ou processamento de quadros. Essas operações continuam dependendo dos engines/provedores implementados e conectados ao núcleo de navegador. O MCP não simula resultados.
