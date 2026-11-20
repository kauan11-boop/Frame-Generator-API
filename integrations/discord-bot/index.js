import 'dotenv/config';
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
  console.log(`Bot online como ${c.user.tag}`);
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
  // Exemplo de comando por prefixo (opcional). Ajuste conforme sua configuração.
  const prefix = process.env.PREFIX || '!';
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/\s+/);
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
