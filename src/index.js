import { Client, GatewayIntentBits, Collection, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initStorage, recordDaily, addXP, hasSubmittedDailyToday, recordContent, deleteContent, getExistingUser, isUserRegistered, USER_ROLES, updateDailyForDate, getWeeklyHours, getRegisteredUsersByRole, getDailiesByDateRange } from './data.js';
import { buildDailyEmbed, CIIA_COLORS, buildContentEmbed, buildContentAdminRow, normalizeProjectNames } from './utils/embeds.js';
import { APP_TIME_ZONE, getCurrentWeekRange, getTodayDateString, getZonedParts, isBusinessDay } from './utils/dates.js';
import { startServer } from './server.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar armazenamento (Google Sheets ou SQLite) e Servidor Web
await initStorage();
startServer();

// Instanciar o Client com as intents padrão (evita erro de Disallowed Intents)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();
const xpCooldowns = new Set();
let lastDailyReminderDate = null;
let lastWeeklySummaryDate = null;

function getAdminUserIds() {
  return new Set(
    (process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
  );
}

function isBotAdmin(userId, dbUser = null) {
  return dbUser?.role === USER_ROLES.ADMIN && getAdminUserIds().has(userId);
}

function canUseCommand(command, userId, dbUser) {
  if (!command.allowedRoles || command.allowedRoles.length === 0) return true;
  if (isBotAdmin(userId, dbUser)) return true;
  if (dbUser?.role === USER_ROLES.ADMIN) return false;
  return command.allowedRoles.includes(dbUser?.role);
}

function buildWeeklySummaryEmbed(startDate, endDate, dailies) {
  const totalHours = dailies.reduce((sum, daily) => sum + Number(daily.hours_today || 0), 0);
  const byUser = new Map();
  const projects = new Set();
  const blockers = [];

  for (const daily of dailies) {
    const current = byUser.get(daily.username) || { hours: 0, count: 0 };
    current.hours += Number(daily.hours_today || 0);
    current.count += 1;
    byUser.set(daily.username, current);

    for (const project of normalizeProjectNames(daily.project_name)) {
      projects.add(project);
    }

    const tasksNext = daily.tasks_next || '';
    if (/bloqueio|impedimento|travado|pendente/i.test(tasksNext)) {
      blockers.push(`• ${daily.username}: ${tasksNext.slice(0, 160)}`);
    }
  }

  const peopleRows = [...byUser.entries()]
    .sort((a, b) => b[1].hours - a[1].hours)
    .slice(0, 10)
    .map(([username, data]) => `• **${username}**: ${data.hours.toFixed(1)}h em ${data.count} daily(s)`)
    .join('\n') || 'Nenhum registro na semana.';

  return new EmbedBuilder()
    .setColor(CIIA_COLORS.PRIMARY)
    .setTitle('📊 Resumo semanal CIIA/DF')
    .setDescription(`Período: \`${startDate}\` a \`${endDate}\`\nTotal registrado: **${totalHours.toFixed(1)}h**`)
    .addFields(
      { name: 'Pessoas', value: peopleRows.slice(0, 1024), inline: false },
      { name: 'Projetos citados', value: projects.size > 0 ? [...projects].slice(0, 12).join(', ') : 'Nenhum projeto citado.', inline: false },
      { name: 'Bloqueios / pendências', value: blockers.length > 0 ? blockers.slice(0, 5).join('\n').slice(0, 1024) : 'Nenhum bloqueio destacado.', inline: false }
    )
    .setTimestamp();
}

async function sendDailyReminders(client) {
  const today = getTodayDateString();
  const bolsistas = await getRegisteredUsersByRole(USER_ROLES.BOLSISTA);

  for (const bolsista of bolsistas) {
    if (await hasSubmittedDailyToday(bolsista.id, today)) continue;

    const user = await client.users.fetch(bolsista.id).catch(() => null);
    if (!user) continue;

    await user.send('Lembrete: você ainda não registrou sua daily de hoje. Use /daily no servidor quando puder.').catch(() => null);
  }
}

async function sendWeeklySummary(client) {
  const { startDate, endDate } = getCurrentWeekRange();
  const dailies = await getDailiesByDateRange(startDate, endDate);
  const embed = buildWeeklySummaryEmbed(startDate, endDate, dailies);
  const channelId = process.env.WEEKLY_SUMMARY_CHANNEL_ID || process.env.DAILY_CHANNEL_ID;

  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  await channel.send({ embeds: [embed] });
}

function startSchedulers(client) {
  setInterval(async () => {
    const now = new Date();
    const parts = getZonedParts(now, APP_TIME_ZONE);
    const today = getTodayDateString(APP_TIME_ZONE);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);

    try {
      if (isBusinessDay(now, APP_TIME_ZONE) && hour === 17 && minute === 0 && lastDailyReminderDate !== today) {
        lastDailyReminderDate = today;
        await sendDailyReminders(client);
      }

      if (parts.weekday === 'Fri' && hour === 15 && minute === 0 && lastWeeklySummaryDate !== today) {
        lastWeeklySummaryDate = today;
        await sendWeeklySummary(client);
      }
    } catch (error) {
      console.error('⚠️ Erro em agendamento automático:', error.message);
    }
  }, 60000);
}

