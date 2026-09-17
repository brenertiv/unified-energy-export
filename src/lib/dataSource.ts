import type { TimelineRow } from './parseUsageCsv';

export type DataSource = 'Monitored' | 'Manual' | 'Utility';

export type CellDataSource = DataSource | 'Mixed';

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getCellDataSource(rowId: string, field: string): DataSource {
  const bucket = hashId(`${rowId}|${field}|source`) % 10;
  if (bucket <= 5) {
    return 'Utility';
  }
  if (bucket <= 8) {
    return 'Monitored';
  }
  return 'Manual';
}

export function getGroupDataSource(
  rows: TimelineRow[],
  utilityType: string,
  field: string,
): CellDataSource {
  const sources = new Set(
    rows
      .filter((row) => row.utility_type === utilityType && typeof row[field] === 'number')
      .map((row) => getCellDataSource(row.id, field)),
  );
  if (sources.size === 0) {
    return 'Utility';
  }
  if (sources.size === 1) {
    return [...sources][0]!;
  }
  return 'Mixed';
}
