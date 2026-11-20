import 'dotenv/config';
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
