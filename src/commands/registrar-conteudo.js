import { SlashCommandBuilder } from 'discord.js';
import { buildContentModal } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('registrar-conteudo')
  .setDescription('Registra um novo arquivo de documento ou post de rede social para o CIIA.');

export async function execute(interaction) {
  const modal = buildContentModal();
  await interaction.showModal(modal);
}
