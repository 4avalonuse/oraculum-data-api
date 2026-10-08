import { DATASETS } from '../datasets.js';

// Synchronize only changed metadata. In particular, never upsert every
// dataset on every Worker cold start: D1's free tier counts row writes.
export async function syncDatasetCatalog(db) {
  const now = Date.now();

  for (const dataset of DATASETS) {
    const kind = dataset.kind || 'ohlcv';
    const existing = await db.prepare(
      'SELECT id, name, provider, symbol, kind, interval, currency, description FROM datasets WHERE id = ?'
    ).bind(dataset.id).first();

    if (!existing) {
      await db.prepare(
        `INSERT INTO datasets
         (id, name, provider, symbol, kind, interval, currency, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        dataset.id, dataset.name, dataset.provider, dataset.symbol, kind,
        dataset.interval, dataset.currency, dataset.description, now, now
      ).run();
      continue;
    }

    const identityChanged =
      existing.provider !== dataset.provider ||
      existing.symbol !== dataset.symbol ||
      existing.kind !== kind;

    const metadataChanged =
      existing.name !== dataset.name ||
      identityChanged ||
      existing.interval !== dataset.interval ||
      existing.currency !== dataset.currency ||
      existing.description !== dataset.description;

    // Old candles must not be mixed with a different provider/symbol series.
    if (identityChanged) {
      await db.prepare('DELETE FROM candles WHERE dataset_id = ?')
        .bind(dataset.id).run();
    }

    if (metadataChanged) {
      await db.prepare(
        `UPDATE datasets SET
          name = ?, provider = ?, symbol = ?, kind = ?, interval = ?,
          currency = ?, description = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        dataset.name, dataset.provider, dataset.symbol, kind,
        dataset.interval, dataset.currency, dataset.description, now, dataset.id
      ).run();
    }
  }
}