// Carregar Comandos Slash
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(`file://${filePath}`);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

// Tratamento de erros do Client do Discord para manter a conexão estável
client.on('error', error => {
  console.error('⚠️ Discord WS Error (capturado sem crash):', error.message);
});

// Evento: Bot pronto
client.once('clientReady', () => {
  console.log(`\n🤖 Bot CIIA/DF online como ${client.user.tag}!`);
  console.log(`🌐 Conectado em ${client.guilds.cache.size} servidor(es).`);
  
  client.user.setActivity('projetos e bolsistas | /ajuda', { type: 3 }); // Watching
  startSchedulers(client);
});

// Evento: Interações (Slash Commands e Modals)
client.on('interactionCreate', async interaction => {
  // 1. Tratar Comandos Slash
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const dbUser = await getExistingUser(interaction.user.id);
    if (interaction.commandName !== 'cadastrar' && !dbUser?.registered_at) {
      await interaction.reply({
        content: 'Para usar os comandos do bot, primeiro faça seu cadastro com **/cadastrar**.',
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName !== 'cadastrar' && !canUseCommand(command, interaction.user.id, dbUser)) {
      await interaction.reply({
        content: 'Você não tem permissão para usar este comando.',
        ephemeral: true
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Erro no comando /${interaction.commandName}:`, error.message);
      try {
        const errorMsg = { content: 'Ocorreu um erro ao executar este comando.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMsg);
        } else {
          await interaction.reply(errorMsg);
        }
      } catch (e) {
        // Ignora se a interação expirou no Discord
      }
    }
    return;
  }

  if ((interaction.isModalSubmit() || interaction.isButton()) && !(await isUserRegistered(interaction.user.id))) {
    await interaction.reply({
      content: 'Para usar os comandos do bot, primeiro faça seu cadastro com **/cadastrar**.',
      ephemeral: true
    });
    return;
  }

  // 2. Tratar Submissão do Modal de Daily (/daily)
  if (interaction.isModalSubmit() && interaction.customId === 'modal_daily') {
    await interaction.deferReply({ ephemeral: true });

    if (await hasSubmittedDailyToday(interaction.user.id)) {
      await interaction.editReply({
        content: 'Você já registrou o seu Standup Diário hoje. Cada bolsista pode enviar apenas 1 daily por dia.'
      });
      return;
    }

    try {
      const hoursStr = interaction.fields.getTextInputValue('hours_today')?.trim();
      const timeRange = interaction.fields.getTextInputValue('time_range')?.trim();
      const tasksDone = interaction.fields.getTextInputValue('tasks_done')?.trim();
      const tasksNext = interaction.fields.getTextInputValue('tasks_next')?.trim();

      // Validar se todos os campos obrigatórios foram preenchidos
      if (!hoursStr || !timeRange || !tasksDone || !tasksNext) {
        await interaction.editReply({
          content: 'Todos os campos da daily são obrigatórios e não podem ficar em branco. Preencha todos os campos e tente novamente com `/daily`.'
        });
        return;
      }

      // Validar valor numérico das horas
      const hoursToday = parseFloat(hoursStr.replace(',', '.'));
      if (isNaN(hoursToday) || hoursToday <= 0 || hoursToday > 24) {
        await interaction.editReply({
          content: 'Valor de horas inválido. Insira um número válido (ex: `4` ou `4.5`). Tente novamente com `/daily`.'
        });
        return;
      }

      // Salvar registro de daily
      const result = await recordDaily(interaction.user.id, interaction.user.username, {
        hoursToday,
        timeRange,
        projectName: 'Geral',
        tasksDone,
        tasksNext,
        blockers: null
      });

      // Gerar Embed público
      const embed = buildDailyEmbed(interaction.user, { hoursToday, timeRange, projectName: 'Geral', tasksDone, tasksNext, blockers: null }, result);

      // Tentar enviar no canal dedicado de standup se configurado
      const dailyChannelId = process.env.DAILY_CHANNEL_ID;
      let targetChannel = interaction.channel;

      if (dailyChannelId) {
        const channel = await interaction.client.channels.fetch(dailyChannelId).catch(() => null);
        if (channel) targetChannel = channel;
      }

      await targetChannel.send({ embeds: [embed] });

      await interaction.editReply({
        content: `Standup registrado com sucesso. (+${result.xpGained} XP)\nProgresso Semanal: **${result.weeklyHours.toFixed(1)}h / 20.0h**`
      });

    } catch (error) {
      console.error('Erro ao processar Modal da Daily:', error);
      await interaction.editReply({
        content: 'Houve um problema ao salvar seu registro de daily. Tente novamente mais tarde.'
      });
    }
    return;
  }

  // 3. Tratar Submissão do Modal de Edição de Daily (/editar-daily)
  if (interaction.isModalSubmit() && interaction.customId === 'modal_edit_daily') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const hoursStr = interaction.fields.getTextInputValue('hours_today')?.trim();
      const timeRange = interaction.fields.getTextInputValue('time_range')?.trim();
      const tasksDone = interaction.fields.getTextInputValue('tasks_done')?.trim();
      const tasksNext = interaction.fields.getTextInputValue('tasks_next')?.trim();

      // Validar se todos os campos obrigatórios foram preenchidos
      if (!hoursStr || !timeRange || !tasksDone || !tasksNext) {
        await interaction.editReply({
          content: 'Todos os campos da daily são obrigatórios e não podem ficar em branco.'
        });
        return;
      }

      const hoursToday = parseFloat(hoursStr.replace(',', '.'));
      if (isNaN(hoursToday) || hoursToday <= 0 || hoursToday > 24) {
        await interaction.editReply({
          content: 'Valor de horas inválido. Insira um número válido (ex: `4` ou `4.5`).'
        });
        return;
      }

      const result = await updateDailyForDate(interaction.user.id, undefined, {
        hoursToday,
        timeRange,
        projectName: 'Geral',
        tasksDone,
        tasksNext,
        blockers: null
      });

      if (!result.success) {
        await interaction.editReply({ content: result.error });
        return;
      }

      const weeklyHours = await getWeeklyHours(interaction.user.id);
      await interaction.editReply({
        content: `Daily de hoje atualizada com sucesso.\nProgresso Semanal: **${weeklyHours.toFixed(1)}h / 20.0h**`
      });
    } catch (error) {
      console.error('Erro ao editar Daily:', error);
      await interaction.editReply({
        content: 'Houve um problema ao atualizar sua daily.'
      });
    }
    return;
  }

  // 4. Tratar Submissão do Modal de Conteúdo (/registrar-conteudo)
  if (interaction.isModalSubmit() && interaction.customId === 'modal_content') {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const title = interaction.fields.getTextInputValue('content_title');
      const link = interaction.fields.getTextInputValue('content_link');
      const category = interaction.fields.getTextInputValue('content_category');
      
      let inspiration = null;
      try {
        inspiration = interaction.fields.getTextInputValue('content_inspiration');
      } catch (e) {}

      const result = await recordContent(interaction.user.id, interaction.user.username, {
        title, link, inspiration, category
      });

      const embed = buildContentEmbed(interaction.user, {
        id: result.id, title, link, inspiration, category
      });

      const adminRow = buildContentAdminRow(result.id);

      const archiveChannelId = process.env.ARCHIVE_CHANNEL_ID;
      let targetChannel = interaction.channel;

      if (archiveChannelId) {
        const channel = await interaction.client.channels.fetch(archiveChannelId).catch(() => null);
        if (channel) targetChannel = channel;
      }

      await targetChannel.send({ embeds: [embed], components: [adminRow] });

      await interaction.editReply({
        content: `Conteúdo registrado com sucesso (+${result.xpGained || 30} XP). Ele foi enviado para o canal de arquivos.`
      });

    } catch (error) {
      console.error('Erro ao processar Modal de Conteúdo:', error);
      await interaction.editReply({ content: 'Houve um problema ao salvar seu registro.' });
    }
    return;
  }

  // 5. Tratar Botões (Excluir Conteúdo)
  if (interaction.isButton() && interaction.customId.startsWith('btn_delete_content_')) {
    const dbUser = await getExistingUser(interaction.user.id);
    const hasPermission = isBotAdmin(interaction.user.id, dbUser);
    
    if (!hasPermission) {
      return interaction.reply({ content: 'Apenas administradores podem excluir registros.', ephemeral: true });
    }

    const contentId = interaction.customId.split('_')[3];
    const deletedResult = await deleteContent(contentId);
    
    if (deletedResult?.changes > 0) {
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.setColor(CIIA_COLORS.WARNING);
      embed.setTitle(embed.data.title + ' [REMOVIDO]');
      embed.setDescription('Este registro foi removido por um administrador.');

      await interaction.update({ embeds: [embed], components: [] });
    } else {
      await interaction.reply({ content: 'Erro ao excluir ou o registro não existe mais.', ephemeral: true });
    }
    return;
  }
});

// Evento: Mensagem enviada no chat (Ganho sutil de XP com cooldown de 1 min)
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const userId = message.author.id;
  if (!(await isUserRegistered(userId))) return;

  if (!xpCooldowns.has(userId)) {
    await addXP(userId, 2); // 2 XP por mensagem útil
    xpCooldowns.add(userId);
    setTimeout(() => xpCooldowns.delete(userId), 60000); // Cooldown de 60s
  }
});

// Evento: Boas-vindas a novos membros no servidor
client.on('guildMemberAdd', async member => {
  try {
    const welcomeEmbed = new EmbedBuilder()
      .setColor(CIIA_COLORS.PRIMARY)
      .setTitle(`👋 Bem-vindo(a) ao CIIA/DF, ${member.displayName}!`)
      .setDescription('Somos o Centro Integrado de Inteligência Artificial do DF, dedicados à pesquisa, inovação, governança e capacitação em IA de interesse público.')
      .addFields(
        { name: '📌 Para Bolsistas', value: 'Registre suas demandas e carga horária usando o comando `/daily`.' },
        { name: '💬 Para a Comunidade', value: 'Participe das discussões nos canais abertos e use `/ajuda` para ver todos os comandos.' }
      )
      .setTimestamp();

    await member.send({ embeds: [welcomeEmbed] }).catch(() => {
      // Ignora se as MMs do usuário estiverem fechadas
    });
  } catch (err) {
    // Ignora falha de boas-vindas silenciosamente
  }
});

// Conectar o bot se o token estiver configurado
if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN !== 'seu_token_aqui') {
  client.login(process.env.DISCORD_TOKEN);
} else {
  console.log('💡 DICA: Configure o seu DISCORD_TOKEN no arquivo .env para iniciar o bot online.');
}
