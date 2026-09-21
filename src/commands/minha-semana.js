import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getDailiesByDateRange } from '../database.js';
import { CIIA_COLORS, createProgressBar, normalizeProjectNames } from '../utils/embeds.js';
import { getCurrentWeekRange } from '../utils/dates.js';

export const data = new SlashCommandBuilder()
  .setName('minha-semana')
  .setDescription('Mostra seu resumo de horas, projetos e registros da semana atual.');

export async function execute(interaction) {
  const { startDate, endDate } = getCurrentWeekRange();
  const dailies = getDailiesByDateRange(startDate, endDate, interaction.user.id);
  const totalHours = dailies.reduce((sum, daily) => sum + Number(daily.hours_today || 0), 0);
  const remainingHours = Math.max(20 - totalHours, 0);
  const projectSet = new Set();

  for (const daily of dailies) {
    for (const project of normalizeProjectNames(daily.project_name)) {
      projectSet.add(project);
    }
  }

  const lastDaily = dailies.at(-1);
  const dailyRows = dailies.length > 0
    ? dailies.map(daily => `\`${daily.date}\` • ${Number(daily.hours_today).toFixed(1)}h • ${daily.project_name || 'Geral'}`).join('\n')
    : 'Nenhuma daily registrada nesta semana.';

  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle(`📊 Minha semana • ${interaction.user.username}`)
    .setDescription(`Período: \`${startDate}\` a \`${endDate}\``)
    .addFields(
      { name: '⏱️ Horas da semana', value: createProgressBar(totalHours, 20), inline: false },
      { name: '🎯 Para a meta de 20h', value: remainingHours === 0 ? 'Meta semanal concluída.' : `Faltam **${remainingHours.toFixed(1)}h**.`, inline: true },
      { name: '📋 Dailies enviadas', value: `${dailies.length} registro(s)`, inline: true },
      { name: '🚀 Projetos citados', value: projectSet.size > 0 ? [...projectSet].join(', ') : 'Nenhum projeto citado.', inline: false },
      { name: '🗓️ Registros', value: dailyRows.slice(0, 1024), inline: false },
      { name: 'Último registro', value: lastDaily ? `\`${lastDaily.date}\` • ${lastDaily.tasks_done.slice(0, 250)}` : 'Nenhum registro nesta semana.', inline: false }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

