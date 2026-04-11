const formatter: Intl.NumberFormat = new Intl.NumberFormat('en', { notation: 'compact' });

export function formatCompactNumber(value: number): string {
  if (value === 0) return '0';
  const absValue = Math.abs(value);
  return formatter.format(absValue).toLowerCase();
}
