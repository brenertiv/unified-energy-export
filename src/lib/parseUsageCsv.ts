import Papa from 'papaparse';

export type UsageRow = {
  id: string;
  portfolio: string;
  property: string;
  address: string;
  utility_type: string;
  unit: string;
  period_number: number;
  period_start: Date;
  period_end: Date;
  consumption: number;
};

type CsvRecord = {
  portfolio?: string;
  property?: string;
  address?: string;
  utility_type?: string;
  unit?: string;
  period_number?: string;
  period_start?: string;
  period_end?: string;
  consumption?: string;
};

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const YOY_PERIOD_OFFSET = 12;

export type PeriodColumn = {
  field: string;
  priorField: string;
  periodNumber: number;
  start: Date;
  end: Date;
  priorStart?: Date;
  priorEnd?: Date;
};

export type TimelineRow = {
  id: string;
  portfolio: string;
  property: string;
  address: string;
  utility_type: string;
  unit: string;
} & Record<string, string | number | undefined>;

export function toTimelineRows(rows: UsageRow[]): {
  rows: TimelineRow[];
  periods: PeriodColumn[];
} {
  const periodDates = new Map<number, { start: Date; end: Date }>();
  const seriesMeta = new Map<string, TimelineRow>();
  const consumption = new Map<string, Map<number, number>>();

  for (const row of rows) {
    if (!periodDates.has(row.period_number)) {
      periodDates.set(row.period_number, {
        start: row.period_start,
        end: row.period_end,
      });
    }

    const id = `${row.property}|${row.utility_type}`;
    if (!seriesMeta.has(id)) {
      seriesMeta.set(id, {
        id,
        portfolio: row.portfolio,
        property: row.property,
        address: row.address,
        utility_type: row.utility_type,
        unit: row.unit,
      });
    }

    let byPeriod = consumption.get(id);
    if (!byPeriod) {
      byPeriod = new Map();
      consumption.set(id, byPeriod);
    }
    byPeriod.set(row.period_number, row.consumption);
  }

  const periods: PeriodColumn[] = [...periodDates.keys()]
    .filter((periodNumber) => periodNumber >= 1)
    .sort((a, b) => a - b)
    .map((periodNumber) => {
      const current = periodDates.get(periodNumber)!;
      const prior = periodDates.get(periodNumber - YOY_PERIOD_OFFSET);
      return {
        field: `p${periodNumber}`,
        priorField: `ly${periodNumber}`,
        periodNumber,
        start: current.start,
        end: current.end,
        priorStart: prior?.start,
        priorEnd: prior?.end,
      };
    });

  const timelineRows = [...seriesMeta.entries()].map(([id, meta]) => {
    const byPeriod = consumption.get(id);
    const row: TimelineRow = { ...meta };
    for (const period of periods) {
      const current = byPeriod?.get(period.periodNumber);
      const prior = byPeriod?.get(period.periodNumber - YOY_PERIOD_OFFSET);
      if (current != null) {
        row[period.field] = current;
      }
      if (prior != null) {
        row[period.priorField] = prior;
      }
    }
    return row;
  });

  return { rows: timelineRows, periods };
}

export function parseUsageCsv(csvText: string): UsageRow[] {
  const parsed = Papa.parse<CsvRecord>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .filter((row) => row.property && row.utility_type && row.period_number)
    .map((row) => {
      const property = row.property!.trim();
      const utilityType = row.utility_type!.trim();
      const periodNumber = Number(row.period_number);
      return {
        id: `${property}|${utilityType}|${periodNumber}`,
        portfolio: (row.portfolio ?? '').trim(),
        property,
        address: (row.address ?? '').trim(),
        utility_type: utilityType,
        unit: (row.unit ?? '').trim(),
        period_number: periodNumber,
        period_start: parseDate(row.period_start ?? ''),
        period_end: parseDate(row.period_end ?? ''),
        consumption: Number(row.consumption),
      };
    });
}
