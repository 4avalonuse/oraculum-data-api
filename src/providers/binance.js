const BASE_URLS = [
  'https://api.binance.us/api/v3/klines'
];
const PAGE_SIZE = 1000;
const MAX_INITIAL_BARS = 1000;
const REQUEST_TIMEOUT_MS = 12000;

async function fetchPage(symbol, interval) {
  let lastError = null;

  for (const baseUrl of BASE_URLS) {
    const url = new URL(baseUrl);
    url.searchParams.set('symbol', String(symbol).toUpperCase());
    url.searchParams.set('interval', interval || '1h');
    url.searchParams.set('limit', String(PAGE_SIZE));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });

      const text = await response.text();
      let payload = null;

      try {
        payload = text ? JSON.parse(text) : null;
      } catch (_) {
        const sample = text.replace(/\s+/g, ' ').slice(0, 120);
        lastError = new Error(`binance_invalid_json_http_${response.status}_${sample || 'empty_body'}`);
        continue;
      }

      if (!response.ok) {
        lastError = new Error(`binance_http_${response.status}_${payload?.msg || 'request_failed'}`);
        continue;
      }

      if (!Array.isArray(payload)) {
        lastError = new Error('binance_invalid_payload');
        continue;
      }

      return payload;
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? new Error('binance_request_timeout')
        : error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('binance_unavailable');
}

export async function fetchBinance({ symbol, interval, historyBars = PAGE_SIZE }) {
  const target = Math.min(
    Math.max(Number(historyBars) || PAGE_SIZE, 1),
    MAX_INITIAL_BARS
  );

  const rows = await fetchPage(symbol, interval);

  const raw = rows
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .filter((row, index, arr) => index === 0 || Number(row[0]) !== Number(arr[index - 1][0]))
    .slice(-target);

  return {
    provider: 'binance-us',
    symbol: String(symbol).toUpperCase(),
    currency: 'USD',
    raw,
    rows: raw.map((kline) => ({
      timestamp: Number(kline[0]),
      open: Number(kline[1]),
      high: Number(kline[2]),
      low: Number(kline[3]),
      close: Number(kline[4]),
      volume: Number(kline[5])
    }))
  };
}
