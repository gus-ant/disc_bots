import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CIIA_COLORS } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('ajuda')
  .setDescription('Guia de comandos e funcionamento do Bot CIIA/DF');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle('🏛 Guia de Comandos • CIIA/DF')
    .setDescription('O cadastro com `/cadastrar` é obrigatório antes de utilizar os demais comandos.')
    .addFields(
      {
        name: 'Cadastro',
        value: '`/cadastrar` realiza seu registro de Bolsista no sistema.'
      },
      {
        name: 'Dailies e Acompanhamento',
        value: '`/daily` registra o standup do dia. `/editar-daily` ajusta o envio de hoje. `/minha-semana` mostra o progresso rumo à meta de 20h.'
      },
      {
        name: 'Dashboard e Métricas',
        value: '`/dashboard` exibe o painel de métricas diretamente no Discord. O painel web também fica acessível em http://localhost:3000.'
      },
      {
        name: 'Perfil e Comunidade',
        value: '`/perfil`, `/ranking`, `/projetos`, `/adicionar-projeto`, `/exportar-dailies`, `/registrar-conteudo`, `/conteudos` e `/compartilhar`.'
      }
    )
    .setFooter({ text: 'CIIA/DF • Centro Integrado de Inteligência Artificial' });

  await interaction.reply({ embeds: [embed] });
}
