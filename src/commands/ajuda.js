import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CIIA_COLORS } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('ajuda')
  .setDescription('Guia de comandos e funcionamento do Bot CIIA/DF');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle('📖 Guia do Bot CIIA/DF')
    .setDescription('O cadastro com `/cadastrar` é obrigatório antes de usar qualquer outro comando.')
    .addFields(
      {
        name: 'Cadastro',
        value: '`/cadastrar` define sua categoria. Depois do cadastro, ela só pode ser alterada por Admin com `/alterar-cadastro`.'
      },
      {
        name: 'Dailies',
        value: '`/daily` registra o check-in do dia. `/editar-daily` corrige a daily de hoje. `/minha-semana` mostra seu resumo semanal.'
      },
      {
        name: 'Perfil e comunidade',
        value: '`/perfil`, `/ranking`, `/projetos`, `/registrar-conteudo`, `/conteudos` e `/compartilhar` ajudam a acompanhar participação e acervo.'
      },
      {
        name: 'Coordenação e Admin',
        value: '`/adicionar-projeto` e `/exportar-dailies` são para Coordenadores/Admins. `/alterar-cadastro` e exclusão de conteúdo são para Admins.'
      },
      {
        name: 'Rotinas automáticas',
        value: 'Bolsistas sem daily recebem DM às 17h em dias úteis. O resumo semanal breve sai na sexta-feira às 15h.'
      }
    )
    .setFooter({ text: 'CIIA/DF • Inovação, Capacitação e IA de Interesse Público' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
