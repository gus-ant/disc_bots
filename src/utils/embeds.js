import { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from 'discord.js';

// Cores temáticas do CIIA/DF
export const CIIA_COLORS = {
  PRIMARY: 0x004488,   // Azul Institucional CIIA
  SUCCESS: 0x00C853,   // Verde Sucesso / Meta Batida
  WARNING: 0xFF9100,   // Laranja Alerta / Bloqueio
  GOLD: 0xFFD700,      // Dourado Conquista
  INFO: 0x00B0FF       // Azul Claro / Notícia IA
};

// Mapeamento de Badges com descrições amigáveis
export const BADGE_INFO = {
  first_daily: { emoji: '🚀', name: 'Primeiros Passos', desc: 'Registrou a primeira daily no CIIA' },
  streak_5: { emoji: '🔥', name: 'Imparável (5 dias)', desc: '5 dias úteis consecutivos de daily' },
  weekly_20h: { emoji: '⏱️', name: 'Meta 20h Concluída', desc: 'Bateu as 20 horas semanais da bolsa' },
  ai_contributor: { emoji: '🧠', name: 'Contribuidor IA', desc: 'Compartilhou conteúdo com a comunidade' },
  ciia_member: { emoji: '🏛️', name: 'Membro CIIA/DF', desc: 'Perfil ativado no servidor' }
};

// Gerar barra de progresso visual (ex: [██████░░░░] 60%)
export function createProgressBar(current, target = 20, size = 10) {
  const percentage = Math.min(Math.max(current / target, 0), 1);
  const progress = Math.round(size * percentage);
  const emptyProgress = size - progress;

  const progressText = '█'.repeat(progress);
  const emptyProgressText = '░'.repeat(emptyProgress);
  const percentageText = Math.round(percentage * 100);

  return `\`[${progressText}${emptyProgressText}]\` **${current.toFixed(1)}h / ${target}h** (${percentageText}%)`;
}

// Modal para o comando /daily
export function buildDailyModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_daily')
    .setTitle('📋 Daily do Bolsista CIIA/DF');

  const hoursInput = new TextInputBuilder()
    .setCustomId('hours_today')
    .setLabel('Carga Horária (em horas)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 4 ou 4.5')
    .setRequired(true);

  const timeRangeInput = new TextInputBuilder()
    .setCustomId('time_range')
    .setLabel('Horário de trabalho (De qual a qual hora?)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 12h às 14h e 18h às 20h')
    .setRequired(true);

  const projectInput = new TextInputBuilder()
    .setCustomId('project_name')
    .setLabel('Projeto do CIIA vinculado')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Hermes Benchmark / Diagnóstico / Governança')
    .setRequired(true);

  const doneInput = new TextInputBuilder()
    .setCustomId('tasks_done')
    .setLabel('O que você realizou / demandas de hoje?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Ex: Desenvolvi o módulo de testes de prompt e validei os resultados.')
    .setRequired(true);

  const nextInput = new TextInputBuilder()
    .setCustomId('tasks_next')
    .setLabel('Próximas metas & Bloqueios (se houver)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Ex: Metas: Iniciar testes / Bloqueios: Nenhum')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(hoursInput),
    new ActionRowBuilder().addComponents(timeRangeInput),
    new ActionRowBuilder().addComponents(projectInput),
    new ActionRowBuilder().addComponents(doneInput),
    new ActionRowBuilder().addComponents(nextInput)
  );

  return modal;
}

// Embed de confirmação pública de Daily no canal #standup-bolsistas
export function buildDailyEmbed(userDiscord, { hoursToday, timeRange, projectName, tasksDone, tasksNext, blockers }, result) {
  const hasBlocker = blockers && blockers.trim().toLowerCase() !== 'nenhum' && blockers.trim() !== '';

  const embed = new EmbedBuilder()
    .setColor(hasBlocker ? CIIA_COLORS.WARNING : CIIA_COLORS.PRIMARY)
    .setTitle(`📋 Standup Diário - ${userDiscord.displayName || userDiscord.username}`)
    .setThumbnail(userDiscord.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '⏱️ Horas Registradas', value: `\`+${hoursToday}h\` (${timeRange || 'Não informado'})`, inline: true },
      { name: '🚀 Projeto Vinculado', value: `\`${projectName || 'Geral'}\``, inline: true },
      { name: '🔥 Daily Streak (Dias Úteis)', value: `\`${result.streak} dia(s)\``, inline: true },
      { name: '📊 Horas Acumuladas na Semana', value: createProgressBar(result.weeklyHours, 20), inline: false },
      { name: '✅ Realizado Hoje', value: tasksDone, inline: false },
      { name: '🎯 Próximas Metas & Bloqueios', value: tasksNext, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'CIIA/DF • Centro Integrado de IA do DF', iconURL: 'https://cdn-icons-png.flaticon.com/512/8644/8644485.png' });

  if (hasBlocker) {
    embed.addFields({ name: '⚠️ Bloqueio / Impedimento Reportado', value: `> ${blockers}`, inline: false });
  }

  let extraNote = '';
  if (result.leveledUp) {
    extraNote += `\n🎉 **LEVEL UP!** Você alcançou o **Nível ${result.newLevel}**!`;
  }
  if (result.newBadges && result.newBadges.length > 0) {
    extraNote += `\n🏆 **Nova Conquista Desbloqueada:** ${result.newBadges.join(', ')}`;
  }

  if (extraNote) {
    embed.addFields({ name: '🎁 Recompensas de Engajamento', value: extraNote, inline: false });
  }

  return embed;
}

