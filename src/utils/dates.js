export const APP_TIME_ZONE = 'America/Sao_Paulo';

function toDateString(date) {
  return date.toISOString().split('T')[0];
}

function fromDateString(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`);
}

export function addDays(dateStr, days) {
  const date = fromDateString(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

export function getZonedParts(date = new Date(), timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function getTodayDateString(timeZone = APP_TIME_ZONE) {
  const parts = getZonedParts(new Date(), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isBusinessDay(date = new Date(), timeZone = APP_TIME_ZONE) {
  const weekday = getZonedParts(date, timeZone).weekday;
  return weekday !== 'Sat' && weekday !== 'Sun';
}

export function getCurrentWeekRange(timeZone = APP_TIME_ZONE) {
  const today = getTodayDateString(timeZone);
  const weekday = getZonedParts(new Date(), timeZone).weekday;
  const offsets = { Mon: 0, Tue: -1, Wed: -2, Thu: -3, Fri: -4, Sat: -5, Sun: -6 };
  const startDate = addDays(today, offsets[weekday] ?? 0);

  return {
    startDate,
    endDate: addDays(startDate, 4)
  };
}

export function getCurrentMonthRange(timeZone = APP_TIME_ZONE) {
  const parts = getZonedParts(new Date(), timeZone);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const startDate = `${parts.year}-${parts.month}-01`;
  const endDate = toDateString(new Date(Date.UTC(year, month, 0, 12)));

  return { startDate, endDate };
}

