import test from 'node:test';
import assert from 'node:assert/strict';
import { DATASETS } from '../src/datasets.js';

test('dataset catalog contains unique ids', () => {
  const ids = DATASETS.map((dataset) => dataset.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('dataset catalog entries contain ingestion metadata', () => {
  for (const dataset of DATASETS) {
    assert.ok(dataset.id);
    assert.ok(dataset.provider);
    assert.ok(dataset.symbol);
    assert.ok(dataset.interval);
    assert.ok(dataset.currency);
  }
});

test('current catalog covers both providers for BTC/USD', () => {
  const providers = new Set(
    DATASETS
      .filter((dataset) => dataset.symbol === 'BTC-USD' || dataset.symbol === 'BTCUSD')
      .map((dataset) => dataset.provider)
  );

  assert.deepEqual([...providers].sort(), ['binance-us', 'yahoo']);
});
