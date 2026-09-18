-- Oraculum Data API — raw ingestion audit trail
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
