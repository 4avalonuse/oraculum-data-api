import { ingestDataset } from './ingest.js';
import { datasetView } from './contract.js';
import { getRecentSuccessfulIngestion, getRefreshCooldownState } from './cache/refresh-policy.js';

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

async function readDataset(db, id) {
  const result = await db.prepare(
    'SELECT timestamp, open, high, low, close, volume FROM candles WHERE dataset_id = ? ORDER BY timestamp'
  ).bind(id).all();
  return result.results || [];
}

async function datasetMeta(db, id) {
  return db.prepare('SELECT * FROM datasets WHERE id = ?').bind(id).first();
}

export async function handleApi(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/health' && request.method === 'GET') {
    let db = false;
    try { await env.DB.prepare('SELECT 1').first(); db = true; } catch (_) {}
    return json({ ok: true, service: 'oraculum-data-api', provider: 'cloudflare-workers', database: db ? 'd1' : 'unavailable', timestamp: Date.now() });
  }

  if (url.pathname === '/api/datasets' && request.method === 'GET') {
    const result = await env.DB.prepare(
      'SELECT id, name, provider, symbol, kind, interval, currency, description, updated_at FROM datasets ORDER BY name'
    ).all();
    return json({ ok: true, data: result.results || [] });
  }

  if (url.pathname === '/api/events' && request.method === 'GET') {
    const result = await env.DB.prepare(
      'SELECT id, timestamp, category, type, title, description, source, importance, asset_ids, metadata, scope FROM events ORDER BY timestamp'
    ).all();

    return json({
      ok: true,
      data: (result.results || []).map(event => ({
        ...event,
        timestamp: Number(event.timestamp),
        importance: event.importance == null ? null : Number(event.importance),
        assetIds: JSON.parse(event.asset_ids || '[]'),
        scope: event.scope || 'asset',
        metadata: JSON.parse(event.metadata || '{}')
      }))
    });
  }

  const match = url.pathname.match(/^\/api\/datasets\/([^/]+)$/);
  if (match && request.method === 'GET') {
    const id = decodeURIComponent(match[1]);
    const dataset = await datasetMeta(env.DB, id);
    if (!dataset) return json({ ok: false, error: 'dataset_not_found' }, 404);
    const rows = await readDataset(env.DB, id);
    return json(datasetView(dataset, rows));
  }

  const refreshMatch = url.pathname.match(/^\/api\/datasets\/([^/]+)\/refresh$/);
  if (refreshMatch && request.method === 'POST') {
    const id = decodeURIComponent(refreshMatch[1]);
    const dataset = await datasetMeta(env.DB, id);
    if (!dataset) return json({ ok: false, error: 'dataset_not_found' }, 404);

    const cachedRows = await readDataset(env.DB, id);
    const cooldown = await getRefreshCooldownState(env.DB, dataset);
    if (cachedRows.length && cooldown.coolingDown) {
      return json({
        ...datasetView(dataset, cachedRows),
        refresh: {
          skipped: true,
          reason: 'refresh_cooldown',
          cached: true,
          lastFetchedAt: cooldown.lastFetchedAt,
          nextRefreshAfterMs: cooldown.nextRefreshAfterMs
        }
      });
    }

    const report = await ingestDataset(env.DB, {
      id: dataset.id, provider: dataset.provider, symbol: dataset.symbol, kind: dataset.kind, interval: dataset.interval
    });
    const freshDataset = await datasetMeta(env.DB, id);
    const rows = await readDataset(env.DB, id);

    return json({ ...datasetView(freshDataset, rows), refresh: report });
  }

  const rawMatch = url.pathname.match(/^\/api\/datasets\/([^/]+)\/raw$/);
  if (rawMatch && request.method === 'GET') {
    const id = decodeURIComponent(rawMatch[1]);
    const result = await env.DB.prepare(
      `SELECT id, provider, symbol, fetched_at, request_status, row_count,
              normalized_count, rejected_count, error
       FROM raw_ingestions WHERE dataset_id = ? ORDER BY fetched_at DESC LIMIT 20`
    ).bind(id).all();
    return json({ ok: true, data: result.results || [] });
  }

  const ingestMatch = url.pathname.match(/^\/api\/ingest\/([^/]+)$/);
  if (ingestMatch && request.method === 'POST') {
    if (!authorized(request, env)) return json({ ok: false, error: env.INGEST_TOKEN ? 'unauthorized' : 'ingest_token_not_configured' }, 401);
    const id = decodeURIComponent(ingestMatch[1]);
    const dataset = await env.DB.prepare('SELECT id, provider, symbol, kind, interval FROM datasets WHERE id = ?').bind(id).first();
    if (!dataset) return json({ ok: false, error: 'dataset_not_found' }, 404);
    return json({ ok: true, data: await ingestDataset(env.DB, dataset) });
  }

  return json({ ok: false, error: 'not_found' }, 404);
}

export { JSON_HEADERS, json };
