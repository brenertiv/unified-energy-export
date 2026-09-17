import { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  DataGridPremium,
  GRID_AGGREGATION_FUNCTIONS,
  GRID_ROW_GROUPING_SINGLE_GROUPING_FIELD,
  gridRowTreeSelector,
  useGridApiRef,
  type GridCellParams,
  type GridColDef,
  type GridColumnGroupingModel,
  type GridRenderCellParams,
  type GridRowGroupingModel,
} from '@mui/x-data-grid-premium';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import {
  fieldSumForUtility,
  periodVolumes,
  sumSameUnit,
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
import { heatmapFill } from '../lib/heatmap';
import { formatPeriodLabel } from '../lib/periodLabel';
import type { PeriodColumn, TimelineRow } from '../lib/parseUsageCsv';
import { defaultWindowRange, type WindowRange } from '../lib/periodWindow';
import { type DataMode } from '../lib/weatherNormalize';
import { PeriodWindowSlider } from './PeriodWindowSlider';

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const ROW_GROUPING_MODEL: GridRowGroupingModel = ['utility_type'];

const groupingColDef = {
  headerName: 'Utility',
  minWidth: 220,
  width: 220,
  leafField: 'property',
};

const columnVisibilityModel = {
  address: false,
  portfolio: false,
  utility_type: false,
  property: false,
};

const aggregationFunctions = {
  ...GRID_AGGREGATION_FUNCTIONS,
  sumSameUnit,
};

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
  minWidth: 160,
} as const;

type HeatmapSelectValue = 'off' | BaselineMode;

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


function yoyChangeColor(relative: number) {
  if (relative < 0) {
    return 'oklch(0.4 0.12 255)';
  }
  if (relative > 0) {
    return 'oklch(0.45 0.13 25)';
  }
  return 'text.secondary';
}

function comparePriorValue(
  params: GridRenderCellParams<TimelineRow, number | null>,
  period: PeriodColumn,
  rows: TimelineRow[],
) {
  if (params.rowNode.type === 'leaf') {
    const value = params.row[period.priorField];
    return typeof value === 'number' ? value : undefined;
  }
  const utility = heatmapUtility(params);
  if (!utility) {
    return undefined;
  }
  return fieldSumForUtility(rows, utility, period.priorField);
}

function periodRangeDescription(start?: Date, end?: Date) {
  if (!start || !end) {
    return undefined;
  }
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
}

function getAggregationPosition(groupNode: { depth: number } | null) {
  if (groupNode == null || groupNode.depth === -1) {
    return null;
  }
  return 'inline' as const;
}

function heatmapUtility(params: GridRenderCellParams<TimelineRow>): string | undefined {
  if (params.rowNode.type === 'group') {
    return params.rowNode.groupingKey == null ? undefined : String(params.rowNode.groupingKey);
  }
  return params.row.utility_type ? String(params.row.utility_type) : undefined;
}

function shouldHeatmapRow(rowNode: { type: string; depth?: number }): boolean {
  if (rowNode.type === 'leaf') {
    return true;
  }
  return rowNode.type === 'group' && (rowNode.depth ?? -1) >= 0;
}

function resolveDataSource(
  params: Pick<GridRenderCellParams<TimelineRow>, 'rowNode' | 'row'>,
  field: string,
  rows: TimelineRow[],
): CellDataSource {
  if (params.rowNode.type === 'leaf') {
    return getCellDataSource(String(params.row.id), field);
  }
  const utility =
    params.rowNode.type === 'group' && params.rowNode.groupingKey != null
      ? String(params.rowNode.groupingKey)
      : undefined;
  if (!utility) {
    return 'Utility';
  }
  return getGroupDataSource(rows, utility, field);
}

function UsageCell({
  value,
  baseline,
  mode,
  applyFill,
  muted,
  priorValue,
  showYoyChange,
  dataSource,
}: {
  value: number | null | undefined;
  baseline: number | undefined;
  mode: BaselineMode;
  applyFill: boolean;
  muted: boolean;
  priorValue?: number;
  showYoyChange: boolean;
  dataSource: CellDataSource;
}) {
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const formatted = formatConsumption(hasValue ? value : undefined);
  const yoy = hasValue && showYoyChange ? yoyChange(value, priorValue) : undefined;
  const relative = hasValue ? relativeToBaseline(value, baseline) : null;
  const fill = applyFill && hasValue ? heatmapFill(relative) : undefined;
  const tooltip = hasValue ? (
    <UsageCellTooltip
      dataSource={dataSource}
      vsBaselineLabel={applyFill ? (mode === 'building' ? 'Building avg' : 'Peer avg') : undefined}
      vsBaseline={applyFill ? vsBaselineDetail(relative) : undefined}
    />
  ) : (
    'No data'
  );
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
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '1px',
          px: '10px',
          cursor: 'pointer',
          bgcolor: fill,
          color: muted && !fill ? 'text.secondary' : 'text.primary',
        }}
      >
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
              color: yoyChangeColor(yoy.relative),
            }}
          >
            {yoy.label}
          </Box>
        ) : null}
      </Box>
    </Tooltip>
  );
}

