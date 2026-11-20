// Discord bot studio (browser-side): configuration, content generation and in-browser command/event simulation.
// Real Discord gateway connection/execution requires an external Node.js runtime; templates are generated for that purpose.

import { esc } from './render.js';

const DEFAULT_INTENTS = ['Guilds', 'GuildMessages'];
const INTENT_OPTIONS = [
  'Guilds', 'GuildMembers', 'GuildModeration', 'GuildEmojisAndStickers', 'GuildIntegrations', 'GuildWebhooks',
  'GuildInvites', 'GuildVoiceStates', 'GuildPresences', 'GuildMessages', 'GuildMessageReactions', 'GuildMessageTyping',
  'DirectMessages', 'DirectMessageReactions', 'DirectMessageTyping', 'MessageContent', 'GuildScheduledEvents', 'AutoModerationConfiguration', 'AutoModerationExecution'
];
const EVENT_OPTIONS = ['ready', 'interactionCreate', 'messageCreate', 'guildMemberAdd', 'guildMemberRemove', 'messageUpdate', 'voiceStateUpdate', 'error', 'warn'];

export function getDiscordOptions() {
  return { intents: INTENT_OPTIONS, events: EVENT_OPTIONS, defaultIntents: DEFAULT_INTENTS };
}

function safeName(name, fallback = 'meu-bot') {
  const s = String(name || '').trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}

function lines(arr, indent = '') { return (arr || []).map((l) => indent + l).join('\n'); }

export function buildDiscordConfig(form = {}) {
  const name = String(form.name || 'Meu Bot Discord').trim() || 'Meu Bot Discord';
  const pkgName = safeName(form.packageName || name, 'meu-bot-discord');
  const clientId = String(form.clientId || 'COLOQUE_SEU_CLIENT_ID').trim();
  const intents = Array.isArray(form.intents) && form.intents.length ? [...new Set(form.intents)] : [...DEFAULT_INTENTS];
  const events = Array.isArray(form.events) && form.events.length ? [...new Set(form.events)] : ['ready', 'interactionCreate'];
  const prefix = String(form.prefix || '!').trim() || '!';
  const useSlash = form.useSlash !== false;
  const usePrefix = !!form.usePrefix;
  const commands = Array.isArray(form.commands) ? form.commands.filter(Boolean) : [];
  const description = String(form.description || 'Bot Discord gerado pelo Frame-Generator-API (template).').trim();
  const nodeVersion = String(form.nodeVersion || '>=18').trim();
  return { name, packageName: pkgName, clientId, intents, events, prefix, useSlash, usePrefix, commands, description, nodeVersion };
}

