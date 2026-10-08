// Refresh policy is kept separate from HTTP routing so cooldown rules can
// be reviewed and changed without mixing them into endpoint handlers.

export const REFRESH_COOLDOWN_MS = Object.freeze({
  '1m': 60_000,
  '1h': 15 * 60_000,
  '1d': 60 * 60_000,
  '1w': 6 * 60 * 60_000,
  '1M': 24 * 60 * 60_000
});

const DEFAULT_COOLDOWN_MS = 60 * 60_000;

export function cooldownForInterval(interval) {
  return REFRESH_COOLDOWN_MS[interval] ?? DEFAULT_COOLDOWN_MS;
}

export async function getRecentSuccessfulIngestion(db, datasetId) {
  return db.prepare(
    "SELECT fetched_at FROM raw_ingestions WHERE dataset_id = ? AND request_status = 'ok' ORDER BY fetched_at DESC LIMIT 1"
  ).bind(datasetId).first();
}

export async function getRefreshCooldownState(db, dataset, now = Date.now()) {
  const last = await getRecentSuccessfulIngestion(db, dataset.id);
  const lastFetchedAt = Number(last?.fetched_at);

  if (!Number.isFinite(lastFetchedAt) || lastFetchedAt <= 0) {
    return {
      coolingDown: false,
      lastFetchedAt: null,
      nextRefreshAfterMs: 0
    };
  }

  const remainingMs = Math.max(
    0,
    cooldownForInterval(dataset.interval) - (now - lastFetchedAt)
  );

  return {
    coolingDown: remainingMs > 0,
    lastFetchedAt,
    nextRefreshAfterMs: remainingMs
  };
}
