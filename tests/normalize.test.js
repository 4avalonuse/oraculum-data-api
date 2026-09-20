import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCandles } from '../src/normalize.js';

test('normalizes valid candles and orders them by timestamp', () => {
  const result = normalizeCandles([
    { timestamp: 2000, open: 2, high: 3, low: 1, close: 2.5, volume: 20 },
    { timestamp: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }
  ]);

  assert.equal(result.rejected.length, 0);
  assert.equal(result.candles.length, 2);
  assert.deepEqual(
    result.candles.map((row) => row.timestamp),
    [1000, 2000]
  );
});

test('rejects invalid OHLC relationships', () => {
  const result = normalizeCandles([
    { timestamp: 1000, open: 10, high: 9, low: 8, close: 9, volume: 1 },
    { timestamp: 2000, open: 10, high: 12, low: 11, close: 9, volume: 1 }
  ]);

  assert.equal(result.candles.length, 0);
  assert.equal(result.rejected.length, 2);
});

test('consolidates duplicate timestamps deterministically', () => {
  const result = normalizeCandles([
    { timestamp: 1000, open: 1, high: 2, low: 1, close: 1.5, volume: 10 },
    { timestamp: 1000, open: 1.1, high: 2.1, low: 1, close: 1.8, volume: 12 }
  ]);

  assert.equal(result.rejected.length, 0);
  assert.equal(result.candles.length, 1);
  assert.equal(result.duplicatesRemoved, 1);
  assert.equal(result.candles[0].close, 1.8);
});
