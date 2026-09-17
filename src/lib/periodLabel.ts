export const PERIOD_LABEL_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: '2-digit',
});

export function formatPeriodLabel(start: Date): string {
  return PERIOD_LABEL_FORMAT.format(start);
}

export function formatWindowEdgeLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatWindowRangeLabel(start: Date, end: Date): string {
  const format = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${format.format(start)} – ${format.format(end)}`;
}
