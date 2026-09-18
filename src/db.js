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
      name: 'Bitcoin / USD',
      provider: 'yahoo',
      symbol: 'BTC-USD',
      interval: '1d',
      currency: 'USD',
      description: 'Bitcoin daily OHLCV from Yahoo Finance'
    },
    {
      id: 'btc-usdt-binance-1m',
      name: 'Bitcoin / USDT · 1m',
      provider: 'binance',
      symbol: 'BTCUSDT',
      interval: '1m',
      currency: 'USDT',
      description: 'Bitcoin minute OHLCV from Binance Spot'
    },
    {
      id: 'btc-usdt-binance-1h',
      name: 'Bitcoin / USDT · 1h',
      provider: 'binance',
      symbol: 'BTCUSDT',
      interval: '1h',
      currency: 'USDT',
      description: 'Bitcoin hourly OHLCV from Binance Spot'
    },
    {
      id: 'btc-usdt-binance-1d',
      name: 'Bitcoin / USDT · 1d',
      provider: 'binance',
      symbol: 'BTCUSDT',
      interval: '1d',
      currency: 'USDT',
      description: 'Bitcoin daily OHLCV from Binance Spot'
    },
    {
      id: 'btc-usdt-binance-1w',
      name: 'Bitcoin / USDT · 1w',
      provider: 'binance',
      symbol: 'BTCUSDT',
      interval: '1w',
      currency: 'USDT',
      description: 'Bitcoin weekly OHLCV from Binance Spot'
    },
    {
      id: 'btc-usdt-binance-1M',
      name: 'Bitcoin / USDT · 1M',
      provider: 'binance',
      symbol: 'BTCUSDT',
      interval: '1M',
      currency: 'USDT',
      description: 'Bitcoin monthly OHLCV from Binance Spot'
    }
  ];

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