export function generateDiscordFiles(cfgInput = {}) {
  const cfg = buildDiscordConfig(cfgInput);
  const intentsStr = cfg.intents.map((i) => `GatewayIntentBits.${i}`).join(', ');
  const partials = cfg.intents.includes('DirectMessages') ? ", Partials.Channel" : '';

  const pkg = {
    name: cfg.packageName,
    version: '1.0.0',
    private: true,
    description: cfg.description,
    type: 'module',
    main: 'index.js',
    scripts: {
      start: 'node index.js',
      deploy: 'node deploy-commands.js'
    },
    engines: { node: cfg.nodeVersion },
    dependencies: { 'discord.js': '^14.16.0', dotenv: '^16.4.5' }
  };

  const envExample = `# Copie para .env e preencha (NUNCA versione o .env real)
DISCORD_TOKEN=COLOQUE_SEU_TOKEN_AQUI
CLIENT_ID=${cfg.clientId || 'COLOQUE_SEU_CLIENT_ID'}
# GUILD_ID=COLOQUE_O_ID_DO_SERVIDOR_PARA_DEPLOY_RAPIDO (opcional)
`;

  const eventHandlers = [];
  if (cfg.events.includes('ready')) eventHandlers.push(`client.once(Events.ClientReady, (c) => {\n  console.log(\`Bot online como \${c.user.tag}\`);\n});`);
  if (cfg.events.includes('interactionCreate')) eventHandlers.push(`client.on(Events.InteractionCreate, async (interaction) => {\n  if (!interaction.isChatInputCommand()) return;\n  const command = client.commands?.get(interaction.commandName);\n  if (!command) return;\n  try {\n    await command.execute(interaction);\n  } catch (error) {\n    console.error(error);\n    const payload = { content: 'Erro ao executar o comando.', ephemeral: true };\n    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});\n    else await interaction.reply(payload).catch(() => {});\n  }\n});`);
  if (cfg.events.includes('messageCreate')) eventHandlers.push(`client.on(Events.MessageCreate, async (message) => {\n  if (message.author.bot) return;\n  ${cfg.usePrefix ? `const prefix = process.env.PREFIX || '${cfg.prefix.replace(/'/g, "\\'")}';\n  if (!message.content.startsWith(prefix)) return;\n  const args = message.content.slice(prefix.length).trim().split(/\\s+/);\n  const cmd = (args.shift() || '').toLowerCase();\n  if (cmd === 'ping') return message.reply('Pong!');` : "// Prefix desativado na configuração gerada."}\n  // Adicione lógica de conteúdo/moderação aqui.\n});`);
  if (cfg.events.includes('guildMemberAdd')) eventHandlers.push(`client.on(Events.GuildMemberAdd, async (member) => {\n  console.log('Novo membro:', member.user?.tag);\n  // Ex.: enviar mensagem de boas-vindas em um canal configurado.\n});`);
  if (cfg.events.includes('guildMemberRemove')) eventHandlers.push(`client.on(Events.GuildMemberRemove, async (member) => {\n  console.log('Membro saiu:', member.user?.tag);\n});`);
  if (cfg.events.includes('messageUpdate')) eventHandlers.push(`client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {\n  // Log/auditoria de edições (respeite privacidade e ToS).\n});`);
  if (cfg.events.includes('voiceStateUpdate')) eventHandlers.push(`client.on(Events.VoiceStateUpdate, async (oldState, newState) => {\n  // Eventos de voz.\n});`);
  if (cfg.events.includes('error')) eventHandlers.push(`client.on(Events.Error, (err) => console.error('Discord client error:', err));`);
  if (cfg.events.includes('warn')) eventHandlers.push(`client.on(Events.Warn, (info) => console.warn('Discord client warn:', info));`);

  const indexJs = `import 'dotenv/config';\nimport { Client, Collection, Events, GatewayIntentBits${partials ? ', Partials' : ''} } from 'discord.js';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\n\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);\n\nconst client = new Client({\n  intents: [${intentsStr}]${partials ? ',\n  partials: [Partials.Channel]' : ''}\n});\n\nclient.commands = new Collection();\n\n// Carrega comandos de ./commands (slash commands)\nconst commandsPath = path.join(__dirname, 'commands');\nif (fs.existsSync(commandsPath)) {\n  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));\n  for (const file of files) {\n    const mod = await import(pathToFileURL(path.join(commandsPath, file)).href);\n    const command = mod.default || mod;\n    if (command?.data?.name && typeof command.execute === 'function') {\n      client.commands.set(command.data.name, command);\n    }\n  }\n}\n\n${eventHandlers.join('\n\n')}\n\nconst token = process.env.DISCORD_TOKEN;\nif (!token || token === 'COLOQUE_SEU_TOKEN_AQUI') {\n  console.error('Defina DISCORD_TOKEN no arquivo .env antes de iniciar.');\n  process.exit(1);\n}\n\nclient.login(token);\n`;

  const deployJs = `import 'dotenv/config';\nimport { REST, Routes } from 'discord.js';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\n\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);\n\nconst commands = [];\nconst commandsPath = path.join(__dirname, 'commands');\nif (fs.existsSync(commandsPath)) {\n  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));\n  for (const file of files) {\n    const mod = await import(pathToFileURL(path.join(commandsPath, file)).href);\n    const command = mod.default || mod;\n    if (command?.data?.toJSON) commands.push(command.data.toJSON());\n  }\n}\n\nconst token = process.env.DISCORD_TOKEN;\nconst clientId = process.env.CLIENT_ID;\nconst guildId = process.env.GUILD_ID;\nif (!token || !clientId) {\n  console.error('Defina DISCORD_TOKEN e CLIENT_ID no .env.');\n  process.exit(1);\n}\n\nconst rest = new REST({ version: '10' }).setToken(token);\ntry {\n  console.log('Registrando comandos slash...');\n  if (guildId) {\n    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });\n    console.log('Comandos registrados no servidor (guild).');\n  } else {\n    await rest.put(Routes.applicationCommands(clientId), { body: commands });\n    console.log('Comandos registrados globalmente (pode levar tempo para propagar).');\n  }\n} catch (error) {\n  console.error(error);\n  process.exit(1);\n}\n`;

  const customCmds = (cfg.commands || []).map((c) => {
    const n = safeName(c.name || 'comando', 'comando').replace(/-/g, '');
    const desc = String(c.description || 'Comando personalizado').replace(/'/g, "\\'");
    return { file: `commands/${n || 'comando'}.js`, content: `import { SlashCommandBuilder } from 'discord.js';\n\nexport default {\n  data: new SlashCommandBuilder()\n    .setName('${n || 'comando'}')\n    .setDescription('${desc}'),\n  async execute(interaction) {\n    await interaction.reply('${String(c.response || 'Resposta do comando.').replace(/'/g, "\\'")}');\n  },\n};\n` };
  });

  const pingCmd = { file: 'commands/ping.js', content: `import { SlashCommandBuilder } from 'discord.js';\n\nexport default {\n  data: new SlashCommandBuilder().setName('ping').setDescription('Responde com Pong!'),\n  async execute(interaction) {\n    await interaction.reply('Pong!');\n  },\n};\n` };

  const helpCmd = { file: 'commands/help.js', content: `import { SlashCommandBuilder } from 'discord.js';\n\nexport default {\n  data: new SlashCommandBuilder().setName('help').setDescription('Lista informações básicas do bot'),\n  async execute(interaction) {\n    await interaction.reply({ content: 'Bot configurado via Frame-Generator-API. Use /ping para testar.', ephemeral: true });\n  },\n};\n` };

  const files = [
    { path: 'package.json', content: JSON.stringify(pkg, null, 2) + '\n' },
    { path: '.env.example', content: envExample },
    { path: 'index.js', content: indexJs },
    { path: 'deploy-commands.js', content: deployJs },
    pingCmd,
    helpCmd,
    ...customCmds,
    { path: 'README.md', content: `# ${cfg.name}\n\n${cfg.description}\n\n## Requisitos\n- Node.js ${cfg.nodeVersion}\n- Um aplicativo/bot no Discord Developer Portal\n\n## Configuração\n1. Copie \`.env.example\` para \`.env\` e preencha \`DISCORD_TOKEN\` e \`CLIENT_ID\`.\n2. (Opcional) Defina \`GUILD_ID\` para registrar comandos rapidamente em um servidor.\n3. Instale dependências: \`npm install\`\n4. Registre comandos slash: \`npm run deploy\`\n5. Inicie o bot: \`npm start\`\n\n## Intents habilitados\n${cfg.intents.map((i) => `- ${i}`).join('\n')}\n\n## Observações\n- Nunca versione o arquivo \`.env\` nem compartilhe seu token.\n- Alguns intents (ex.: GuildMembers, MessageContent, GuildPresences) exigem ativação no Developer Portal e podem exigir verificação/aprovação conforme o uso.\n- Este template é gerado para execução em ambiente Node.js (não roda no GitHub Pages).\n` },
  ];

  return { config: cfg, files };
}

