# config

Configurações e perfis de ambiente para a API/adaptadores.

- `baseUrl`: origem do site estático (ex.: `https://<user>.github.io/Frame-Generator-API/src`).
- `adapterUrl`/`adapterId`: backend selecionado para comandos de escrita/execução (`adapter-external-http`, `adapter-openai-compatible`, `adapter-cloudflare-worker`, `adapter-wasm-browser`).
- Perfis sugeridos: `static-readonly`, `hybrid-external`, `openai-compatible-local`, `wasm-experimental`.

Referências: `../api/v1/adapters/index.json`, `../sdk/frame-api.js`.
