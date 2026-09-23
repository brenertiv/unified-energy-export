import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DEFAULT_HEATMAP_EASE, evaluateCubicBezier } from '../lib/cubicBezier';
import { formatHeatmapThreshold } from '../lib/heatmap';

const WIDTH = 180;
const HEIGHT = 52;
const PAD_X = 10;
const PAD_Y = 12;
const PLOT_W = WIDTH - PAD_X * 2;
const PLOT_H = HEIGHT - PAD_Y * 2;
const HANDLE_R = 6;
const HIT_R = 12;
const SAMPLES = 24;
const NUDGE = 0.02;
const NUDGE_FAST = 0.1;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function toSvgX(x: number) {
  return PAD_X + x * PLOT_W;
}

function toSvgY(y: number) {
  return PAD_Y + (1 - y) * PLOT_H;
}

function rampY(x: number, threshold: number) {
  if (x <= threshold) {
    return 0;
  }
  const span = 1 - threshold;
  const t = span <= 0 ? 1 : (x - threshold) / span;
  return evaluateCubicBezier(clamp01(t), DEFAULT_HEATMAP_EASE);
}

function rampPath(threshold: number) {
  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const x = i / SAMPLES;
    const command = i === 0 ? 'M' : 'L';
    points.push(`${command} ${toSvgX(x)} ${toSvgY(rampY(x, threshold))}`);
  }
  return points.join(' ');
}

function rampArea(threshold: number) {
  const line = rampPath(threshold);
  return `${line} L ${toSvgX(1)} ${toSvgY(0)} L ${toSvgX(threshold)} ${toSvgY(0)} Z`;
}

export function ThresholdSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);
  const threshold = clamp01(value);

  const setFromClientX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) * (WIDTH / rect.width);
    onChange(clamp01((x - PAD_X) / PLOT_W));
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    setFromClientX(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) {
      return;
    }
    setFromClientX(event.clientX);
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragging.current = false;
  };

  const onKeyDown = (event: KeyboardEvent<SVGCircleElement>) => {
    const step = event.shiftKey ? NUDGE_FAST : NUDGE;
    event.stopPropagation();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(clamp01(threshold - step));
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(clamp01(threshold + step));
    }
  };

  const thumbX = toSvgX(threshold);
  const thumbY = toSvgY(0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ userSelect: 'none' }}>
        Outlier Threshold
      </Typography>
      <Box
        component="svg"
        ref={svgRef}
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMinYMid meet"
        role="group"
        aria-label="Outlier threshold"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        sx={{
          display: 'block',
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          boxShadow: 'inset 0 0 0 1px oklch(0 0 0 / 0.1)',
          touchAction: 'none',
          userSelect: 'none',
          cursor: 'ew-resize',
          '& [role="slider"]:focus-visible': {
            outline: '2px solid currentColor',
            outlineOffset: 2,
          },
        }}
      >
        <line
          x1={toSvgX(0)}
          y1={toSvgY(0)}
          x2={toSvgX(1)}
          y2={toSvgY(0)}
          stroke="oklch(0 0 0 / 0.1)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {threshold < 1 ? <path d={rampArea(threshold)} fill="oklch(0.32 0.04 255 / 0.12)" /> : null}
        <path d={rampPath(threshold)} fill="none" stroke="oklch(0.32 0.04 255)" strokeWidth={2} strokeLinecap="round" />
        <line
          x1={thumbX}
          y1={toSvgY(1)}
          x2={thumbX}
          y2={toSvgY(0)}
          stroke="oklch(0 0 0 / 0.2)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <circle cx={thumbX} cy={thumbY} r={HIT_R} fill="transparent" />
        <circle
          cx={thumbX}
          cy={thumbY}
          r={HANDLE_R}
          fill="#fff"
          stroke="oklch(0.32 0.04 255)"
          strokeWidth={2}
          role="slider"
          tabIndex={0}
          aria-label="Outlier threshold"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(threshold * 100)}
          aria-valuetext={formatHeatmapThreshold(threshold)}
          onKeyDown={onKeyDown}
        />
      </Box>
    </Box>
  );
}
