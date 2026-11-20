# Template de Bot Discord (discord.js)

Template avançado gerado/configurável pelo dashboard do Frame-Generator-API. **Execução em ambiente Node.js** (não roda no GitHub Pages/navegador).

## Requisitos
- Node.js >= 18
- Aplicativo/bot criado no [Discord Developer Portal](https://discord.com/developers/applications)

## Instalação e uso
1. Copie `.env.example` para `.env` e preencha `DISCORD_TOKEN` e `CLIENT_ID` (nunca versione `.env`).
2. Instale dependências: `npm install`
3. Registre comandos slash: `npm run deploy` (defina `GUILD_ID` no `.env` para deploy rápido no servidor)
4. Inicie: `npm start`

## Conteúdo
- `index.js`: cliente, carregamento de comandos, eventos (ready, interactions, mensagens etc.)
- `deploy-commands.js`: registro de slash commands (guild ou global)
- `commands/`: comandos slash modulares (`ping`, `help`, extensível)

## Segurança e limites
- Alguns intents (ex.: `GuildMembers`, `MessageContent`, `GuildPresences`) exigem ativação no Developer Portal e podem exigir verificação.
- Mantenha o token secreto; use variáveis de ambiente/segredos do provedor de hospedagem do bot.
- Este repositório/site principal é estático (GitHub Pages); hospede o bot em um runtime Node compatível.
