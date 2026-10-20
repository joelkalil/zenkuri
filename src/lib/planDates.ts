/* Datas do plano. Todas as datas do plano são 'YYYY-MM-DD' em horário local. */

export const DAY_MS = 86_400_000;
export const PLAN_START = '2026-10-13';
export const PLAN_END = '2027-10-31';

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 'YYYY-MM-DD' como data local (sem o deslocamento de fuso do parse ISO). */
export function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isoDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** '13/10' — ano só quando muda em relação a hoje. */
export function formatDay(iso: string, today = todayStart()) {
  const [y, m, d] = iso.split('-');
  return Number(y) === today.getFullYear() ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

export function monthShort(index: number) {
  return MONTHS_SHORT[((index % 12) + 12) % 12];
}

/** 'YYYY-MM' → 'nov/26' */
export function monthKeyLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
}

/** 'YYYY-MM' → 'novembro de 2026' */
export function monthKeyLong(key: string) {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return `${MONTHS_LONG[m - 1]} de ${y}`;
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Próximos `count` meses a partir do mês de `from`, como 'YYYY-MM'. */
export function upcomingMonths(from: Date, count: number) {
  return Array.from({ length: count }, (_, index) => monthKey(new Date(from.getFullYear(), from.getMonth() + index, 1)));
}

/** "Hoje", "amanhã", "em 37 dias", "há 3 dias". */
export function relativeDays(days: number) {
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === -1) return 'ontem';
  return days > 0 ? `em ${days} dias` : `há ${-days} dias`;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}
