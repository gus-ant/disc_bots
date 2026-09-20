import { initDatabase, recordDaily, getUser, getWeeklyHours, getUserBadges, getLeaderboard } from './database.js';

console.log('🧪 Testando Inicialização do Banco de Dados...');
initDatabase();

const testUserId = '1234567890';
const testUsername = 'Bolsista_Teste';

console.log('\n📝 Registrando primeira daily...');
const res1 = recordDaily(testUserId, testUsername, {
  hoursToday: 4,
  tasksDone: 'Desenvolvimento do modelo de OCR de documentos públicos',
  tasksNext: 'Integração com API de Governança',
  blockers: 'Nenhum'
});
console.log('Resultado Daily 1:', res1);

console.log('\n📝 Registrando segunda daily (acumulando horas)...');
const res2 = recordDaily(testUserId, testUsername, {
  hoursToday: 16,
  tasksDone: 'Refatoração da pipeline de treinamento',
  tasksNext: 'Apresentação no grupo de estudo do CIIA',
  blockers: null
});
console.log('Resultado Daily 2:', res2);

const user = getUser(testUserId);
console.log('\n👤 Perfil do Usuário:', user);

const badges = getUserBadges(testUserId);
console.log('\n🏅 Badges do Usuário:', badges);

const totalHours = getWeeklyHours(testUserId);
console.log(`\n⏱️ Total de horas nesta semana: ${totalHours}h / 20h`);

const leaderboard = getLeaderboard();
console.log('\n🏆 Leaderboard:', leaderboard);

console.log('\n✅ Todos os testes de banco de dados passaram com sucesso!');
