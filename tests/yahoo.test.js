import test from 'node:test';
import assert from 'node:assert/strict';
import { buildYahooChartUrl } from '../src/providers/yahoo.js';

test('Yahoo request window honors the requested history bar count', () => {
  const now = Date.UTC(2026, 0, 1);
  const url = buildYahooChartUrl({
    symbol: 'BTC-USD',
    interval: '1h',
    historyBars: 1000,
    now
  });

  assert.equal(url.searchParams.get('interval'), '1h');
  assert.equal(
    Number(url.searchParams.get('period2')) - Number(url.searchParams.get('period1')),
    1000 * 60 * 60 + 60
  );
});

test('Yahoo interval aliases map to provider intervals', () => {
  const url = buildYahooChartUrl({
    symbol: 'BTC-USD',
    interval: '1w',
    historyBars: 100,
    now: Date.UTC(2026, 0, 1)
  });

  assert.equal(url.searchParams.get('interval'), '1wk');
});
