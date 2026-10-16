import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_TIME_ZONE, getTodayDateString, addDays } from './utils/dates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const USER_ROLES = {
  BOLSISTA: 'Bolsista NIA/UnDF',
  COORDENADOR: 'Coordenador',
  ADMIN: 'Admin'
};

const SHEET_NAMES = {
  USERS: 'Usuarios',
  DAILIES: 'Dailies',
  PROJECTS: 'Projetos',
  BADGES: 'Badges',
  CONTENTS: 'Conteudos'
};

const HEADERS = {
  [SHEET_NAMES.USERS]: ['id', 'username', 'role', 'xp', 'level', 'daily_streak', 'last_daily_date', 'registered_at', 'created_at'],
  [SHEET_NAMES.DAILIES]: ['id', 'user_id', 'date', 'week_code', 'hours_today', 'time_range', 'project_name', 'tasks_done', 'tasks_next', 'blockers', 'created_at'],
  [SHEET_NAMES.PROJECTS]: ['id', 'name', 'description', 'created_at'],
  [SHEET_NAMES.BADGES]: ['id', 'user_id', 'badge_id', 'unlocked_at'],
  [SHEET_NAMES.CONTENTS]: ['id', 'user_id', 'title', 'link', 'inspiration', 'category', 'created_at']
};

let sheetsClient = null;
let spreadsheetId = null;

export function getSpreadsheetId() {
  return spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID || null;
}

export function isGoogleSheetsConfigured() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'credentials.json');
  const sheetId = process.env.GOOGLE_SPREADSHEET_ID;
  return Boolean(fs.existsSync(credPath) && sheetId && sheetId !== 'seu_spreadsheet_id_aqui');
}

export async function initGoogleSheets() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'credentials.json');
  spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!fs.existsSync(credPath)) {
    console.warn(`[Google Sheets] Arquivo de credenciais não encontrado em: ${credPath}`);
    return false;
  }

  if (!spreadsheetId || spreadsheetId === 'seu_spreadsheet_id_aqui') {
    console.warn('[Google Sheets] GOOGLE_SPREADSHEET_ID não configurado no .env.');
    return false;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  sheetsClient = google.sheets({ version: 'v4', auth });

  try {
    const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const existingSheets = (meta.data.sheets || []).map(s => s.properties?.title);

    const sheetsToCreate = Object.values(SHEET_NAMES).filter(name => !existingSheets.includes(name));

    if (sheetsToCreate.length > 0) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: sheetsToCreate.map(title => ({
            addSheet: { properties: { title } }
          }))
        }
      });
    }

    // Inicializar cabeçalhos se vazios
    for (const [sheetTitle, headers] of Object.entries(HEADERS)) {
      const res = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetTitle}!A1:Z1`
      });

      if (!res.data.values || res.data.values.length === 0) {
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetTitle}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] }
        });
      }
    }

    // Inserir projetos padrões se a aba de projetos estiver vazia
    const projectsData = await readSheetRows(SHEET_NAMES.PROJECTS);
    if (projectsData.length === 0) {
      const defaultProjects = [
        ['1', 'Hermes Benchmark (LLMs)', 'Avaliação e benchmark de modelos de linguagem para o setor público.', new Date().toISOString()],
        ['2', 'Diagnóstico de Maturidade em IA', 'Análise de prontidão tecnológica e maturidade de IA em órgãos governamentais.', new Date().toISOString()],
        ['3', 'Governança & Ética em IA', 'Diretrizes de IA responsável, transparência, privacidade e segurança.', new Date().toISOString()],
        ['4', 'Capacitação & Formação de Talentos', 'Treinamento, desenvolvimento e capacitação contínua de pesquisadores e bolsistas.', new Date().toISOString()]
      ];
      await appendSheetRows(SHEET_NAMES.PROJECTS, defaultProjects);
    }

    console.log(`[Google Sheets] Conectado com sucesso à planilha: ${meta.data.properties?.title} (${spreadsheetId})`);
    return true;
  } catch (error) {
    console.error('[Google Sheets] Erro ao inicializar conexão:', error.message);
    return false;
  }
}

// Cache em memória (TTL: 15 segundos) para acelerar consultas e poupar cota da API
const cache = new Map();
const CACHE_TTL_MS = 15000;

export function invalidateSheetCache(sheetTitle = null) {
  if (sheetTitle) {
    cache.delete(sheetTitle);
  } else {
    cache.clear();
  }
}

// Helpers para leitura e escrita na planilha
export async function readSheetRows(sheetTitle) {
  if (!sheetsClient || !spreadsheetId) return [];

  const cached = cache.get(sheetTitle);
  const now = Date.now();
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  try {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTitle}!A2:Z`
    });

    const rows = res.data.values || [];
    const headers = HEADERS[sheetTitle] || [];

    const data = rows.map((row, index) => {
      const obj = { _rowIndex: index + 2 };
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });

    cache.set(sheetTitle, { timestamp: now, data });
    return data;
  } catch (err) {
    console.error(`[Google Sheets] Erro ao ler aba ${sheetTitle}:`, err.message);
    return [];
  }
}

