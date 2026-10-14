import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchXaus } from '../src/providers/xaus.js';

test('XAUS provider returns daily spot prices and uses the current spot quote for today', async () => {
  const originalFetch = globalThis.fetch;
  const now = Date.now();
  const points = Array.from({ length: 31 }, (_, index) => ({
    d: new Date(now - index * 86400000).toISOString().slice(0, 10),
    c: 3000 + index
  })).reverse();

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/history')) {
      return new Response(JSON.stringify({ symbol: 'XAUUSD', interval: 'daily', points }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      spot_usd_oz: 4321.5,
      data_state: { status: 'fresh', age_seconds: 20 }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const result = await fetchXaus({ symbol: 'XAUUSD' });
    assert.equal(result.provider, 'xaus');
    assert.equal(result.symbol, 'XAUUSD');
    assert.ok(result.rows.length >= 30);
    assert.equal(result.rows.at(-1).value, 4321.5);
    assert.ok(result.rows.every((row) => Number.isFinite(row.timestamp) && row.value > 0));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('XAUS provider rejects unsupported symbols', async () => {
  await assert.rejects(fetchXaus({ symbol: 'GC=F' }), /xaus_unsupported_symbol/);
});
