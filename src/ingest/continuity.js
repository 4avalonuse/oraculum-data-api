export function expectedNextTimestamp(timestamp, interval) {
  const date = new Date(timestamp);

  switch (interval) {
    case '1m': return timestamp + 60_000;
    case '1h': return timestamp + 3_600_000;
    case '1d': return timestamp + 86_400_000;
    case '1w': return timestamp + 7 * 86_400_000;
    case '1M': {
      const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
      return next.getTime();
    }
    default: return null;
  }
}

export function auditContinuity(rows, interval) {
  if (rows.length < 2) return { gaps: [], checked: rows.length };

  const sorted = rows
    .map((row) => Number(row.timestamp))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const expected = expectedNextTimestamp(previous, interval);
    if (expected !== null && current > expected) {
      gaps.push({ from: previous, to: current, missingMs: current - expected });
    }
  }

  return { gaps, checked: sorted.length };
}
