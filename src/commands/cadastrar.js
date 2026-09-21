import { SlashCommandBuilder } from 'discord.js';
import { registerUser, USER_ROLES } from '../database.js';

function getAdminUserIds() {
  return new Set(
    (process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
  );
}

export const data = new SlashCommandBuilder()
  .setName('cadastrar')
  .setDescription('Realiza o cadastro inicial obrigatório para usar os comandos do bot.')
  .addStringOption(option =>
    option.setName('categoria')
      .setDescription('Sua categoria no servidor')
      .setRequired(true)
      .addChoices(
        { name: 'Bolsista NIA/UnDF', value: USER_ROLES.BOLSISTA },
        { name: 'Coordenador', value: USER_ROLES.COORDENADOR },
        { name: 'Admin', value: USER_ROLES.ADMIN }
      )
  );

export async function execute(interaction) {
  const role = interaction.options.getString('categoria');

  if (role === USER_ROLES.ADMIN && !getAdminUserIds().has(interaction.user.id)) {
    await interaction.reply({
      content: '⚠️ A categoria **Admin** é restrita aos usuários configurados em `ADMIN_USER_IDS`. Escolha outra categoria ou peça a correção para um admin.',
      ephemeral: true
    });
    return;
  }

  const result = registerUser(interaction.user.id, interaction.user.username, role);
  if (!result.success) {
    await interaction.reply({ content: `⚠️ ${result.error}`, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `✅ Cadastro concluído como **${result.role}**. Agora você pode usar os comandos do bot.`,
    ephemeral: true
  });
}

