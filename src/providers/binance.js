const BASE_URL = 'https://data-api.binance.vision/api/v3/klines';

export async function fetchBinance({ symbol, interval }) {
  const url = new URL(BASE_URL);
  url.searchParams.set('symbol', String(symbol).toUpperCase());
  url.searchParams.set('interval', interval || '1h');
  url.searchParams.set('limit', '1000');

  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`binance_http_${response.status}_${payload?.msg || 'request_failed'}`);
  }

  if (!Array.isArray(payload)) {
    throw new Error('binance_invalid_payload');
  }

  const rows = payload.map((kline) => ({
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
    currency: null,
    raw: payload,
    rows
  };
}
