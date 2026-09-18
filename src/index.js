const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: JSON_HEADERS });
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);

    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      let db = false;
      try { await env.DB.prepare('SELECT 1').first(); db = true; } catch (_) {}
      return json({
        ok: true,
        service: 'oraculum-data-api',
        provider: 'cloudflare-workers',
        database: db ? 'd1' : 'unavailable',
        timestamp: Date.now()
      });
    }

    if (url.pathname === '/api/datasets') {
      const result = await env.DB.prepare(
        'SELECT id, name, provider, symbol, kind, interval, currency, description, updated_at FROM datasets ORDER BY name'
      ).all();
      return json({ ok: true, data: result.results || [] });
    }

    const match = url.pathname.match(/^\/api\/datasets\/([^/]+)$/);
    if (match) {
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

    return json({ ok: false, error: 'not_found' }, 404);
  }
};
