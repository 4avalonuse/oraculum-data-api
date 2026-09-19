import test from 'node:test';
import assert from 'node:assert/strict';
import { datasetView, toApiCandle } from '../src/contract.js';

test('public candle contract is compact and numeric', () => {
  assert.deepEqual(
    toApiCandle({
      timestamp: 1700000000000,
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 42
    }),
    { t: 1700000000000, o: 10, h: 12, l: 9, c: 11, v: 42 }
  );
});

test('dataset view preserves metadata and maps rows', () => {
  const payload = datasetView(
    {
      id: 'btc-usd-yahoo-1d',
      name: 'Bitcoin / USD',
      provider: 'yahoo',
      symbol: 'BTC-USD',
      kind: 'ohlcv',
      interval: '1d',
      currency: 'USD',
      updated_at: 123
    },
    [{ timestamp: 1, open: 2, high: 3, low: 1, close: 2.5, volume: 10 }]
  );

  assert.equal(payload.ok, true);
  assert.deepEqual(payload.meta, {
    datasetId: 'btc-usd-yahoo-1d',
    name: 'Bitcoin / USD',
    provider: 'yahoo',
    symbol: 'BTC-USD',
    kind: 'ohlcv',
    interval: '1d',
    currency: 'USD',
    sourceName: 'Yahoo Finance',
    updatedAt: 123
  });
  assert.deepEqual(payload.data, [{ t: 1, o: 2, h: 3, l: 1, c: 2.5, v: 10 }]);
});
