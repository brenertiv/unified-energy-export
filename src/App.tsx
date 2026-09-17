import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import csvText from './data/colliersUsage.csv?raw';
import { UsageGroupedGrid } from './components/UsageGroupedGrid';
import { completeBuildingUtilityRows } from './lib/aggregations';
import { extendPriorYear } from './lib/extendPriorYear';
import { parseUsageCsv, toTimelineRows } from './lib/parseUsageCsv';
import { weatherNormalizeRows } from './lib/weatherNormalize';

const { rows: sparseRows, periods } = toTimelineRows(extendPriorYear(parseUsageCsv(csvText)));
const actualRows = completeBuildingUtilityRows(sparseRows);
const normalizedRows = weatherNormalizeRows(actualRows, periods);

const theme = createTheme({
  palette: {
    background: {
      default: '#f4f5f7',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  shape: {
    borderRadius: 10,
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 2.5 },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 650, letterSpacing: -0.3 }}>
            All Utilities Usage
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Colliers Portfolio
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            backgroundColor: 'background.paper',
            borderRadius: 2,
            boxShadow: '0 1px 2px oklch(0 0 0 / 0.06), 0 8px 24px oklch(0 0 0 / 0.06)',
            overflow: 'hidden',
          }}
        >
          <UsageGroupedGrid actualRows={actualRows} normalizedRows={normalizedRows} periods={periods} />
        </Box>
      </Box>
    </ThemeProvider>
  );
}
