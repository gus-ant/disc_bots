import { SlashCommandBuilder } from 'discord.js';
import { buildDailyModal } from '../utils/embeds.js';
import { hasSubmittedDailyToday } from '../database.js';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('📋 Abre o formulário de Standup Diário do Bolsista (CIIA/DF)');

export async function execute(interaction) {
  if (hasSubmittedDailyToday(interaction.user.id)) {
    await interaction.reply({
      content: '⚠️ **Você já registrou o seu Standup Diário hoje!**\nCada bolsista pode registrar apenas 1 daily por dia. Para verificar o total de horas acumuladas na semana, use o comando **/perfil**.',
      ephemeral: true
    });
    return;
  }

  const modal = buildDailyModal();
  await interaction.showModal(modal);
}