// Embed de Perfil do Bolsista/Membro
export function buildProfileEmbed(userDiscord, dbUser, badges, weeklyHours) {
  const badgeList = badges.length > 0
    ? badges.map(b => {
        const info = BADGE_INFO[b.badge_id] || { emoji: '🎖️', name: b.badge_id };
        return `${info.emoji} **${info.name}**`;
      }).join('\n')
    : '*Nenhuma conquista desbloqueada ainda. Faça sua primeira `/daily`!*';

  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle(`👤 Perfil no CIIA/DF • ${userDiscord.displayName || userDiscord.username}`)
    .setThumbnail(userDiscord.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '🏷️ Função / Vínculo', value: `\`${dbUser.role}\``, inline: true },
      { name: '⭐ Nível de Contribuição', value: `**Nível ${dbUser.level}** (${dbUser.xp} XP)`, inline: true },
      { name: '🔥 Daily Streak (Dias Úteis)', value: `\`${dbUser.daily_streak} dia(s)\``, inline: true },
      { name: '⏱️ Meta Semanal de Horas (Bolsa)', value: createProgressBar(weeklyHours, 20), inline: false },
      { name: '🏆 Conquistas & Badges', value: badgeList, inline: false }
    )
    .setFooter({ text: 'CIIA/DF • Inovação e Inteligência Artificial Responsável' })
    .setTimestamp();

  return embed;
}

// Embed de Projetos Ativos do CIIA (Dinâmico do Banco de Dados)
export function buildProjectsEmbed(projects = []) {
  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle('🚀 Projetos & Iniciativas de IA do CIIA/DF')
    .setDescription('O Centro Integrado de IA do DF transforma conhecimento técnico em soluções públicas e governança.\nPara cadastrar novos projetos, use o comando `/adicionar-projeto`.');

  if (projects.length === 0) {
    embed.addFields({ name: 'Nenhum projeto cadastrado', value: 'Use `/adicionar-projeto` para cadastrar o primeiro projeto.' });
  } else {
    projects.forEach((p, idx) => {
      embed.addFields({
        name: `🤖 ${idx + 1}. ${p.name}`,
        value: p.description
      });
    });
  }

  embed.setFooter({ text: 'Use /daily para registrar suas contribuições nos projetos!' });
  return embed;
}

// Embed de Ranking de Engajamento
export function buildRankingEmbed(leaderboard) {
  const rows = leaderboard.map((u, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
    return `${medal} **${u.username}** • Nível ${u.level} (${u.xp} XP) | 🔥 ${u.daily_streak}d streak`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(CIIA_COLORS.GOLD)
    .setTitle('🏆 Leaderboard de Engajamento CIIA/DF')
    .setDescription(rows || 'Nenhum membro registrado ainda.')
    .setFooter({ text: 'Ganhe XP registrando dailies e interagindo na comunidade!' });
}

// Embed para Compartilhamento de Conteúdo de IA
export function buildShareEmbed(userDiscord, title, link, description, category) {
  return new EmbedBuilder()
    .setColor(CIIA_COLORS.INFO)
    .setTitle(`💡 [${category}] ${title}`)
    .setURL(link)
    .setDescription(description)
    .addFields(
      { name: '🔗 Link do Recurso', value: link, inline: false }
    )
    .setAuthor({ name: userDiscord.displayName || userDiscord.username, iconURL: userDiscord.displayAvatarURL() })
    .setFooter({ text: 'Compartilhado com a Comunidade CIIA/DF' })
    .setTimestamp();
}

// Modal para registro de conteúdos/arquivos
export function buildContentModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_content')
    .setTitle('📁 Registrar Arquivo / Conteúdo');

  const titleInput = new TextInputBuilder()
    .setCustomId('content_title')
    .setLabel('Nome do Post / Arquivo')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Post Carrossel IA na Educação')
    .setRequired(true);

  const linkInput = new TextInputBuilder()
    .setCustomId('content_link')
    .setLabel('Link do Arquivo (Drive / Canva)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://...')
    .setRequired(true);

  const categoryInput = new TextInputBuilder()
    .setCustomId('content_category')
    .setLabel('Categoria')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Redes Sociais, Documentação, Relatório')
    .setRequired(true);

  const inspirationInput = new TextInputBuilder()
    .setCustomId('content_inspiration')
    .setLabel('Inspiração / Referências (Opcional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Ex: Link para o post de referência ou ideias...')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(linkInput),
    new ActionRowBuilder().addComponents(categoryInput),
    new ActionRowBuilder().addComponents(inspirationInput)
  );

  return modal;
}

// Embed de confirmação de conteúdo
export function buildContentEmbed(userDiscord, { id, title, link, inspiration, category }) {
  const embed = new EmbedBuilder()
    .setColor(CIIA_COLORS.INFO)
    .setTitle(`📁 Novo Arquivo Registrado: ${title}`)
    .setThumbnail(userDiscord.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '🏷️ Categoria', value: `\`${category}\``, inline: true },
      { name: '🔗 Link de Acesso', value: link, inline: false }
    )
    .setAuthor({ name: userDiscord.displayName || userDiscord.username, iconURL: userDiscord.displayAvatarURL() })
    .setFooter({ text: `CIIA/DF Archive • ID: ${id}` })
    .setTimestamp();

  if (inspiration && inspiration.trim() !== '') {
    embed.addFields({ name: '💡 Inspiração / Referência', value: inspiration, inline: false });
  }

  return embed;
}

// Botões de administração para gerenciar conteúdo
export function buildContentAdminRow(contentId) {
  const deleteBtn = new ButtonBuilder()
    .setCustomId(`btn_delete_content_${contentId}`)
    .setLabel('🗑️ Excluir Arquivo')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(deleteBtn);
}
