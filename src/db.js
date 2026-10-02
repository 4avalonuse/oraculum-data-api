import { DATASETS } from './datasets.js';

const HALVINGS = [
  ['btc-halving-2012', '2012-11-28', 'Bitcoin Halving 2012', 210000, 50, 25, 'Bitcoin.org'],
  ['btc-halving-2016', '2016-07-09', 'Bitcoin Halving 2016', 420000, 25, 12.5, 'Bitcoin.org'],
  ['btc-halving-2020', '2020-05-11', 'Bitcoin Halving 2020', 630000, 12.5, 6.25, 'Bitcoin.org'],
  ['btc-halving-2024', '2024-04-20', 'Bitcoin Halving 2024', 840000, 6.25, 3.125, 'Bitcoin.org']
];

const MARKET_EVENTS = [
  {
    id: 'strategy-btc-sale-2026-05', date: '2026-05-31', category: 'Institutional', type: 'institutional_btc_sale',
    title: 'Strategy vendeu 32 BTC',
    description: 'Strategy vendeu 32 BTC por aproximadamente US$2,5 milhões; primeira venda desde dezembro de 2022.',
    source: 'The Block', importance: 0.8, metadata: { btc: 32, amountUsd: 2500000, averagePriceUsd: 77135 }
  },
  {
    id: 'btc-og-whale-80000-2025-07', date: '2025-07-04', category: 'OnChain', type: 'whale_movement',
    title: 'Baleia antiga movimenta mais de 80.000 BTC',
    description: 'Mais de 80.000 BTC permaneceram dormentes por cerca de 14 anos antes de serem transferidos para novos endereços.',
    source: 'The Block / Arkham', importance: 1, metadata: { btc: 80000, dormancyYears: 14 }
  },
  {
    id: 'btc-spot-etf-approval-2024-01', date: '2024-01-10', category: 'Regulation', type: 'spot_etf_approval',
    title: 'SEC aprova ETFs spot de Bitcoin',
    description: 'A SEC aprovou a listagem e negociação de diversos produtos negociados em bolsa de Bitcoin spot nos EUA.',
    source: 'SEC', importance: 1, metadata: { tradingStartDate: '2024-01-11' }
  },
  {
    id: 'mtgox-repayments-2024-07', date: '2024-07-05', category: 'Market', type: 'exchange_repayment_flow',
    title: 'Mt. Gox inicia fluxo de restituição de BTC',
    description: 'A restituição de Bitcoin aos credores da Mt. Gox aumentou a preocupação com possível pressão de venda e coincidiu com forte volatilidade do BTC.',
    source: 'Reuters', importance: 0.9, metadata: { entity: 'Mt. Gox', flowType: 'creditor_repayments' }
  }
];

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
      metadata TEXT NOT NULL DEFAULT '{}'
    )
  `).run();

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)').run();

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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      d.id, d.name, d.provider, d.symbol, d.kind || 'ohlcv', d.interval,
      d.currency, d.description, now, now
    ).run();
  }

  for (const event of MARKET_EVENTS) {
    await db.prepare(
      `INSERT OR IGNORE INTO events
       (id, timestamp, category, type, title, description, source, importance, asset_ids, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      event.id,
      Date.parse(event.date + 'T00:00:00Z'),
      event.category,
      event.type,
      event.title,
      event.description,
      event.source,
      event.importance,
      JSON.stringify(['btc-usd']),
      JSON.stringify({ date: event.date, ...event.metadata })
    ).run();
  }

  for (const [id, date, title, block, rewardBefore, rewardAfter, source] of HALVINGS) {
    await db.prepare(
      `INSERT OR IGNORE INTO events
       (id, timestamp, category, type, title, description, source, importance, asset_ids, metadata)
       VALUES (?, ?, 'Crypto', 'bitcoin_halving', ?, ?, ?, 1, ?, ?)`
    ).bind(
      id,
      Date.parse(date + 'T00:00:00Z'),
      title,
      `Bitcoin block ${block}: reward ${rewardBefore} → ${rewardAfter} BTC`,
      source,
      JSON.stringify(['btc-usd']),
      JSON.stringify({ date, block, rewardBefore, rewardAfter })
    ).run();
  }
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
