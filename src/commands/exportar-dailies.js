import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import { getDailiesByDateRange, USER_ROLES } from '../database.js';
import { getCurrentMonthRange } from '../utils/dates.js';

export const allowedRoles = [USER_ROLES.COORDENADOR, USER_ROLES.ADMIN];

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(rows) {
  const headers = [
    'data',
    'usuario',
    'categoria',
    'horas',
    'horario',
    'projetos',
    'realizado',
    'proximas_metas_bloqueios'
  ];

  const lines = rows.map(row => [
    row.date,
    row.username,
    row.role,
    Number(row.hours_today || 0).toFixed(1),
    row.time_range,
    row.project_name,
    row.tasks_done,
    row.tasks_next
  ].map(csvCell).join(','));

  return [headers.join(','), ...lines].join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('exportar-dailies')
  .setDescription('Exporta dailies em CSV. Por padrão, exporta o mês atual.')
  .addStringOption(option =>
    option.setName('data_inicio')
      .setDescription('Data inicial no formato YYYY-MM-DD')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('data_fim')
      .setDescription('Data final no formato YYYY-MM-DD')
      .setRequired(false)
  );

export async function execute(interaction) {
  const monthRange = getCurrentMonthRange();
  const startDate = interaction.options.getString('data_inicio') || monthRange.startDate;
  const endDate = interaction.options.getString('data_fim') || monthRange.endDate;

  if (!isDateString(startDate) || !isDateString(endDate) || startDate > endDate) {
    await interaction.reply({
      content: '⚠️ Informe datas válidas no formato `YYYY-MM-DD`, com `data_inicio` menor ou igual a `data_fim`.',
      ephemeral: true
    });
    return;
  }

  const rows = getDailiesByDateRange(startDate, endDate);
  const csv = buildCsv(rows);
  const fileName = `dailies_${startDate}_${endDate}.csv`;
  const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf8'), { name: fileName });

  await interaction.reply({
    content: `✅ Exportação concluída: **${rows.length}** registro(s) de \`${startDate}\` a \`${endDate}\`.`,
    files: [attachment],
    ephemeral: true
  });
}

