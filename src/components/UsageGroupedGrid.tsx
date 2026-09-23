import { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import Papa from 'papaparse';
import {
  fieldSumForUtility,
  groupRowsByUtility,
  periodVolumes,
  sumFieldSameUnit,
  uniqueUtilities,
} from '../lib/aggregations';
import {
  createBaselines,
  getCellBaseline,
  getUtilityGroupBaseline,
  relativeToBaseline,
  type BaselineMode,
} from '../lib/baselines';
import { getCellDataSource, getGroupDataSource, type CellDataSource } from '../lib/dataSource';
import {
  DEFAULT_HEATMAP_HUE,
  DEFAULT_HEATMAP_THRESHOLD,
  heatmapAppearance,
  heatmapLegendGradient,
  heatmapYoyColor,
} from '../lib/heatmap';
import { formatPeriodLabel } from '../lib/periodLabel';
import type { PeriodColumn, TimelineRow } from '../lib/parseUsageCsv';
import { defaultWindowRange, type WindowRange } from '../lib/periodWindow';
import { withSiteEnergyRows } from '../lib/siteEnergy';
import { type DataMode } from '../lib/weatherNormalize';
import { PeriodRangePicker } from './PeriodRangePicker';
import { PeriodWindowSlider } from './PeriodWindowSlider';
import { ThresholdSlider } from './ThresholdSlider';

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const UTILITY_COL_WIDTH = 220;
const PERIOD_COL_WIDTH = 108;
const GROUP_HEADER_HEIGHT = 36;
const COLUMN_HEADER_HEIGHT = 40;
const ROW_HEIGHT = 52;
const STICKY_LABEL_LEFT = UTILITY_COL_WIDTH + 8;

const toolbarButtonSx = { textTransform: 'none' } as const;

const selectSx = {
  minWidth: 148,
  '& .MuiInputBase-root': { fontSize: 13 },
  '& .MuiInputLabel-root': { fontSize: 13 },
} as const;

const dataSelectSx = {
  ...selectSx,
  minWidth: 188,
} as const;

const heatmapSelectSx = {
  ...selectSx,
  minWidth: 188,
} as const;

const HUE_SLIDER_TRACK =
  'linear-gradient(to right in oklab, oklch(0.7 0.16 0), oklch(0.7 0.16 60), oklch(0.7 0.16 120), oklch(0.7 0.16 180), oklch(0.7 0.16 240), oklch(0.7 0.16 300), oklch(0.7 0.16 360))';

function stopMenuEvent(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

const utilitySelectSx = {
  ...selectSx,
  minWidth: 160,
} as const;

type HeatmapSelectValue = 'off' | BaselineMode;

type PeriodFieldColumn = {
  field: string;
  headerName: string;
  exportHeaderName: string;
  description?: string;
  prior: boolean;
  period: PeriodColumn;
};

type ColumnGroup = {
  id: string;
  headerName: string;
  children: PeriodFieldColumn[];
};

function formatConsumption(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return NUMBER_FORMAT.format(value);
}

function yoyChange(current: number | null | undefined, prior: number | undefined) {
  if (typeof current !== 'number' || prior == null || Number.isNaN(current)) {
    return undefined;
  }
  if (prior === 0) {
    if (current === 0) {
      return { relative: 0, label: '0%' };
    }
    return undefined;
  }
  const relative = (current - prior) / prior;
  const percent = Math.round(relative * 100);
  return {
    relative,
    label: percent > 0 ? `+${percent}%` : `${percent}%`,
  };
}

function vsBaselineDetail(relative: number | null): string | undefined {
  if (relative == null) {
    return undefined;
  }
  const percent = Math.round(relative * 100);
  if (percent === 0) {
    return 'At average';
  }
  if (percent < 0) {
    return `${Math.abs(percent)}% below`;
  }
  return `${percent}% above`;
}

function TooltipFact({ label, value }: { label: string; value: string }) {
  return (
    <Box component="div" sx={{ m: 0 }}>
      <Box
        component="dt"
        sx={{
          m: 0,
          fontSize: 11,
          lineHeight: 1.3,
          fontWeight: 400,
          color: 'oklch(1 0 0 / 0.72)',
        }}
      >
        {label}
      </Box>
      <Box
        component="dd"
        sx={{
          m: 0,
          mt: '1px',
          fontSize: 12,
          lineHeight: 1.35,
          fontWeight: 500,
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

function UsageCellTooltip({
  dataSource,
  vsBaselineLabel,
  vsBaseline,
}: {
  dataSource?: string;
  vsBaselineLabel?: string;
  vsBaseline?: string;
}) {
  if (!dataSource && !vsBaseline) {
    return 'No data';
  }

  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minWidth: 128,
      }}
    >
      {dataSource ? <TooltipFact label="Data source" value={dataSource} /> : null}
      {vsBaseline && vsBaselineLabel ? (
        <TooltipFact label={vsBaselineLabel} value={vsBaseline} />
      ) : null}
    </Box>
  );
}


function periodRangeDescription(start?: Date, end?: Date) {
  if (!start || !end) {
    return undefined;
  }
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function downloadFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toSpreadsheetXml(headers: string[], rows: Array<Array<string | number>>) {
  const cellXml = (value: string | number) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
    }
    return `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
  };
  const headerRow = `<Row>${headers.map((header) => cellXml(header)).join('')}</Row>`;
  const body = rows.map((row) => `<Row>${row.map((value) => cellXml(value)).join('')}</Row>`).join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Usage">
  <Table>
   ${headerRow}
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

const groupChevronButtonSx = {
  p: 0.25,
  '@media (prefers-reduced-motion: no-preference)': {
    '& .group-chevron': {
      transition: 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
    },
  },
} as const;

function GroupChevronButton({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <IconButton
      size="small"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      sx={groupChevronButtonSx}
    >
      <KeyboardArrowRightIcon
        className="group-chevron"
        fontSize="small"
        sx={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
      />
    </IconButton>
  );
}

function stickyUtilitySx(isHeader: boolean) {
  return {
    position: 'sticky',
    left: 0,
    zIndex: isHeader ? 4 : 3,
    width: UTILITY_COL_WIDTH,
    minWidth: UTILITY_COL_WIDTH,
    maxWidth: UTILITY_COL_WIDTH,
    bgcolor: 'background.paper',
    borderRight: 1,
    borderColor: 'divider',
    overflow: 'hidden',
    isolation: 'isolate',
  } as const;
}

function UsageCell({
  value,
  baseline,
  mode,
  applyFill,
  muted,
  heatmapHue,
  heatmapThreshold,
  priorValue,
  showYoyChange,
  dataSource,
  onSelect,
}: {
  value: number | null | undefined;
  baseline: number | undefined;
  mode: BaselineMode;
  applyFill: boolean;
  muted: boolean;
  heatmapHue: number;
  heatmapThreshold: number;
  priorValue?: number;
  showYoyChange: boolean;
  dataSource: CellDataSource;
  onSelect?: () => void;
}) {
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const formatted = formatConsumption(hasValue ? value : undefined);
  const yoy = hasValue && showYoyChange ? yoyChange(value, priorValue) : undefined;
  const relative = hasValue ? relativeToBaseline(value, baseline) : null;
  const appearance = applyFill && hasValue ? heatmapAppearance(relative, muted, heatmapHue, heatmapThreshold) : { invert: false };
  const fill = appearance.fill;
  const tooltip = hasValue ? (
    <UsageCellTooltip
      dataSource={dataSource}
      vsBaselineLabel={applyFill ? (mode === 'building' ? 'Building avg' : 'Peer avg') : undefined}
      vsBaseline={applyFill ? vsBaselineDetail(relative) : undefined}
    />
  ) : (
    'No data'
  );
  const content = (
    <>
      <Box component="span" sx={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}>
        {formatted}
      </Box>
      {yoy ? (
        <Box
          component="span"
          sx={{
            fontSize: 11,
            lineHeight: 1.2,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            color: heatmapYoyColor(yoy.relative, applyFill ? relative : null, heatmapHue, heatmapThreshold) ?? 'text.secondary',
          }}
        >
          {yoy.label}
        </Box>
      ) : null}
    </>
  );

  const cellSx = {
    width: '100%',
    height: '100%',
    minHeight: ROW_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: '1px',
    px: '10px',
    bgcolor: 'transparent',
    backgroundImage: fill ? `linear-gradient(${fill}, ${fill})` : 'none',
    color: fill ? appearance.color : muted ? 'text.secondary' : 'text.primary',
    opacity: muted && !fill ? 0.5 : 1,
    overflow: 'hidden',
  } as const;

  return (
    <Tooltip
      title={tooltip}
      enterDelay={400}
      disableInteractive
      slotProps={{
        tooltip: {
          sx: {
            px: 1.25,
            py: 1,
          },
        },
      }}
    >
      {hasValue && onSelect ? (
        <Box
          component="button"
          type="button"
          onClick={onSelect}
          sx={{
            ...cellSx,
            appearance: 'none',
            border: 0,
            margin: 0,
            font: 'inherit',
            textAlign: 'right',
            cursor: 'pointer',
          }}
        >
          {content}
        </Box>
      ) : (
        <Box sx={cellSx}>{content}</Box>
      )}
    </Tooltip>
  );
}

type UsageGroupedGridProps = {
  actualRows: TimelineRow[];
  normalizedRows: TimelineRow[];
  periods: PeriodColumn[];
};

export function UsageGroupedGrid({ actualRows, normalizedRows, periods }: UsageGroupedGridProps) {
  const [dataMode, setDataMode] = useState<DataMode>('actual');
  const [compareLastYear, setCompareLastYear] = useState(false);
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [heatmapHue, setHeatmapHue] = useState(DEFAULT_HEATMAP_HUE);
  const [heatmapThreshold, setHeatmapThreshold] = useState(DEFAULT_HEATMAP_THRESHOLD);
  const [baselineMode, setBaselineMode] = useState<BaselineMode>('building');
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [windowRange, setWindowRange] = useState<WindowRange>(() => defaultWindowRange(periods.length));
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedUtility, setSelectedUtility] = useState('Electricity');
  const [selectedUtilities, setSelectedUtilities] = useState<string[]>([]);
  const [collapsedUtilities, setCollapsedUtilities] = useState<Set<string>>(() => new Set());

  const sourceRows = dataMode === 'normalized' ? normalizedRows : actualRows;
  const rows = useMemo(() => withSiteEnergyRows(sourceRows, periods), [periods, sourceRows]);
  const baselines = useMemo(() => createBaselines(rows, periods), [rows, periods]);
  const utilities = useMemo(() => uniqueUtilities(rows), [rows]);
  const groups = useMemo(() => groupRowsByUtility(rows), [rows]);
  const currentSelection = selectedUtilities.length === 0 ? utilities : selectedUtilities;
  const visibleUtilities = useMemo(() => {
    const selected = utilities.filter((utility) => currentSelection.includes(utility));
    return selected.length > 0 ? selected : utilities;
  }, [currentSelection, utilities]);
  const visibleGroups = useMemo(
    () => groups.filter((group) => visibleUtilities.includes(group.utility)),
    [groups, visibleUtilities],
  );
  const volumeUtility = visibleUtilities.includes(selectedUtility)
    ? selectedUtility
    : (visibleUtilities[0] ?? '');
  const volumes = useMemo(
    () => periodVolumes(rows, periods, volumeUtility),
    [periods, rows, volumeUtility],
  );
  const visiblePeriods = useMemo(
    () => periods.slice(windowRange[0], windowRange[1] + 1),
    [periods, windowRange],
  );

  const columnGroups = useMemo<ColumnGroup[]>(() => {
    if (compareLastYear) {
      return visiblePeriods.map((period) => {
        const label = formatPeriodLabel(period.start);
        const current: PeriodFieldColumn = {
          field: period.field,
          headerName: 'Current',
          exportHeaderName: `${label} Current`,
          description: periodRangeDescription(period.start, period.end),
          prior: false,
          period,
        };
        const prior: PeriodFieldColumn = {
          field: period.priorField,
          headerName: 'Last year',
          exportHeaderName: `${label} Last year`,
          description: period.priorStart
            ? `${periodRangeDescription(period.priorStart, period.priorEnd)} · same 30-day window last year`
            : 'Same 30-day window last year',
          prior: true,
          period,
        };
        return {
          id: period.field,
          headerName: label,
          children: [current, prior],
        };
      });
    }

    const years = new Map<number, PeriodFieldColumn[]>();
    for (const period of visiblePeriods) {
      const year = period.start.getFullYear();
      const columns = years.get(year) ?? [];
      columns.push({
        field: period.field,
        headerName: formatPeriodLabel(period.start),
        exportHeaderName: formatPeriodLabel(period.start),
        description: periodRangeDescription(period.start, period.end),
        prior: false,
        period,
      });
      years.set(year, columns);
    }
    return [...years.entries()].map(([year, children]) => ({
      id: String(year),
      headerName: String(year),
      children,
    }));
  }, [compareLastYear, visiblePeriods]);

  const periodColumns = useMemo(
    () => columnGroups.flatMap((group) => group.children),
    [columnGroups],
  );

  const closeSourceDrawer = useCallback(() => {
    setSourceDrawerOpen(false);
  }, []);

  const openSourceDrawer = useCallback(() => {
    setSourceDrawerOpen(true);
  }, []);

  const anyGroupExpanded = visibleGroups.some((group) => !collapsedUtilities.has(group.utility));

  const setAllGroupExpansion = useCallback(
    (expanded: boolean) => {
      setCollapsedUtilities(expanded ? new Set() : new Set(visibleUtilities));
    },
    [visibleUtilities],
  );

  const handleUtilitySelection = useCallback((next: string[]) => {
    const allowed = next.filter((utility) => utilities.includes(utility));
    if (allowed.length === 0) {
      return;
    }
    const added = allowed.find((utility) => !currentSelection.includes(utility));
    setSelectedUtilities(allowed);
    if (added) {
      setSelectedUtility(added);
      return;
    }
    if (!allowed.includes(selectedUtility)) {
      setSelectedUtility(allowed[allowed.length - 1] ?? allowed[0]);
    }
  }, [currentSelection, selectedUtility, utilities]);

  const toggleUtility = useCallback((utility: string) => {
    setCollapsedUtilities((current) => {
      const next = new Set(current);
      if (next.has(utility)) {
        next.delete(utility);
      } else {
        next.add(utility);
      }
      return next;
    });
  }, []);

  const exportRows = useCallback(() => {
    const headers = ['Utility', 'Building', 'Unit', ...periodColumns.map((column) => column.exportHeaderName)];
    const data = visibleGroups.flatMap((group) =>
      group.rows.map((row) => [
        group.utility,
        String(row.property),
        String(row.unit),
        ...periodColumns.map((column) => {
          const value = row[column.field];
          return typeof value === 'number' && Number.isFinite(value) ? value : '';
        }),
      ]),
    );
    return { headers, data };
  }, [periodColumns, visibleGroups]);

  const downloadCsv = useCallback(() => {
    const { headers, data } = exportRows();
    downloadFile(
      'utilities-usage.csv',
      Papa.unparse({ fields: headers, data }),
      'text/csv;charset=utf-8',
    );
  }, [exportRows]);

  const downloadExcel = useCallback(() => {
    const { headers, data } = exportRows();
    downloadFile(
      'utilities-usage.xls',
      toSpreadsheetXml(headers, data),
      'application/vnd.ms-excel',
    );
  }, [exportRows]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          px: 1.5,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          alignItems: 'center',
          flexWrap: 'wrap',
          rowGap: 1,
        }}
      >
        <FormControl size="small" sx={utilitySelectSx}>
          <InputLabel id="utility-filter-label">Utility</InputLabel>
          <Select
            labelId="utility-filter-label"
            label="Utility"
            multiple
            value={visibleUtilities}
            onChange={(event) => {
              const value = event.target.value;
              handleUtilitySelection(typeof value === 'string' ? value.split(',') : value);
            }}
            renderValue={(selected) => {
              if (selected.length === utilities.length) {
                return 'All';
              }
              if (selected.length === 1) {
                return selected[0];
              }
              return `${selected.length} selected`;
            }}
          >
            {utilities.map((utility) => (
              <MenuItem
                key={utility}
                value={utility}
                disabled={visibleUtilities.length === 1 && visibleUtilities[0] === utility}
              >
                <Checkbox size="small" checked={visibleUtilities.includes(utility)} sx={{ py: 0 }} />
                <ListItemText primary={utility} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={dataSelectSx}>
          <InputLabel id="data-mode-label">Data</InputLabel>
          <Select
            labelId="data-mode-label"
            label="Data"
            value={dataMode}
            onChange={(event) => setDataMode(event.target.value as DataMode)}
          >
            <MenuItem value="actual">Actual</MenuItem>
            <MenuItem value="normalized">Weather normalized</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={heatmapSelectSx}>
          <InputLabel id="heatmap-mode-label">Heatmap</InputLabel>
          <Select
            labelId="heatmap-mode-label"
            label="Heatmap"
            value={heatmapOn ? baselineMode : 'off'}
            onChange={(event) => {
              const value = event.target.value as HeatmapSelectValue;
              if (value !== 'off' && value !== 'building' && value !== 'peer') {
                return;
              }
              if (value === 'off') {
                setHeatmapOn(false);
                return;
              }
              setBaselineMode(value);
              setHeatmapOn(true);
            }}
            MenuProps={{
              slotProps: { paper: { sx: { minWidth: 248 } } },
            }}
          >
            <MenuItem value="off">Off</MenuItem>
            <MenuItem value="building">Building avg</MenuItem>
            <MenuItem value="peer">Peer avg</MenuItem>
            <Divider />
            <Box
              component="li"
              role="presentation"
              sx={{ listStyle: 'none', py: 1, px: 2 }}
              onMouseDown={stopMenuEvent}
              onClick={stopMenuEvent}
            >
              <Stack spacing={1}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Below
                  </Typography>
                  <Box
                    aria-hidden
                    sx={{
                      flex: 1,
                      height: 8,
                      borderRadius: 99,
                      background: heatmapLegendGradient(heatmapHue),
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Above
                  </Typography>
                </Stack>
                <Box>
                  <Typography
                    id="heatmap-hue-label"
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.25 }}
                  >
                    Hue
                  </Typography>
                  <Slider
                    size="small"
                    min={0}
                    max={360}
                    step={1}
                    value={heatmapHue}
                    onChange={(_event, value) => {
                      if (typeof value === 'number') {
                        setHeatmapHue(value);
                      }
                    }}
                    aria-labelledby="heatmap-hue-label"
                    getAriaValueText={(value) => `${value} degrees`}
                    onKeyDown={stopMenuEvent}
                    sx={{
                      py: 1,
                      '& .MuiSlider-rail': {
                        height: 8,
                        borderRadius: 99,
                        opacity: 1,
                        background: HUE_SLIDER_TRACK,
                      },
                      '& .MuiSlider-track': {
                        display: 'none',
                      },
                      '& .MuiSlider-thumb': {
                        width: 16,
                        height: 16,
                        bgcolor: `oklch(0.62 0.18 ${heatmapHue})`,
                        border: '2px solid #fff',
                        boxShadow: '0 0 0 1px oklch(0 0 0 / 0.22)',
                      },
                    }}
                  />
                </Box>
                <ThresholdSlider value={heatmapThreshold} onChange={setHeatmapThreshold} />
              </Stack>
            </Box>
          </Select>
        </FormControl>
        <PeriodRangePicker periods={periods} value={windowRange} onChange={setWindowRange} />
        <Box sx={{ flex: 1 }} />
        <ToggleButton
          size="small"
          value="compare"
          selected={compareLastYear}
          onChange={() => setCompareLastYear((value) => !value)}
          sx={{ ...toolbarButtonSx, px: 1.25 }}
        >
          Compare 1yr
        </ToggleButton>
        <Tooltip title="Download">
          <IconButton
            id="download-button"
            size="small"
            aria-label="Download"
            aria-haspopup="menu"
            aria-expanded={downloadMenuAnchor ? true : undefined}
            aria-controls={downloadMenuAnchor ? 'download-menu' : undefined}
            onClick={(event) => setDownloadMenuAnchor(event.currentTarget)}
          >
            <FileDownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu
          id="download-menu"
          anchorEl={downloadMenuAnchor}
          open={Boolean(downloadMenuAnchor)}
          onClose={() => setDownloadMenuAnchor(null)}
          slotProps={{
            list: { 'aria-labelledby': 'download-button' },
          }}
        >
          <MenuItem
            onClick={() => {
              downloadCsv();
              setDownloadMenuAnchor(null);
            }}
          >
            Download as CSV
          </MenuItem>
          <MenuItem
            onClick={() => {
              downloadExcel();
              setDownloadMenuAnchor(null);
            }}
          >
            Download as Excel
          </MenuItem>
        </Menu>
      </Stack>
      <PeriodWindowSlider
        periods={periods}
        value={windowRange}
        onChange={setWindowRange}
        volumes={volumes}
      />
      <TableContainer sx={{ flex: 1, minHeight: 0, isolation: 'isolate' }}>
        <Table
          stickyHeader
          aria-label="Utility usage by building and period"
          sx={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontVariantNumeric: 'tabular-nums',
            '& .MuiTableCell-root': {
              fontSize: 13,
              borderBottom: 1,
              borderColor: 'divider',
            },
            '& tbody td': {
              overflow: 'hidden',
              bgcolor: 'grey.50',
            },
            '& tbody tr[data-row-type="group"] td': {
              bgcolor: 'background.paper',
              fontWeight: 600,
            },
            '& tbody tr:hover td': {
              bgcolor: 'grey.100',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                rowSpan={2}
                className="usage-pinned"
                sx={{
                  ...stickyUtilitySx(true),
                  top: 0,
                  height: GROUP_HEADER_HEIGHT + COLUMN_HEADER_HEIGHT,
                  p: 0,
                  verticalAlign: 'bottom',
                  fontWeight: 600,
                }}
              >
                <Stack
                  direction="row"
                  spacing={0.25}
                  sx={{
                    height: COLUMN_HEADER_HEIGHT,
                    alignItems: 'center',
                    px: 1,
                    py: 0.75,
                  }}
                >
                  <GroupChevronButton
                    expanded={anyGroupExpanded}
                    label={anyGroupExpanded ? 'Collapse all' : 'Expand all'}
                    onClick={() => setAllGroupExpansion(!anyGroupExpanded)}
                  />
                  Utility
                </Stack>
              </TableCell>
              {columnGroups.map((group) => (
                <TableCell
                  key={group.id}
                  colSpan={group.children.length}
                  sx={{
                    top: 0,
                    height: GROUP_HEADER_HEIGHT,
                    py: 0.75,
                    px: 1.25,
                    fontWeight: 600,
                    bgcolor: 'background.paper',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Box
                    sx={{
                      position: 'sticky',
                      left: STICKY_LABEL_LEFT,
                      width: 'max-content',
                    }}
                  >
                    {group.headerName}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              {periodColumns.map((column) => (
                <TableCell
                  key={column.field}
                  align="right"
                  title={column.description}
                  sx={{
                    top: GROUP_HEADER_HEIGHT,
                    height: COLUMN_HEADER_HEIGHT,
                    width: PERIOD_COL_WIDTH,
                    minWidth: PERIOD_COL_WIDTH,
                    maxWidth: PERIOD_COL_WIDTH,
                    px: 1.25,
                    py: 0.75,
                    fontWeight: column.prior ? 400 : 600,
                    color: column.prior ? 'text.secondary' : 'text.primary',
                    bgcolor: 'background.paper',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {column.headerName}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleGroups.map((group) => {
              const expanded = !collapsedUtilities.has(group.utility);
              return (
                <UtilityGroupRows
                  key={group.utility}
                  group={group}
                  expanded={expanded}
                  periodColumns={periodColumns}
                  rows={rows}
                  baselines={baselines}
                  baselineMode={baselineMode}
                  heatmapOn={heatmapOn}
                  heatmapHue={heatmapHue}
                  heatmapThreshold={heatmapThreshold}
                  compareLastYear={compareLastYear}
                  onToggle={() => toggleUtility(group.utility)}
                  onSelectValue={openSourceDrawer}
                />
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Drawer
        anchor="right"
        open={sourceDrawerOpen}
        onClose={closeSourceDrawer}
        aria-labelledby="data-source-drawer-title"
        slotProps={{
          paper: {
            sx: { width: { xs: '100%', sm: 360 } },
          },
        }}
      >
        <Stack
          direction="row"
          sx={{
            px: 2,
            py: 1.5,
            alignItems: 'center',
            gap: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography
            id="data-source-drawer-title"
            variant="h6"
            component="h2"
            sx={{ flex: 1, fontWeight: 650, letterSpacing: -0.2 }}
          >
            Data Source
          </Typography>
          <IconButton aria-label="Close" onClick={closeSourceDrawer} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </Drawer>
    </Box>
  );
}

function UtilityGroupRows({
  group,
  expanded,
  periodColumns,
  rows,
  baselines,
  baselineMode,
  heatmapOn,
  heatmapHue,
  heatmapThreshold,
  compareLastYear,
  onToggle,
  onSelectValue,
}: {
  group: ReturnType<typeof groupRowsByUtility>[number];
  expanded: boolean;
  periodColumns: PeriodFieldColumn[];
  rows: TimelineRow[];
  baselines: ReturnType<typeof createBaselines>;
  baselineMode: BaselineMode;
  heatmapOn: boolean;
  heatmapHue: number;
  heatmapThreshold: number;
  compareLastYear: boolean;
  onToggle: () => void;
  onSelectValue: () => void;
}) {
  return (
    <>
      <TableRow data-row-type="group" hover={false}>
        <TableCell className="usage-pinned" sx={{ ...stickyUtilitySx(false), py: 0, px: 1 }}>
          <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', minHeight: ROW_HEIGHT }}>
            <GroupChevronButton
              expanded={expanded}
              label={expanded ? `Collapse ${group.utility}` : `Expand ${group.utility}`}
              onClick={onToggle}
            />
            <Stack spacing="1px" sx={{ minWidth: 0, justifyContent: 'center' }}>
              <Typography component="span" sx={{ fontSize: 13, fontWeight: 650, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {group.utility}
              </Typography>
              {group.unit ? (
                <Box
                  component="span"
                  sx={{
                    fontSize: 11,
                    lineHeight: 1.2,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    color: 'grey.500',
                  }}
                >
                  {group.unit}
                </Box>
              ) : null}
            </Stack>
          </Stack>
        </TableCell>
        {periodColumns.map((column) => {
          const value = sumFieldSameUnit(group.rows, column.field);
          const baseline = getUtilityGroupBaseline(
            baselines,
            baselineMode,
            rows,
            group.utility,
            column.period,
            column.prior,
          );
          const priorValue =
            compareLastYear && !column.prior
              ? fieldSumForUtility(rows, group.utility, column.period.priorField)
              : undefined;
          return (
            <TableCell
              key={column.field}
              padding="none"
              sx={{
                position: 'relative',
                zIndex: 0,
                width: PERIOD_COL_WIDTH,
                minWidth: PERIOD_COL_WIDTH,
                maxWidth: PERIOD_COL_WIDTH,
                height: ROW_HEIGHT,
                p: 0,
              }}
            >
              <UsageCell
                value={value}
                baseline={baseline}
                mode={baselineMode}
                applyFill={heatmapOn}
                muted={column.prior}
                heatmapHue={heatmapHue}
                heatmapThreshold={heatmapThreshold}
                priorValue={priorValue}
                showYoyChange={compareLastYear && !column.prior}
                dataSource={getGroupDataSource(rows, group.utility, column.field)}
                onSelect={onSelectValue}
              />
            </TableCell>
          );
        })}
      </TableRow>
      {expanded
        ? group.rows.map((row) => (
            <TableRow key={row.id} data-row-type="leaf" hover={false}>
              <TableCell
                className="usage-pinned"
                sx={{
                  ...stickyUtilitySx(false),
                  py: 0,
                  pl: 5,
                  pr: 1.25,
                  whiteSpace: 'nowrap',
                }}
              >
                {String(row.property)}
              </TableCell>
              {periodColumns.map((column) => {
                const value = row[column.field];
                const numericValue = typeof value === 'number' ? value : null;
                const priorRaw = row[column.period.priorField];
                const priorValue =
                  compareLastYear && !column.prior && typeof priorRaw === 'number' ? priorRaw : undefined;
                return (
                  <TableCell
                    key={column.field}
                    padding="none"
                    sx={{
                      position: 'relative',
                      zIndex: 0,
                      width: PERIOD_COL_WIDTH,
                      minWidth: PERIOD_COL_WIDTH,
                      maxWidth: PERIOD_COL_WIDTH,
                      height: ROW_HEIGHT,
                      p: 0,
                    }}
                  >
                    <UsageCell
                      value={numericValue}
                      baseline={getCellBaseline(baselines, baselineMode, row, column.period, column.prior)}
                      mode={baselineMode}
                      applyFill={heatmapOn}
                      muted={column.prior}
                      heatmapHue={heatmapHue}
                      heatmapThreshold={heatmapThreshold}
                      priorValue={priorValue}
                      showYoyChange={compareLastYear && !column.prior}
                      dataSource={getCellDataSource(row.id, column.field)}
                      onSelect={onSelectValue}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))
        : null}
    </>
  );
}
