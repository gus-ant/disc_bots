import { SlashCommandBuilder } from 'discord.js';
import { updateUserRegistration, USER_ROLES } from '../database.js';

export const allowedRoles = [USER_ROLES.ADMIN];

export const data = new SlashCommandBuilder()
  .setName('alterar-cadastro')
  .setDescription('Altera a categoria de cadastro de um usuário.')
  .addUserOption(option =>
    option.setName('usuario')
      .setDescription('Usuário que terá o cadastro ajustado')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('categoria')
      .setDescription('Nova categoria')
      .setRequired(true)
      .addChoices(
        { name: 'Bolsista NIA/UnDF', value: USER_ROLES.BOLSISTA },
        { name: 'Coordenador', value: USER_ROLES.COORDENADOR },
        { name: 'Admin', value: USER_ROLES.ADMIN }
      )
  );

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('usuario');
  const role = interaction.options.getString('categoria');
  const result = updateUserRegistration(targetUser.id, targetUser.username, role);

  if (!result.success) {
    await interaction.reply({ content: `⚠️ ${result.error}`, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `✅ Cadastro de **${targetUser.username}** atualizado para **${result.role}**.`,
    ephemeral: true
  });
}

