import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('❌ ERRO: DISCORD_TOKEN e CLIENT_ID são necessários no arquivo .env!');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(`file://${filePath}`);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(`🔹 Carregado comando: /${command.data.name}`);
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`\n⏳ Registrando ${commands.length} comandos Slash no Discord...`);

    const isGuildDeploy = guildId && guildId !== 'seu_guild_id_aqui' && /^\d+$/.test(guildId);

    if (isGuildDeploy) {
      // Registro instantâneo em servidor de testes específico
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log(`✅ Sucesso! ${data.length} comandos registrados no servidor (GUILD_ID: ${guildId}).`);
    } else {
      // Registro global
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log(`✅ Sucesso! ${data.length} comandos registrados globalmente no Discord.`);
    }
  } catch (error) {
    console.error('❌ Erro ao registrar comandos no Discord:', error);
  }
})();
