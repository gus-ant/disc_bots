import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getContents } from '../database.js';
import { CIIA_COLORS } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('conteudos')
  .setDescription('Lista os arquivos e conteúdos registrados no CIIA.')
  .addUserOption(option =>
    option.setName('usuario')
      .setDescription('Filtrar conteúdos de um usuário específico')
      .setRequired(false)
  );

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('usuario');
  
  // Se usuário foi fornecido, usamos o id dele, senão null
  const contents = getContents(targetUser ? targetUser.id : null, 15);

  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.INFO)
    .setTitle(targetUser ? `📁 Conteúdos de ${targetUser.username}` : '📁 Últimos Conteúdos Registrados no CIIA')
    .setDescription('Aqui estão os arquivos e posts recentes registrados na base de dados.')
    .setTimestamp();

  if (contents.length === 0) {
    embed.addFields({ name: 'Nenhum registro encontrado.', value: 'Não há conteúdos para exibir.' });
  } else {
    contents.forEach(c => {
      const insp = c.inspiration ? `\n💡 Inspiração: ${c.inspiration.substring(0, 50)}...` : '';
      embed.addFields({
        name: `[${c.category}] ${c.title}`,
        value: `👤 ${c.username}\n🔗 [Acessar Link](${c.link})${insp}\n\`ID: ${c.id}\``,
        inline: false
      });
    });
  }

  await interaction.reply({ embeds: [embed] });
}
