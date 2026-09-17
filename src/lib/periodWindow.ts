export type WindowPreset = 6 | 12;
export type WindowRange = [number, number];

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
