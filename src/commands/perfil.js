import { SlashCommandBuilder } from 'discord.js';
import { getUser, getUserBadges, getWeeklyHours } from '../database.js';
import { buildProfileEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('👤 Exibe o perfil, horas acumuladas na semana e conquistas do membro/bolsista')
  .addUserOption(option =>
    option.setName('usuario')
      .setDescription('Membro que deseja visualizar (deixe em branco para ver o seu)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('usuario') || interaction.user;
  const dbUser = getUser(targetUser.id, targetUser.username);
  const badges = getUserBadges(targetUser.id);
  const weeklyHours = getWeeklyHours(targetUser.id);

  const embed = buildProfileEmbed(targetUser, dbUser, badges, weeklyHours);
  await interaction.reply({ embeds: [embed] });
}
