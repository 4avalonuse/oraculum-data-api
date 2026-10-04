const BASE_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

function parseCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const comma = line.indexOf(',');
    if (comma < 0) return null;
    const date = line.slice(0, comma).trim();
    const value = line.slice(comma + 1).trim();
    const timestamp = Date.parse(date + 'T00:00:00Z');
    const numeric = Number(value);
    if (!Number.isFinite(timestamp) || !Number.isFinite(numeric)) return null;
    return { timestamp, value: numeric };
  }).filter(Boolean);
}

export async function fetchFred({ symbol }) {
  const url = new URL(BASE_URL);
  url.searchParams.set('id', symbol);
  url.searchParams.set('cosd', '1900-01-01');
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
