import { SlashCommandBuilder } from 'discord.js';
import { getDashboardSummary, getProjectDistribution, getStudentsMetrics } from '../data.js';
import { buildDiscordDashboardEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('dashboard')
  .setDescription('Exibe as métricas consolidadas e o painel de produtividade do CIIA/DF diretamente no Discord.');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const summary = await getDashboardSummary();
    const projectStats = await getProjectDistribution();
    const students = await getStudentsMetrics();

    const embed = buildDiscordDashboardEmbed(summary, projectStats, students);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Erro ao gerar dashboard no Discord:', error);
    await interaction.editReply({
      content: 'Ocorreu um erro ao carregar as métricas do dashboard.'
    });
  }
}