type UsageGroupedGridProps = {
  actualRows: TimelineRow[];
  normalizedRows: TimelineRow[];
  periods: PeriodColumn[];
};

export function UsageGroupedGrid({ actualRows, normalizedRows, periods }: UsageGroupedGridProps) {
  const apiRef = useGridApiRef();
  const [dataMode, setDataMode] = useState<DataMode>('actual');
  const [compareLastYear, setCompareLastYear] = useState(false);
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [baselineMode, setBaselineMode] = useState<BaselineMode>('building');
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [windowRange, setWindowRange] = useState<WindowRange>(() => defaultWindowRange(periods.length));
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedUtility, setSelectedUtility] = useState('Electricity');

  const rows = dataMode === 'normalized' ? normalizedRows : actualRows;
  const baselines = useMemo(() => createBaselines(rows, periods), [rows, periods]);
  const utilities = useMemo(() => uniqueUtilities(rows), [rows]);
  const volumeUtility = utilities.includes(selectedUtility) ? selectedUtility : (utilities[0] ?? '');
  const volumes = useMemo(
    () => periodVolumes(rows, periods, volumeUtility),
    [periods, rows, volumeUtility],
  );
  const visiblePeriods = useMemo(
    () => periods.slice(windowRange[0], windowRange[1] + 1),
    [periods, windowRange],
  );

  const valueFields = useMemo(() => {
    if (!compareLastYear) {
      return visiblePeriods.map((period) => period.field);
    }
    return visiblePeriods.flatMap((period) => [period.field, period.priorField]);
  }, [compareLastYear, visiblePeriods]);

  const aggregationModel = useMemo(
    () => Object.fromEntries(valueFields.map((field) => [field, 'sumSameUnit'])),
    [valueFields],
  );

  const columns = useMemo<GridColDef<TimelineRow>[]>(() => {
    const dimensionColumns: GridColDef<TimelineRow>[] = [
      { field: 'property', headerName: 'Building', width: 160, groupable: false },
      { field: 'utility_type', headerName: 'Utility', width: 130, groupable: false },
      { field: 'unit', headerName: 'Unit', width: 80, groupable: false },
      { field: 'address', headerName: 'Address', width: 220, groupable: false },
      { field: 'portfolio', headerName: 'Portfolio', width: 120, groupable: false },
    ];

    const periodColumns: GridColDef<TimelineRow>[] = visiblePeriods.flatMap((period) => {
      const valueColumn = (field: string, headerName: string, description: string | undefined, prior: boolean) => {
        const column: GridColDef<TimelineRow> = {
          field,
          headerName,
          description,
          type: 'number',
          width: 108,
          groupable: false,
          aggregable: true,
          availableAggregationFunctions: ['sumSameUnit'],
          headerClassName: prior ? 'comparison-prior-header' : undefined,
          valueGetter: (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null),
          valueFormatter: (value) => formatConsumption(typeof value === 'number' ? value : undefined),
          cellClassName: (params) => {
            const classes: string[] = [];
            if (prior) {
              classes.push('comparison-prior');
            }
            if (shouldHeatmapRow(params.rowNode)) {
              classes.push('heatmap-leaf');
            }
            return classes.join(' ');
          },
          renderCell: (params: GridRenderCellParams<TimelineRow, number | null>) => {
            const utility = heatmapUtility(params);
            const baseline =
              params.rowNode.type === 'group' && utility
                ? getUtilityGroupBaseline(baselines, baselineMode, rows, utility, period, prior)
                : getCellBaseline(baselines, baselineMode, params.row, period, prior);
            return (
              <UsageCell
                value={params.value}
                baseline={baseline}
                mode={baselineMode}
                applyFill={heatmapOn && shouldHeatmapRow(params.rowNode)}
                muted={prior}
                priorValue={compareLastYear && !prior ? comparePriorValue(params, period, rows) : undefined}
                showYoyChange={compareLastYear && !prior && shouldHeatmapRow(params.rowNode)}
                dataSource={resolveDataSource(params, field, rows)}
              />
            );
          },
        };

        return column;
      };

      const current = valueColumn(
        period.field,
        compareLastYear ? 'Current' : formatPeriodLabel(period.start),
        periodRangeDescription(period.start, period.end),
        false,
      );

      if (!compareLastYear) {
        return [current];
      }

      return [
        current,
        valueColumn(
          period.priorField,
          'Last year',
          period.priorStart
            ? `${periodRangeDescription(period.priorStart, period.priorEnd)} · same 30-day window last year`
            : 'Same 30-day window last year',
          true,
        ),
      ];
    });

    return [...dimensionColumns, ...periodColumns];
  }, [baselineMode, baselines, compareLastYear, heatmapOn, rows, visiblePeriods]);

  const columnGroupingModel = useMemo<GridColumnGroupingModel>(() => {
    if (compareLastYear) {
      return visiblePeriods.map((period) => ({
        groupId: period.field,
        headerName: formatPeriodLabel(period.start),
        children: [{ field: period.field }, { field: period.priorField }],
      }));
    }

    const years = new Map<number, string[]>();
    for (const period of visiblePeriods) {
      const year = period.start.getFullYear();
      const fields = years.get(year) ?? [];
      fields.push(period.field);
      years.set(year, fields);
    }
    return [...years.entries()].map(([year, fields]) => ({
      groupId: String(year),
      headerName: String(year),
      children: fields.map((field) => ({ field })),
    }));
  }, [compareLastYear, visiblePeriods]);

  const closeSourceDrawer = useCallback(() => {
    setSourceDrawerOpen(false);
  }, []);

  const handleCellClick = useCallback(
    (params: GridCellParams<TimelineRow>) => {
      if (!valueFields.includes(params.field) || !shouldHeatmapRow(params.rowNode)) {
        return;
      }
      if (typeof params.value !== 'number') {
        return;
      }
      setSourceDrawerOpen(true);
    },
    [valueFields],
  );

  const setAllGroupExpansion = useCallback(
    (expanded: boolean) => {
      const tree = gridRowTreeSelector(apiRef);
      for (const node of Object.values(tree)) {
        if (node.type === 'group' && node.depth >= 0) {
          apiRef.current?.setRowChildrenExpansion(node.id, expanded);
        }
      }
    },
    [apiRef],
  );

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
          >
            <MenuItem value="off">Off</MenuItem>
            <MenuItem value="building">Building avg</MenuItem>
            <MenuItem value="peer">Peer avg</MenuItem>
            <Divider />
            <ListSubheader
              disableSticky
              sx={{ lineHeight: 'unset', py: 0.5, pointerEvents: 'none' }}
            >
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Less
                </Typography>
                <Box
                  aria-hidden
                  sx={{
                    width: 72,
                    height: 8,
                    borderRadius: 99,
                    background:
                      'linear-gradient(to right in oklab, oklch(0.8 0.12 255), oklch(0.97 0.005 0), oklch(0.8 0.12 25))',
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  More
                </Typography>
              </Stack>
            </ListSubheader>
          </Select>
        </FormControl>
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
        <Tooltip title="Expand">
          <IconButton
            size="small"
            aria-label="Expand"
            onClick={() => setAllGroupExpansion(true)}
          >
            <UnfoldMoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Collapse">
          <IconButton
            size="small"
            aria-label="Collapse"
            onClick={() => setAllGroupExpansion(false)}
          >
            <UnfoldLessIcon fontSize="small" />
          </IconButton>
        </Tooltip>
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
              apiRef.current?.exportDataAsCsv();
              setDownloadMenuAnchor(null);
            }}
          >
            Download as CSV
          </MenuItem>
          <MenuItem
            onClick={() => {
              void apiRef.current?.exportDataAsExcel();
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
        utilities={utilities}
        selectedUtility={volumeUtility}
        onUtilityChange={setSelectedUtility}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGridPremium
          apiRef={apiRef}
          rows={rows}
          columns={columns}
          disablePivoting
          rowGroupingModel={ROW_GROUPING_MODEL}
          groupingColDef={groupingColDef}
          columnVisibilityModel={columnVisibilityModel}
          columnGroupingModel={columnGroupingModel}
          aggregationModel={aggregationModel}
          aggregationFunctions={aggregationFunctions}
          getAggregationPosition={getAggregationPosition}
          defaultGroupingExpansionDepth={1}
          pinnedColumns={{
            left: [GRID_ROW_GROUPING_SINGLE_GROUPING_FIELD, 'unit'],
          }}
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          onCellClick={handleCellClick}
          onCellKeyDown={(params, event) => {
            if (event.key !== 'Enter') {
              return;
            }
            handleCellClick(params);
          }}
          columnGroupHeaderHeight={36}
          sx={{
            border: 0,
            height: '100%',
            '--DataGrid-cellOffsetMultiplier': 3,
            fontVariantNumeric: 'tabular-nums',
            '& .MuiDataGrid-aggregationColumnHeaderLabel': {
              display: 'none',
            },
            '& .comparison-prior': {
              opacity: 0.5,
            },
            '& .comparison-prior-header': {
              opacity: 0.55,
              '& .MuiDataGrid-columnHeaderTitle': {
                color: 'text.secondary',
                fontWeight: 400,
              },
            },
            '& .heatmap-leaf': {
              padding: 0,
              overflow: 'hidden',
            },
            '& .MuiDataGrid-columnHeader--filledGroup': {
              '& .MuiDataGrid-columnHeaderTitleContainer': {
                overflow: 'visible',
              },
              '& .MuiDataGrid-columnHeaderTitleContainerContent': {
                position: 'sticky',
                left: 8,
              },
            },
          }}
        />
      </Box>
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
