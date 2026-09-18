const REQUIRED = ['timestamp', 'open', 'high', 'low', 'close'];

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeCandles(rows) {
  const byTimestamp = new Map();
  const rejected = [];

  for (const row of rows || []) {
    const normalized = {
      timestamp: Number(row.timestamp),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: row.volume == null ? 0 : Number(row.volume)
    };

    const valid = REQUIRED.every((key) => {
      const value = normalized[key];
      return key === 'timestamp'
        ? Number.isInteger(value) && value > 0
        : finite(value);
    }) && finite(normalized.volume) && normalized.open > 0 &&
      normalized.high >= Math.max(normalized.open, normalized.close) &&
      normalized.low <= Math.min(normalized.open, normalized.close) &&
      normalized.low >= 0;

    if (!valid) {
      rejected.push(row);
      continue;
    }

    byTimestamp.set(normalized.timestamp, normalized);
  }

  return {
    candles: [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp),
    rejected,
    duplicatesRemoved: Math.max(0, (rows || []).length - rejected.length - byTimestamp.size)
  };
}
