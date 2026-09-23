import { useMemo, useRef, useState, type PointerEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatPeriodLabel, formatWindowEdgeLabel, formatWindowRangeLabel } from '../lib/periodLabel';
import type { PeriodColumn } from '../lib/parseUsageCsv';
import {
  applyPreset,
  presetFromRange,
  shiftWindow,
  type WindowPreset,
  type WindowRange,
} from '../lib/periodWindow';

const MARK_STEP = 4;
const VOLUME_PANE_HEIGHT = 48;

function selectorButtonSx(selected: boolean) {
  return {
    textTransform: 'none',
    minWidth: 0,
    minHeight: 22,
    px: 0.75,
    py: 0,
    fontSize: 11,
    lineHeight: 1.2,
    fontWeight: selected ? 600 : 500,
    color: selected ? 'text.primary' : 'text.secondary',
    bgcolor: selected ? 'grey.200' : 'grey.100',
    '&:hover': {
      bgcolor: selected ? 'grey.300' : 'grey.200',
    },
  } as const;
}

type PeriodWindowSliderProps = {
  periods: PeriodColumn[];
  value: WindowRange;
  onChange: (value: WindowRange) => void;
  volumes: number[];
};

function periodEdgeLabel(periods: PeriodColumn[], periodIndex: number, thumbIndex: number) {
  const period = periods[periodIndex];
  if (!period) {
    return '';
  }
  return formatWindowEdgeLabel(thumbIndex === 0 ? period.start : period.end);
}

function selectedPeriodLabel(periods: PeriodColumn[], range: WindowRange) {
  const start = periods[range[0]]?.start;
  const end = periods[range[1]]?.end;
  if (!start || !end) {
    return '';
  }
  return formatWindowRangeLabel(start, end);
}

function VolumeBars({
  volumes,
  windowStart,
  windowEnd,
}: {
  volumes: number[];
  windowStart: number;
  windowEnd: number;
}) {
  const peak = Math.max(0, ...volumes);
  return (
    <Box
      aria-hidden
      sx={{
        height: VOLUME_PANE_HEIGHT,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '2px',
        pointerEvents: 'none',
      }}
    >
      {volumes.map((volume, index) => {
        const inWindow = index >= windowStart && index <= windowEnd;
        const height = peak > 0 ? `${(volume / peak) * 100}%` : '0%';
        return (
          <Box
            key={index}
            sx={{
              flex: 1,
              minWidth: 0,
              height,
              borderRadius: '2px 2px 0 0',
              bgcolor: 'primary.main',
              opacity: inWindow ? 0.72 : 0.22,
            }}
          />
        );
      })}
    </Box>
  );
}

