# packages

Pacotes e conteúdos versionados, com autoajuste por manifesto.

- Manifesto: `../api/v1/packages/index.json` (version/etag/depends/provides/entry).
- Catálogo de conteúdos: `../api/v1/content/index.json`.
- Dados locais: `../data/packages/`.

Clientes conectados detectam mudanças de `version`/`etag` e reidratam caches/configurações (ver `../sdk/frame-api.js`).
