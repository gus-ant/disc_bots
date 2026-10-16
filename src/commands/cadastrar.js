import { SlashCommandBuilder } from 'discord.js';
import { registerUser, USER_ROLES } from '../data.js';

export const data = new SlashCommandBuilder()
  .setName('cadastrar')
  .setDescription('Realiza seu cadastro de Bolsista no CIIA/DF para habilitar os comandos do bot.');

export async function execute(interaction) {
  const result = await registerUser(interaction.user.id, interaction.user.username, USER_ROLES.BOLSISTA);
  if (!result.success) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `Cadastro de Bolsista concluído com sucesso. Agora você pode usar os comandos do bot (/daily, /minha-semana, /dashboard, etc.).`,
    ephemeral: true
  });
}

