// Shared freshness rules for each dataset interval.

export const REFRESH_COOLDOWN_MS = Object.freeze({
  '1m': 60_000,
  '1h': 15 * 60_000,
  '1d': 60 * 60_000,
  '1w': 6 * 60 * 60_000,
  '1M': 24 * 60 * 60_000
});

const DEFAULT_COOLDOWN_MS = 60 * 60_000;
export const FAILED_REFRESH_BACKOFF_MS = 5 * 60_000;

export function cooldownForInterval(interval) {
  return REFRESH_COOLDOWN_MS[interval] ?? DEFAULT_COOLDOWN_MS;
}
