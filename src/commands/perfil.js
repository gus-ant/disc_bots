import { SlashCommandBuilder } from 'discord.js';
import { getUser, getUserBadges, getWeeklyHours } from '../data.js';
import { buildProfileEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('Exibe o perfil, horas acumuladas na semana e status do membro/bolsista')
  .addUserOption(option =>
    option.setName('usuario')
      .setDescription('Membro que deseja visualizar (deixe em branco para ver o seu)')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('usuario') || interaction.user;
  const dbUser = await getUser(targetUser.id, targetUser.username);
  const badges = await getUserBadges(targetUser.id);
  const weeklyHours = await getWeeklyHours(targetUser.id);

  const embed = buildProfileEmbed(targetUser, dbUser, badges, weeklyHours);
  await interaction.editReply({ embeds: [embed] });
}
