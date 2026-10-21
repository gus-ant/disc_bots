import { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from 'discord.js';

// Cores temáticas do CIIA/DF
export const CIIA_COLORS = {
  PRIMARY: 0x004488,   // Azul Institucional CIIA
  SUCCESS: 0x00C853,   // Verde Sucesso / Meta Batida
  WARNING: 0xFF9100,   // Laranja Alerta / Bloqueio
  GOLD: 0xFFD700,      // Dourado Conquista
  INFO: 0x00B0FF       // Azul Claro / Notícia IA
};

// Mapeamento de Badges com descrições limpas
export const BADGE_INFO = {
  first_daily: { name: 'Primeiros Passos', desc: 'Registrou a primeira daily no CIIA' },
  streak_5: { name: 'Imparável (5 dias)', desc: '5 dias úteis consecutivos de daily' },
  weekly_20h: { name: 'Meta 20h Concluída', desc: 'Bateu as 20 horas semanais da bolsa' },
  ai_contributor: { name: 'Contribuidor IA', desc: 'Compartilhou conteúdo com a comunidade' },
  ciia_member: { name: 'Membro CIIA/DF', desc: 'Perfil ativado no servidor' }
};

// Barra de progresso visual limpa
export function createProgressBar(current, target = 20, size = 12) {
  const percentage = Math.min(Math.max(current / target, 0), 1);
  const progress = Math.round(size * percentage);
  const emptyProgress = size - progress;

  const progressText = '■'.repeat(progress);
  const emptyProgressText = '□'.repeat(emptyProgress);
  const percentageText = Math.round(percentage * 100);

  return `\`[${progressText}${emptyProgressText}]\` **${current.toFixed(1)}h / ${target}h** (${percentageText}%)`;
}

export function normalizeProjectNames(projectName = '') {
  const seen = new Set();

  return String(projectName)
    .split(/[,\n;]+/)
    .map(project => project.trim())
    .filter(Boolean)
    .filter(project => {
      const key = project.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function formatProjectField(projectName) {
  const projects = normalizeProjectNames(projectName);

  if (projects.length === 0) return '`Geral`';
  if (projects.length === 1) return `\`${projects[0]}\``;

  return projects.map(project => `• ${project}`).join('\n');
}

// Modal limpo para o comando /daily
export function buildDailyModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_daily')
    .setTitle('Registro de Daily | CIIA/DF');

  const hoursInput = new TextInputBuilder()
    .setCustomId('hours_today')
    .setLabel('Horas trabalhadas hoje')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 4 ou 4.5')
    .setMinLength(1)
    .setRequired(true);

  const timeRangeInput = new TextInputBuilder()
    .setCustomId('time_range')
    .setLabel('Intervalo de horário')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 09h às 13h ou 14h às 18h')
    .setMinLength(1)
    .setRequired(true);

  const doneInput = new TextInputBuilder()
    .setCustomId('tasks_done')
    .setLabel('Atividades realizadas hoje')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Resumo das entregas e atividades executadas...')
    .setMinLength(1)
    .setRequired(true);

  const nextInput = new TextInputBuilder()
    .setCustomId('tasks_next')
    .setLabel('Próximas entregas & Bloqueios')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Planejamento para o próximo dia útil e impedimentos...')
    .setMinLength(1)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(hoursInput),
    new ActionRowBuilder().addComponents(timeRangeInput),
    new ActionRowBuilder().addComponents(doneInput),
    new ActionRowBuilder().addComponents(nextInput)
  );

  return modal;
}

export function buildEditDailyModal(daily) {
  const modal = new ModalBuilder()
    .setCustomId('modal_edit_daily')
    .setTitle('Edição de Daily | CIIA/DF');

  const hoursInput = new TextInputBuilder()
    .setCustomId('hours_today')
    .setLabel('Horas trabalhadas hoje')
    .setStyle(TextInputStyle.Short)
    .setValue(String(daily.hours_today))
    .setMinLength(1)
    .setRequired(true);

  const timeRangeInput = new TextInputBuilder()
    .setCustomId('time_range')
    .setLabel('Intervalo de horário')
    .setStyle(TextInputStyle.Short)
    .setValue(daily.time_range || '')
    .setMinLength(1)
    .setRequired(true);

  const doneInput = new TextInputBuilder()
    .setCustomId('tasks_done')
    .setLabel('Atividades realizadas hoje')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(daily.tasks_done || '')
    .setMinLength(1)
    .setRequired(true);

  const nextInput = new TextInputBuilder()
    .setCustomId('tasks_next')
    .setLabel('Próximas entregas & Bloqueios')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(daily.tasks_next || '')
    .setMinLength(1)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(hoursInput),
    new ActionRowBuilder().addComponents(timeRangeInput),
    new ActionRowBuilder().addComponents(doneInput),
    new ActionRowBuilder().addComponents(nextInput)
  );

  return modal;
}

// Embed de confirmação pública de Daily com visual limpo
export function buildDailyEmbed(userDiscord, { hoursToday, timeRange, projectName, tasksDone, tasksNext, blockers }, result) {
  const hasBlocker = blockers && blockers.trim().toLowerCase() !== 'nenhum' && blockers.trim() !== '';

  const embed = new EmbedBuilder()
    .setColor(hasBlocker ? CIIA_COLORS.WARNING : CIIA_COLORS.PRIMARY)
    .setTitle(`📖 Standup Diário • ${userDiscord.displayName || userDiscord.username}`)
    .setThumbnail(userDiscord.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Carga Horária', value: `\`${hoursToday}h\` (${timeRange || 'Período não informado'})`, inline: true },
      { name: 'Sequência (Dias Úteis)', value: `\`${result.streak} dia(s)\``, inline: true },
      { name: 'Progresso Semanal (Meta: 20h)', value: createProgressBar(result.weeklyHours, 20), inline: false },
      { name: 'Atividades Concluídas', value: tasksDone, inline: false },
      { name: 'Próximas Entregas', value: tasksNext, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'CIIA/DF • Centro Integrado de Inteligência Artificial' });

  if (hasBlocker) {
    embed.addFields({ name: 'Impedimento / Bloqueio Registrado', value: `> ${blockers}`, inline: false });
  }

  return embed;
}

// Embed de Dashboard no Discord (Métricas executivas sem poluição visual)
export function buildDiscordDashboardEmbed(summary, projectStats = [], topStudents = []) {
  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle('Painel de Produtividade & Métricas • CIIA/DF')
    .setDescription(`Semana de Referência: \`${summary.currentWeek}\`\nDados consolidados de bolsistas, entregas e projetos.`)
    .addFields(
      { name: 'Total de Horas', value: `\`${summary.totalHours.toFixed(1)}h\``, inline: true },
      { name: 'Dailies Registradas', value: `\`${summary.totalDailies}\``, inline: true },
      { name: 'Bolsistas Ativos (Semana)', value: `\`${summary.activeThisWeek}\``, inline: true },
      { name: 'Adesão à Meta (20h)', value: `\`${summary.usersMetGoal} bolsistas (${summary.goalCompletionRate}%)\``, inline: true },
      { name: 'Média Semanal / Bolsista', value: `\`${summary.avgWeeklyHours.toFixed(1)}h\``, inline: true },
      { name: 'Projetos Ativos', value: `\`${summary.totalProjects}\``, inline: true }
    );

  if (projectStats && projectStats.length > 0) {
    const projectText = projectStats
      .slice(0, 5)
      .map(p => `• **${p.project_name}**: ${p.total_hours}h (${p.daily_count} registros)`)
      .join('\n');
    embed.addFields({ name: 'Distribuição por Projeto', value: projectText, inline: false });
  }

  if (topStudents && topStudents.length > 0) {
    const studentText = topStudents
      .slice(0, 5)
      .map((s, idx) => `**#${idx + 1}** ${s.username} — \`${s.weekly_hours}h\` nesta semana (Streak: ${s.daily_streak}d)`)
      .join('\n');
    embed.addFields({ name: 'Destaques da Semana', value: studentText, inline: false });
  }

  embed
    .setFooter({ text: 'Painel CIIA/DF • Atualizado em tempo real' })
    .setTimestamp();

  return embed;
}

// Embed de Perfil Limpo
export function buildProfileEmbed(userDiscord, dbUser, badges, weeklyHours) {
  const badgeList = badges.length > 0
    ? badges.map(b => {
      const info = BADGE_INFO[b.badge_id] || { name: b.badge_id };
      return `• **${info.name}**`;
    }).join('\n')
    : '*Nenhuma conquista registrada ainda.*';

  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle(`Perfil • ${userDiscord.displayName || userDiscord.username}`)
    .setThumbnail(userDiscord.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Categoria', value: `\`${dbUser.role}\``, inline: true },
      { name: 'Nível', value: `**Nível ${dbUser.level}** (${dbUser.xp} XP)`, inline: true },
      { name: 'Sequência em Dias Úteis', value: `\`${dbUser.daily_streak} dia(s)\``, inline: true },
      { name: 'Carga Semanal (Meta: 20h)', value: createProgressBar(weeklyHours, 20), inline: false },
      { name: 'Conquistas', value: badgeList, inline: false }
    )
    .setFooter({ text: 'CIIA/DF • Centro Integrado de IA' })
    .setTimestamp();

  return embed;
}

// Embed de Projetos
export function buildProjectsEmbed(projects = []) {
  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle('⛳️ Projetos e Frentes de Atuação • CIIA/DF')
    .setDescription('Iniciativas ativas de pesquisa, desenvolvimento e inovação.');

  if (projects.length === 0) {
    embed.addFields({ name: 'Projetos', value: 'Nenhum projeto cadastrado no momento.' });
  } else {
    projects.forEach((p, idx) => {
      embed.addFields({
        name: `${idx + 1}. ${p.name}`,
        value: p.description
      });
    });
  }

  embed.setFooter({ text: 'Use /daily para vincular suas atividades aos projetos.' });
  return embed;
}

// Embed de Ranking Limpo
export function buildRankingEmbed(leaderboard) {
  const rows = leaderboard.map((u, idx) => {
    return `**#${idx + 1}** ${u.username} • Nível ${u.level} (${u.xp} XP) | Sequência: ${u.daily_streak}d`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle('🏅 Classificação de Engajamento • CIIA/DF')
    .setDescription(rows || 'Nenhum registro encontrado.')
    .setFooter({ text: 'Pontuação atribuída por registros de daily e colaborações.' });
}

// Embed para Compartilhamento
export function buildShareEmbed(userDiscord, title, link, description, category) {
  return new EmbedBuilder()
    .setColor(CIIA_COLORS.INFO)
    .setTitle(`[${category}] ${title}`)
    .setURL(link)
    .setDescription(description)
    .addFields({ name: 'Link do Recurso', value: link, inline: false })
    .setAuthor({ name: userDiscord.displayName || userDiscord.username, iconURL: userDiscord.displayAvatarURL() })
    .setFooter({ text: 'Compartilhado com o CIIA/DF' })
    .setTimestamp();
}

// Modal de Conteúdo
export function buildContentModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_content')
    .setTitle('Registro de Conteúdo / Arquivo');

  const titleInput = new TextInputBuilder()
    .setCustomId('content_title')
    .setLabel('Título do documento ou arquivo')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Relatório de Avaliação do Modelo')
    .setRequired(true);

  const linkInput = new TextInputBuilder()
    .setCustomId('content_link')
    .setLabel('Link do arquivo (Drive / Canva / GitHub)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://...')
    .setRequired(true);

  const categoryInput = new TextInputBuilder()
    .setCustomId('content_category')
    .setLabel('Categoria')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Documentação, Benchmark, Artigo')
    .setRequired(true);

  const inspirationInput = new TextInputBuilder()
    .setCustomId('content_inspiration')
    .setLabel('Referências / Observações (Opcional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Links ou notas complementares...')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(linkInput),
    new ActionRowBuilder().addComponents(categoryInput),
    new ActionRowBuilder().addComponents(inspirationInput)
  );

  return modal;
}

// Embed de Confirmação de Conteúdo Limpo
export function buildContentEmbed(userDiscord, { id, title, link, inspiration, category }) {
  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.INFO)
    .setTitle(`Documento Registrado: ${title}`)
    .setThumbnail(userDiscord.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Categoria', value: `\`${category}\``, inline: true },
      { name: 'Acesso', value: link, inline: false }
    )
    .setAuthor({ name: userDiscord.displayName || userDiscord.username, iconURL: userDiscord.displayAvatarURL() })
    .setFooter({ text: `Acervo CIIA/DF • ID: ${id}` })
    .setTimestamp();

  if (inspiration && inspiration.trim() !== '') {
    embed.addFields({ name: 'Referências / Notas', value: inspiration, inline: false });
  }

  return embed;
}

// Botões de Administração
export function buildContentAdminRow(contentId) {
  const deleteBtn = new ButtonBuilder()
    .setCustomId(`btn_delete_content_${contentId}`)
    .setLabel('Excluir Registro')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(deleteBtn);
}
