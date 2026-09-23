import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'ciia_bot.db');
const db = new Database(dbPath);

export const USER_ROLES = {
  BOLSISTA: 'Bolsista NIA/UnDF',
  COORDENADOR: 'Coordenador',
  ADMIN: 'Admin'
};

// Habilitar chaves estrangeiras e WAL mode para máxima estabilidade
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Inicialização das Tabelas
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      role TEXT,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      daily_streak INTEGER DEFAULT 0,
      last_daily_date TEXT,
      registered_at DATETIME,
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

    CREATE TABLE IF NOT EXISTS contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      inspiration TEXT,
      category TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migrações dinâmicas para tabelas existentes
  try { db.exec('ALTER TABLE dailies ADD COLUMN time_range TEXT;'); } catch {}
  try { db.exec('ALTER TABLE dailies ADD COLUMN project_name TEXT;'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN registered_at DATETIME;'); } catch {}

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

export function getExistingUser(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function isUserRegistered(userId) {
  const user = getExistingUser(userId);
  return !!user?.registered_at;
}

export function registerUser(userId, username, role) {
  if (!Object.values(USER_ROLES).includes(role)) {
    return { success: false, error: 'Categoria inválida.' };
  }

  const existing = getExistingUser(userId);
  if (existing?.registered_at) {
    return { success: false, error: `Você já está cadastrado como ${existing.role}.` };
  }

  getUser(userId, username);
  db.prepare(`
    UPDATE users
    SET username = ?, role = ?, registered_at = COALESCE(registered_at, CURRENT_TIMESTAMP)
    WHERE id = ?
  `).run(username, role, userId);

  return { success: true, role };
}

export function updateUserRegistration(targetUserId, username, role) {
  if (!Object.values(USER_ROLES).includes(role)) {
    return { success: false, error: 'Categoria inválida.' };
  }

  getUser(targetUserId, username);
  db.prepare(`
    UPDATE users
    SET username = ?, role = ?, registered_at = COALESCE(registered_at, CURRENT_TIMESTAMP)
    WHERE id = ?
  `).run(username, role, targetUserId);

  return { success: true, role };
}

export function getRegisteredUsersByRole(role = null) {
  if (role) {
    return db.prepare(`
      SELECT * FROM users
      WHERE registered_at IS NOT NULL AND role = ?
      ORDER BY username ASC
    `).all(role);
  }

  return db.prepare(`
    SELECT * FROM users
    WHERE registered_at IS NOT NULL
    ORDER BY username ASC
  `).all();
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

export function getDailyByUserDate(userId, date = getFormattedDate()) {
  return db.prepare('SELECT * FROM dailies WHERE user_id = ? AND date = ?').get(userId, date);
}

export function updateDailyForDate(userId, date, { hoursToday, timeRange, projectName, tasksDone, tasksNext, blockers }) {
  const daily = getDailyByUserDate(userId, date);
  if (!daily) return { success: false, error: 'Daily não encontrada.' };

  db.prepare(`
    UPDATE dailies
    SET hours_today = ?, time_range = ?, project_name = ?, tasks_done = ?, tasks_next = ?, blockers = ?
    WHERE id = ?
  `).run(hoursToday, timeRange || null, projectName || null, tasksDone, tasksNext, blockers || null, daily.id);

  return { success: true, daily: getDailyByUserDate(userId, date) };
}

export function getDailiesByDateRange(startDate, endDate, userId = null) {
  if (userId) {
    return db.prepare(`
      SELECT d.*, u.username, u.role
      FROM dailies d
      JOIN users u ON u.id = d.user_id
      WHERE d.date BETWEEN ? AND ? AND d.user_id = ?
      ORDER BY d.date ASC, u.username ASC
    `).all(startDate, endDate, userId);
  }

  return db.prepare(`
    SELECT d.*, u.username, u.role
    FROM dailies d
    JOIN users u ON u.id = d.user_id
    WHERE d.date BETWEEN ? AND ?
    ORDER BY d.date ASC, u.username ASC
  `).all(startDate, endDate);
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

// Registrar novo conteúdo/arquivo
export function recordContent(userId, username, { title, link, inspiration, category }) {
  // Garantir que o usuário existe
  getUser(userId, username);

  const result = db.prepare(`
    INSERT INTO contents (user_id, title, link, inspiration, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, title, link, inspiration || null, category);

  // Dar XP ao usuário pelo registro
  const xpResult = addXP(userId, 30);

  return { id: result.lastInsertRowid, xpGained: 30, ...xpResult };
}

// Obter conteúdos (opcionalmente filtrado por user_id)
export function getContents(userId = null, limit = 10) {
  if (userId) {
    return db.prepare(`
      SELECT c.*, u.username FROM contents c
      JOIN users u ON c.user_id = u.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC LIMIT ?
    `).all(userId, limit);
  }
  return db.prepare(`
    SELECT c.*, u.username FROM contents c
    JOIN users u ON c.user_id = u.id
    ORDER BY c.created_at DESC LIMIT ?
  `).all(limit);
}

// Deletar conteúdo (somente admins farão isso via interface)
export function deleteContent(contentId) {
  try {
    const result = db.prepare('DELETE FROM contents WHERE id = ?').run(contentId);
    return result.changes > 0;
  } catch (e) {
    return false;
  }
}

// ==========================================
// FUNÇÕES DE MÉTRICAS E DASHBOARD
// ==========================================

// Resumo de KPIs Globais para o Dashboard
export function getDashboardSummary() {
  const currentWeek = getWeekCode();
  
  const totalHours = db.prepare('SELECT COALESCE(SUM(hours_today), 0) as total FROM dailies').get().total;
  const totalDailies = db.prepare('SELECT COUNT(*) as count FROM dailies').get().count;
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalContents = db.prepare('SELECT COUNT(*) as count FROM contents').get().count;
  const totalProjects = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
  
  // Bolsistas que bateram a meta de 20h na semana atual
  const weeklyUserHours = db.prepare(`
    SELECT user_id, SUM(hours_today) as hours
    FROM dailies
    WHERE week_code = ?
    GROUP BY user_id
  `).all(currentWeek);

  const usersMetGoal = weeklyUserHours.filter(u => u.hours >= 20).length;
  const activeThisWeek = weeklyUserHours.length;

  const totalWeeklyHoursSum = weeklyUserHours.reduce((acc, curr) => acc + curr.hours, 0);
  const avgWeeklyHours = activeThisWeek > 0 ? (totalWeeklyHoursSum / activeThisWeek) : 0;

  return {
    totalHours: Number(totalHours.toFixed(1)),
    totalDailies,
    totalUsers,
    totalContents,
    totalProjects,
    currentWeek,
    usersMetGoal,
    activeThisWeek,
    avgWeeklyHours: Number(avgWeeklyHours.toFixed(1)),
    goalCompletionRate: activeThisWeek > 0 ? Math.round((usersMetGoal / activeThisWeek) * 100) : 0
  };
}

// Histórico Temporal de Horas e Dailies
export function getDailyTrends(days = 30) {
  return db.prepare(`
    SELECT 
      date,
      ROUND(SUM(hours_today), 1) as total_hours,
      COUNT(id) as total_dailies,
      COUNT(DISTINCT user_id) as active_users
    FROM dailies
    GROUP BY date
    ORDER BY date ASC
    LIMIT ?
  `).all(days);
}

// Distribuição de Horas por Projeto
export function getProjectDistribution() {
  return db.prepare(`
    SELECT 
      COALESCE(project_name, 'Outros / Geral') as name,
      ROUND(SUM(hours_today), 1) as total_hours,
      COUNT(id) as total_dailies,
      COUNT(DISTINCT user_id) as total_contributors
    FROM dailies
    GROUP BY project_name
    ORDER BY total_hours DESC
  `).all();
}

// Distribuição de Conteúdos por Categoria
export function getContentCategoryStats() {
  return db.prepare(`
    SELECT category, COUNT(*) as count
    FROM contents
    GROUP BY category
    ORDER BY count DESC
  `).all();
}

// Métricas de Alunos / Bolsistas
export function getStudentsMetrics() {
  const currentWeek = getWeekCode();
  const users = db.prepare('SELECT * FROM users ORDER BY xp DESC').all();

  return users.map(user => {
    const weeklyHours = getWeeklyHours(user.id, currentWeek);
    const totalHoursRes = db.prepare('SELECT SUM(hours_today) as total FROM dailies WHERE user_id = ?').get(user.id);
    const totalHours = totalHoursRes?.total || 0;
    const totalDailiesRes = db.prepare('SELECT COUNT(*) as total FROM dailies WHERE user_id = ?').get(user.id);
    const totalDailies = totalDailiesRes?.total || 0;
    const totalContentsRes = db.prepare('SELECT COUNT(*) as total FROM contents WHERE user_id = ?').get(user.id);
    const totalContents = totalContentsRes?.total || 0;
    const badges = getUserBadges(user.id);

    return {
      ...user,
      weeklyHours: Number(weeklyHours.toFixed(1)),
      totalHours: Number(totalHours.toFixed(1)),
      totalDailies,
      totalContents,
      badgesCount: badges.length,
      badges,
      weeklyProgressPct: Math.min(100, Math.round((weeklyHours / 20) * 100))
    };
  });
}

// Detalhes completos de um Aluno / Bolsista
export function getStudentDetails(userId) {
  const user = getUser(userId);
  if (!user) return null;

  const currentWeek = getWeekCode();
  const weeklyHours = getWeeklyHours(userId, currentWeek);
  const totalHoursRes = db.prepare('SELECT SUM(hours_today) as total FROM dailies WHERE user_id = ?').get(userId);
  const totalHours = totalHoursRes?.total || 0;
  const badges = getUserBadges(userId);

  const dailies = db.prepare(`
    SELECT * FROM dailies
    WHERE user_id = ?
    ORDER BY date DESC, created_at DESC
    LIMIT 50
  `).all(userId);

  const contents = db.prepare(`
    SELECT * FROM contents
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);

  const projectsBreakdown = db.prepare(`
    SELECT 
      COALESCE(project_name, 'Outros') as project_name,
      ROUND(SUM(hours_today), 1) as hours,
      COUNT(id) as count
    FROM dailies
    WHERE user_id = ?
    GROUP BY project_name
    ORDER BY hours DESC
  `).all(userId);

  return {
    ...user,
    weeklyHours: Number(weeklyHours.toFixed(1)),
    totalHours: Number(totalHours.toFixed(1)),
    badges,
    badgesCount: badges.length,
    weeklyProgressPct: Math.min(100, Math.round((weeklyHours / 20) * 100)),
    dailies,
    contents,
    projectsBreakdown
  };
}

// Obter Dailies filtráveis
export function getDailiesList({ project, userId, search, limit = 100 } = {}) {
  let query = `
    SELECT d.*, u.username
    FROM dailies d
    JOIN users u ON d.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (project) {
    query += ` AND d.project_name = ?`;
    params.push(project);
  }
  if (userId) {
    query += ` AND d.user_id = ?`;
    params.push(userId);
  }
  if (search) {
    query += ` AND (d.tasks_done LIKE ? OR d.tasks_next LIKE ? OR u.username LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY d.date DESC, d.created_at DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(query).all(...params);
}

// Obter Lista de Projetos com Estatísticas Detalhadas
export function getProjectsList() {
  const projects = db.prepare('SELECT * FROM projects ORDER BY name ASC').all();

  return projects.map(proj => {
    const stats = db.prepare(`
      SELECT 
        ROUND(SUM(hours_today), 1) as total_hours,
        COUNT(id) as total_dailies,
        COUNT(DISTINCT user_id) as total_contributors
      FROM dailies
      WHERE project_name = ?
    `).get(proj.name);

    const topContributor = db.prepare(`
      SELECT u.username, SUM(d.hours_today) as hours
      FROM dailies d
      JOIN users u ON d.user_id = u.id
      WHERE d.project_name = ?
      GROUP BY d.user_id
      ORDER BY hours DESC
      LIMIT 1
    `).get(proj.name);

    return {
      ...proj,
      totalHours: stats?.total_hours || 0,
      totalDailies: stats?.total_dailies || 0,
      totalContributors: stats?.total_contributors || 0,
      topContributor: topContributor ? `${topContributor.username} (${topContributor.hours.toFixed(1)}h)` : 'Nenhum'
    };
  });
}

// Obter Dados dos Rankings Globais
export function getRankingsData() {
  const students = getStudentsMetrics();

  const byXP = [...students].sort((a, b) => b.xp - a.xp);
  const byStreak = [...students].sort((a, b) => b.daily_streak - a.daily_streak);
  const byWeeklyHours = [...students].sort((a, b) => b.weeklyHours - a.weeklyHours);
  const byTotalHours = [...students].sort((a, b) => b.totalHours - a.totalHours);

  return {
    byXP: byXP.slice(0, 10),
    byStreak: byStreak.slice(0, 10),
    byWeeklyHours: byWeeklyHours.slice(0, 10),
    byTotalHours: byTotalHours.slice(0, 10)
  };
}

export default db;

