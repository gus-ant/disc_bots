import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'ciia_bot.db');
const db = new Database(dbPath);

// Habilitar chaves estrangeiras e WAL mode para máxima estabilidade
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Inicialização das Tabelas
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      role TEXT DEFAULT 'Bolsista',
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      daily_streak INTEGER DEFAULT 0,
      last_daily_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dailies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      week_code TEXT NOT NULL,
      hours_today REAL NOT NULL,
      time_range TEXT,
      project_name TEXT,
      tasks_done TEXT NOT NULL,
      tasks_next TEXT NOT NULL,
      blockers TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, badge_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migrações dinâmicas para tabelas existentes
  try { db.exec('ALTER TABLE dailies ADD COLUMN time_range TEXT;'); } catch {}
  try { db.exec('ALTER TABLE dailies ADD COLUMN project_name TEXT;'); } catch {}

  // Inserir projetos padrões se a tabela estiver vazia
  const count = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
  if (count === 0) {
    const defaultProjects = [
      { name: 'Hermes Benchmark (LLMs)', desc: 'Avaliação e benchmark de modelos de linguagem para o setor público.' },
      { name: 'Diagnóstico de Maturidade em IA', desc: 'Análise de prontidão tecnológica e maturidade de IA em órgãos governamentais.' },
      { name: 'Governança & Ética em IA', desc: 'Diretrizes de IA responsável, transparência, privacidade e segurança.' },
      { name: 'Capacitação & Formação de Talentos', desc: 'Treinamento, desenvolvimento e capacitação contínua de pesquisadores e bolsistas.' }
    ];

    const insert = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)');
    for (const p of defaultProjects) {
      insert.run(p.name, p.desc);
    }
  }
}

// Obter ou criar perfil do usuário
export function getUser(userId, username = 'Membro') {
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    db.prepare(`
      INSERT INTO users (id, username) VALUES (?, ?)
    `).run(userId, username);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }
  return user;
}

// Obter número da semana (ex: 2026-W38)
export function getWeekCode(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Data formatada YYYY-MM-DD
export function getFormattedDate(d = new Date()) {
  return d.toISOString().split('T')[0];
}

// Obter o dia útil anterior
export function getPreviousBusinessDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dayOfWeek = d.getUTCDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sáb

  let daysToSubtract = 1;
  if (dayOfWeek === 1) { // Segunda-feira -> Sexta anterior (3 dias atrás)
    daysToSubtract = 3;
  } else if (dayOfWeek === 0) { // Domingo -> Sexta anterior (2 dias atrás)
    daysToSubtract = 2;
  }

  d.setUTCDate(d.getUTCDate() - daysToSubtract);
  return d.toISOString().split('T')[0];
}

// Adicionar XP ao usuário e checar level up
export function addXP(userId, xpAmount) {
  const user = getUser(userId);
  const newXP = user.xp + xpAmount;
  const newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;

  db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXP, newLevel, userId);

  return { newXP, newLevel, leveledUp: newLevel > user.level };
}

// Desbloquear Badge
export function unlockBadge(userId, badgeId) {
  try {
    db.prepare('INSERT INTO badges (user_id, badge_id) VALUES (?, ?)').run(userId, badgeId);
    return true;
  } catch (err) {
    // Badge já desbloqueada
    return false;
  }
}

// Buscar Badges do usuário
export function getUserBadges(userId) {
  return db.prepare('SELECT badge_id, unlocked_at FROM badges WHERE user_id = ?').all(userId);
}

// Calcular Horas Acumuladas na Semana Atual
export function getWeeklyHours(userId, weekCode = getWeekCode()) {
  const result = db.prepare(`
    SELECT SUM(hours_today) as total_hours FROM dailies
    WHERE user_id = ? AND week_code = ?
  `).get(userId, weekCode);
  return result?.total_hours || 0;
}

// Verificar se o usuário já fez daily hoje
export function hasSubmittedDailyToday(userId, date = getFormattedDate()) {
  const result = db.prepare('SELECT id FROM dailies WHERE user_id = ? AND date = ?').get(userId, date);
  return !!result;
}

// Obter todos os projetos cadastrados
export function getProjects() {
  return db.prepare('SELECT * FROM projects ORDER BY id ASC').all();
}

// Cadastrar novo projeto
export function addProject(name, description) {
  try {
    const result = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)').run(name, description);
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    return { success: false, error: 'Projeto com este nome já existe ou dados inválidos.' };
  }
}

// Registrar Daily do Bolsista
export function recordDaily(userId, username, { hoursToday, timeRange, projectName, tasksDone, tasksNext, blockers }) {
  const today = getFormattedDate();
  const weekCode = getWeekCode();
  const user = getUser(userId, username);

  // Inserir registro de daily com horário e projeto
  db.prepare(`
    INSERT INTO dailies (user_id, date, week_code, hours_today, time_range, project_name, tasks_done, tasks_next, blockers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, today, weekCode, hoursToday, timeRange || null, projectName || null, tasksDone, tasksNext, blockers || null);

  // Atualizar Streak (considerando apenas dias úteis)
  let newStreak = user.daily_streak;
  const lastDate = user.last_daily_date;

  if (!lastDate) {
    newStreak = 1;
  } else if (lastDate === today) {
    // Já fez daily hoje
  } else {
    const prevBusinessDate = getPreviousBusinessDate(today);
    if (lastDate === prevBusinessDate) {
      newStreak += 1;
    } else {
      newStreak = 1; // Reseta streak se pulou um dia útil
    }
  }

  db.prepare('UPDATE users SET daily_streak = ?, last_daily_date = ?, username = ? WHERE id = ?')
    .run(newStreak, today, username, userId);

  // Dar XP pela daily (ex: 50 XP)
  const xpResult = addXP(userId, 50);

  // Checar Badges
  const newBadges = [];
  if (unlockBadge(userId, 'first_daily')) newBadges.push('🚀 Primeiros Passos');
  if (newStreak >= 5 && unlockBadge(userId, 'streak_5')) newBadges.push('🔥 Imparável (5 dias úteis)');
  
  const currentWeeklyHours = getWeeklyHours(userId, weekCode);
  if (currentWeeklyHours >= 20 && unlockBadge(userId, 'weekly_20h')) newBadges.push('⏱️ Meta 20h Concluída');

  return {
    streak: newStreak,
    weeklyHours: currentWeeklyHours,
    xpGained: 50,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.newLevel,
    newBadges
  };
}

// Obter Leaderboard
export function getLeaderboard(limit = 10) {
  return db.prepare(`
    SELECT id, username, xp, level, daily_streak FROM users
    ORDER BY xp DESC LIMIT ?
  `).all(limit);
}

export default db;
