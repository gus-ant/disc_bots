import { SlashCommandBuilder } from 'discord.js';
import { getDailyByUserDate } from '../database.js';
import { buildEditDailyModal } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('editar-daily')
  .setDescription('Edita a sua daily registrada no dia atual.');

export async function execute(interaction) {
  const daily = getDailyByUserDate(interaction.user.id);

  if (!daily) {
    await interaction.reply({
      content: '⚠️ Você ainda não registrou uma daily hoje. Use **/daily** primeiro.',
      ephemeral: true
    });
    return;
  }

  await interaction.showModal(buildEditDailyModal(daily));
}

