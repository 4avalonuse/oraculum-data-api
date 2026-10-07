const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

function stepMs(interval, index) {
  if (interval === '1m') return MINUTE_MS;
  if (interval === '1h') return HOUR_MS;
  if (interval === '1w') return 7 * DAY_MS;
  if (interval === '1M') return 30 * DAY_MS;
  return DAY_MS;
}

function baseTimestamp(interval, bars) {
  const step = stepMs(interval, 0);
  const end = Date.UTC(2026, 0, 1);
  return end - (bars - 1) * step;
}

function controlledReturn(kind, i) {
  const a = [0.0005, 0.0010, 0.0015, 0.0008, 0.0012, 0.0007][i % 6];
  if (kind === 'A') return a;
  if (kind === 'B') return 2 * a + 0.0005;

  // TEST-C: deterministic AR(1) return process with smooth, non-random shocks.
  const shock = 0.0008 * Math.sin(i * 1.7) + 0.0003 * Math.cos(i * 0.43);
  return 0.0003 + 0.65 * shock;
}

export function generateSyntheticRows(symbol, interval, bars = 500) {
  const kind = String(symbol).replace('TEST-', '');
  const step = stepMs(interval, 0);
  const start = baseTimestamp(interval, bars);
  let close = kind === 'A' ? 100 : kind === 'B' ? 100 : 80;
  let previousReturn = 0;
  const rows = [];

  for (let i = 0; i < bars; i++) {
    let r = controlledReturn(kind, i);
    if (kind === 'C') {
      const shock = 0.0008 * Math.sin(i * 1.7) + 0.0003 * Math.cos(i * 0.43);
      r = 0.0003 + 0.65 * previousReturn + shock;
      previousReturn = r - 0.0003;
    }

    const open = close;
    close = close * (1 + r);
    const wiggle = Math.abs(close - open) * 0.25 + close * 0.0002;
    const high = Math.max(open, close) + wiggle;
    const low = Math.max(0.000001, Math.min(open, close) - wiggle);
    rows.push({
      timestamp: start + i * step,
      open,
      high,
      low,
      close,
      volume: 1000000 + i * 1000
    });
  }

  return rows;
}

export function fetchSynthetic({ symbol, interval, historyBars = 500 }) {
  const rows = generateSyntheticRows(symbol, interval, Math.min(historyBars, 500));
  return {
    provider: 'synthetic',
    symbol,
    raw: rows,
    rows
  };
}
