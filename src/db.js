import { DATASETS } from './datasets.js';
import { seedEvents } from './events/seed.js';

let schemaReady = false;
let schemaPromise = null;

async function initializeSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      symbol TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'ohlcv',
      interval TEXT,
      currency TEXT,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS candles (
      dataset_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      open REAL, high REAL, low REAL, close REAL, volume REAL,
      PRIMARY KEY (dataset_id, timestamp),
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    )
  `).run();

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_candles_dataset_timestamp ON candles(dataset_id, timestamp)').run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS raw_ingestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      symbol TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      request_status TEXT NOT NULL,
      payload TEXT,
      row_count INTEGER NOT NULL DEFAULT 0,
      normalized_count INTEGER NOT NULL DEFAULT 0,
      rejected_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    )
  `).run();

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_raw_ingestions_dataset_fetched ON raw_ingestions(dataset_id, fetched_at DESC)').run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT,
      importance REAL,
      asset_ids TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      scope TEXT NOT NULL DEFAULT 'asset'
    )
  `).run();

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)').run();

  await db.prepare("ALTER TABLE events ADD COLUMN scope TEXT NOT NULL DEFAULT 'asset'").run().catch(() => {});



  await db.prepare(`
    CREATE TABLE IF NOT EXISTS api_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL
    )
  `).run();

  const now = Date.now();

  for (const d of DATASETS) {
    const kind = d.kind || 'ohlcv';
    const existingDataset = await db.prepare(
      'SELECT id, name, provider, symbol, kind, interval, currency, description FROM datasets WHERE id = ?'
    ).bind(d.id).first();

    if (!existingDataset) {
      await db.prepare(
        `INSERT INTO datasets
         (id, name, provider, symbol, kind, interval, currency, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        d.id, d.name, d.provider, d.symbol, kind, d.interval,
        d.currency, d.description, now, now
      ).run();
      continue;
    }

    const identityChanged =
      existingDataset.provider !== d.provider ||
      existingDataset.symbol !== d.symbol ||
      existingDataset.kind !== kind;

    const metadataChanged =
      existingDataset.name !== d.name ||
      identityChanged ||
      existingDataset.interval !== d.interval ||
      existingDataset.currency !== d.currency ||
      existingDataset.description !== d.description;

    // Avoid rewriting every catalog row on each Worker cold start. D1's free
    // tier counts row writes, and the catalog is unchanged for most requests.
    if (identityChanged) {
      await db.prepare('DELETE FROM candles WHERE dataset_id = ?').bind(d.id).run();
    }

    if (metadataChanged) {
      await db.prepare(
        `UPDATE datasets SET
          name = ?, provider = ?, symbol = ?, kind = ?, interval = ?,
          currency = ?, description = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        d.name, d.provider, d.symbol, kind, d.interval,
        d.currency, d.description, now, d.id
      ).run();
    }
  }

  // TEST datasets are provisioned in the catalog but populated lazily by the normal refresh/load path.
  // This keeps schema initialization fast and cannot block the existing BTC startup path.

  await seedEvents(db);
}

export async function ensureSchema(db) {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = initializeSchema(db)
      .then(() => { schemaReady = true; })
      .catch((error) => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

// Macro event layer reviewed against Federal Reserve historical policy data.
