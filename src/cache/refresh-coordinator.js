import { cooldownForInterval, FAILED_REFRESH_BACKOFF_MS } from './refresh-policy.js';

export const REFRESH_LEASE_MS = 120000;

export async function getRefreshState(db, dataset, now = Date.now()) {
  const last = await db.prepare(
    'SELECT fetched_at, request_status FROM raw_ingestions WHERE dataset_id = ? ORDER BY fetched_at DESC, id DESC LIMIT 1'
  ).bind(dataset.id).first();

  const fetchedAt = Number(last?.fetched_at);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    return { coolingDown: false, reason: null, lastFetchedAt: null, nextRefreshAfterMs: 0 };
  }

  const duration = last.request_status === 'ok'
    ? cooldownForInterval(dataset.interval)
    : FAILED_REFRESH_BACKOFF_MS;
  const remaining = Math.max(0, duration - (now - fetchedAt));

  return {
    coolingDown: remaining > 0,
    reason: last.request_status === 'ok' ? 'refresh_cooldown' : 'failure_backoff',
    lastFetchedAt: fetchedAt,
    nextRefreshAfterMs: remaining
  };
}

export async function claimRefreshLease(db, datasetId, now = Date.now()) {
  const result = await db.prepare(
    'INSERT INTO refresh_locks (dataset_id, locked_until) VALUES (?, ?) ON CONFLICT(dataset_id) DO UPDATE SET locked_until = excluded.locked_until WHERE refresh_locks.locked_until <= ?'
  ).bind(datasetId, now + REFRESH_LEASE_MS, now).run();

  return Number(result?.meta?.changes || 0) === 1;
}
