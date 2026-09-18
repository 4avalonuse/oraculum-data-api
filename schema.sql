-- Oraculum Data API — D1 schema
-- Dataset metadata is separate from time-series observations.
-- Keep the first schema small; new series/types can be added without
-- coupling the database to the chart renderer.

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

CREATE TABLE IF NOT EXISTS api_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER NOT NULL
);
