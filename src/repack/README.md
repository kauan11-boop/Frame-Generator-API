# repack

Sistema Repack: preenchimento e reconstrução controlada de manifests/conteúdos.

- Pipeline auditável: `scan → diff → plan → simulate → apply → verify`.
- Transparente: gera artefatos derivados e relatórios; **não** altera código-fonte de forma oculta; `apply` requer aprovação.
- Estado/API: `../api/v1/repack/index.json`.
- Planos/logs/overlays/derivados: `../data/repack/`.
- CLI: `node src/scripts/repack.mjs <scan|plan|simulate|apply|verify>` (a partir da raiz do repositório).

Estratégias: `fill-missing`, `merge-overlay`, `normalize`, `upgrade-compatible`, `full-rebuild-derived`.
