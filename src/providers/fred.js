const BASE_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const HEADERS = { 'User-Agent': 'Oraculum-Data-API/1.0', Accept: 'text/csv' };

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

async function fetchCsv(symbol, startDate, endDate) {
  const url = new URL(BASE_URL);
  url.searchParams.set('id', symbol);
  url.searchParams.set('cosd', startDate);
  url.searchParams.set('coed', endDate);
  const response = await fetch(url, { headers: HEADERS });
  const text = await response.text();
  if (!response.ok) throw new Error('fred_http_' + response.status);
  return text;
}

export async function fetchFred({ symbol, historyBars = 1000 }) {
  const fullHistory = Number(historyBars) >= 10000;
  const today = new Date().toISOString().slice(0, 10);
  let raw;
  let rows;

  if (symbol === 'DCOILWTICO' && fullHistory) {
    // Split the 40-year daily series into five-year requests. Smaller responses
    // are more reliable than one large FRED export and stay within Worker limits.
    const currentYear = new Date().getUTCFullYear();
    const chunks = [];
    const byTimestamp = new Map();
    for (let year = 1986; year <= currentYear; year += 5) {
      const endYear = Math.min(year + 4, currentYear);
      const startDate = `${year}-01-01`;
      const endDate = endYear === currentYear ? today : `${endYear}-12-31`;
      const csv = await fetchCsv(symbol, startDate, endDate);
      chunks.push({ startDate, endDate, csv });
      for (const row of parseCsv(csv)) byTimestamp.set(row.timestamp, row);
    }
    rows = [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
    raw = { source: 'FRED', symbol, chunks };
  } else {
    // The first WTI population is full history; normal refreshes are bounded.
    const startDate = symbol === 'DCOILWTICO'
      ? new Date(Date.now() - 548 * 86400000).toISOString().slice(0, 10)
      : '1900-01-01';
    const csv = await fetchCsv(symbol, startDate, today);
    rows = parseCsv(csv);
    raw = csv;
  }

  if (!rows.length) throw new Error('fred_no_series_data');

  return {
    provider: 'fred',
    symbol,
    currency: 'USD',
    raw,
    rows
  };
}
