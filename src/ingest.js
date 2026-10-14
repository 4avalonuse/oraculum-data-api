import { fetchYahoo } from './providers/yahoo.js';
import { fetchBinance } from './providers/binance.js';
import { fetchFred } from './providers/fred.js';
import { fetchXaus } from './providers/xaus.js';
import { fetchSynthetic } from './providers/synthetic.js';
import { normalizeSeries } from './normalize-series.js';
import { normalizeCandles } from './normalize.js';
import { assessCandleQuality } from './quality/index.js';
import { auditContinuity } from './ingest/continuity.js';
import { recordFailedIngestion, recordSuccessfulIngestion, persistCandles } from './ingest/persist.js';

const providers = { yahoo: fetchYahoo, 'binance-us': fetchBinance, fred: fetchFred, xaus: fetchXaus, synthetic: fetchSynthetic };
const MAX_HISTORY_BARS = 10000;
const DAY_MS = 86400000;

function parseGoldPayload(payload) {
  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const points = parsed?.history?.points;
    if (!Array.isArray(points) || !points.length) return null;
    const firstTimestamp = Date.parse(points[0]?.d);
    const sourceStart = Number.isFinite(firstTimestamp) ? Date.UTC(
      new Date(firstTimestamp).getUTCFullYear(),
      new Date(firstTimestamp).getUTCMonth(),
      new Date(firstTimestamp).getUTCDate()
    ) : null;
    return { sourceStart, sourceCount: points.length };
  } catch {
    return null;
  }
}

export async function getHistoricalBackfillState(db, dataset) {
  if (!['gold-spot-xaus-1d', 'oil-wti-spot-fred-1d'].includes(dataset.id)) {
    return { required: false, existingCount: null, oldestTimestamp: null };
  }

  const existing = await db.prepare(
    'SELECT COUNT(*) AS count, MIN(timestamp) AS oldest_timestamp FROM candles WHERE dataset_id = ?'
  ).bind(dataset.id).first();
  const existingCount = Number(existing?.count || 0);
  const oldestTimestamp = existing?.oldest_timestamp == null ? null : Number(existing.oldest_timestamp);

  let required = existingCount === 0;
  if (dataset.id === 'oil-wti-spot-fred-1d' && oldestTimestamp !== null) {
    // WTI's official daily spot series starts on 1986-01-02 and has thousands
    // of observations. Count and start-date checks catch quota-interrupted loads.
    required ||= oldestTimestamp > Date.UTC(1986, 0, 2) || existingCount < 9500;
  }
  if (dataset.id === 'gold-spot-xaus-1d' && existingCount > 0) {
    const prior = await db.prepare(
      "SELECT payload FROM raw_ingestions WHERE dataset_id = ? AND request_status = 'ok' ORDER BY fetched_at DESC LIMIT 1"
    ).bind(dataset.id).first();
    const goldHistory = parseGoldPayload(prior?.payload);
    if (goldHistory && oldestTimestamp !== null) {
      required ||= oldestTimestamp > goldHistory.sourceStart + DAY_MS ||
        existingCount < Math.max(1, goldHistory.sourceCount - 5);
    } else if (oldestTimestamp !== null) {
      required ||= oldestTimestamp > Date.now() - 3 * 365 * DAY_MS;
    }
  }

  return { required, existingCount, oldestTimestamp };
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
    const backfillState = await getHistoricalBackfillState(db, dataset);
    existingCount = backfillState.existingCount ?? 0;
    const oldestTimestamp = backfillState.oldestTimestamp;
    const fullHistoryRequired = backfillState.required;

    const historyBars = dataset.provider === 'synthetic'
      ? 500
      : (fullHistoryRequired ? MAX_HISTORY_BARS : 1000);

    console.log(JSON.stringify({
      event: 'ingestion_plan',
      datasetId: dataset.id,
      existingCount,
      oldestTimestamp,
      requestedBars: historyBars,
      mode: fullHistoryRequired ? 'historical_backfill' : 'incremental_refresh'
    }));

    result = await fetcher({
      symbol: dataset.symbol,
      interval: dataset.interval,
      historyBars
    });

    // If a dataset changes provider identity (for example JUP-USD -> JUP29210-USD),
    // never mix the old series with the new one. The normalized D1 is rebuilt.
    const latestIngestion = await db.prepare(
      "SELECT provider, symbol FROM raw_ingestions WHERE dataset_id = ? AND request_status = 'ok' ORDER BY fetched_at DESC LIMIT 1"
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

  // Mark the ingestion successful only after candle persistence completes.
  await recordSuccessfulIngestion(
    db,
    dataset.id,
    result,
    fetchedAt,
    acceptedCandles.length,
    normalized.rejected.length + quality.anomalies.length
  );

  const report = {
    datasetId: dataset.id,
    provider: result.provider,
    fetched: result.rows.length,
    normalized: acceptedCandles.length,
    rejected: normalized.rejected.length,
    anomalies: quality.anomalies.length,
    duplicatesRemoved: normalized.duplicatesRemoved,
    existingCount,
    finalCount,
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
     WHERE provider IN ('yahoo', 'binance-us', 'fred', 'xaus', 'synthetic')
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
