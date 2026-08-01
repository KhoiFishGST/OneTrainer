// uPlot's default axis/legend formatter is `Intl.NumberFormat` with no options,
// which caps at 3 fraction digits -- so every learning rate renders as "0".
// This formatter is used for both the y-axis ticks and the legend readout.
const standardFormatter = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 });

const SMALL_THRESHOLD = 1e-3;
const LARGE_THRESHOLD = 1e6;

export function formatMetricValue(v: number | null | undefined): string {
  if (v === null || v === undefined || typeof v !== 'number' || Number.isNaN(v)) return '';
  if (v === 0) return '0';

  const abs = Math.abs(v);
  if (abs < SMALL_THRESHOLD || abs >= LARGE_THRESHOLD) {
    return v.toExponential(2);
  }
  return standardFormatter.format(v);
}

export function humanizeMetricKey(key: string): string {
  const withoutPrefix = key.startsWith('lr_') ? key.slice(3) : key;
  return withoutPrefix.replace(/_/g, ' ');
}
