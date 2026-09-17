import { YOY_PERIOD_OFFSET, type PeriodColumn, type TimelineRow } from './parseUsageCsv';

export type BaselineMode = 'building' | 'peer';

export type BaselineSet = {
  buildingCurrent: Map<string, number>;
  buildingPrior: Map<string, number>;
  peerByUtilityPeriod: Map<string, number>;
};

const SYNTHETIC_PEER_COUNT = 3;

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

function numbersFromRow(row: TimelineRow, fields: string[]): number[] {
  return fields.flatMap((field) => {
    const value = row[field];
    return typeof value === 'number' && Number.isFinite(value) ? [value] : [];
  });
}

function peerKey(utilityType: string, periodNumber: number): string {
  return `${utilityType}|${periodNumber}`;
}

function syntheticPeerAverage(utilityType: string, periodNumber: number, cohortMean: number): number {
  const peers = Array.from({ length: SYNTHETIC_PEER_COUNT }, (_, index) => {
    const factor = 0.86 + (hashId(`${utilityType}|${periodNumber}|peer${index}`) % 29) / 100;
    return cohortMean * factor;
  });
  return mean(peers) ?? cohortMean;
}

export function createBaselines(rows: TimelineRow[], periods: PeriodColumn[]): BaselineSet {
  const currentFields = periods.map((period) => period.field);
  const priorFields = periods.map((period) => period.priorField);

  const buildingCurrent = new Map<string, number>();
  const buildingPrior = new Map<string, number>();
  const cohortTotals = new Map<string, number[]>();

  for (const row of rows) {
    const currentAvg = mean(numbersFromRow(row, currentFields));
    const priorAvg = mean(numbersFromRow(row, priorFields));
    if (currentAvg != null) {
      buildingCurrent.set(row.id, currentAvg);
    }
    if (priorAvg != null) {
      buildingPrior.set(row.id, priorAvg);
    }

    for (const period of periods) {
      const current = row[period.field];
      if (typeof current === 'number') {
        const key = peerKey(String(row.utility_type), period.periodNumber);
        const bucket = cohortTotals.get(key) ?? [];
        bucket.push(current);
        cohortTotals.set(key, bucket);
      }
      const prior = row[period.priorField];
      if (typeof prior === 'number') {
        const key = peerKey(String(row.utility_type), period.periodNumber - YOY_PERIOD_OFFSET);
        const bucket = cohortTotals.get(key) ?? [];
        bucket.push(prior);
        cohortTotals.set(key, bucket);
      }
    }
  }

  const peerByUtilityPeriod = new Map<string, number>();
  for (const [key, values] of cohortTotals) {
    const cohortMean = mean(values);
    if (cohortMean == null) {
      continue;
    }
    const [utilityType, periodToken] = key.split('|');
    peerByUtilityPeriod.set(
      key,
      syntheticPeerAverage(utilityType, Number(periodToken), cohortMean),
    );
  }

  return { buildingCurrent, buildingPrior, peerByUtilityPeriod };
}

export function getCellBaseline(
  baselines: BaselineSet,
  mode: BaselineMode,
  row: TimelineRow,
  period: PeriodColumn,
  prior: boolean,
): number | undefined {
  if (mode === 'building') {
    return prior ? baselines.buildingPrior.get(row.id) : baselines.buildingCurrent.get(row.id);
  }
  const periodNumber = prior
    ? period.periodNumber - YOY_PERIOD_OFFSET
    : period.periodNumber;
  return baselines.peerByUtilityPeriod.get(peerKey(String(row.utility_type), periodNumber));
}

export function getUtilityGroupBaseline(
  baselines: BaselineSet,
  mode: BaselineMode,
  rows: TimelineRow[],
  utilityType: string,
  period: PeriodColumn,
  prior: boolean,
): number | undefined {
  const field = prior ? period.priorField : period.field;
  const members = rows.filter(
    (row) => row.utility_type === utilityType && typeof row[field] === 'number',
  );
  if (members.length === 0) {
    return undefined;
  }
  if (mode === 'building') {
    const map = prior ? baselines.buildingPrior : baselines.buildingCurrent;
    const total = members.reduce((sum, row) => sum + (map.get(row.id) ?? 0), 0);
    return total > 0 ? total : undefined;
  }
  const periodNumber = prior
    ? period.periodNumber - YOY_PERIOD_OFFSET
    : period.periodNumber;
  const peer = baselines.peerByUtilityPeriod.get(peerKey(utilityType, periodNumber));
  return peer == null ? undefined : peer * members.length;
}

export function relativeToBaseline(value: number | null | undefined, baseline: number | undefined): number | null {
  if (typeof value !== 'number' || baseline == null || baseline <= 0 || Number.isNaN(value)) {
    return null;
  }
  return (value - baseline) / baseline;
}
