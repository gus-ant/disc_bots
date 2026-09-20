import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CIIA_COLORS } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('ajuda')
  .setDescription('❓ Guia de comandos e funcionamento do Bot CIIA/DF');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle('📖 Guia do Bot CIIA/DF • Engajamento & Bolsistas')
    .setDescription('Bem-vindo(a) ao servidor do Centro Integrado de IA do DF! Confira abaixo como utilizar o bot no seu dia a dia:')
    .addFields(
      {
        name: '📋 `/daily`',
        value: 'Abre o formulário de Standup Diário. Registre suas **horas dedicadas** (meta de 20h/semana), o que fez e se há bloqueios. Dailies contam apenas em **dias úteis** (Segunda a Sexta).'
      },
      {
        name: '👤 `/perfil [usuario]`',
        value: 'Exibe seu cartão de membro com seu progresso de horas na semana (`X / 20h`), sequência de dailies e conquistas (*badges*).'
      },
      {
        name: '🚀 `/projetos`',
        value: 'Mostra as principais frentes de pesquisa e soluções de IA desenvolvidas pelo CIIA/DF.'
      },
      {
        name: '🏆 `/ranking`',
        value: 'Exibe o leaderboard com os membros mais ativos e com maior nível de contribuição.'
      },
      {
        name: '💡 `/compartilhar`',
        value: 'Compartilha artigos de pesquisa, benchmarks e ferramentas de IA formatados para a comunidade.'
      }
    )
    .setFooter({ text: 'CIIA/DF • Inovação, Capacitação e IA de Interesse Público' });

  await interaction.reply({ embeds: [embed] });
}
