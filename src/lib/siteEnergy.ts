import type { PeriodColumn, TimelineRow } from './parseUsageCsv';

export const SITE_ENERGY_UTILITY = 'Energy';
export const SITE_ENERGY_UNIT = 'kBtu';

const KWH_TO_KBTU = 3.412;
const THERM_TO_KBTU = 100;

function isElectricity(utilityType: string): boolean {
  return utilityType.toLowerCase().includes('electric');
}

function isNaturalGas(utilityType: string): boolean {
  return utilityType.toLowerCase().includes('gas');
}

export function toSiteEnergyKbtu(value: number, unit: string): number | undefined {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'kwh') {
    return value * KWH_TO_KBTU;
  }
  if (normalized === 'thm' || normalized === 'therm' || normalized === 'therms') {
    return value * THERM_TO_KBTU;
  }
  if (normalized === 'kbtu' || normalized === 'kbtus') {
    return value;
  }
  return undefined;
}

function addConverted(total: number | undefined, row: TimelineRow | undefined, field: string): number | undefined {
  if (!row) {
    return total;
  }
  const value = row[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return total;
  }
  const converted = toSiteEnergyKbtu(value, String(row.unit ?? ''));
  if (converted == null) {
    return total;
  }
  return (total ?? 0) + converted;
}

export function withSiteEnergyRows(rows: TimelineRow[], periods: PeriodColumn[]): TimelineRow[] {
  if (rows.some((row) => row.utility_type === SITE_ENERGY_UTILITY)) {
    return rows;
  }

  const byProperty = new Map<string, { electric?: TimelineRow; gas?: TimelineRow }>();
  for (const row of rows) {
    const utility = String(row.utility_type);
    const property = String(row.property);
    if (!property) {
      continue;
    }
    const current = byProperty.get(property) ?? {};
    if (isElectricity(utility)) {
      current.electric = row;
    } else if (isNaturalGas(utility)) {
      current.gas = row;
    } else {
      continue;
    }
    byProperty.set(property, current);
  }

  const fields = periods.flatMap((period) => [period.field, period.priorField]);
  const energyRows: TimelineRow[] = [];

  for (const [property, sources] of byProperty) {
    const template = sources.electric ?? sources.gas;
    if (!template) {
      continue;
    }

    const energy: TimelineRow = {
      id: `${property}|${SITE_ENERGY_UTILITY}`,
      portfolio: template.portfolio,
      property: template.property,
      address: template.address,
      utility_type: SITE_ENERGY_UTILITY,
      unit: SITE_ENERGY_UNIT,
    };

    let hasValue = false;
    for (const field of fields) {
      const total = addConverted(undefined, sources.electric, field);
      const combined = addConverted(total, sources.gas, field);
      if (combined == null) {
        continue;
      }
      energy[field] = Math.round(combined);
      hasValue = true;
    }

    if (hasValue) {
      energyRows.push(energy);
    }
  }

  energyRows.sort((a, b) => String(a.property).localeCompare(String(b.property)));
  return [...rows, ...energyRows];
}
