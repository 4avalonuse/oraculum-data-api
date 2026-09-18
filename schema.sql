-- Oraculum Data API — D1 schema
-- One backend, with raw provider payloads preserved separately from
-- normalized candles consumed by OChart.

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
);

-- NORMALIZED time-series data. OChart reads this table through the API.
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
);

CREATE INDEX IF NOT EXISTS idx_candles_dataset_timestamp
  ON candles(dataset_id, timestamp);

-- RAW provider responses. Never overwrite these during normalization.
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
);

CREATE INDEX IF NOT EXISTS idx_raw_ingestions_dataset_fetched
  ON raw_ingestions(dataset_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS api_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER NOT NULL
);
