import { SlashCommandBuilder } from 'discord.js';
import { addXP, unlockBadge } from '../database.js';
import { buildShareEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('compartilhar')
  .setDescription('💡 Compartilha um artigo, ferramenta ou conteúdo relevante de IA com a comunidade')
  .addStringOption(option =>
    option.setName('titulo')
      .setDescription('Título do artigo ou recurso')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('link')
      .setDescription('URL do recurso (ex: https://arxiv.org/...)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('descricao')
      .setDescription('Resumo ou por que este conteúdo é interessante?')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('categoria')
      .setDescription('Categoria do recurso')
      .setRequired(false)
      .addChoices(
        { name: 'Paper / Pesquisa', value: 'Paper' },
        { name: 'Ferramenta / Código', value: 'Ferramenta' },
        { name: 'Governança & Ética em IA', value: 'Governança' },
        { name: 'Notícia / Evento', value: 'Notícia' }
      )
  );

export async function execute(interaction) {
  const title = interaction.options.getString('titulo');
  const link = interaction.options.getString('link');
  const description = interaction.options.getString('descricao');
  const category = interaction.options.getString('categoria') || 'Recurso IA';

  const embed = buildShareEmbed(interaction.user, title, link, description, category);

  // Dar XP de incentivo ao compartilhar (20 XP)
  addXP(interaction.user.id, 20);
  unlockBadge(interaction.user.id, 'ai_contributor');

  await interaction.reply({
    content: '✅ **Conteúdo compartilhado com sucesso!** (+20 XP)',
    embeds: [embed]
  });
}
