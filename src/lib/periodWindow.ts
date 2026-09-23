import type { PeriodColumn } from './parseUsageCsv';

export type WindowPreset = 6 | 12;
export type WindowRange = [number, number];

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateInputValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function rangeFromDates(periods: PeriodColumn[], startDate: Date, endDate: Date): WindowRange {
  if (periods.length === 0) {
    return [0, 0];
  }

  const startMs = Math.min(startDate.getTime(), endDate.getTime());
  const endMs = Math.max(startDate.getTime(), endDate.getTime());

  let startIndex = periods.findIndex((period) => period.end.getTime() >= startMs);
  if (startIndex < 0) {
    startIndex = periods.length - 1;
  }

  let endIndex = 0;
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    if (periods[index].start.getTime() <= endMs) {
      endIndex = index;
      break;
    }
  }

  return startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
}

export function presetFromRange(startIndex: number, endIndex: number): WindowPreset | null {
  const length = endIndex - startIndex + 1;
  return length === 6 || length === 12 ? length : null;
}

export function applyPreset(endIndex: number, months: WindowPreset, lastIndex: number): WindowRange {
  const length = months;
  let start = endIndex - (length - 1);
  let end = endIndex;
  if (start < 0) {
    start = 0;
    end = Math.min(length - 1, lastIndex);
  }
  if (end > lastIndex) {
    end = lastIndex;
    start = Math.max(0, end - (length - 1));
  }
  return [start, end];
}

export function defaultWindowRange(periodCount: number): WindowRange {
  if (periodCount <= 0) {
    return [0, 0];
  }
  const last = periodCount - 1;
  return applyPreset(last, 12, last);
}

export function shiftWindow(range: WindowRange, delta: number, min: number, max: number): WindowRange {
  const duration = range[1] - range[0];
  let start = range[0] + delta;
  let end = range[1] + delta;
  if (start < min) {
    start = min;
    end = Math.min(min + duration, max);
  } else if (end > max) {
    end = max;
    start = Math.max(max - duration, min);
  }
  return [start, end];
}
