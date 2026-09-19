import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixtureUrl = new URL('./fixtures/sample-dataset.json', import.meta.url);

test('dataset fixture contains the minimum public Data API contract', async () => {
  const payload = JSON.parse(await readFile(fixtureUrl, 'utf8'));

  assert.equal(payload.ok, true);
  assert.equal(typeof payload.meta.datasetId, 'string');
  assert.equal(typeof payload.meta.symbol, 'string');
  assert.equal(typeof payload.meta.interval, 'string');
  assert.equal(payload.meta.kind, 'ohlcv');
  assert.ok(Array.isArray(payload.data));
  assert.ok(payload.data.length > 0);

  for (const row of payload.data) {
    for (const key of ['t', 'o', 'h', 'l', 'c', 'v']) {
      assert.equal(typeof row[key], 'number');
    }
    assert.ok(row.h >= Math.max(row.o, row.c));
    assert.ok(row.l <= Math.min(row.o, row.c));
    assert.ok(row.l >= 0);
  }
});
