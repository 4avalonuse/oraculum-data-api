// Database structure and compatibility migration only.
// Dataset metadata and event catalogs are managed by separate modules.

export async function ensureTables(db) {
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

  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)'
  ).run();

  // Safe for both older and newer databases: the error is expected if the
  // column already exists. Keep this migration here, beside the schema.
  await db.prepare(
    "ALTER TABLE events ADD COLUMN scope TEXT NOT NULL DEFAULT 'asset'"
  ).run().catch(() => {});

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS api_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL
    )
  `).run();

  // Atomic lease used to ensure only one request refreshes a dataset at a time.
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS refresh_locks (
      dataset_id TEXT PRIMARY KEY,
      locked_until INTEGER NOT NULL
    )
  `).run();
}