export async function appendSheetRows(sheetTitle, valuesMatrix) {
  if (!sheetsClient || !spreadsheetId) return;
  invalidateSheetCache(sheetTitle);
  try {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetTitle}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: valuesMatrix }
    });
  } catch (err) {
    console.error(`[Google Sheets] Erro ao adicionar linhas em ${sheetTitle}:`, err.message);
    throw err;
  }
}

export async function updateSheetRow(sheetTitle, rowIndex, valuesRow) {
  if (!sheetsClient || !spreadsheetId) return;
  invalidateSheetCache(sheetTitle);
  try {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [valuesRow] }
    });
  } catch (err) {
    console.error(`[Google Sheets] Erro ao atualizar linha ${rowIndex} em ${sheetTitle}:`, err.message);
    throw err;
  }
}

export async function deleteSheetRow(sheetTitle, rowIndex) {
  if (!sheetsClient || !spreadsheetId) return;
  invalidateSheetCache(sheetTitle);
  try {
    const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const sheet = (meta.data.sheets || []).find(s => s.properties?.title === sheetTitle);
    if (!sheet) return;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties?.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              }
            }
          }
        ]
      }
    });
  } catch (err) {
    console.error(`[Google Sheets] Erro ao deletar linha ${rowIndex} em ${sheetTitle}:`, err.message);
    throw err;
  }
}

// Utilitários de Data e Regras de Negócio
export function getWeekCode(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getFormattedDate(d = new Date()) {
  return getTodayDateString(APP_TIME_ZONE);
}

export function getPreviousBusinessDate(dateStr) {
  let cur = dateStr;
  for (let i = 0; i < 7; i++) {
    cur = addDays(cur, -1);
    const d = new Date(`${cur}T12:00:00Z`);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      return cur;
    }
  }
  return cur;
}

// ----------------------------------------------------
// OPERAÇÕES DE NEGÓCIO DIRETAS NO GOOGLE SHEETS
// ----------------------------------------------------

export async function getExistingUser(userId) {
  const users = await readSheetRows(SHEET_NAMES.USERS);
  const found = users.find(u => String(u.id) === String(userId));
  if (!found) return null;
  return {
    ...found,
    xp: Number(found.xp || 0),
    level: Number(found.level || 1),
    daily_streak: Number(found.daily_streak || 0)
  };
}

export async function isUserRegistered(userId) {
  const user = await getExistingUser(userId);
  return Boolean(user && user.registered_at);
}

export async function getUser(userId, username = 'Membro') {
  let user = await getExistingUser(userId);
  if (!user) {
    const newUserRow = [
      String(userId),
      username,
      '',
      0,
      1,
      0,
      '',
      '',
      new Date().toISOString()
    ];
    await appendSheetRows(SHEET_NAMES.USERS, [newUserRow]);
    user = {
      id: String(userId),
      username,
      role: '',
      xp: 0,
      level: 1,
      daily_streak: 0,
      last_daily_date: '',
      registered_at: '',
      created_at: newUserRow[8]
    };
  }
  return user;
}

export async function registerUser(userId, username, role) {
  const existing = await getExistingUser(userId);
  const now = new Date().toISOString();

  if (existing && existing.registered_at) {
    return {
      success: false,
      error: `Você já está cadastrado como **${existing.role}**. Se precisar alterar, solicite a um Administrador ou use o comando apropriado.`
    };
  }

  if (existing) {
    const updatedRow = [
      existing.id,
      username,
      role,
      existing.xp,
      existing.level,
      existing.daily_streak,
      existing.last_daily_date,
      now,
      existing.created_at || now
    ];
    await updateSheetRow(SHEET_NAMES.USERS, existing._rowIndex, updatedRow);
  } else {
    const newRow = [
      String(userId),
      username,
      role,
      0,
      1,
      0,
      '',
      now,
      now
    ];
    await appendSheetRows(SHEET_NAMES.USERS, [newRow]);
  }

  return { success: true, role };
}

