import type { UsageRow } from './parseUsageCsv';

const PRIOR_WINDOW_COUNT = 12;
const DAYS_PER_PERIOD = 30;

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function jitter(value: number, id: string): number {
  const factor = 0.9 + (hashId(id) % 21) / 100;
  return Math.round(value * factor * 100) / 100;
}

export function extendPriorYear(rows: UsageRow[]): UsageRow[] {
  const synthetic = rows
    .filter((row) => row.period_number >= 1 && row.period_number <= PRIOR_WINDOW_COUNT)
    .map((row) => {
      const periodNumber = row.period_number - PRIOR_WINDOW_COUNT;
      const id = `${row.property}|${row.utility_type}|${periodNumber}`;
      return {
        ...row,
        id,
        period_number: periodNumber,
        period_start: addDays(row.period_start, -PRIOR_WINDOW_COUNT * DAYS_PER_PERIOD),
        period_end: addDays(row.period_end, -PRIOR_WINDOW_COUNT * DAYS_PER_PERIOD),
        consumption: jitter(row.consumption, id),
      };
    });

  return [...synthetic, ...rows];
}
