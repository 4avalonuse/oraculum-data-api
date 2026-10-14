const BASE_URL = 'https://xaus.com/api/v1';

function utcDay(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export async function fetchXaus({ symbol = 'XAUUSD' }) {
  if (symbol !== 'XAUUSD') throw new Error('xaus_unsupported_symbol');

  const headers = { 'User-Agent': 'Oraculum-Data-API/1.0', Accept: 'application/json' };
  const [historyResponse, spotResponse] = await Promise.all([
    fetch(new URL(BASE_URL + '/history'), { headers }),
    fetch(new URL(BASE_URL + '/spot?compact=1'), { headers })
  ]);

  const historyText = await historyResponse.text();
  const spotText = await spotResponse.text();
  if (!historyResponse.ok) throw new Error('xaus_history_http_' + historyResponse.status);
  if (!spotResponse.ok) throw new Error('xaus_spot_http_' + spotResponse.status);

  let history;
  let spot;
  try {
    history = JSON.parse(historyText);
    spot = JSON.parse(spotText);
  } catch {
    throw new Error('xaus_invalid_json');
  }

  const historyPoints = Array.isArray(history.points) ? history.points : [];
  const historyStart = utcDay(Date.now() - 548 * 86400000);
  const byDay = new Map();
  for (const point of historyPoints) {
    const timestamp = utcDay(point.d);
    const value = Number(point.c);
    if (timestamp && timestamp >= historyStart && Number.isFinite(value) && value > 0) {
      byDay.set(timestamp, { timestamp, value });
    }
  }

  const spotValue = Number(spot.spot_usd_oz ?? spot.xau?.price);
  const spotState = spot.data_state?.status;
  const spotAge = Number(spot.data_state?.age_seconds);
  if (Number.isFinite(spotValue) && spotValue > 0 &&
      spotState !== 'unavailable' && (!Number.isFinite(spotAge) || spotAge <= 86400)) {
    const today = utcDay(new Date());
    byDay.set(today, { timestamp: today, value: spotValue });
  }

  const rows = [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp);
  if (rows.length < 30) throw new Error('xaus_insufficient_history');
  if (rows.at(-1).timestamp < utcDay(new Date()) - 2 * 86400000) {
    throw new Error('xaus_stale_history');
  }

  return {
    provider: 'xaus',
    symbol: 'XAUUSD',
    currency: 'USD',
    raw: { history, spot },
    rows
  };
}