export async function updateUserRegistration(targetUserId, username, role) {
  const existing = await getExistingUser(targetUserId);
  const now = new Date().toISOString();

  if (!existing) {
    const newRow = [String(targetUserId), username, role, 0, 1, 0, '', now, now];
    await appendSheetRows(SHEET_NAMES.USERS, [newRow]);
    return { success: true, isNew: true, role };
  }

  const updatedRow = [
    existing.id,
    username,
    role,
    existing.xp,
    existing.level,
    existing.daily_streak,
    existing.last_daily_date,
    existing.registered_at || now,
    existing.created_at || now
  ];
  await updateSheetRow(SHEET_NAMES.USERS, existing._rowIndex, updatedRow);
  return { success: true, isNew: false, role };
}

export async function getRegisteredUsersByRole(role = null) {
  const users = await readSheetRows(SHEET_NAMES.USERS);
  return users
    .filter(u => u.registered_at && (!role || u.role === role))
    .map(u => ({
      ...u,
      xp: Number(u.xp || 0),
      level: Number(u.level || 1),
      daily_streak: Number(u.daily_streak || 0)
    }));
}

export async function addXP(userId, xpAmount) {
  const user = await getUser(userId);
  const newXP = user.xp + xpAmount;
  const newLevel = Math.floor(newXP / 100) + 1;
  const leveledUp = newLevel > user.level;

  const users = await readSheetRows(SHEET_NAMES.USERS);
  const target = users.find(u => String(u.id) === String(userId));
  if (target) {
    const row = [
      target.id,
      target.username,
      target.role,
      newXP,
      newLevel,
      target.daily_streak,
      target.last_daily_date,
      target.registered_at,
      target.created_at
    ];
    await updateSheetRow(SHEET_NAMES.USERS, target._rowIndex, row);
  }

  return { newXP, newLevel, leveledUp };
}

export async function unlockBadge(userId, badgeId) {
  const badges = await readSheetRows(SHEET_NAMES.BADGES);
  const exists = badges.some(b => String(b.user_id) === String(userId) && b.badge_id === badgeId);
  if (exists) return false;

  const newId = String(Date.now() + Math.floor(Math.random() * 1000));
  await appendSheetRows(SHEET_NAMES.BADGES, [[newId, String(userId), badgeId, new Date().toISOString()]]);
  return true;
}

export async function getUserBadges(userId) {
  const badges = await readSheetRows(SHEET_NAMES.BADGES);
  return badges.filter(b => String(b.user_id) === String(userId));
}

export async function getWeeklyHours(userId, weekCode = getWeekCode()) {
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  const sum = dailies
    .filter(d => String(d.user_id) === String(userId) && d.week_code === weekCode)
    .reduce((acc, curr) => acc + (parseFloat(curr.hours_today) || 0), 0);
  return Number(sum.toFixed(1));
}

export async function hasSubmittedDailyToday(userId, date = getFormattedDate()) {
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  return dailies.some(d => String(d.user_id) === String(userId) && d.date === date);
}

export async function getDailyByUserDate(userId, date = getFormattedDate()) {
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  return dailies.find(d => String(d.user_id) === String(userId) && d.date === date) || null;
}

export async function updateDailyForDate(userId, date = getFormattedDate(), { hoursToday, timeRange, projectName, tasksDone, tasksNext, blockers }) {
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  const target = dailies.find(d => String(d.user_id) === String(userId) && d.date === date);

  if (!target) {
    return { success: false, error: 'Nenhum registro de daily encontrado para hoje.' };
  }

  const updatedRow = [
    target.id,
    target.user_id,
    target.date,
    target.week_code,
    hoursToday,
    timeRange || '',
    projectName || '',
    tasksDone,
    tasksNext,
    blockers || '',
    target.created_at
  ];

  await updateSheetRow(SHEET_NAMES.DAILIES, target._rowIndex, updatedRow);
  return { success: true };
}

