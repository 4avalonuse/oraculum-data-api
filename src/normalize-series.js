export function normalizeSeries(rows) {
  const byTimestamp = new Map();
  const rejected = [];

  for (const row of rows || []) {
    const timestamp = Number(row.timestamp);
    const value = Number(row.value);
    if (!Number.isInteger(timestamp) || timestamp <= 0 || !Number.isFinite(value)) {
      rejected.push(row);
      continue;
    }
    byTimestamp.set(timestamp, {
      timestamp,
      open: value,
      high: value,
      low: value,
      close: value,
      volume: 0
    });
  }

  return {
    candles: [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp),
    rejected,
    duplicatesRemoved: Math.max(0, (rows || []).length - rejected.length - byTimestamp.size)
  };
}
