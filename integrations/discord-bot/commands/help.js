import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('Informações básicas do bot'),
  async execute(interaction) {
    await interaction.reply({ content: 'Bot configurado a partir do template do Frame-Generator-API. Use /ping para testar.', ephemeral: true });
  },
};
