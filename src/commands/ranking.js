import { SlashCommandBuilder } from 'discord.js';
import { getLeaderboard } from '../data.js';
import { buildRankingEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('Exibe o ranking de engajamento e contribuições do servidor');

export async function execute(interaction) {
  const leaderboard = await getLeaderboard(10);
  const embed = buildRankingEmbed(leaderboard);
  await interaction.reply({ embeds: [embed] });
}
