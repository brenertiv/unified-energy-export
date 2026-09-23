export type CubicBezier = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export const DEFAULT_HEATMAP_EASE: CubicBezier = {
  x1: 0.55,
  y1: 0.085,
  x2: 0.68,
  y2: 0.53,
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function sampleCurve(t: number, p1: number, p2: number) {
  const oneMinusT = 1 - t;
  return 3 * oneMinusT * oneMinusT * t * p1 + 3 * oneMinusT * t * t * p2 + t * t * t;
}

function sampleCurveDerivative(t: number, p1: number, p2: number) {
  const oneMinusT = 1 - t;
  return 3 * oneMinusT * oneMinusT * p1 + 6 * oneMinusT * t * (p2 - p1) + 3 * t * t * (1 - p2);
}

function solveTForX(x: number, x1: number, x2: number) {
  let t = x;
  for (let i = 0; i < 8; i += 1) {
    const current = sampleCurve(t, x1, x2) - x;
    if (Math.abs(current) < 1e-6) {
      return t;
    }
    const derivative = sampleCurveDerivative(t, x1, x2);
    if (Math.abs(derivative) < 1e-6) {
      break;
    }
    t = clamp01(t - current / derivative);
  }

  let low = 0;
  let high = 1;
  t = x;
  for (let i = 0; i < 12; i += 1) {
    const current = sampleCurve(t, x1, x2);
    if (Math.abs(current - x) < 1e-6) {
      return t;
    }
    if (current < x) {
      low = t;
    } else {
      high = t;
    }
    t = (low + high) / 2;
  }
  return t;
}

export function evaluateCubicBezier(t: number, curve: CubicBezier) {
  const x = clamp01(t);
  if (x === 0 || x === 1) {
    return x;
  }
  const param = solveTForX(x, curve.x1, curve.x2);
  return clamp01(sampleCurve(param, curve.y1, curve.y2));
}

export function formatCubicBezier(curve: CubicBezier) {
  const n = (value: number) => value.toFixed(2);
  return `cubic-bezier(${n(curve.x1)}, ${n(curve.y1)}, ${n(curve.x2)}, ${n(curve.y2)})`;
}
