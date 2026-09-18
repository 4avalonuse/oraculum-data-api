import { ingestDataset } from './ingest.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function authorized(request, env) {
  if (!env.INGEST_TOKEN) return false;
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  return token === env.INGEST_TOKEN;
}

export async function handleApi(request, env) {
  const url = new URL(request.url);

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

    // Dataset discovery must stay fast and read-only. Ingestion is triggered
    // only when a specific series is requested or by the scheduled job.
    return json({ ok: true, data: result.results || [] });
  }

  const match = url.pathname.match(/^\/api\/datasets\/([^/]+)$/);
  if (match && request.method === 'GET') {
    const id = decodeURIComponent(match[1]);
    const dataset = await env.DB.prepare('SELECT * FROM datasets WHERE id = ?').bind(id).first();
    if (!dataset) return json({ ok: false, error: 'dataset_not_found' }, 404);

    const existing = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM candles WHERE dataset_id = ?'
    ).bind(id).first();

    const shouldRefresh = url.searchParams.get('refresh') === '1';
    const shouldBootstrap = Number(existing?.count || 0) === 0;

    if (shouldRefresh || shouldBootstrap) {
      const report = await ingestDataset(env.DB, {
        id: dataset.id,
        provider: dataset.provider,
        symbol: dataset.symbol,
        interval: dataset.interval
      });
      console.log(JSON.stringify({ event: shouldRefresh ? 'manual_ingestion' : 'dataset_bootstrap', report }));
    }

    const result = await env.DB.prepare(
      'SELECT timestamp AS t, open AS o, high AS h, low AS l, close AS c, volume AS v FROM candles WHERE dataset_id = ? ORDER BY timestamp'
    ).bind(id).all();

    const freshDataset = await env.DB.prepare('SELECT * FROM datasets WHERE id = ?').bind(id).first();

    return json({
      ok: true,
      data: result.results || [],
      meta: {
        datasetId: freshDataset.id,
        name: freshDataset.name,
        provider: freshDataset.provider,
        symbol: freshDataset.symbol,
        kind: freshDataset.kind,
        interval: freshDataset.interval,
        currency: freshDataset.currency,
        sourceName: freshDataset.provider === 'yahoo' ? 'Yahoo Finance' : freshDataset.provider === 'binance' ? 'Binance' : freshDataset.provider === 'binance-us' ? 'Binance.US' : freshDataset.provider,
        updatedAt: freshDataset.updated_at
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
      return json({
        ok: false,
        error: env.INGEST_TOKEN ? 'unauthorized' : 'ingest_token_not_configured'
      }, 401);
    }

    const id = decodeURIComponent(ingestMatch[1]);
    const dataset = await env.DB.prepare(
      'SELECT id, provider, symbol, interval FROM datasets WHERE id = ?'
    ).bind(id).first();

    if (!dataset) return json({ ok: false, error: 'dataset_not_found' }, 404);
    return json({ ok: true, data: await ingestDataset(env.DB, dataset) });
  }

  return json({ ok: false, error: 'not_found' }, 404);
}

export { JSON_HEADERS, json };
