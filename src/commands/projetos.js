import { SlashCommandBuilder } from 'discord.js';
import { getProjects } from '../data.js';
import { buildProjectsEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('projetos')
  .setDescription('Lista as frentes de pesquisa e projetos ativos do CIIA/DF');

export async function execute(interaction) {
  const projects = await getProjects();
  const embed = buildProjectsEmbed(projects);
  await interaction.reply({ embeds: [embed] });
}
