import { Client, GatewayIntentBits, Collection, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, recordDaily, addXP, hasSubmittedDailyToday, recordContent, deleteContent } from './database.js';
import { buildDailyEmbed, CIIA_COLORS, buildContentEmbed, buildContentAdminRow } from './utils/embeds.js';
import { startServer } from './server.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar banco de dados SQLite e Servidor do Dashboard Web
initDatabase();
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
client.once('ready', () => {
  console.log(`\n🤖 Bot CIIA/DF online como ${client.user.tag}!`);
  console.log(`🌐 Conectado em ${client.guilds.cache.size} servidor(es).`);
  
  client.user.setActivity('projetos e bolsistas | /ajuda', { type: 3 }); // Watching
});

// Evento: Interações (Slash Commands e Modals)
client.on('interactionCreate', async interaction => {
  // 1. Tratar Comandos Slash
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Erro no comando /${interaction.commandName}:`, error.message);
      try {
        const errorMsg = { content: '❌ Ocorreu um erro ao executar este comando.', ephemeral: true };
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

  // 2. Tratar Submissão do Modal de Daily (/daily)
  if (interaction.isModalSubmit() && interaction.customId === 'modal_daily') {
    await interaction.deferReply({ ephemeral: true });

    if (hasSubmittedDailyToday(interaction.user.id)) {
      await interaction.editReply({
        content: '⚠️ **Você já registrou o seu Standup Diário hoje!** Cada bolsista pode enviar apenas 1 daily por dia.'
      });
      return;
    }

    try {
      const hoursStr = interaction.fields.getTextInputValue('hours_today');
      const timeRange = interaction.fields.getTextInputValue('time_range');
      const projectName = interaction.fields.getTextInputValue('project_name');
      const tasksDone = interaction.fields.getTextInputValue('tasks_done');
      const tasksNext = interaction.fields.getTextInputValue('tasks_next');

      // Validar valor numérico das horas
      const hoursToday = parseFloat(hoursStr.replace(',', '.'));
      if (isNaN(hoursToday) || hoursToday <= 0 || hoursToday > 24) {
        await interaction.editReply({
          content: '⚠️ **Valor de horas inválido!** Insira um número válido (ex: `4` ou `4.5`). Tente novamente com `/daily`.'
        });
        return;
      }

      // Salvar registro de daily no SQLite
      const result = recordDaily(interaction.user.id, interaction.user.username, {
        hoursToday,
        timeRange,
        projectName,
        tasksDone,
        tasksNext,
        blockers: null
      });

      // Gerar Embed público
      const embed = buildDailyEmbed(interaction.user, { hoursToday, timeRange, projectName, tasksDone, tasksNext, blockers: null }, result);

      // Tentar enviar no canal dedicado de standup se configurado
      const dailyChannelId = process.env.DAILY_CHANNEL_ID;
      let targetChannel = interaction.channel;

      if (dailyChannelId) {
        const channel = await interaction.client.channels.fetch(dailyChannelId).catch(() => null);
        if (channel) targetChannel = channel;
      }

      await targetChannel.send({ embeds: [embed] });

      await interaction.editReply({
        content: `✅ **Standup registrado com sucesso!** (+${result.xpGained} XP)\n📊 Progresso Semanal: **${result.weeklyHours.toFixed(1)}h / 20.0h**`
      });

    } catch (error) {
      console.error('❌ Erro ao processar Modal da Daily:', error);
      await interaction.editReply({
        content: '❌ Houve um problema ao salvar seu registro de daily. Tente novamente mais tarde.'
      });
    }
    return;
  }

  // 3. Tratar Submissão do Modal de Conteúdo (/registrar-conteudo)
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

      const result = recordContent(interaction.user.id, interaction.user.username, {
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
        content: `✅ **Conteúdo registrado com sucesso!** (+${result.xpGained} XP)\nEle foi enviado para o canal de arquivos.`
      });

    } catch (error) {
      console.error('❌ Erro ao processar Modal de Conteúdo:', error);
      await interaction.editReply({ content: '❌ Houve um problema ao salvar seu registro.' });
    }
    return;
  }

  // 4. Tratar Botões (Excluir Conteúdo)
  if (interaction.isButton() && interaction.customId.startsWith('btn_delete_content_')) {
    const hasPermission = interaction.memberPermissions.has('ManageMessages') || interaction.memberPermissions.has('Administrator');
    
    if (!hasPermission) {
      return interaction.reply({ content: '❌ Apenas administradores podem excluir registros.', ephemeral: true });
    }

    const contentId = interaction.customId.split('_')[3];
    const deleted = deleteContent(contentId);
    
    if (deleted) {
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.setColor(CIIA_COLORS.WARNING);
      embed.setTitle(embed.data.title + ' [EXCLUÍDO]');
      embed.setDescription('Este registro foi removido por um administrador.');

      await interaction.update({ embeds: [embed], components: [] });
    } else {
      await interaction.reply({ content: '❌ Erro ao excluir ou o registro não existe mais.', ephemeral: true });
    }
    return;
  }
});

// Evento: Mensagem enviada no chat (Ganho sutil de XP com cooldown de 1 min)
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const userId = message.author.id;
  if (!xpCooldowns.has(userId)) {
    addXP(userId, 2); // 2 XP por mensagem útil
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
