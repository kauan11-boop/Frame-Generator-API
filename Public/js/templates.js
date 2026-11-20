// Embedded integration templates/content (browser-accessible), formerly under integrations/.
// Provides React+Vite and Discord bot source templates for preview/copy/download inside the dashboard.

export function getReactViteTemplates() {
  return [
    {
      path: 'react-vite/index.html',
      description: 'HTML base (Vite).',
      content: `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Frame-Generator-API + React + Vite</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`
    },
    {
      path: 'react-vite/package.json',
      description: 'Dependências e scripts (npm install, dev, build, deploy gh-pages).',
      content: `{
  "name": "frame-generator-api-react-vite",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "Integração React + Vite compatível com o Frame-Generator-API (consumo de configs/payload estáticos) com deploy para GitHub Pages.",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && gh-pages -d dist"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "gh-pages": "^6.2.0",
    "vite": "^5.4.10"
  }
}
`
    },
    {
      path: 'react-vite/vite.config.js',
      description: 'Configuração Vite com base para GitHub Pages.',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ajuste "base" para o nome do repositório/página no GitHub Pages.
// Ex.: base: '/Frame-Generator-API/' para project pages, ou '/' para user/org pages/custom domain.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/Frame-Generator-API/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
`
    },
    {
      path: 'react-vite/src/main.jsx',
      description: 'Entrada React.',
      content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`
    },
    {
      path: 'react-vite/src/App.jsx',
      description: 'Componente principal consumindo configs do Frame-Generator-API.',
      content: `import React, { useEffect, useState } from 'react';

// Base do site estático do Frame-Generator-API (ajuste conforme seu deploy).
const DEFAULT_SITE = 'https://kauan11-boop.github.io/Frame-Generator-API/';

function joinUrl(base, path) {
  const b = base.endsWith('/') ? base : base + '/';
  return new URL(path.replace(/^\\//, ''), b).toString();
}

export default function App() {
  const [siteBase, setSiteBase] = useState(DEFAULT_SITE);
  const [apiConfig, setApiConfig] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [apiRes, settingsRes] = await Promise.all([
        fetch(joinUrl(siteBase, 'configs/api.json'), { cache: 'no-store' }),
        fetch(joinUrl(siteBase, 'configs/settings.json'), { cache: 'no-store' }),
      ]);
      if (!apiRes.ok) throw new Error(\`Falha ao carregar configs/api.json (\${apiRes.status})\`);
      if (!settingsRes.ok) throw new Error(\`Falha ao carregar configs/settings.json (\${settingsRes.status})\`);
      setApiConfig(await apiRes.json());
      setSettings(await settingsRes.json());
    } catch (e) {
      setError(e?.message || String(e));
      setApiConfig(null);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="container">
      <header>
        <h1>Frame-Generator-API · React + Vite</h1>
        <p>Exemplo de compatibilidade/integração: consome configurações e contrato público do site estático. Execução de inferência/processamento pesado depende de runtime/provedor/backend compatível.</p>
      </header>

      <section className="card">
        <h2>Origem dos dados (GitHub Pages / estático)</h2>
        <label htmlFor="siteBase">URL base do site</label>
        <div className="row">
          <input id="siteBase" value={siteBase} onChange={(e) => setSiteBase(e.target.value)} placeholder="https://usuario.github.io/repositorio/" />
          <button onClick={load} disabled={loading}>{loading ? 'Carregando…' : 'Recarregar'}</button>
        </div>
        {error ? <p className="error" role="alert">Erro: {error}</p> : null}
      </section>

      <section className="grid">
        <article className="card">
          <h2>Contrato de API (lógico)</h2>
          {apiConfig ? (
            <>
              <p><strong>Base:</strong> <code>{apiConfig.base || '/api/v1'}</code> · <strong>Modo:</strong> {apiConfig.mode || 'demo'}</p>
              <p className="muted">Namespaces declarados: {(apiConfig.namespaces || []).length}</p>
              <pre>{JSON.stringify(apiConfig, null, 2)}</pre>
            </>
          ) : <p className="muted">Sem dados carregados.</p>}
        </article>
        <article className="card">
          <h2>Configurações do sistema</h2>
          {settings ? (
            <>
              <p><strong>Projeto:</strong> {settings?.system?.name || '—'} · <strong>Versão:</strong> {settings?.system?.version || '—'}</p>
              <pre>{JSON.stringify(settings, null, 2)}</pre>
            </>
          ) : <p className="muted">Sem dados carregados.</p>}
        </article>
      </section>

      <footer className="muted">
        <p>Para conectar a um backend WebSocket/REST real, configure a URL e (opcionalmente) um código/token no seu cliente; trate segredos fora do código versionado.</p>
      </footer>
    </main>
  );
}
`
    },
    {
      path: 'react-vite/src/styles.css',
      description: 'Estilos base do exemplo.',
      content: `:root { color-scheme: light; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
body { margin: 0; background: #f6f7f9; color: #111827; }
.container { max-width: 1100px; margin: 0 auto; padding: 24px; }
h1 { margin: 0 0 8px; font-size: 1.75rem; }
h2 { margin: 0 0 8px; font-size: 1rem; }
header p { margin: 0 0 16px; color: #4b5563; max-width: 75ch; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
input { flex: 1 1 320px; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; }
button { padding: 10px 14px; border: 1px solid #2563eb; background: #2563eb; color: #fff; border-radius: 8px; font: inherit; cursor: pointer; }
button:disabled { opacity: .6; cursor: not-allowed; }
pre { background: #0f172a; color: #e5e7eb; padding: 12px; border-radius: 8px; overflow: auto; font-size: 12px; max-height: 360px; }
code { background: #f1f4f8; border: 1px solid #e5e7eb; padding: 1px 6px; border-radius: 6px; }
.muted { color: #4b5563; }
.error { color: #991b1b; background: #fef2f2; border: 1px solid #fca5a5; padding: 8px 10px; border-radius: 8px; }
label { display: block; font-size: 0.875rem; font-weight: 600; color: #4b5563; margin-bottom: 4px; }
footer { margin-top: 8px; font-size: 0.875rem; }
`
    },
    {
      path: 'react-vite/README.md',
      description: 'Instruções de uso/build/deploy (Vite + GitHub Pages).',
      content: `# Integração React + Vite (Frame-Generator-API)

Fontes de referência para um app React + Vite que consome configs/contrato do site estático.

## Uso (projeto externo/local)
1. Crie os arquivos conforme esta estrutura.
2. \`npm install\`
3. \`npm run dev\` (desenvolvimento) / \`npm run build\` (produção) / \`npm run preview\`
4. Deploy GitHub Pages: ajuste \`base\` em \`vite.config.js\` e publique \`dist\` (ex.: \`npm run deploy\` com \`gh-pages\`).

## Execução direta no navegador (sem build)
O projeto inclui uma demo integrada que roda no navegador via módulos ES/CDN: abra \`Public/react-vite.html\` (ou o link no dashboard). Ela consome \`configs/api.json\` e \`configs/settings.json\` do site.
`
    }
  ];
}

