# FGUA v3 — Console MCP sobre REA

Camada MCP que orquestra as 263 ferramentas do **MCP REA**, adiciona presets, prompts,
reparo/transpilação com **LLM local + testes como reward** e um dashboard estático para
GitHub Pages com sidebar e painel de administração/integrações.

## Arquitetura

```
                       ┌──────────────────────────────┐
  agente (OpenCode) ──▶ │ MCP FGUA (stdio)             │
                       │  mcp-server/src/index.js     │
                       └──────────────┬───────────────┘
                                      │ mesmos handlers
  dashboard (GH Pages) ─HTTP─▶ ┌──────▼───────────────┐
    https://kauan11-boop...    │ bridge 127.0.0.1:4174│
                               └──────┬───────────────┘
                    ┌──────────────────┼────────────────────┐
                    ▼                  ▼                    ▼
          REA MCP (stdio)     LM Studio :1234      sandbox local
          open_binary/        chat/completions     Node (permission)
          inspect_artifact/                        Python (-I)
          list_* / decompile
                    │
                    ▼
          .frame-data/{store.json,reports/,work/}
```

O **GitHub Pages não executa servidor**: o dashboard é estático e só conversa com o bridge
quando ele está rodando na máquina local.

## Instalação

```bash
npm install
npm run bridge     # dashboard local: http://127.0.0.1:4174
npm run mcp        # servidor MCP stdio (usado pelo agente)
npm test           # 8 testes de smoke
```

Requisitos: Node >= 20 (validado em Node 24), Python 3 (para testes em Python) e,
opcionalmente, LM Studio em `http://localhost:1234/v1` com CORS habilitado.

### Registrar o MCP no OpenCode

Adicione ao `opencode.json` (arquivo de configuração do OpenCode):

```json
{
  "mcp": {
    "fgua": {
      "type": "local",
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\kauat\\Documents\\GitHub\\Frame-Generator-API\\mcp-server\\src\\index.js"
      ],
      "enabled": true
    }
  }
}
```

O FGUA descobre o REA automaticamente lendo `mcp.rea.command` desse mesmo arquivo.
Sobrescreva com `FGUA_REA_COMMAND` (array JSON) se necessário.

## Ferramentas expostas

| Ferramenta | Função |
|---|---|
| `fgua_status` | Estado de REA, LM Studio, presets, prompts, jobs |
| `fgua_presets` | list / get / save / delete de presets |
| `fgua_prompts` | list / get / save / delete / render de prompts `{{chave}}` |
| `fgua_settings` | get / update de configurações locais |
| `fgua_rea_catalog` | busca ferramentas do REA com nome, descrição e schema |
| `fgua_rea_call` | chama qualquer ferramenta do REA com validação de catálogo |
| `fgua_reverse_file` | RE de um arquivo → relatório Markdown + JSON com Evidence IDs |
| `fgua_run_tests` | executa código com reward binário (0/1) |
| `fgua_repair_code` | corrige código com loop LLM + testes |
| `fgua_transpile_code` | converte entre linguagens com loop LLM + testes |
| `fgua_jobs` | list / get / report do histórico |

Exemplo mínimo de uso pelo agente:

```
fgua_reverse_file({ "path": "C:\\alvo\\app.exe", "outputDir": "C:\\relatorios" })
fgua_repair_code({ "code": "...", "language": "javascript", "tests": "if (f(2)!==4) throw Error('x')" })
fgua_transpile_code({ "code": "...", "language": "python", "targetLanguage": "javascript" })
```

## Pipeline de engenharia reversa

1. `open_binary(path)` abre a sessão no REA.
2. `inspect_artifact(detail=summary)` produz Evidence IDs.
3. `binary_overview()` completa a visão.
4. O FGUA grava `<job>-reverse.md` e `<job>-reverse.json` no destino e registra o job.

O preset `reverse-deep` adiciona `list_procedures`, `list_strings` e `list_names` —
exige um provedor de análise configurado no REA; quando indisponível, a etapa falha
isoladamente e as demais continuam.

Para `.wasm`, o preset `reverse-wasm` usa `inspect_wasm_artifact(path)`. Essa ferramenta
exige `REA_WABT_BIN_DIRECTORY` apontando para uma instalação WABT (wasm-validate,
wasm-objdump, wasm2wat, versão >= 1.0.42 < 1.1.0) **no ambiente do processo MCP REA**.
Sem isso o REA responde `capability_unavailable` e o FGUA reporta a remediação.

## Loop de reparo / transpilação (o "RL" prático)

```
código + erro anterior + testes
        │
        ▼
LM Studio (system prompt administrável) → candidato
        │
        ▼
sandbox (Node --permission / Python -I, timeout, limite de saída)
        │
   reward = 1 se exit 0, senão 0
        │
        ├─ passou → para e grava o melhor candidato
        └─ falhou → realimenta stderr na próxima iteração
```

Estados: `succeeded`, `failed`, `max-iterations`, `requires-provider`, `requires-model`,
`requires-runtime`, `empty-response`. Sem testes executáveis o estado é `requires-runtime`:
o candidato é gravado, mas **não é apresentado como validado**.

Isso não é treinamento de política (deep RL real exigiria dataset, reward model e compute).
É o mecanismo verificável e entregável agora, com recompensa derivada de execução real.

### Limitação sobre WebAssembly

WASM é **alvo de compilação**, não um interpretador universal: C/C++ compilam para
`.wasm` (Emscripten/Clang), Python roda via Pyodide e C# via Blazor/mono; **NodeJS não
roda em WASM puro**. Por isso a execução do FGUA usa subprocessos locais, e o WASM entra
apenas como alvo de engenharia reversa (`inspect_wasm_artifact`).

## Dashboard

`https://kauan11-boop.github.io/Frame-Generator-API/`

Sidebar com: Visão geral, Engenharia reversa, Reparo & transpilação, Jobs,
Ferramentas REA e **Admin & integrações**. A aba de administração tem sub-abas para
Informações, Prompts, Ferramentas locais, Presets e Configurações.

Sem o bridge local, o painel mostra explicitamente "bridge desconectado" e não finge
resultados. Para servir localmente, rode `npm run bridge` e, em outro terminal,
`python -m http.server 4173` na raiz do repositório; abra `http://localhost:4173`.
O bridge serve apenas `/api/*`, não os arquivos estáticos.

## Arquivos e dados

- `config/defaults.json` — presets, prompts e configuração inicial.
- `mcp-server/src/` — servidor MCP, cliente REA, LLM, sandbox, bridge e handlers.
- `dashboard/` — CSS e JavaScript do painel estático.
- `.frame-data/` (git-ignorado) — `store.json`, `reports/`, `work/`.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `FGUA_REA_COMMAND` | Sobrescreve o comando do MCP REA (array JSON) |
| `FGUA_DATA_DIR` | Diretório de dados |
| `FGUA_LM_URL` / `FGUA_LM_MODEL` | LM Studio e modelo |
| `FGUA_BRIDGE_PORT` | Porta do bridge (padrão 4174) |
| `FGUA_MAX_ITERATIONS` / `FGUA_RUN_TIMEOUT_MS` | Limites do loop e da execução |
| `FGUA_KEEP_WORK` | Mantém diretórios temporários para depuração |

## Alertas

- O bridge escuta somente em `127.0.0.1`; não exponha em rede pública.
- O sandbox Node usa permission model (leitura/escrita limitadas ao diretório temporário);
  Python roda com `-I`, mas **não é um sandbox de segurança Multi-tenant**. Execute apenas
  código de origem confiável.
- Nenhum segredo deve ser gravado em presets, prompts ou arquivos versionados.
