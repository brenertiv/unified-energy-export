import { useId, useState } from 'react';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { formatWindowRangeLabel } from '../lib/periodLabel';
import type { PeriodColumn } from '../lib/parseUsageCsv';
import {
  fromDateInputValue,
  rangeFromDates,
  toDateInputValue,
  type WindowRange,
} from '../lib/periodWindow';

const rangeSelectSx = {
  minWidth: 228,
  '& .MuiInputBase-root': { fontSize: 13 },
  '& .MuiInputLabel-root': { fontSize: 13 },
} as const;

type PeriodRangePickerProps = {
  periods: PeriodColumn[];
  value: WindowRange;
  onChange: (value: WindowRange) => void;
};

export function PeriodRangePicker({ periods, value, onChange }: PeriodRangePickerProps) {
  const labelId = useId();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const startPeriod = periods[value[0]];
  const endPeriod = periods[value[1]];
  const firstPeriod = periods[0];
  const lastPeriod = periods[periods.length - 1];
  const disabled = periods.length === 0 || !startPeriod || !endPeriod;
  const rangeText =
    startPeriod && endPeriod ? formatWindowRangeLabel(startPeriod.start, endPeriod.end) : '';
  const min = firstPeriod ? toDateInputValue(firstPeriod.start) : undefined;
  const max = lastPeriod ? toDateInputValue(lastPeriod.end) : undefined;
  const startValue = startPeriod ? toDateInputValue(startPeriod.start) : '';
  const endValue = endPeriod ? toDateInputValue(endPeriod.end) : '';
  const open = Boolean(anchorEl);

  const applyDate = (nextStart: string, nextEnd: string) => {
    const startDate = fromDateInputValue(nextStart);
    const endDate = fromDateInputValue(nextEnd);
    if (!startDate || !endDate) {
      return;
    }
    onChange(rangeFromDates(periods, startDate, endDate));
  };

  return (
    <>
      <FormControl size="small" sx={rangeSelectSx} disabled={disabled}>
        <InputLabel id={labelId} shrink>
          Range
        </InputLabel>
        <OutlinedInput
          notched
          label="Range"
          readOnly
          value={rangeText}
          onClick={(event) => {
            if (disabled) {
              return;
            }
            setAnchorEl(event.currentTarget);
          }}
          inputProps={{
            'aria-labelledby': labelId,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-controls': open ? 'period-range-popover' : undefined,
          }}
          endAdornment={
            <InputAdornment position="end" sx={{ mr: -0.25 }}>
              <CalendarMonthIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            </InputAdornment>
          }
          sx={{
            cursor: disabled ? 'default' : 'pointer',
            '& input': {
              cursor: 'inherit',
              fontVariantNumeric: 'tabular-nums',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
          }}
        />
      </FormControl>
      <Popover
        id="period-range-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: { sx: { mt: 0.5, p: 1.5 } },
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <TextField
            type="date"
            size="small"
            label="Start"
            value={startValue}
            onChange={(event) => applyDate(event.target.value, endValue)}
            slotProps={{
              htmlInput: { min, max },
              inputLabel: { shrink: true },
            }}
            sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}
          />
          <TextField
            type="date"
            size="small"
            label="End"
            value={endValue}
            onChange={(event) => applyDate(startValue, event.target.value)}
            slotProps={{
              htmlInput: { min, max },
              inputLabel: { shrink: true },
            }}
            sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}
          />
        </Stack>
      </Popover>
    </>
  );
}