export function getDiscordRuntimeTemplateFiles() {
  // Reference template for external Node.js runtime (embedded for browser preview/copy).
  return [
    {
      path: 'discord-bot/package.json',
      content: `{
  "name": "frame-generator-discord-bot-template",
  "version": "1.0.0",
  "private": true,
  "description": "Template avançado de bot Discord (discord.js v14). Executar em ambiente Node.js.",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "deploy": "node deploy-commands.js"
  },
  "engines": { "node": ">=18" },
  "dependencies": {
    "discord.js": "^14.16.0",
    "dotenv": "^16.4.5"
  }
}
`
    },
    {
      path: 'discord-bot/.env.example',
      content: `# Copie para .env e preencha (NUNCA versione o .env real)
DISCORD_TOKEN=COLOQUE_SEU_TOKEN_AQUI
CLIENT_ID=COLOQUE_SEU_CLIENT_ID
# GUILD_ID=COLOQUE_O_ID_DO_SERVIDOR_PARA_DEPLOY_RAPIDO (opcional)
# PREFIX=!
`
    },
    {
      path: 'discord-bot/index.js',
      content: `import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, Partials } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // Adicione intents conforme necessário (alguns exigem ativação no Developer Portal)
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(commandsPath, file)).href);
    const command = mod.default || mod;
    if (command?.data?.name && typeof command.execute === 'function') {
      client.commands.set(command.data.name, command);
    }
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(\`Bot online como \${c.user.tag}\`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands?.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const payload = { content: 'Erro ao executar o comando.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const prefix = process.env.PREFIX || '!';
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/\\s+/);
  const cmd = (args.shift() || '').toLowerCase();
  if (cmd === 'ping') await message.reply('Pong!');
});

client.on(Events.Error, (err) => console.error('Discord client error:', err));
client.on(Events.Warn, (info) => console.warn('Discord client warn:', info));

const token = process.env.DISCORD_TOKEN;
if (!token || token === 'COLOQUE_SEU_TOKEN_AQUI') {
  console.error('Defina DISCORD_TOKEN no arquivo .env antes de iniciar.');
  process.exit(1);
}

client.login(token);
`
    },
    {
      path: 'discord-bot/deploy-commands.js',
      content: `import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(commandsPath, file)).href);
    const command = mod.default || mod;
    if (command?.data?.toJSON) commands.push(command.data.toJSON());
  }
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
if (!token || !clientId) {
  console.error('Defina DISCORD_TOKEN e CLIENT_ID no .env.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);
try {
  console.log('Registrando comandos slash...');
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Comandos registrados no servidor (guild).');
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Comandos registrados globalmente (pode levar tempo para propagar).');
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
`
    },
    {
      path: 'discord-bot/commands/ping.js',
      content: `import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Responde com Pong!'),
  async execute(interaction) {
    await interaction.reply('Pong!');
  },
};
`
    },
    {
      path: 'discord-bot/commands/help.js',
      content: `import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('Informações básicas do bot'),
  async execute(interaction) {
    await interaction.reply({ content: 'Bot configurado a partir do template do Frame-Generator-API. Use /ping para testar.', ephemeral: true });
  },
};
`
    },
    {
      path: 'discord-bot/README.md',
      content: `# Template de Bot Discord (discord.js)

Template avançado integrado ao Frame-Generator-API. **Execução real em ambiente Node.js** (gateway/Discord requer runtime externo). Configuração, geração de arquivos e simulação de comandos/eventos rodam no navegador pelo dashboard.

## Instalação e uso (runtime Node)
1. Copie \`.env.example\` para \`.env\` e preencha \`DISCORD_TOKEN\` e \`CLIENT_ID\` (nunca versione \`.env\`).
2. \`npm install\`
3. \`npm run deploy\` (defina \`GUILD_ID\` no \`.env\` para deploy rápido no servidor)
4. \`npm start\`
`
    }
  ];
}
