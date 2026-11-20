# Frame-Generator-API + React + Vite (integração)

Template de compatibilidade para consumir o **Frame-Generator-API** (site estático / GitHub Pages) a partir de um app **React + Vite**.

## Instalação
```bash
cd integrations/react-vite
npm install
```

## Desenvolvimento
```bash
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy no GitHub Pages
- Ajuste `base` em `vite.config.js` (ou `VITE_BASE`) para o caminho correto do seu repositório/página.
- Publique a pasta `dist` (ex.: `npm run deploy` usa `gh-pages`, ou configure GitHub Actions/Pages para servir `dist`).

## O que este exemplo faz
- Busca `configs/api.json` e `configs/settings.json` do site estático do Frame-Generator-API.
- Demonstra como integrar o contrato lógico `/api/v1` e metadados públicos em uma UI React.

## Notas
- O site principal do Frame-Generator-API é estático: inferência/quantização/processamento pesado exigem runtime/provedor/backend compatível.
- Não coloque tokens/segredos no frontend. Para WebSocket/REST autenticados, use código/token fornecido pelo usuário em tempo de execução e um backend seguro quando aplicável.
