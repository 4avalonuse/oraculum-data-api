import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFred } from '../src/providers/fred.js';

test('FRED full WTI backfill uses date windows and skips missing observations', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(new URL(String(input)));
    return new Response('observation_date,DCOILWTICO\n1986-01-02,25.56\n1986-01-03,.\n1986-01-06,26.00\n', {
      status: 200,
      headers: { 'Content-Type': 'text/csv' }
    });
  };

  try {
    const result = await fetchFred({ symbol: 'DCOILWTICO', historyBars: 10000 });
    assert.equal(requestedUrls[0].searchParams.get('cosd'), '1986-01-01');
    assert.ok(requestedUrls.length >= 8, 'full history should be split into multiple smaller requests');
    assert.equal(result.raw.chunks.length, requestedUrls.length);
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

test('FRED retries a transient server error', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response('temporary upstream failure', { status: 520 });
    return new Response('observation_date,DCOILWTICO\\n2026-10-01,90.00\\n', {
      status: 200,
      headers: { 'Content-Type': 'text/csv' }
    });
  };

  try {
    const result = await fetchFred({ symbol: 'DCOILWTICO', historyBars: 1000 });
    assert.equal(calls, 2);
    assert.equal(result.rows[0].value, 90);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
