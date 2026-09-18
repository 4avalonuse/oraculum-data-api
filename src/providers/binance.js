const BASE_URL = 'https://data-api.binance.vision/api/v3/klines';
const PAGE_SIZE = 1000;
const MAX_INITIAL_BARS = 9000;

function intervalMs(interval) {
  const units = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  const match = String(interval || '1h').match(/^(\\d+)([mhdw])$/i);
  if (!match) return 3600000;
  return Number(match[1]) * (units[match[2].toLowerCase()] || units.h);
}

async function fetchPage(symbol, interval, startTime) {
  const url = new URL(BASE_URL);
  url.searchParams.set('symbol', String(symbol).toUpperCase());
  url.searchParams.set('interval', interval || '1h');
  url.searchParams.set('limit', String(PAGE_SIZE));
  if (Number.isFinite(startTime)) url.searchParams.set('startTime', String(startTime));

  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`binance_http_${response.status}_${payload?.msg || 'request_failed'}`);
  }

  if (!Array.isArray(payload)) {
    throw new Error('binance_invalid_payload');
  }

  return payload;
}

export async function fetchBinance({ symbol, interval, historyBars = PAGE_SIZE }) {
  const target = Math.min(Math.max(Number(historyBars) || PAGE_SIZE, PAGE_SIZE), MAX_INITIAL_BARS);
  const step = intervalMs(interval);
  const now = Date.now();
  let startTime = now - ((target - 1) * step);
  const pages = [];
  let remaining = target;

  while (remaining > 0) {
    const page = await fetchPage(symbol, interval, startTime);
    if (!page.length) break;

    pages.push(...page);
    const lastOpen = Number(page.at(-1)?.[0]);
    if (!Number.isFinite(lastOpen)) break;

    remaining -= page.length;
    if (page.length < PAGE_SIZE || remaining <= 0) break;

    startTime = lastOpen + step;
  }

  const raw = pages
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .filter((row, index, arr) => index === 0 || Number(row[0]) !== Number(arr[index - 1][0]))
    .slice(-target);

  const rows = raw.map((kline) => ({
    timestamp: Number(kline[0]),
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
    volume: Number(kline[5])
  }));

  return {
    provider: 'binance',
    symbol: String(symbol).toUpperCase(),
    currency: 'USDT',
    raw,
    rows
  };
}
