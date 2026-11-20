# adapters

Organização dos adaptadores que conectam a API estática a executores.

- **Leitura estática:** `adapter-static-readonly` (GitHub Pages, JSONs em `../api/v1/`).
- **Backend HTTP:** `adapter-external-http` (Node/Python/etc.) — escrita, filas, jobs.
- **Compatível OpenAI:** `adapter-openai-compatible` (LM Studio/Ollama/llama.cpp server).
- **Serverless:** `adapter-cloudflare-worker` (controle/orquestração).
- **Navegador (experimental):** `adapter-wasm-browser` (inspeção/planejamento leve; modelos pequenos).

Contrato de comandos: `../api/v1/commands/index.json`. Configurações: `../api/v1/adapters/index.json`.
