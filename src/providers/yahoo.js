const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const INTERVALS = { '1m':'1m', '1h':'1h', '1d':'1d', '1w':'1wk', '1M':'1mo' };

function intervalSeconds(interval) {
  const yahooInterval = INTERVALS[interval] || interval || '1d';
  const match = String(yahooInterval).match(/^(\d+)(m|h|d|wk|mo)$/);
  if (!match) return 86400;
  return Number(match[1]) * ({ m:60, h:3600, d:86400, wk:604800, mo:2592000 }[match[2]] || 86400);
}

export function buildYahooChartUrl({ symbol, interval, historyBars = 1000, now = Date.now() }) {
  const yahooInterval = INTERVALS[interval] || interval || '1d';
  const nowSeconds = Math.floor(now / 1000);
  const bars = Math.max(1, Number(historyBars) || 1000);
  const period1 = nowSeconds - intervalSeconds(interval) * bars;
  const period2 = nowSeconds + 60;
  const url = new URL(BASE_URL + '/' + encodeURIComponent(symbol));
  url.searchParams.set('period1', String(period1));
  url.searchParams.set('period2', String(period2));
  url.searchParams.set('interval', yahooInterval);
  url.searchParams.set('events', 'div,splits');
  return url;
}

export async function fetchYahoo({ symbol, interval, historyBars = 1000 }) {
  const url = buildYahooChartUrl({ symbol, interval, historyBars });
  const response = await fetch(url, { headers: { 'User-Agent': 'Oraculum-Data-API/1.0' } });
  const payload = await response.json();
  if (!response.ok) throw new Error('yahoo_http_' + response.status);
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error('yahoo_' + (payload?.chart?.error?.description || 'no_chart_data'));

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
  return { provider:'yahoo', symbol:result.meta?.symbol || symbol, currency:result.meta?.currency || null, raw:payload, rows };
}
