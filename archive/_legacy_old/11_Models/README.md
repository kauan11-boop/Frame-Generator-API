# models

Domínio de modelos de IA e metadados GGUF.

- Registro: `../api/v1/models/index.json` (metadados completos: general, architecture, tokenizer, tensors, inspection).
- Modos: A) runner externo, B) WASM experimental, C) catálogo/metadados.
- Inspeção GGUF: extração de metadados e índice de tensores (sem descompilação de pesos).
- Dados/artefatos locais: `../data/models/`.

Carregador e despacho via SDK/adapters: `../sdk/frame-api.js`, `../adapters/`.
