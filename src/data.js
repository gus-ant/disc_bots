import * as sqlite from './database.js';
import * as sheets from './sheets.js';

export const USER_ROLES = sqlite.USER_ROLES;

export function isUsingSheets() {
  return sheets.isGoogleSheetsConfigured();
}

export async function initStorage() {
  if (isUsingSheets()) {
    console.log('📊 Modo de Armazenamento: Google Sheets API Ativa.');
    const ok = await sheets.initGoogleSheets();
    if (ok) return 'sheets';
    console.warn('⚠️ Falha ao inicializar Google Sheets. Utilizando SQLite como fallback.');
  } else {
    console.log('💾 Modo de Armazenamento: Banco de Dados Local SQLite.');
  }
  sqlite.initDatabase();
  return 'sqlite';
}

function getProvider() {
  return isUsingSheets() ? sheets : sqlite;
}

export async function getUser(userId, username = 'Membro') {
  return await getProvider().getUser(userId, username);
}

export async function getExistingUser(userId) {
  return await getProvider().getExistingUser(userId);
}

export async function isUserRegistered(userId) {
  return await getProvider().isUserRegistered(userId);
}

export async function registerUser(userId, username, role) {
  return await getProvider().registerUser(userId, username, role);
}

export async function updateUserRegistration(targetUserId, username, role) {
  return await getProvider().updateUserRegistration(targetUserId, username, role);
}

export async function getRegisteredUsersByRole(role = null) {
  return await getProvider().getRegisteredUsersByRole(role);
}

export function getWeekCode(d = new Date()) {
  return sqlite.getWeekCode(d);
}

export function getFormattedDate(d = new Date()) {
  return sqlite.getFormattedDate(d);
}

export function getPreviousBusinessDate(dateStr) {
  return sqlite.getPreviousBusinessDate(dateStr);
}

export async function addXP(userId, xpAmount) {
  return await getProvider().addXP(userId, xpAmount);
}

export async function unlockBadge(userId, badgeId) {
  return await getProvider().unlockBadge(userId, badgeId);
}

export async function getUserBadges(userId) {
  return await getProvider().getUserBadges(userId);
}

export async function getWeeklyHours(userId, weekCode) {
  return await getProvider().getWeeklyHours(userId, weekCode);
}

export async function hasSubmittedDailyToday(userId, date) {
  return await getProvider().hasSubmittedDailyToday(userId, date);
}

export async function getDailyByUserDate(userId, date) {
  return await getProvider().getDailyByUserDate(userId, date);
}

export async function updateDailyForDate(userId, date, params) {
  return await getProvider().updateDailyForDate(userId, date, params);
}

export async function getDailiesByDateRange(startDate, endDate, userId = null) {
  return await getProvider().getDailiesByDateRange(startDate, endDate, userId);
}

export async function getProjects() {
  return await getProvider().getProjects();
}

export async function addProject(name, description) {
  return await getProvider().addProject(name, description);
}

export async function recordDaily(userId, username, params) {
  return await getProvider().recordDaily(userId, username, params);
}

export async function getLeaderboard(limit = 10) {
  return await getProvider().getLeaderboard(limit);
}

export async function recordContent(userId, username, params) {
  return await getProvider().recordContent(userId, username, params);
}

export async function getContents(userId = null, limit = 10) {
  return await getProvider().getContents(userId, limit);
}

export async function deleteContent(contentId) {
  return await getProvider().deleteContent(contentId);
}

export async function getDashboardSummary() {
  return await getProvider().getDashboardSummary();
}

export async function getDailyTrends(days = 30) {
  return await getProvider().getDailyTrends(days);
}

export async function getProjectDistribution() {
  return await getProvider().getProjectDistribution();
}

export async function getContentCategoryStats() {
  return await getProvider().getContentCategoryStats();
}

export async function getStudentsMetrics() {
  return await getProvider().getStudentsMetrics();
}

export async function getStudentDetails(userId) {
  return await getProvider().getStudentDetails(userId);
}

export async function getDailiesList(filters) {
  return await getProvider().getDailiesList(filters);
}

export async function getProjectsList() {
  return await getProvider().getProjectsList();
}

export async function getRankingsData() {
  return await getProvider().getRankingsData();
}
