import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, recordDaily } from './database.js';
import { buildDailyModal, buildDailyEmbed, buildProfileEmbed, buildProjectsEmbed, buildRankingEmbed, buildShareEmbed } from './utils/embeds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Iniciando suíte de testes do Bot CIIA/DF...');

// 1. Inicializar Banco
initDatabase();
console.log('✅ Banco de dados inicializado');

// 2. Testar Comandos Slash
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log(`\n📦 Verificando ${commandFiles.length} comandos slash:`);
for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  if (command.data && command.data.name && typeof command.execute === 'function') {
    console.log(`  ✓ /${command.data.name} - ${command.data.description}`);
  } else {
    throw new Error(`Comando inválido no arquivo ${file}`);
  }
}

// 3. Testar Construtor de Modal
const modal = buildDailyModal();
console.log(`\n📋 Modal de Daily criado com sucesso (ID: ${modal.data.custom_id})`);

// 4. Testar Embeds
const fakeUser = {
  id: '999888777',
  username: 'GustavoBolsista',
  displayName: 'Gustavo (Pesquisa IA)',
  displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png'
};

const dailyRes = recordDaily(fakeUser.id, fakeUser.username, {
  hoursToday: 4.5,
  timeRange: '08:00 às 12:30',
  projectName: 'Hermes Benchmark, Governança & Ética em IA',
  tasksDone: 'Refatoração da pipeline de testes',
  tasksNext: 'Documentação no GitHub',
  blockers: 'Nenhum'
});

const dailyEmbed = buildDailyEmbed(fakeUser, { hoursToday: 4.5, timeRange: '08:00 às 12:30', projectName: 'Hermes Benchmark, Governança & Ética em IA', tasksDone: 'Refatoração', tasksNext: 'Doc', blockers: 'Nenhum' }, dailyRes);
console.log(`✅ Embed de Daily gerado (${dailyEmbed.data.title})`);

const profileEmbed = buildProfileEmbed(fakeUser, { role: 'Bolsista de Pesquisa', level: 1, xp: 50, daily_streak: 1 }, [], 4.5);
console.log(`✅ Embed de Perfil gerado (${profileEmbed.data.title})`);

const projectsEmbed = buildProjectsEmbed();
console.log(`✅ Embed de Projetos gerado (${projectsEmbed.data.title})`);

const rankingEmbed = buildRankingEmbed([{ username: 'Gustavo', level: 1, xp: 50, daily_streak: 1 }]);
console.log(`✅ Embed de Ranking gerado (${rankingEmbed.data.title})`);

const shareEmbed = buildShareEmbed(fakeUser, 'Novo Paper de LLM', 'https://arxiv.org', 'Resumo do paper', 'Paper');
console.log(`✅ Embed de Compartilhamento gerado (${shareEmbed.data.title})`);

console.log('\n🎉 Todos os testes de componentes do Bot foram concluídos com SUCESSO!');
