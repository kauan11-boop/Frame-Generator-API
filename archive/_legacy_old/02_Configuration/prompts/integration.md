# Prompt de Integração — Frame-Generator-API

Use este prompt em uma IA (copilot/assistente) para integrar a **Frame-Generator-API** (estática, GitHub Pages) ao seu projeto.

## Prompt (copie e cole)

```text
Você é um engenheiro de integração. Integre meu projeto à Frame-Generator-API (API unificada estática hospedada em GitHub Pages) seguindo estas regras:

1) Descoberta e autoajuste
- Faça fetch de `{BASE_URL}/api/v1/index.json` para descobrir endpoints e capacidades.
- Implemente polling de manifests (version/updated_at/etag) em `models`, `frames`, `packages`, `commands`, `repack`, `adapters`.
- Quando version/etag mudar, recarregue apenas os recursos afetados e reidrate caches/configurações sem reiniciar o app.

2) Contratos JSON (obrigatório)
- Envie comandos no envelope de `schemas/command.schema.json` {command, request_id, payload, client?, auth?, meta?}.
- Aceite respostas no envelope de `schemas/response.schema.json` {ok, request_id, command, data, error?, meta?}.
- Respeite allowlist e restrições de `api/v1/commands/index.json` (comandos de escrita exigem adapter/backend).

3) Modelos de IA (carregador + metadados)
- Consuma `api/v1/models/index.json` para listar modelos, capacidades e metadados GGUF (general/architecture/tokenizer/tensors/inspection).
- Suporte os modos: A) runner externo (llama.cpp/LM Studio/Ollama/OpenAI-compatible), B) WASM experimental no navegador (apenas modelos pequenos, inspeção/planejamento leve), C) catálogo/metadados.
- Para GGUF, trate "descompilar" como extração/inspeção de metadados e índice de tensores (nunca pesos).

4) Geração de quadros
- Use `api/v1/frames/index.json` e `templates.json` para criar jobs nos modos: storyboard, video_frames, data_panels, composite.
- Valide payload com `schemas/frame-job.schema.json` e despache via adapter configurado.

5) Pacotes e Repack
- Consuma `api/v1/packages/index.json`; instale/atualize via adapter quando houver backend.
- Use Repack (`api/v1/repack/index.json`) como pipeline auditável (scan→diff→plan→simulate→apply→verify), com aprovação antes de apply e artefatos derivados.

6) Entrega
- Gere um módulo/cliente no meu projeto com: baseUrl configurável, cache por etag, dispatcher de comandos, validação leve, e tratamento de erros.
- Não assuma servidor no GitHub Pages; operações de escrita/execução devem ir para o adapter selecionado.
- Liste arquivos alterados e como testar.

Contexto do meu projeto: [DESCREVA AQUI: linguagem, framework, onde salvar o cliente, adapter desejado].
BASE_URL: [COLE AQUI A URL DO GITHUB PAGES].
```

## Variáveis

- `{BASE_URL}`: ex. `https://<usuario>.github.io/Frame-Generator-API`
- `adapter`: `adapter-static-readonly` (leitura), `adapter-external-http`, `adapter-openai-compatible`, `adapter-cloudflare-worker`, `adapter-wasm-browser`