export function PeriodWindowSlider({
  periods,
  value,
  onChange,
  volumes,
}: PeriodWindowSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    originX: number;
    originRange: WindowRange;
    span: number;
  } | null>(null);
  const [panning, setPanning] = useState(false);

  const lastIndex = Math.max(periods.length - 1, 0);
  const activePreset = presetFromRange(value[0], value[1]);
  const disabled = periods.length === 0;

  const marks = useMemo(
    () => periods.map((_, index) => ({ value: index })),
    [periods],
  );

  const axisLabels = useMemo(() => {
    if (periods.length === 0) {
      return [];
    }
    return periods.flatMap((period, index) => {
      const labeled = index === 0 || index === lastIndex || index % MARK_STEP === 0;
      if (!labeled) {
        return [];
      }
      return [
        {
          index,
          label: formatPeriodLabel(period.start),
          align: index === 0 ? 'flex-start' : index === lastIndex ? 'flex-end' : 'center',
          left: lastIndex === 0 ? 0 : (index / lastIndex) * 100,
        } as const,
      ];
    });
  }, [lastIndex, periods]);

  const handleSliderChange = (_event: Event, next: number | number[]) => {
    if (!Array.isArray(next) || next.length < 2) {
      return;
    }
    onChange([next[0], next[1]]);
  };

  const handlePreset = (months: WindowPreset) => {
    if (periods.length === 0) {
      return;
    }
    onChange(applyPreset(value[1], months, lastIndex));
  };

  const handleTrackPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || disabled) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    const rail = sliderRef.current?.querySelector('.MuiSlider-rail');
    const rect = (rail instanceof HTMLElement ? rail : event.currentTarget).getBoundingClientRect();
    panRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originRange: value,
      span: Math.max(rect.width, 1),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  };

  const handleTrackPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const pan = panRef.current;
    if (!pan || event.pointerId !== pan.pointerId) {
      return;
    }
    const delta = Math.round(((event.clientX - pan.originX) / pan.span) * lastIndex);
    onChange(shiftWindow(pan.originRange, delta, 0, lastIndex));
  };

  const endPan = (event: PointerEvent<HTMLSpanElement>) => {
    if (!panRef.current || event.pointerId !== panRef.current.pointerId) {
      return;
    }
    panRef.current = null;
    setPanning(false);
  };

  const rangeText = selectedPeriodLabel(periods, value);

  return (
    <Stack
      spacing={0.5}
      sx={{
        px: 1.5,
        pt: 1,
        pb: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography
          id="date-window-label"
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        >
          {rangeText}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 12 }} />
        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
          <Typography
            id="window-length-label"
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: 11, lineHeight: 1.2, whiteSpace: 'nowrap' }}
          >
            Window
          </Typography>
          <Stack direction="row" sx={{ gap: '2px' }} role="group" aria-labelledby="window-length-label">
            <Button
              size="small"
              variant="text"
              color="inherit"
              disabled={disabled}
              disableElevation
              aria-pressed={activePreset === 6}
              onClick={() => handlePreset(6)}
              sx={selectorButtonSx(activePreset === 6)}
            >
              6 months
            </Button>
            <Button
              size="small"
              variant="text"
              color="inherit"
              disabled={disabled}
              disableElevation
              aria-pressed={activePreset === 12}
              onClick={() => handlePreset(12)}
              sx={selectorButtonSx(activePreset === 12)}
            >
              12 months
            </Button>
          </Stack>
        </Stack>
      </Stack>
      <Box
        ref={sliderRef}
        role="group"
        aria-labelledby="date-window-label"
        sx={{ px: { xs: 1, sm: 2 }, pt: 3.25, pb: 1.25 }}
      >
        <Box sx={{ position: 'relative', height: VOLUME_PANE_HEIGHT }}>
          <Box sx={{ position: 'absolute', inset: 0 }}>
            <VolumeBars volumes={volumes} windowStart={value[0]} windowEnd={value[1]} />
          </Box>
          <Slider
            value={value}
            min={0}
            max={lastIndex}
            step={1}
            marks={marks}
            disableSwap
            disabled={disabled}
            valueLabelDisplay="on"
            valueLabelFormat={(periodIndex, thumbIndex) => periodEdgeLabel(periods, periodIndex, thumbIndex)}
            getAriaLabel={(index) => (index === 0 ? 'Window start' : 'Window end')}
            getAriaValueText={(periodIndex, thumbIndex) => periodEdgeLabel(periods, periodIndex, thumbIndex)}
            onChange={handleSliderChange}
            slotProps={{
              track: {
                onPointerDown: handleTrackPointerDown,
                onPointerMove: handleTrackPointerMove,
                onPointerUp: endPan,
                onPointerCancel: endPan,
              },
            }}
            sx={{
              height: VOLUME_PANE_HEIGHT,
              padding: 0,
              '& .MuiSlider-rail': {
                height: 8,
                borderRadius: 99,
                top: 'auto',
                bottom: 0,
                transform: 'none',
                opacity: 0.28,
              },
              '& .MuiSlider-track': {
                height: 8,
                borderRadius: 99,
                top: 'auto',
                bottom: 0,
                transform: 'none',
                cursor: panning ? 'grabbing' : 'grab',
                touchAction: 'none',
              },
              '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
                zIndex: 1,
                top: 'auto',
                bottom: 4,
                transform: 'translate(-50%, 50%)',
              },
              '& .MuiSlider-mark': {
                top: 'auto',
                bottom: 2,
              },
              '& .MuiSlider-valueLabel': {
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
                pointerEvents: 'none',
              },
            }}
          />
        </Box>
        <Box sx={{ position: 'relative', height: 18, mt: 0.75 }}>
          {axisLabels.map((tick) => (
            <Typography
              key={tick.index}
              variant="caption"
              color="text.secondary"
              sx={{
                position: 'absolute',
                left: `${tick.left}%`,
                transform:
                  tick.align === 'flex-start'
                    ? 'none'
                    : tick.align === 'flex-end'
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
                fontSize: 11,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {tick.label}
            </Typography>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}
