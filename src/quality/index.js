import { detectCandleAnomalies } from './anomaly.js';

export function assessCandleQuality(candles, options = {}) {
  const anomalies = detectCandleAnomalies(candles, options);
  const anomalyTimestamps = new Set(anomalies.map((item) => item.timestamp));
  const cleanCandles = candles.filter((candle) => !anomalyTimestamps.has(candle.timestamp));

  return {
    candles: cleanCandles,
    anomalies,
    quality: {
      total: candles.length,
      accepted: cleanCandles.length,
      anomalies: anomalies.length
    }
  };
}
