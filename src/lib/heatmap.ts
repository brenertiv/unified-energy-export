import { DEFAULT_HEATMAP_EASE, evaluateCubicBezier } from './cubicBezier';

export const DEFAULT_HEATMAP_HUE = 25;
export const DEFAULT_HEATMAP_THRESHOLD = 0;
export const HEATMAP_FULL_AT = 0.45;
const LESS_HUE_OFFSET = 230;
const FULL_AT = HEATMAP_FULL_AT;
const MIN_INTENSITY = 0.1;
const WCAG_AA_TEXT = 4.5;
const SURFACE: Rgb = [1, 1, 1];
const INK_DARK: Rgb = [0, 0, 0];
const INK_LIGHT: Rgb = [1, 1, 1];
const INK_DARK_CSS = 'oklch(0.2 0 0)';
const INK_LIGHT_CSS = 'oklch(1 0 0)';

export function wrapHue(hue: number) {
  return ((hue % 360) + 360) % 360;
}

export function heatmapPair(moreHue = DEFAULT_HEATMAP_HUE) {
  const more = wrapHue(moreHue);
  return { less: wrapHue(more + LESS_HUE_OFFSET), more };
}

export function heatmapLegendGradient(moreHue = DEFAULT_HEATMAP_HUE) {
  const { less, more } = heatmapPair(moreHue);
  return `linear-gradient(to right in oklab, oklch(0.4 0.22 ${less}), oklch(0.97 0.005 0), oklch(0.4 0.22 ${more}))`;
}

type Rgb = [number, number, number];

type FillSwatch = {
  css: string;
  rgb: Rgb;
  alpha: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function rawFromRelative(relative: number) {
  return Math.min(1, Math.abs(relative) / FULL_AT);
}

export function heatmapPassesThreshold(relative: number | null, threshold = DEFAULT_HEATMAP_THRESHOLD) {
  if (relative == null || Math.round(relative * 100) === 0) {
    return false;
  }
  return rawFromRelative(relative) > clamp01(threshold);
}

function intensityFromRelative(relative: number, threshold: number) {
  const raw = rawFromRelative(relative);
  const gate = clamp01(threshold);
  const span = 1 - gate;
  const t = span <= 0 ? 1 : (raw - gate) / span;
  return MIN_INTENSITY + evaluateCubicBezier(clamp01(t), DEFAULT_HEATMAP_EASE) * (1 - MIN_INTENSITY);
}

export function formatHeatmapThreshold(threshold: number) {
  const percent = Math.round(clamp01(threshold) * FULL_AT * 100);
  return `Below ${percent}% vs avg`;
}

function fillSwatch(hue: number, intensity: number, alphaScale = 1): FillSwatch {
  const t = clamp01(intensity);
  const lightness = 0.94 - t * 0.54;
  const chroma = 0.05 + t * 0.17;
  const alpha = clamp01((0.4 + t * 0.6) * alphaScale);
  return {
    css: `oklch(${lightness} ${chroma} ${hue} / ${alpha})`,
    rgb: oklchToSrgb(lightness, chroma, hue),
    alpha,
  };
}

function swatchForRelative(
  relative: number,
  alphaScale = 1,
  moreHue = DEFAULT_HEATMAP_HUE,
  threshold = DEFAULT_HEATMAP_THRESHOLD,
) {
  const { less, more } = heatmapPair(moreHue);
  return fillSwatch(relative < 0 ? less : more, intensityFromRelative(relative, threshold), alphaScale);
}

function yoyTone(relative: number, invert: boolean, moreHue: number) {
  const { less, more } = heatmapPair(moreHue);
  const hue = relative < 0 ? less : more;
  if (invert) {
    return {
      lightness: 0.96,
      chroma: relative < 0 ? 0.05 : 0.06,
      hue,
    };
  }
  return {
    lightness: 0.32,
    chroma: relative < 0 ? 0.12 : 0.13,
    hue,
  };
}

function composite(src: Rgb, alpha: number, dest: Rgb): Rgb {
  return [
    src[0] * alpha + dest[0] * (1 - alpha),
    src[1] * alpha + dest[1] * (1 - alpha),
    src[2] * alpha + dest[2] * (1 - alpha),
  ];
}

function channelLuminance(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: Rgb) {
  return 0.2126 * channelLuminance(rgb[0]) + 0.7152 * channelLuminance(rgb[1]) + 0.0722 * channelLuminance(rgb[2]);
}

function contrastRatio(foreground: Rgb, background: Rgb) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function oklchToSrgb(lightness: number, chroma: number, hue: number): Rgb {
  const hueRad = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hueRad);
  const b = chroma * Math.sin(hueRad);
  const l_ = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const encode = (channel: number) => {
    const clipped = clamp01(channel);
    return clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
  };
  return [encode(r), encode(g), encode(blue)];
}

function oklchCss(lightness: number, chroma: number, hue: number) {
  return `oklch(${lightness} ${chroma} ${hue})`;
}

function inkForBackground(background: Rgb): { invert: boolean; color: string } {
  const invert = contrastRatio(INK_DARK, background) < WCAG_AA_TEXT;
  return {
    invert,
    color: invert ? INK_LIGHT_CSS : INK_DARK_CSS,
  };
}

function renderedFill(swatch: FillSwatch): Rgb {
  return composite(swatch.rgb, swatch.alpha, SURFACE);
}

export function heatmapFill(
  relative: number | null,
  muted = false,
  moreHue = DEFAULT_HEATMAP_HUE,
  threshold = DEFAULT_HEATMAP_THRESHOLD,
): string | undefined {
  return heatmapAppearance(relative, muted, moreHue, threshold).fill;
}

export function heatmapAppearance(
  relative: number | null,
  muted = false,
  moreHue = DEFAULT_HEATMAP_HUE,
  threshold = DEFAULT_HEATMAP_THRESHOLD,
): { fill?: string; color?: string; invert: boolean } {
  if (!heatmapPassesThreshold(relative, threshold)) {
    return { invert: false };
  }
  const swatch = swatchForRelative(relative, muted ? 0.5 : 1, moreHue, threshold);
  const ink = inkForBackground(renderedFill(swatch));
  return {
    fill: swatch.css,
    color: ink.color,
    invert: ink.invert,
  };
}

export function heatmapYoyColor(
  relative: number,
  cellRelative: number | null,
  moreHue = DEFAULT_HEATMAP_HUE,
  threshold = DEFAULT_HEATMAP_THRESHOLD,
): string | undefined {
  if (cellRelative == null || !heatmapPassesThreshold(cellRelative, threshold)) {
    if (relative === 0) {
      return undefined;
    }
    const yoy = yoyTone(relative, false, moreHue);
    return oklchCss(yoy.lightness, yoy.chroma, yoy.hue);
  }
  const background = renderedFill(swatchForRelative(cellRelative, 1, moreHue, threshold));
  const invert = contrastRatio(INK_DARK, background) < WCAG_AA_TEXT;
  const cellInk = invert ? INK_LIGHT_CSS : INK_DARK_CSS;
  if (relative === 0) {
    return cellInk;
  }
  const yoy = yoyTone(relative, invert, moreHue);
  const candidate = oklchToSrgb(yoy.lightness, yoy.chroma, yoy.hue);
  if (contrastRatio(candidate, background) >= WCAG_AA_TEXT) {
    return oklchCss(yoy.lightness, yoy.chroma, yoy.hue);
  }
  return cellInk;
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
