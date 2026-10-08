import { fetchYahoo } from './providers/yahoo.js';
import { fetchBinance } from './providers/binance.js';
import { fetchFred } from './providers/fred.js';
import { fetchSynthetic } from './providers/synthetic.js';
import { normalizeSeries } from './normalize-series.js';
import { normalizeCandles } from './normalize.js';
import { assessCandleQuality } from './quality/index.js';
import { auditContinuity } from './ingest/continuity.js';
import { recordFailedIngestion, recordSuccessfulIngestion, persistCandles } from './ingest/persist.js';

const providers = { yahoo: fetchYahoo, 'binance-us': fetchBinance, fred: fetchFred, synthetic: fetchSynthetic };
const MAX_HISTORY_BARS = 10000;

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

    // Request full history only for a new dataset. Re-fetching 10k rows for
    // every refresh creates unnecessary D1 writes, especially for series data.
    const historyBars = dataset.provider === 'synthetic'
      ? 500
      : (existingCount === 0 ? MAX_HISTORY_BARS : 1000);

    console.log(JSON.stringify({
      event: 'ingestion_plan',
      datasetId: dataset.id,
      existingCount,
      requestedBars: historyBars,
      mode: existingCount === 0 ? 'historical_backfill' : 'incremental_refresh'
    }));

    result = await fetcher({
      symbol: dataset.symbol,
      interval: dataset.interval,
      historyBars
    });

    // If a dataset changes provider identity (for example JUP-USD -> JUP29210-USD),
    // never mix the old series with the new one. The normalized D1 is rebuilt.
    const latestIngestion = await db.prepare(
      'SELECT provider, symbol FROM raw_ingestions WHERE dataset_id = ? AND request_status = \'ok\' ORDER BY fetched_at DESC LIMIT 1'
    ).bind(dataset.id).first();
    const identityChanged = latestIngestion && (
      latestIngestion.provider !== dataset.provider ||
      latestIngestion.symbol !== dataset.symbol
    );
    if (identityChanged) {
      await db.prepare('DELETE FROM candles WHERE dataset_id = ?').bind(dataset.id).run();
      existingCount = 0;
      console.log(JSON.stringify({
        event: 'ingestion_identity_reset',
        datasetId: dataset.id,
        previousProvider: latestIngestion.provider,
        previousSymbol: latestIngestion.symbol,
        provider: dataset.provider,
        symbol: dataset.symbol
      }));
    }
  } catch (error) {
    const message = String(error.message || error);
    await recordFailedIngestion(db, dataset, fetchedAt, message);

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

  const continuity = dataset.kind === 'series'
    ? { gaps: [], checked: result.rows.length }
    : auditContinuity(result.rows, dataset.interval);

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

  const normalized = dataset.kind === 'series'
    ? normalizeSeries(result.rows)
    : normalizeCandles(result.rows);

  const quality = dataset.kind === 'series'
    ? { candles: normalized.candles, anomalies: [], quality: null }
    : assessCandleQuality(normalized.candles);

  if (quality.anomalies.length) {
    console.warn(JSON.stringify({
      event: 'ingestion_anomalies_detected',
      datasetId: dataset.id,
      provider: result.provider,
      symbol: result.symbol,
      anomalyCount: quality.anomalies.length,
      anomalies: quality.anomalies
    }));

    for (const anomaly of quality.anomalies) {
      await db.prepare(
        'DELETE FROM candles WHERE dataset_id = ? AND timestamp = ?'
      ).bind(dataset.id, anomaly.timestamp).run();
    }
  }

  const acceptedCandles = quality.candles;

  await recordSuccessfulIngestion(
    db,
    dataset.id,
    result,
    fetchedAt,
    acceptedCandles.length,
    normalized.rejected.length + quality.anomalies.length
  );

  console.log(JSON.stringify({
    event: 'ingestion_normalized',
    datasetId: dataset.id,
    fetched: result.rows.length,
    normalized: acceptedCandles.length,
    rejected: normalized.rejected.length,
    anomalies: quality.anomalies.length,
    duplicatesRemoved: normalized.duplicatesRemoved
  }));

  const finalCount = await persistCandles(db, dataset.id, acceptedCandles, fetchedAt);

  const report = {
    datasetId: dataset.id,
    provider: result.provider,
    fetched: result.rows.length,
    normalized: acceptedCandles.length,
    rejected: normalized.rejected.length,
    anomalies: quality.anomalies.length,
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
    `SELECT id, provider, symbol, kind, interval
     FROM datasets
     WHERE provider IN ('yahoo', 'binance-us', 'fred', 'synthetic')
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
