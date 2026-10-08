import { MACRO_EVENTS } from './macro.js';

// Increment this version whenever MARKET_EVENTS, MACRO_EVENTS, or HALVINGS change.
export const EVENT_SEED_VERSION = '2026-10-08-v1';

const HALVINGS = [
  ['btc-halving-2012', '2012-11-28', 'Bitcoin Halving 2012', 210000, 50, 25, 'Bitcoin.org'],
  ['btc-halving-2016', '2016-07-09', 'Bitcoin Halving 2016', 420000, 25, 12.5, 'Bitcoin.org'],
  ['btc-halving-2020', '2020-05-11', 'Bitcoin Halving 2020', 630000, 12.5, 6.25, 'Bitcoin.org'],
  ['btc-halving-2024', '2024-04-20', 'Bitcoin Halving 2024', 840000, 6.25, 3.125, 'Bitcoin.org']
];

const MARKET_EVENTS = [
  {
    id: 'strategy-btc-sale-2026-05', date: '2026-05-31', category: 'market', type: 'institutional_btc_sale',
    title: 'Strategy vendeu 32 BTC',
    description: 'Strategy vendeu 32 BTC por aproximadamente US$2,5 milhões; primeira venda desde dezembro de 2022.',
    source: 'The Block', importance: 0.8, metadata: { btc: 32, amountUsd: 2500000, averagePriceUsd: 77135 }
  },
  {
    id: 'btc-og-whale-80000-2025-07', date: '2025-07-04', category: 'ecosystem', type: 'whale_movement',
    title: 'Baleia antiga movimenta mais de 80.000 BTC',
    description: 'Mais de 80.000 BTC permaneceram dormentes por cerca de 14 anos antes de serem transferidos para novos endereços.',
    source: 'The Block / Arkham', importance: 1, metadata: { btc: 80000, dormancyYears: 14 }
  },
  {
    id: 'btc-spot-etf-approval-2024-01', date: '2024-01-10', category: 'regulatory', type: 'spot_etf_approval',
    title: 'SEC aprova ETFs spot de Bitcoin',
    description: 'A SEC aprovou a listagem e negociação de diversos produtos negociados em bolsa de Bitcoin spot nos EUA.',
    source: 'SEC', importance: 1, metadata: { tradingStartDate: '2024-01-11' }
  },
  {
    id: 'mtgox-repayments-2024-07', date: '2024-07-05', category: 'market', type: 'exchange_repayment_flow',
    title: 'Mt. Gox inicia fluxo de restituição de BTC',
    description: 'A restituição de Bitcoin aos credores da Mt. Gox aumentou a preocupação com possível pressão de venda e coincidiu com forte volatilidade do BTC.',
    source: 'Reuters', importance: 0.9, metadata: { entity: 'Mt. Gox', flowType: 'creditor_repayments' }
  }
];

export async function seedEvents(db) {
  const seedState = await db.prepare(
    'SELECT value FROM api_meta WHERE key = ?'
  ).bind('events_seed_version').first();
  if (seedState?.value === EVENT_SEED_VERSION) return;

  for (const event of MARKET_EVENTS) {
    await db.prepare(
      `INSERT OR IGNORE INTO events
       (id, timestamp, category, type, title, description, source, importance, asset_ids, metadata, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      JSON.stringify({ date: event.date, ...event.metadata }),
      'asset'
    ).run();
  }

  for (const event of MACRO_EVENTS) {
    await db.prepare(`INSERT OR IGNORE INTO events (id, timestamp, category, type, title, description, source, importance, asset_ids, metadata, scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(event.id, Date.parse(event.date + 'T00:00:00Z'), event.category, event.type, event.title, event.description, event.source, event.importance, JSON.stringify([]), JSON.stringify({ date: event.date, ...(event.metadata || {}) }), 'global').run();
  }

  for (const [id, date, title, block, rewardBefore, rewardAfter, source] of HALVINGS) {
    await db.prepare(
      `INSERT OR IGNORE INTO events
       (id, timestamp, category, type, title, description, source, importance, asset_ids, metadata, scope)
       VALUES (?, ?, 'Crypto', 'bitcoin_halving', ?, ?, ?, 1, ?, ?, ?)`
    ).bind(
      id,
      Date.parse(date + 'T00:00:00Z'),
      title,
      `Bitcoin block ${block}: reward ${rewardBefore} → ${rewardAfter} BTC`,
      source,
      JSON.stringify(['btc-usd']),
      JSON.stringify({ date, block, rewardBefore, rewardAfter }),
      'asset'
    ).run();
  }

  
  await db.prepare(
    'INSERT INTO api_meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).bind('events_seed_version', EVENT_SEED_VERSION, Date.now()).run();
}
