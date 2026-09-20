import { DATASETS } from './datasets.js';

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
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume REAL,
      PRIMARY KEY (dataset_id, timestamp),
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    )
  `).run();

  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_candles_dataset_timestamp ON candles(dataset_id, timestamp)'
  ).run();

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

  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_raw_ingestions_dataset_fetched ON raw_ingestions(dataset_id, fetched_at DESC)'
  ).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS api_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL
    )
  `).run();

  const now = Date.now();

  for (const d of DATASETS) {
    await db.prepare(
      `INSERT OR IGNORE INTO datasets
       (id, name, provider, symbol, kind, interval, currency, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ohlcv', ?, ?, ?, ?, ?)`
    ).bind(
      d.id,
      d.name,
      d.provider,
      d.symbol,
      d.interval,
      d.currency,
      d.description,
      now,
      now
    ).run();
  }
}

export async function ensureSchema(db) {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = initializeSchema(db)
      .then(() => {
        schemaReady = true;
      })
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}
