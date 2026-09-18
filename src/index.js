import { ingestAll, ingestDataset } from './ingest.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function ensureSchema(db) {
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
  await db.prepare(
    `INSERT OR IGNORE INTO datasets
     (id, name, provider, symbol, kind, interval, currency, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ohlcv', ?, ?, ?, ?, ?)`
  ).bind(
    'btc-usd-yahoo', 'Bitcoin / USD', 'yahoo', 'BTC-USD', '1d', 'USD',
    'Bitcoin daily OHLCV from Yahoo Finance', now, now
  ).run();

  await db.prepare(
    `INSERT OR IGNORE INTO datasets
     (id, name, provider, symbol, kind, interval, currency, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ohlcv', ?, ?, ?, ?, ?)`
  ).bind(
    'btc-usdt-binance', 'Bitcoin / USDT', 'binance', 'BTCUSDT', '1h', 'USDT',
    'Bitcoin hourly OHLCV from Binance Spot', now, now
  ).run();
}

function authorized(request, env) {
  if (!env.INGEST_TOKEN) return false;
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  return token === env.INGEST_TOKEN;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: JSON_HEADERS });
    }

    const url = new URL(request.url);

    try {
      await ensureSchema(env.DB);

      if (url.pathname === '/api/health' && request.method === 'GET') {
        let db = false;
        try {
          await env.DB.prepare('SELECT 1').first();
          db = true;
        } catch (_) {}

        return json({
          ok: true,
          service: 'oraculum-data-api',
          provider: 'cloudflare-workers',
          database: db ? 'd1' : 'unavailable',
          timestamp: Date.now()
        });
      }

      if (url.pathname === '/api/datasets' && request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT id, name, provider, symbol, kind, interval, currency, description, updated_at FROM datasets ORDER BY name'
        ).all();
        return json({ ok: true, data: result.results || [] });
      }

      const match = url.pathname.match(/^\/api\/datasets\/([^/]+)$/);
      if (match && request.method === 'GET') {
        const id = decodeURIComponent(match[1]);
        const dataset = await env.DB.prepare('SELECT * FROM datasets WHERE id = ?').bind(id).first();
        if (!dataset) return json({ ok: false, error: 'dataset_not_found' }, 404);

        const result = await env.DB.prepare(
          'SELECT timestamp AS t, open AS o, high AS h, low AS l, close AS c, volume AS v FROM candles WHERE dataset_id = ? ORDER BY timestamp'
        ).bind(id).all();

        return json({
          ok: true,
          data: result.results || [],
          meta: {
            datasetId: dataset.id,
            name: dataset.name,
            provider: dataset.provider,
            symbol: dataset.symbol,
            kind: dataset.kind,
            interval: dataset.interval,
            currency: dataset.currency,
            updatedAt: dataset.updated_at
          }
        });
      }

      const rawMatch = url.pathname.match(/^\/api\/datasets\/([^/]+)\/raw$/);
      if (rawMatch && request.method === 'GET') {
        const id = decodeURIComponent(rawMatch[1]);
        const result = await env.DB.prepare(
          `SELECT id, provider, symbol, fetched_at, request_status, row_count,
                  normalized_count, rejected_count, error
           FROM raw_ingestions
           WHERE dataset_id = ?
           ORDER BY fetched_at DESC
           LIMIT 20`
        ).bind(id).all();
        return json({ ok: true, data: result.results || [] });
      }

      const ingestMatch = url.pathname.match(/^\/api\/ingest\/([^/]+)$/);
      if (ingestMatch && request.method === 'POST') {
        if (!authorized(request, env)) {
          return json({ ok: false, error: env.INGEST_TOKEN ? 'unauthorized' : 'ingest_token_not_configured' }, 401);
        }

        const id = decodeURIComponent(ingestMatch[1]);
        const dataset = await env.DB.prepare(
          'SELECT id, provider, symbol, interval FROM datasets WHERE id = ?'
        ).bind(id).first();

        if (!dataset) return json({ ok: false, error: 'dataset_not_found' }, 404);

        return json({ ok: true, data: await ingestDataset(env.DB, dataset) });
      }

      return json({ ok: false, error: 'not_found' }, 404);
    } catch (error) {
      return json({
        ok: false,
        error: 'internal_error',
        message: String(error.message || error)
      }, 500);
    }
  },

  async scheduled(controller, env) {
    await ensureSchema(env.DB);
    const reports = await ingestAll(env.DB);
    console.log(JSON.stringify({
      event: 'scheduled_ingestion',
      cron: controller.cron,
      reports
    }));
  }
};
