import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBinance } from '../src/providers/binance.js';

function kline(timestamp, price = 100) {
  return [
    timestamp,
    String(price),
    String(price + 2),
    String(price - 1),
    String(price + 1),
    '10',
    timestamp + 59999,
    '0',
    1,
    '5',
    '500',
    '0'
  ];
}

test('fetchBinance maps Binance.US klines to normalized rows', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify([
      kline(1000, 100),
      kline(61000, 101)
    ]),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );

  try {
    const result = await fetchBinance({ symbol: 'BTCUSD', interval: '1m', historyBars: 2 });
    assert.equal(result.provider, 'binance-us');
    assert.equal(result.symbol, 'BTCUSD');
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows[0], {
      timestamp: 1000,
      open: 100,
      high: 102,
      low: 99,
      close: 101,
      volume: 10
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchBinance paginates backward and keeps the newest target bars', async () => {
  const originalFetch = globalThis.fetch;
  const pages = [
    Array.from({ length: 1000 }, (_, i) => kline(2_000_000 + i * 60_000, 100 + i)),
    Array.from({ length: 1000 }, (_, i) => kline(1_940_000 + i * 60_000, 50 + i))
  ];
  let calls = 0;

  globalThis.fetch = async () => {
    const payload = pages[calls++];
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const result = await fetchBinance({ symbol: 'BTCUSD', interval: '1m', historyBars: 1500 });
    assert.equal(calls, 2);
    assert.equal(result.rows.length, 1500);
    assert.ok(result.rows[0].timestamp < result.rows.at(-1).timestamp);
    assert.equal(result.rows.at(-1).timestamp, pages[0].at(-1)[0]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchBinance rejects non-OK provider responses', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ code: -1121, msg: 'Invalid symbol.' }),
    { status: 400, headers: { 'content-type': 'application/json' } }
  );

  try {
    await assert.rejects(
      fetchBinance({ symbol: 'BAD', interval: '1h', historyBars: 1 }),
      /binance_http_400_Invalid symbol/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
