const GOOD_HUE = 255;
const BAD_HUE = 25;
const FULL_AT = 0.45;
const MIN_INTENSITY = 0.1;
const EASE = 1.6;

function fill(hue: number, intensity: number): string {
  const t = Math.min(1, Math.max(0, intensity));
  const lightness = 0.94 - t * 0.14;
  const chroma = 0.05 + t * 0.09;
  const alpha = 0.4 + t * 0.38;
  return `oklch(${lightness} ${chroma} ${hue} / ${alpha})`;
}

export function heatmapFill(relative: number | null): string | undefined {
  if (relative == null || Math.round(relative * 100) === 0) {
    return undefined;
  }
  const raw = Math.min(1, Math.abs(relative) / FULL_AT);
  const intensity = MIN_INTENSITY + Math.pow(raw, EASE) * (1 - MIN_INTENSITY);
  return fill(relative < 0 ? GOOD_HUE : BAD_HUE, intensity);
}

export function formatVsBaseline(
  relative: number | null,
  mode: 'building' | 'peer',
): string | undefined {
  if (relative == null) {
    return undefined;
  }
  const label = mode === 'building' ? 'building avg' : 'peer avg';
  const percent = Math.round(relative * 100);
  if (percent === 0) {
    return `At ${label}`;
  }
  if (percent < 0) {
    return `${Math.abs(percent)}% below ${label}`;
  }
  return `${percent}% above ${label}`;
}
