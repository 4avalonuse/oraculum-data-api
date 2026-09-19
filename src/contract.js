export function toApiCandle(row) {
  return {
    t: Number(row.timestamp),
    o: Number(row.open),
    h: Number(row.high),
    l: Number(row.low),
    c: Number(row.close),
    v: Number(row.volume ?? 0)
  };
}

export function datasetView(meta, rows) {
  return {
    ok: true,
    data: rows.map(toApiCandle),
    meta: {
      datasetId: meta.id,
      name: meta.name,
      provider: meta.provider,
      symbol: meta.symbol,
      kind: meta.kind,
      interval: meta.interval,
      currency: meta.currency,
      sourceName: meta.provider === 'yahoo'
        ? 'Yahoo Finance'
        : meta.provider === 'binance'
          ? 'Binance'
          : meta.provider === 'binance-us'
            ? 'Binance.US'
            : meta.provider,
      updatedAt: meta.updated_at
    }
  };
}