export function renderDiscordFileList(files = []) {
  return `<ul>${files.map((f) => `<li><code>${esc(f.path)}</code> <span class="muted">(${esc(String(f.content.length))} chars)</span></li>`).join('')}</ul>`;
}

export function simulateDiscordInteraction(cfgInput = {}, inputText = '') {
  const cfg = buildDiscordConfig(cfgInput);
  const raw = String(inputText || '').trim();
  const now = new Date().toISOString();
  const events = [];
  if (!raw) {
    return { ok: false, events: [{ at: now, type: 'warn', message: 'Informe um comando ou mensagem para simular.' }], output: null };
  }

  const commands = Array.isArray(cfg.commands) ? cfg.commands : [];
  const findCmd = (name) => commands.find((c) => String(c.name || '').toLowerCase() === String(name || '').toLowerCase())
    || [{ name: 'ping', description: 'Responde com Pong!', response: 'Pong!' }, { name: 'help', description: 'Ajuda', response: 'Comandos disponíveis no simulador.' }].find((c) => c.name === String(name || '').toLowerCase());

  // Slash-style: /cmd args
  if (raw.startsWith('/')) {
    const parts = raw.slice(1).trim().split(/\s+/);
    const name = (parts.shift() || '').toLowerCase();
    events.push({ at: now, type: 'event', message: `interactionCreate (slash): /${name}` });
    const cmd = findCmd(name);
    if (!cfg.useSlash) events.push({ at: now, type: 'warn', message: 'Slash commands estão desativados na configuração, mas a simulação foi executada.' });
    if (cmd) {
      events.push({ at: now, type: 'ok', message: `Comando "${name}" executado no simulador.` });
      return { ok: true, events, output: { kind: 'slash', command: name, response: String(cmd.response || 'Sem resposta configurada.') } };
    }
    events.push({ at: now, type: 'error', message: `Comando "/${name}" não encontrado na configuração/simulador.` });
    return { ok: false, events, output: { kind: 'slash', command: name, response: 'Comando não encontrado.' } };
  }

  // Prefix command
  const prefix = String(cfg.prefix || '!');
  if (cfg.usePrefix && raw.startsWith(prefix)) {
    const parts = raw.slice(prefix.length).trim().split(/\s+/);
    const name = (parts.shift() || '').toLowerCase();
    events.push({ at: now, type: 'event', message: `messageCreate (prefix): ${prefix}${name}` });
    const cmd = findCmd(name);
    if (cmd) {
      events.push({ at: now, type: 'ok', message: `Comando de prefixo "${name}" processado no simulador.` });
      return { ok: true, events, output: { kind: 'prefix', command: name, response: String(cmd.response || 'Sem resposta configurada.') } };
    }
    events.push({ at: now, type: 'warn', message: `Nenhuma resposta configurada para "${prefix}${name}" no simulador.` });
    return { ok: false, events, output: { kind: 'prefix', command: name, response: 'Sem resposta configurada.' } };
  }

  events.push({ at: now, type: 'event', message: 'messageCreate: mensagem recebida (sem comando correspondente no simulador).' });
  if ((cfg.events || []).includes('messageCreate')) {
    events.push({ at: now, type: 'info', message: 'Evento messageCreate está habilitado na configuração; lógica personalizada depende do seu código/handlers.' });
  }
  return { ok: true, events, output: { kind: 'message', response: null } };
}
