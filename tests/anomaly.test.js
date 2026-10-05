import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCandleAnomalies } from '../src/quality/anomaly.js';
import { assessCandleQuality } from '../src/quality/index.js';

function candle(timestamp, close, high = close, low = close) {
  return { timestamp, open: close, high, low, close, volume: 1 };
}

test('detects a JUP-like isolated price spike at a small price scale', () => {
  const candles = [
    candle(1, 0.0048, 0.0049, 0.0047),
    candle(2, 0.0050, 0.0051, 0.0049),
    candle(3, 0.29, 0.30, 0.28),
    candle(4, 0.0051, 0.0052, 0.0050),
    candle(5, 0.0050, 0.0051, 0.0049)
  ];

  const anomalies = detectCandleAnomalies(candles);

  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].timestamp, 3);
  assert.equal(anomalies[0].type, 'price_spike');
});

test('detects an isolated price spike that immediately reverses', () => {
  const candles = [
    candle(1, 1),
    candle(2, 1.02),
    candle(3, 10),
    candle(4, 1.01),
    candle(5, 1.03)
  ];

  const anomalies = detectCandleAnomalies(candles);

  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].timestamp, 3);
  assert.equal(anomalies[0].type, 'price_spike');
});

test('detects an isolated wick spike', () => {
  const candles = [
    candle(1, 1),
    candle(2, 1.01, 1.02, 1),
    candle(3, 1.02, 10, 1),
    candle(4, 1.03, 1.04, 1),
    candle(5, 1.02)
  ];

  const anomalies = detectCandleAnomalies(candles);

  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].timestamp, 3);
  assert.equal(anomalies[0].type, 'wick_spike');
});

test('does not flag a sustained price move as an isolated anomaly', () => {
  const candles = [
    candle(1, 1),
    candle(2, 1.3),
    candle(3, 1.6),
    candle(4, 1.9),
    candle(5, 2.2)
  ];

  assert.equal(detectCandleAnomalies(candles).length, 0);
});

test('quality pipeline excludes anomalies but preserves the anomaly report', () => {
  const candles = [
    candle(1, 1),
    candle(2, 1.02),
    candle(3, 10),
    candle(4, 1.01),
    candle(5, 1.03)
  ];

  const quality = assessCandleQuality(candles);

  assert.equal(quality.candles.length, 4);
  assert.equal(quality.anomalies.length, 1);
  assert.equal(quality.quality.total, 5);
  assert.equal(quality.quality.accepted, 4);
});
