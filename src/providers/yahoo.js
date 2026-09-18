const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

function intervalSeconds(interval) {
  const match = String(interval || '1d').match(/^(\\d+)(m|h|d|wk|mo)$/);
  if (!match) return 86400;
  const n = Number(match[1]);
  const unit = match[2];
  return n * ({ m: 60, h: 3600, d: 86400, wk: 604800, mo: 2592000 }[unit] || 86400);
}

export async function fetchYahoo({ symbol, interval }) {
  const now = Math.floor(Date.now() / 1000);
  const lookback = intervalSeconds(interval) * 1000;
  const period1 = now - lookback;
  const period2 = now + 60;

  const url = new URL(`${BASE_URL}/${encodeURIComponent(symbol)}`);
  url.searchParams.set('period1', String(period1));
  url.searchParams.set('period2', String(period2));
  url.searchParams.set('interval', interval || '1d');
  url.searchParams.set('events', 'div,splits');

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Oraculum-Data-API/1.0' }
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`yahoo_http_${response.status}`);
  }

  const result = payload?.chart?.result?.[0];
  if (!result) {
    const description = payload?.chart?.error?.description || 'no_chart_data';
    throw new Error(`yahoo_${description}`);
  }

  const quote = result?.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const rows = timestamps.map((timestamp, i) => ({
    timestamp: Number(timestamp) * 1000,
    open: quote.open?.[i],
    high: quote.high?.[i],
    low: quote.low?.[i],
    close: quote.close?.[i],
    volume: quote.volume?.[i] ?? 0
  }));

  return {
    provider: 'yahoo',
    symbol: result.meta?.symbol || symbol,
    currency: result.meta?.currency || null,
    raw: payload,
    rows
  };
}
