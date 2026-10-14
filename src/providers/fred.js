const BASE_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

function parseCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const comma = line.indexOf(',');
    if (comma < 0) return null;
    const date = line.slice(0, comma).trim();
    const rawValue = line.slice(comma + 1).trim();
    // FRED uses "." for unavailable observations; never coerce it or an
    // empty field into a numeric zero, because that corrupts returns.
    if (!rawValue || rawValue === '.') return null;
    const timestamp = Date.parse(date + 'T00:00:00Z');
    const numeric = Number(rawValue);
    if (!Number.isFinite(timestamp) || !Number.isFinite(numeric) || numeric <= 0) return null;
    return { timestamp, value: numeric };
  }).filter(Boolean);
}

export async function fetchFred({ symbol, historyBars = 1000 }) {
  const url = new URL(BASE_URL);
  url.searchParams.set('id', symbol);

  // On first population, load the full official WTI spot series from 1986.
  // Routine refreshes fetch a bounded recent window to avoid needless provider
  // traffic. Other FRED datasets keep their configured historical behavior.
  const fullHistory = Number(historyBars) >= 10000;
  const startDate = symbol === 'DCOILWTICO'
    ? (fullHistory ? '1986-01-01' : new Date(Date.now() - 548 * 86400000).toISOString().slice(0, 10))
    : '1900-01-01';
  url.searchParams.set('cosd', startDate);
  url.searchParams.set('coed', new Date().toISOString().slice(0, 10));

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Oraculum-Data-API/1.0', Accept: 'text/csv' }
  });
  const text = await response.text();
  if (!response.ok) throw new Error('fred_http_' + response.status);

  const rows = parseCsv(text);
  if (!rows.length) throw new Error('fred_no_series_data');

  return {
    provider: 'fred',
    symbol,
    currency: 'USD',
    raw: text,
    rows
  };
}
