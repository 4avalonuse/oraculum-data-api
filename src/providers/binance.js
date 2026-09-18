const BASE_URLS = [
  'https://api.binance.us/api/v3/klines'
];
const PAGE_SIZE = 1000;
const MAX_INITIAL_BARS = 10000;
const REQUEST_TIMEOUT_MS = 12000;

async function fetchPage(symbol, interval, { endTime = null, startTime = null } = {}) {
  let lastError = null;

  for (const baseUrl of BASE_URLS) {
    const url = new URL(baseUrl);
    url.searchParams.set('symbol', String(symbol).toUpperCase());
    url.searchParams.set('interval', interval || '1h');
    url.searchParams.set('limit', String(PAGE_SIZE));
    if (Number.isFinite(startTime)) url.searchParams.set('startTime', String(startTime));
    if (Number.isFinite(endTime)) url.searchParams.set('endTime', String(endTime));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      console.log(JSON.stringify({
        event: 'provider_request',
        provider: 'binance-us',
        symbol: String(symbol).toUpperCase(),
        interval,
        startTime,
        endTime,
        limit: PAGE_SIZE
      }));

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
        console.error(JSON.stringify({
          event: 'provider_response_error',
          provider: 'binance-us',
          symbol,
          interval,
          httpStatus: response.status,
          error: lastError.message
        }));
        continue;
      }

      if (!response.ok) {
        lastError = new Error(`binance_http_${response.status}_${payload?.msg || 'request_failed'}`);
        console.error(JSON.stringify({
          event: 'provider_response_error',
          provider: 'binance-us',
          symbol,
          interval,
          httpStatus: response.status,
          error: lastError.message
        }));
        continue;
      }

      if (!Array.isArray(payload)) {
        lastError = new Error('binance_invalid_payload');
        continue;
      }

      console.log(JSON.stringify({
        event: 'provider_response_ok',
        provider: 'binance-us',
        symbol: String(symbol).toUpperCase(),
        interval,
        rows: payload.length,
        firstTimestamp: payload.length ? Number(payload[0][0]) : null,
        lastTimestamp: payload.length ? Number(payload[payload.length - 1][0]) : null
      }));

      return payload;
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? new Error('binance_request_timeout')
        : error;
      console.error(JSON.stringify({
        event: 'provider_request_failed',
        provider: 'binance-us',
        symbol,
        interval,
        error: String(lastError?.message || lastError)
      }));
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

  const pages = [];
  let endTime = null;
  while (pages.length < target) {
    const page = await fetchPage(symbol, interval, { endTime });
    if (!page.length) break;
    pages.push(...page);
    if (page.length < PAGE_SIZE) break;

    const oldest = Number(page[0][0]);
    const nextEnd = oldest - 1;
    if (!Number.isFinite(nextEnd) || nextEnd >= (endTime ?? Infinity)) break;
    endTime = nextEnd;
  }

  const raw = pages
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .filter((row, index, arr) => index === 0 || Number(row[0]) !== Number(arr[index - 1][0]))
    .slice(-target);

  console.log(JSON.stringify({
    event: 'binance_history_complete',
    symbol: String(symbol).toUpperCase(),
    interval,
    target,
    pages: pages.length,
    rows: raw.length,
    firstTimestamp: raw.length ? Number(raw[0][0]) : null,
    lastTimestamp: raw.length ? Number(raw[raw.length - 1][0]) : null
  }));

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
