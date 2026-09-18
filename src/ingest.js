import { fetchYahoo } from './providers/yahoo.js';
import { fetchBinance } from './providers/binance.js';
import { normalizeCandles } from './normalize.js';

const providers = { yahoo: fetchYahoo, 'binance-us': fetchBinance };

export async function ingestDataset(db, dataset) {
  const fetcher = providers[dataset.provider];
  if (!fetcher) throw new Error(`unsupported_provider_${dataset.provider}`);

  const fetchedAt = Date.now();
  let result;

  try {
    // Keep the request bounded and fast for the Worker. Historical
    // backfill can be added separately without blocking the chart.
    const historyBars = 1000;

    result = await fetcher({
      symbol: dataset.symbol,
      interval: dataset.interval,
      historyBars
    });
  } catch (error) {
    await db.prepare(
      `INSERT INTO raw_ingestions
       (dataset_id, provider, symbol, fetched_at, request_status, error)
       VALUES (?, ?, ?, ?, 'error', ?)`
    ).bind(
      dataset.id, dataset.provider, dataset.symbol, fetchedAt, String(error.message || error)
    ).run();
    throw error;
  }

  const normalized = normalizeCandles(result.rows);

  await db.prepare(
    `INSERT INTO raw_ingestions
     (dataset_id, provider, symbol, fetched_at, request_status, payload, row_count, normalized_count, rejected_count)
     VALUES (?, ?, ?, ?, 'ok', ?, ?, ?, ?)`
  ).bind(
    dataset.id,
    result.provider,
    result.symbol,
    fetchedAt,
    JSON.stringify(result.raw),
    result.rows.length,
    normalized.candles.length,
    normalized.rejected.length
  ).run();

  for (let i = 0; i < normalized.candles.length; i += 100) {
    const chunk = normalized.candles.slice(i, i + 100);
    const statement = db.prepare(
      `INSERT INTO candles
       (dataset_id, timestamp, open, high, low, close, volume)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(dataset_id, timestamp) DO UPDATE SET
         open = excluded.open,
         high = excluded.high,
         low = excluded.low,
         close = excluded.close,
         volume = excluded.volume`
    );
    await db.batch(chunk.map((c) => statement.bind(
      dataset.id, c.timestamp, c.open, c.high, c.low, c.close, c.volume
    )));
  }

  await db.prepare(
    'UPDATE datasets SET updated_at = ? WHERE id = ?'
  ).bind(fetchedAt, dataset.id).run();

  return {
    datasetId: dataset.id,
    provider: result.provider,
    fetched: result.rows.length,
    normalized: normalized.candles.length,
    rejected: normalized.rejected.length,
    duplicatesRemoved: normalized.duplicatesRemoved,
    fetchedAt
  };
}

export async function ingestAll(db) {
  const result = await db.prepare(
    `SELECT id, provider, symbol, interval
     FROM datasets
     WHERE provider IN ('yahoo', 'binance-us')
     ORDER BY id`
  ).all();

  const reports = [];
  for (const dataset of result.results || []) {
    try {
      reports.push({ ok: true, ...(await ingestDataset(db, dataset)) });
    } catch (error) {
      reports.push({
        ok: false,
        datasetId: dataset.id,
        provider: dataset.provider,
        error: String(error.message || error)
      });
    }
  }
  return reports;
}
