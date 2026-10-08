function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function robustScale(values, center) {
  const deviations = values.map((value) => Math.abs(value - center));
  return median(deviations) * 1.4826;
}

function logReturn(previous, current) {
  if (!(previous > 0 && current > 0)) return null;
  return Math.log(current / previous);
}

function isRoundTrip(previous, current, next, tolerance = 0.10) {
  if (!(previous > 0 && current > 0 && next > 0)) return false;
  return Math.abs(next / previous - 1) <= tolerance;
}

export function detectCandleAnomalies(candles, options = {}) {
  const {
    minReturn = 0.20,
    robustThreshold = 8,
    roundTripTolerance = 0.10,
    wickMultiple = 3
  } = options;

  if (!Array.isArray(candles) || candles.length < 3) return [];

  const returns = [];
  for (let i = 1; i < candles.length; i++) {
    const value = logReturn(candles[i - 1].close, candles[i].close);
    if (value !== null) returns.push(value);
  }

  const center = median(returns);
  const scale = robustScale(returns, center);
  const anomalies = [];

  // Edge candles need explicit handling: the original detector only inspected
  // interior candles, so a single bad first/last row could survive into D1
  // and stretch FIT's price axis (for example 4253 surrounded by ~255).
  const scaleRatio = (a, b) => {
    if (!(a > 0) || !(b > 0)) return Infinity;
    return Math.max(a, b) / Math.min(a, b);
  };

  if (
    candles.length >= 3 &&
    (
      (
        scaleRatio(candles[0].close, candles[1].close) >= 2 &&
        scaleRatio(candles[1].close, candles[2].close) <= 1.10
      ) ||
      candles[0].high > Math.max(candles[1].high, candles[2].high) * wickMultiple ||
      (
        candles[0].low > 0 &&
        candles[0].low < Math.min(candles[1].low, candles[2].low) / wickMultiple
      )
    )
  ) {
    anomalies.push({
      timestamp: candles[0].timestamp,
      index: 0,
      type: 'edge_price_or_wick_spike',
      score: null,
      returnBefore: null,
      returnAfter: Number((candles[1].close / candles[0].close - 1).toFixed(6)),
      action: 'exclude'
    });
  }

  const last = candles.length - 1;
  if (
    candles.length >= 3 &&
    (
      (
        scaleRatio(candles[last].close, candles[last - 1].close) >= 2 &&
        scaleRatio(candles[last - 1].close, candles[last - 2].close) <= 1.10
      ) ||
      candles[last].high > Math.max(candles[last - 1].high, candles[last - 2].high) * wickMultiple ||
      (
        candles[last].low > 0 &&
        candles[last].low < Math.min(candles[last - 1].low, candles[last - 2].low) / wickMultiple
      )
    )
  ) {
    anomalies.push({
      timestamp: candles[last].timestamp,
      index: last,
      type: 'edge_price_or_wick_spike',
      score: null,
      returnBefore: Number((candles[last].close / candles[last - 1].close - 1).toFixed(6)),
      returnAfter: null,
      action: 'exclude'
    });
  }

  for (let i = 1; i < candles.length - 1; i++) {
    const previous = candles[i - 1];
    const current = candles[i];
    const next = candles[i + 1];

    const before = logReturn(previous.close, current.close);
    const after = logReturn(current.close, next.close);
    if (before === null || after === null) continue;

    const priceJump = Math.max(Math.abs(before), Math.abs(after));
    const robustScore = scale > 0
      ? Math.max(Math.abs(before - center), Math.abs(after - center)) / scale
      : 0;

    const roundTrip = isRoundTrip(
      previous.close,
      current.close,
      next.close,
      roundTripTolerance
    );

    const highSpike = current.high > Math.max(previous.high, next.high) * wickMultiple;
    const lowSpike = current.low > 0 &&
      current.low < Math.min(previous.low, next.low) / wickMultiple;

    const isolatedPriceSpike =
      roundTrip &&
      priceJump >= Math.log(1 + minReturn) &&
      (robustScore >= robustThreshold || priceJump >= Math.log(2));

    const isolatedWickSpike =
      roundTrip &&
      (highSpike || lowSpike);

    if (isolatedPriceSpike || isolatedWickSpike) {
      anomalies.push({
        timestamp: current.timestamp,
        index: i,
        type: isolatedPriceSpike ? 'price_spike' : 'wick_spike',
        score: Number(robustScore.toFixed(2)),
        returnBefore: Number((Math.exp(before) - 1).toFixed(6)),
        returnAfter: Number((Math.exp(after) - 1).toFixed(6)),
        action: 'exclude'
      });
    }
  }

  return anomalies;
}
