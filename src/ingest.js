import { fetchYahoo } from './providers/yahoo.js';
import { fetchBinance } from './providers/binance.js';
import { normalizeCandles } from './normalize.js';

const providers = { yahoo: fetchYahoo, 'binance-us': fetchBinance };
const MAX_HISTORY_BARS = 10000;

function expectedNextTimestamp(timestamp, interval) {
  const date = new Date(timestamp);

  switch (interval) {
    case '1m': return timestamp + 60_000;
    case '1h': return timestamp + 3_600_000;
    case '1d': return timestamp + 86_400_000;
    case '1w': return timestamp + 7 * 86_400_000;
    case '1M': {
      const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
      return next.getTime();
    }
    default: return null;
  }
}

function auditContinuity(rows, interval) {
  if (rows.length < 2) return { gaps: [], checked: rows.length };

  const sorted = rows
    .map((row) => Number(row.timestamp))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const expected = expectedNextTimestamp(previous, interval);
    if (expected !== null && current > expected) {
      gaps.push({
        from: previous,
        to: current,
        missingMs: current - expected
      });
    }
  }

  return { gaps, checked: sorted.length };
}

export async function ingestDataset(db, dataset) {
  const startedAt = Date.now();
  const fetcher = providers[dataset.provider];
  if (!fetcher) throw new Error(`unsupported_provider_${dataset.provider}`);

  console.log(JSON.stringify({
    event: 'ingestion_start',
    datasetId: dataset.id,
    provider: dataset.provider,
    symbol: dataset.symbol,
    interval: dataset.interval
  }));

  const fetchedAt = Date.now();
  let result;
  let existingCount = 0;

  try {
    const existing = await db.prepare(
      'SELECT COUNT(*) AS count FROM candles WHERE dataset_id = ?'
    ).bind(dataset.id).first();
    existingCount = Number(existing?.count || 0);

    const historyBars = existingCount < MAX_HISTORY_BARS ? MAX_HISTORY_BARS : 1000;

    console.log(JSON.stringify({
      event: 'ingestion_plan',
      datasetId: dataset.id,
      existingCount,
      requestedBars: historyBars,
      mode: existingCount < MAX_HISTORY_BARS ? 'historical_backfill' : 'incremental_refresh'
    }));

    result = await fetcher({
      symbol: dataset.symbol,
      interval: dataset.interval,
      historyBars
    });
  } catch (error) {
    const message = String(error.message || error);
    await db.prepare(
      `INSERT INTO raw_ingestions
       (dataset_id, provider, symbol, fetched_at, request_status, error)
       VALUES (?, ?, ?, ?, 'error', ?)`
    ).bind(
      dataset.id, dataset.provider, dataset.symbol, fetchedAt, message
    ).run();

    console.error(JSON.stringify({
      event: 'ingestion_provider_failed',
      datasetId: dataset.id,
      provider: dataset.provider,
      symbol: dataset.symbol,
      interval: dataset.interval,
      error: message,
      durationMs: Date.now() - startedAt
    }));
    throw error;
  }

  const continuity = auditContinuity(result.rows, dataset.interval);
  if (continuity.gaps.length) {
    console.warn(JSON.stringify({
      event: 'ingestion_continuity_warning',
      datasetId: dataset.id,
      provider: dataset.provider,
      interval: dataset.interval,
      gapCount: continuity.gaps.length,
      firstGap: continuity.gaps[0],
      checked: continuity.checked
    }));
  } else {
    console.log(JSON.stringify({
      event: 'ingestion_continuity_ok',
      datasetId: dataset.id,
      interval: dataset.interval,
      checked: continuity.checked
    }));
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

  console.log(JSON.stringify({
    event: 'ingestion_normalized',
    datasetId: dataset.id,
    fetched: result.rows.length,
    normalized: normalized.candles.length,
    rejected: normalized.rejected.length,
    duplicatesRemoved: normalized.duplicatesRemoved
  }));

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

  const finalCount = await db.prepare(
    'SELECT COUNT(*) AS count FROM candles WHERE dataset_id = ?'
  ).bind(dataset.id).first();

  const report = {
    datasetId: dataset.id,
    provider: result.provider,
    fetched: result.rows.length,
    normalized: normalized.candles.length,
    rejected: normalized.rejected.length,
    duplicatesRemoved: normalized.duplicatesRemoved,
    existingCount,
    finalCount: Number(finalCount?.count || 0),
    continuityGaps: continuity.gaps.length,
    fetchedAt,
    durationMs: Date.now() - startedAt
  };

  console.log(JSON.stringify({
    event: 'ingestion_complete',
    ...report
  }));

  return report;
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
