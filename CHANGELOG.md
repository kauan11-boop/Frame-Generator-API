# Changelog — Frame-Generator-API

## 2.0.0 — 2026-11-20 (auditoria e revisão técnica)

**Responsável:** Kauan Henrique Alves dos Reis  
**Licença:** MIT

### Correções e melhorias aplicadas (evidenciadas nesta revisão)
- **WebSocket (cliente de UI):** validação explícita de protocolo/URL (`ws://`/`wss://`), limpeza de temporizador de reconexão e prevenção de reconexões obsoletas após desconexão/configuração manual (`Public/js/websocket.js`).
- **Dashboard (Integração):** ao aplicar backend na sessão, a configuração não marca mais `connected=true` sem verificação; URLs são normalizadas e o exemplo JS gerado escapa caracteres de forma segura para o literal exibido (`Public/js/dashboard.js`).
- **Conteúdos e documentação:** README, documentação (MD/HTML), master prompt, manifest e locales revisados e ampliados para refletir com precisão o estado real da interface (dashboard, integração/WebSocket, estúdio Discord com simulação local, demo React, payload, limites e segurança), com alinhamento de versão/identidade do projeto.
- **Versionamento:** alinhamento de versão do núcleo/configuração/pacote para `2.0.0` (`src/app.js`, `configs/settings.json`, `package.json`) e registro desta revisão.

### Validação executada
- `node scripts/check-syntax.mjs` — OK (56 arquivos)
- `node scripts/validate-json.mjs` — OK (13 arquivos)
- `node --test tests/*.test.mjs` — OK (12/12)

### Limitações e pendências (não ocultadas)
- Hospedagem estática (GitHub Pages): `/api/v1` permanece contrato lógico; inferência, quantização efetiva e processamento pesado dependem de runtime/engine/provedor/backend compatível e **não são simulados**.
- Auditoria completa de 320 pontos solicitada requer varredura contínua adicional, testes E2E/visuais e validações em múltiplos navegadores/dispositivos não executadas integralmente neste ambiente.
- Integrações externas (WebSocket/Discord/REST reais, LM Studio, provedores remotos, etc.) dependem de serviços/endpoints configurados fora do repositório.
- Demo React (`Public/react-vite.html`) carrega React/ReactDOM via CDN em tempo de execução (dependência externa de rede/CDN).
