import type { PeriodColumn, TimelineRow } from './parseUsageCsv';

export type DataMode = 'actual' | 'normalized';

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function weatherShare(utilityType: string): number {
  const utility = utilityType.toLowerCase();
  if (utility.includes('gas')) {
    return 0.62;
  }
  if (utility.includes('electric')) {
    return 0.42;
  }
  if (utility.includes('water')) {
    return 0.08;
  }
  return 0.3;
}

function numbersFromRow(row: TimelineRow, fields: string[]): number[] {
  return fields.flatMap((field) => {
    const value = row[field];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? [value] : [];
  });
}

function normalizeFields(row: TimelineRow, fields: string[]): Record<string, number> {
  const typical = mean(numbersFromRow(row, fields));
  const share = weatherShare(String(row.utility_type));
  const next: Record<string, number> = {};

  for (const field of fields) {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue;
    }
    if (value === 0 || typical == null) {
      next[field] = value;
      continue;
    }
    const mixed = value * (1 - share) + typical * share;
    const jitter = 0.985 + (hashId(`${row.id}|${field}|wn`) % 31) / 1000;
    next[field] = Math.round(mixed * jitter * 100) / 100;
  }

  return next;
}

export function weatherNormalizeRows(rows: TimelineRow[], periods: PeriodColumn[]): TimelineRow[] {
  const currentFields = periods.map((period) => period.field);
  const priorFields = periods.map((period) => period.priorField);

  return rows.map((row) => ({
    ...row,
    ...normalizeFields(row, currentFields),
    ...normalizeFields(row, priorFields),
  }));
}
