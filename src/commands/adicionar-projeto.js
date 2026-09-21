import { SlashCommandBuilder } from 'discord.js';
import { addProject, USER_ROLES } from '../database.js';

export const allowedRoles = [USER_ROLES.COORDENADOR, USER_ROLES.ADMIN];

export const data = new SlashCommandBuilder()
  .setName('adicionar-projeto')
  .setDescription('➕ Cadastra um novo projeto ou iniciativa de IA do CIIA/DF')
  .addStringOption(option =>
    option.setName('nome')
      .setDescription('Nome do novo projeto (ex: Automação Jurídica com IA)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('descricao')
      .setDescription('Descrição sucinta das metas e escopo do projeto')
      .setRequired(true)
  );

export async function execute(interaction) {
  const name = interaction.options.getString('nome');
  const description = interaction.options.getString('descricao');

  const result = addProject(name, description);

  if (result.success) {
    await interaction.reply({
      content: `✅ **Projeto cadastrado com sucesso!**\n🤖 **${name}**: ${description}\n\nO projeto já está disponível em **/projetos** e para vinculação na **/daily**.`,
      ephemeral: false
    });
  } else {
    await interaction.reply({
      content: `⚠️ **Erro ao cadastrar projeto:** ${result.error}`,
      ephemeral: true
    });
  }
}