export async function getDailiesByDateRange(startDate, endDate, userId = null) {
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  const users = await readSheetRows(SHEET_NAMES.USERS);
  const userMap = new Map(users.map(u => [String(u.id), u.username]));

  return dailies
    .filter(d => {
      const inRange = d.date >= startDate && d.date <= endDate;
      const matchUser = userId ? String(d.user_id) === String(userId) : true;
      return inRange && matchUser;
    })
    .map(d => ({
      ...d,
      hours_today: parseFloat(d.hours_today) || 0,
      username: userMap.get(String(d.user_id)) || 'Membro'
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getProjects() {
  const projects = await readSheetRows(SHEET_NAMES.PROJECTS);
  return projects.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description
  }));
}

export async function addProject(name, description) {
  const projects = await readSheetRows(SHEET_NAMES.PROJECTS);
  const exists = projects.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (exists) {
    return { success: false, error: 'Já existe um projeto cadastrado com este nome.' };
  }

  const newId = String(Date.now());
  await appendSheetRows(SHEET_NAMES.PROJECTS, [[newId, name.trim(), description.trim(), new Date().toISOString()]]);
  return { success: true };
}

export async function recordDaily(userId, username, { hoursToday, timeRange, projectName, tasksDone, tasksNext, blockers }) {
  const today = getFormattedDate();
  const weekCode = getWeekCode();
  const user = await getUser(userId, username);

  const dailyId = String(Date.now());
  const dailyRow = [
    dailyId,
    String(userId),
    today,
    weekCode,
    hoursToday,
    timeRange || '',
    projectName || '',
    tasksDone,
    tasksNext,
    blockers || '',
    new Date().toISOString()
  ];
  await appendSheetRows(SHEET_NAMES.DAILIES, [dailyRow]);

  // Atualizar Streak (considerando dias úteis)
  let newStreak = user.daily_streak;
  const lastDate = user.last_daily_date;

  if (!lastDate) {
    newStreak = 1;
  } else if (lastDate === today) {
    // Mesma data
  } else {
    const prevBusinessDate = getPreviousBusinessDate(today);
    if (lastDate === prevBusinessDate) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  }

  // Atualizar dados do usuário
  const users = await readSheetRows(SHEET_NAMES.USERS);
  const targetUser = users.find(u => String(u.id) === String(userId));
  if (targetUser) {
    const updatedUserRow = [
      targetUser.id,
      username,
      targetUser.role,
      targetUser.xp,
      targetUser.level,
      newStreak,
      today,
      targetUser.registered_at,
      targetUser.created_at
    ];
    await updateSheetRow(SHEET_NAMES.USERS, targetUser._rowIndex, updatedUserRow);
  }

  const xpResult = await addXP(userId, 50);

  const newBadges = [];
  if (await unlockBadge(userId, 'first_daily')) newBadges.push('Primeiros Passos');
  if (newStreak >= 5 && (await unlockBadge(userId, 'streak_5'))) newBadges.push('Imparável (5 dias úteis)');

  const currentWeeklyHours = await getWeeklyHours(userId, weekCode);
  if (currentWeeklyHours >= 20 && (await unlockBadge(userId, 'weekly_20h'))) newBadges.push('Meta 20h Concluída');

  return {
    streak: newStreak,
    weeklyHours: currentWeeklyHours,
    xpGained: 50,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.newLevel,
    newBadges
  };
}

export async function getLeaderboard(limit = 10) {
  const users = await readSheetRows(SHEET_NAMES.USERS);
  return users
    .map(u => ({
      id: u.id,
      username: u.username,
      xp: Number(u.xp || 0),
      level: Number(u.level || 1),
      daily_streak: Number(u.daily_streak || 0)
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

export async function recordContent(userId, username, { title, link, inspiration, category }) {
  await getUser(userId, username);
  const contentId = String(Date.now());
  const row = [
    contentId,
    String(userId),
    title,
    link,
    inspiration || '',
    category,
    new Date().toISOString()
  ];
  await appendSheetRows(SHEET_NAMES.CONTENTS, [row]);
  await addXP(userId, 30);
  await unlockBadge(userId, 'ai_contributor');
  return { id: contentId };
}

export async function getContents(userId = null, limit = 10) {
  const contents = await readSheetRows(SHEET_NAMES.CONTENTS);
  const users = await readSheetRows(SHEET_NAMES.USERS);
  const userMap = new Map(users.map(u => [String(u.id), u.username]));

  return contents
    .filter(c => (userId ? String(c.user_id) === String(userId) : true))
    .map(c => ({
      ...c,
      username: userMap.get(String(c.user_id)) || 'Membro'
    }))
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, limit);
}

export async function deleteContent(contentId) {
  const contents = await readSheetRows(SHEET_NAMES.CONTENTS);
  const target = contents.find(c => String(c.id) === String(contentId));
  if (!target) return { changes: 0 };
  await deleteSheetRow(SHEET_NAMES.CONTENTS, target._rowIndex);
  return { changes: 1 };
}

// ----------------------------------------------------
// MÉTRICAS E DASHBOARD VIA GOOGLE SHEETS
// ----------------------------------------------------

export async function getDashboardSummary() {
  const currentWeek = getWeekCode();
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  const users = await readSheetRows(SHEET_NAMES.USERS);
  const contents = await readSheetRows(SHEET_NAMES.CONTENTS);
  const projects = await readSheetRows(SHEET_NAMES.PROJECTS);

  const totalHours = dailies.reduce((sum, d) => sum + (parseFloat(d.hours_today) || 0), 0);
  const totalDailies = dailies.length;
  const totalUsers = users.length;
  const totalContents = contents.length;
  const totalProjects = projects.length;

  const currentWeekDailies = dailies.filter(d => d.week_code === currentWeek);
  const userHoursMap = new Map();
  for (const d of currentWeekDailies) {
    const uid = String(d.user_id);
    userHoursMap.set(uid, (userHoursMap.get(uid) || 0) + (parseFloat(d.hours_today) || 0));
  }

  const activeThisWeek = userHoursMap.size;
  let usersMetGoal = 0;
  let totalWeeklyHoursSum = 0;
  for (const hours of userHoursMap.values()) {
    if (hours >= 20) usersMetGoal += 1;
    totalWeeklyHoursSum += hours;
  }

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

export async function getDailyTrends(days = 30) {
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  const dateMap = new Map();

  for (const d of dailies) {
    const date = d.date;
    if (!date) continue;
    const current = dateMap.get(date) || { total_hours: 0, total_dailies: 0 };
    current.total_hours += (parseFloat(d.hours_today) || 0);
    current.total_dailies += 1;
    dateMap.set(date, current);
  }

  const sortedDates = [...dateMap.keys()].sort().slice(-days);
  return sortedDates.map(date => ({
    date,
    total_hours: Number(dateMap.get(date).total_hours.toFixed(1)),
    total_dailies: dateMap.get(date).total_dailies
  }));
}

export async function getProjectDistribution() {
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  const projectMap = new Map();

  for (const d of dailies) {
    const rawNames = d.project_name || 'Geral';
    const names = rawNames.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
    const splitNames = names.length > 0 ? names : ['Geral'];
    const hoursPerProject = (parseFloat(d.hours_today) || 0) / splitNames.length;

    for (const name of splitNames) {
      const current = projectMap.get(name) || { hours: 0, count: 0 };
      current.hours += hoursPerProject;
      current.count += 1;
      projectMap.set(name, current);
    }
  }

  return [...projectMap.entries()]
    .map(([project_name, data]) => ({
      project_name,
      total_hours: Number(data.hours.toFixed(1)),
      daily_count: data.count
    }))
    .sort((a, b) => b.total_hours - a.total_hours)
    .slice(0, 8);
}

export async function getContentCategoryStats() {
  const contents = await readSheetRows(SHEET_NAMES.CONTENTS);
  const catMap = new Map();

  for (const c of contents) {
    const cat = c.category || 'Geral';
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  }

  return [...catMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getStudentsMetrics() {
  const currentWeek = getWeekCode();
  const users = await readSheetRows(SHEET_NAMES.USERS);
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  const badges = await readSheetRows(SHEET_NAMES.BADGES);

  return users
    .filter(u => u.role === USER_ROLES.BOLSISTA)
    .map(u => {
      const userDailies = dailies.filter(d => String(d.user_id) === String(u.id));
      const weeklyHours = userDailies
        .filter(d => d.week_code === currentWeek)
        .reduce((sum, d) => sum + (parseFloat(d.hours_today) || 0), 0);
      const totalHours = userDailies
        .reduce((sum, d) => sum + (parseFloat(d.hours_today) || 0), 0);
      const badgeCount = badges.filter(b => String(b.user_id) === String(u.id)).length;

      return {
        id: u.id,
        username: u.username,
        xp: Number(u.xp || 0),
        level: Number(u.level || 1),
        daily_streak: Number(u.daily_streak || 0),
        last_daily_date: u.last_daily_date,
        weekly_hours: Number(weeklyHours.toFixed(1)),
        total_hours: Number(totalHours.toFixed(1)),
        total_dailies: userDailies.length,
        badges_count: badgeCount,
        goal_met: weeklyHours >= 20 ? 1 : 0
      };
    })
    .sort((a, b) => b.weekly_hours - a.weekly_hours);
}

export async function getStudentDetails(userId) {
  const user = await getExistingUser(userId);
  if (!user) return null;

  const currentWeek = getWeekCode();
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  const userDailies = dailies
    .filter(d => String(d.user_id) === String(userId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const weeklyHours = userDailies
    .filter(d => d.week_code === currentWeek)
    .reduce((sum, d) => sum + (parseFloat(d.hours_today) || 0), 0);

  const totalHours = userDailies
    .reduce((sum, d) => sum + (parseFloat(d.hours_today) || 0), 0);

  const userBadges = await getUserBadges(userId);

  return {
    user: {
      ...user,
      weekly_hours: Number(weeklyHours.toFixed(1)),
      total_hours: Number(totalHours.toFixed(1)),
      total_dailies: userDailies.length
    },
    badges: userBadges,
    dailies: userDailies.slice(0, 30)
  };
}

export async function getDailiesList({ project, userId, search, limit = 100 } = {}) {
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);
  const users = await readSheetRows(SHEET_NAMES.USERS);
  const userMap = new Map(users.map(u => [String(u.id), u.username]));

  let filtered = dailies.map(d => ({
    ...d,
    hours_today: parseFloat(d.hours_today) || 0,
    username: userMap.get(String(d.user_id)) || 'Membro'
  }));

  if (userId) {
    filtered = filtered.filter(d => String(d.user_id) === String(userId));
  }

  if (project) {
    const pLower = project.toLowerCase();
    filtered = filtered.filter(d => (d.project_name || '').toLowerCase().includes(pLower));
  }

  if (search) {
    const sLower = search.toLowerCase();
    filtered = filtered.filter(d =>
      d.username.toLowerCase().includes(sLower) ||
      (d.tasks_done || '').toLowerCase().includes(sLower) ||
      (d.tasks_next || '').toLowerCase().includes(sLower)
    );
  }

  return filtered.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export async function getProjectsList() {
  const projects = await readSheetRows(SHEET_NAMES.PROJECTS);
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);

  return projects.map(p => {
    const pDailies = dailies.filter(d => (d.project_name || '').toLowerCase().includes(p.name.toLowerCase()));
    const hours = pDailies.reduce((sum, d) => sum + (parseFloat(d.hours_today) || 0), 0);
    const uniqueUsers = new Set(pDailies.map(d => String(d.user_id))).size;

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      total_hours: Number(hours.toFixed(1)),
      total_dailies: pDailies.length,
      active_contributors: uniqueUsers
    };
  });
}

export async function getRankingsData() {
  const users = await readSheetRows(SHEET_NAMES.USERS);
  const bolsistas = users.filter(u => u.role === USER_ROLES.BOLSISTA);

  const topXP = [...bolsistas]
    .map(u => ({ id: u.id, username: u.username, xp: Number(u.xp || 0), level: Number(u.level || 1), daily_streak: Number(u.daily_streak || 0) }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  const topStreak = [...bolsistas]
    .map(u => ({ id: u.id, username: u.username, daily_streak: Number(u.daily_streak || 0), level: Number(u.level || 1) }))
    .sort((a, b) => b.daily_streak - a.daily_streak)
    .slice(0, 10);

  const currentWeek = getWeekCode();
  const dailies = await readSheetRows(SHEET_NAMES.DAILIES);

  const hoursMap = new Map();
  for (const d of dailies.filter(d => d.week_code === currentWeek)) {
    const uid = String(d.user_id);
    hoursMap.set(uid, (hoursMap.get(uid) || 0) + (parseFloat(d.hours_today) || 0));
  }

  const userMap = new Map(users.map(u => [String(u.id), u.username]));
  const topWeekly = [...hoursMap.entries()]
    .map(([uid, hours]) => ({
      id: uid,
      username: userMap.get(uid) || 'Membro',
      weekly_hours: Number(hours.toFixed(1))
    }))
    .sort((a, b) => b.weekly_hours - a.weekly_hours)
    .slice(0, 10);

  return { topXP, topStreak, topWeekly };
}
