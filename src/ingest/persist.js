// Persistence helpers for ingestion history and normalized candle rows.

export async function recordFailedIngestion(db, dataset, fetchedAt, errorMessage) {
  await db.prepare(
    `INSERT INTO raw_ingestions
     (dataset_id, provider, symbol, fetched_at, request_status, error)
     VALUES (?, ?, ?, ?, 'error', ?)`
  ).bind(
    dataset.id, dataset.provider, dataset.symbol, fetchedAt, errorMessage
  ).run();
}

export async function recordSuccessfulIngestion(db, datasetId, result, fetchedAt, acceptedCount, rejectedCount) {
  await db.prepare(
    `INSERT INTO raw_ingestions
     (dataset_id, provider, symbol, fetched_at, request_status, payload, row_count, normalized_count, rejected_count)
     VALUES (?, ?, ?, ?, 'ok', ?, ?, ?, ?)`
  ).bind(
    datasetId,
    result.provider,
    result.symbol,
    fetchedAt,
    JSON.stringify(result.raw),
    result.rows.length,
    acceptedCount,
    rejectedCount
  ).run();
}

export async function persistCandles(db, datasetId, candles, fetchedAt) {
  for (let i = 0; i < candles.length; i += 100) {
    const chunk = candles.slice(i, i + 100);
    const statement = db.prepare(
      `INSERT INTO candles
       (dataset_id, timestamp, open, high, low, close, volume)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(dataset_id, timestamp) DO UPDATE SET
         open = excluded.open,
         high = excluded.high,
         low = excluded.low,
         close = excluded.close,
         volume = excluded.volume
       WHERE candles.open IS NOT excluded.open
          OR candles.high IS NOT excluded.high
          OR candles.low IS NOT excluded.low
          OR candles.close IS NOT excluded.close
          OR candles.volume IS NOT excluded.volume`
    );

    await db.batch(chunk.map((candle) => statement.bind(
      datasetId,
      candle.timestamp,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume
    )));
  }

  await db.prepare(
    'UPDATE datasets SET updated_at = ? WHERE id = ?'
  ).bind(fetchedAt, datasetId).run();

  const finalCount = await db.prepare(
    'SELECT COUNT(*) AS count FROM candles WHERE dataset_id = ?'
  ).bind(datasetId).first();

  return Number(finalCount?.count || 0);
}
