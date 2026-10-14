import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFred } from '../src/providers/fred.js';

test('FRED full WTI backfill starts at the beginning of the official daily series', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response('observation_date,DCOILWTICO\n1986-01-02,25.56\n1986-01-03,.\n1986-01-06,26.00\n', {
      status: 200,
      headers: { 'Content-Type': 'text/csv' }
    });
  };

  try {
    const result = await fetchFred({ symbol: 'DCOILWTICO', historyBars: 10000 });
    assert.equal(requestedUrl.searchParams.get('cosd'), '1986-01-01');
    assert.deepEqual(result.rows.map((row) => row.value), [25.56, 26]);
    assert.equal(result.rows.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FRED routine WTI refresh uses a bounded window', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response('observation_date,DCOILWTICO\n2026-10-01,90.00\n', {
      status: 200,
      headers: { 'Content-Type': 'text/csv' }
    });
  };

  try {
    await fetchFred({ symbol: 'DCOILWTICO', historyBars: 1000 });
    assert.notEqual(requestedUrl.searchParams.get('cosd'), '1986-01-01');
    assert.equal(requestedUrl.searchParams.get('id'), 'DCOILWTICO');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
