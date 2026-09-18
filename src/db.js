export async function ensureSchema(db) {
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

  const now = Date.now();
  const datasets = [
    {
      id: 'btc-usd-yahoo',
      name: 'Bitcoin / USD · Yahoo Finance',
      provider: 'yahoo',
      symbol: 'BTC-USD',
      interval: '1d',
      currency: 'USD',
      description: 'Bitcoin daily OHLCV from Yahoo Finance'
    },
    {
      id: 'btc-usd-binance-us-1m',
      name: 'Bitcoin / USD · Binance.US · 1m',
      provider: 'binance-us',
      symbol: 'BTCUSD',
      interval: '1m',
      currency: 'USD',
      description: 'Bitcoin minute OHLCV from Binance.US'
    },
    {
      id: 'btc-usd-binance-us-1h',
      name: 'Bitcoin / USD · Binance.US · 1h',
      provider: 'binance-us',
      symbol: 'BTCUSD',
      interval: '1h',
      currency: 'USD',
      description: 'Bitcoin hourly OHLCV from Binance.US'
    },
    {
      id: 'btc-usd-binance-us-1d',
      name: 'Bitcoin / USD · Binance.US · 1d',
      provider: 'binance-us',
      symbol: 'BTCUSD',
      interval: '1d',
      currency: 'USD',
      description: 'Bitcoin daily OHLCV from Binance.US'
    },
    {
      id: 'btc-usd-binance-us-1w',
      name: 'Bitcoin / USD · Binance.US · 1w',
      provider: 'binance-us',
      symbol: 'BTCUSD',
      interval: '1w',
      currency: 'USD',
      description: 'Bitcoin weekly OHLCV from Binance.US'
    },
    {
      id: 'btc-usd-binance-us-1M',
      name: 'Bitcoin / USD · Binance.US · 1M',
      provider: 'binance-us',
      symbol: 'BTCUSD',
      interval: '1M',
      currency: 'USD',
      description: 'Bitcoin monthly OHLCV from Binance.US'
    },
  ];

  await db.prepare("DELETE FROM datasets WHERE id IN ('btc-usdt-binance', 'btc-usdt-binance-1m', 'btc-usdt-binance-1h', 'btc-usdt-binance-1d', 'btc-usdt-binance-1w', 'btc-usdt-binance-1M')").run();

  for (const d of datasets) {
    await db.prepare(
      `INSERT OR IGNORE INTO datasets
       (id, name, provider, symbol, kind, interval, currency, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ohlcv', ?, ?, ?, ?, ?)`
    ).bind(
      d.id, d.name, d.provider, d.symbol, d.interval, d.currency, d.description, now, now
    ).run();
  }
}
