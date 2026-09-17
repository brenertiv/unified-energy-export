import type { PeriodColumn, TimelineRow } from './parseUsageCsv';

const PREFERRED_UTILITY_ORDER = ['Electricity', 'Water', 'Natural Gas'];

export function fieldSumForUtility(rows: TimelineRow[], utilityType: string, field: string) {
  return rows
    .filter((row) => row.utility_type === utilityType)
    .reduce((sum, row) => {
      const value = row[field];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
}

export function uniqueUtilities(rows: TimelineRow[]): string[] {
  const present = [...new Set(rows.map((row) => String(row.utility_type)).filter(Boolean))];
  const preferred = PREFERRED_UTILITY_ORDER.filter((utility) => present.includes(utility));
  const rest = present.filter((utility) => !PREFERRED_UTILITY_ORDER.includes(utility)).sort();
  return [...preferred, ...rest];
}

export function completeBuildingUtilityRows(rows: TimelineRow[]): TimelineRow[] {
  const utilities = uniqueUtilities(rows);
  const properties = new Map<string, Pick<TimelineRow, 'portfolio' | 'property' | 'address'>>();
  const unitByUtility = new Map<string, string>();
  const existingIds = new Set<string>();

  for (const row of rows) {
    existingIds.add(row.id);
    const property = String(row.property);
    if (property && !properties.has(property)) {
      properties.set(property, {
        portfolio: row.portfolio,
        property: row.property,
        address: row.address,
      });
    }
    const utility = String(row.utility_type);
    if (utility && row.unit && !unitByUtility.has(utility)) {
      unitByUtility.set(utility, String(row.unit));
    }
  }

  const completed = [...rows];
  for (const meta of properties.values()) {
    for (const utility of utilities) {
      const id = `${meta.property}|${utility}`;
      if (existingIds.has(id)) {
        continue;
      }
      completed.push({
        id,
        portfolio: meta.portfolio,
        property: meta.property,
        address: meta.address,
        utility_type: utility,
        unit: unitByUtility.get(utility) ?? '',
      });
    }
  }

  return completed.sort((a, b) => {
    const utilityDelta = utilities.indexOf(String(a.utility_type)) - utilities.indexOf(String(b.utility_type));
    if (utilityDelta !== 0) {
      return utilityDelta;
    }
    return String(a.property).localeCompare(String(b.property));
  });
}

export function unitForUtility(rows: TimelineRow[], utilityType: string): string {
  const match = rows.find((row) => row.utility_type === utilityType);
  return match ? String(match.unit) : '';
}

export function periodVolumes(
  rows: TimelineRow[],
  periods: PeriodColumn[],
  utilityType: string,
): number[] {
  return periods.map((period) => fieldSumForUtility(rows, utilityType, period.field));
}

export type UtilityGroup = {
  utility: string;
  unit: string;
  rows: TimelineRow[];
};

export function groupRowsByUtility(rows: TimelineRow[]): UtilityGroup[] {
  return uniqueUtilities(rows).map((utility) => ({
    utility,
    unit: unitForUtility(rows, utility),
    rows: rows.filter((row) => row.utility_type === utility),
  }));
}

export function sumFieldSameUnit(rows: TimelineRow[], field: string): number | null {
  const present = rows.flatMap((row) => {
    const value = row[field];
    if (typeof value !== 'number' || !row.unit) {
      return [];
    }
    return [{ value, unit: String(row.unit) }];
  });
  if (present.length === 0) {
    return null;
  }
  const units = new Set(present.map((item) => item.unit));
  if (units.size > 1) {
    return null;
  }
  return present.reduce((total, item) => total + item.value, 0);
}
