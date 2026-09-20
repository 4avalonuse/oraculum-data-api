const INTERVALS = ['1m', '1h', '1d', '1w', '1M'];

function buildOhlcvDatasets({
  assetId,
  assetName,
  provider,
  symbol,
  currency,
  providerLabel,
  descriptionLabel
}) {
  return INTERVALS.map((interval) => ({
    id: `${assetId}-${provider}-${interval}`,
    name: `${assetName} · ${providerLabel} · ${interval}`,
    provider,
    symbol,
    interval,
    currency,
    description: `${assetName} ${descriptionLabel} OHLCV from ${providerLabel}`
  }));
}

export const DATASETS = [
  ...buildOhlcvDatasets({
    assetId: 'btc-usd',
    assetName: 'Bitcoin / USD',
    provider: 'yahoo',
    symbol: 'BTC-USD',
    currency: 'USD',
    providerLabel: 'Yahoo Finance',
    descriptionLabel: 'OHLCV'
  }),
  ...buildOhlcvDatasets({
    assetId: 'btc-usd',
    assetName: 'Bitcoin / USD',
    provider: 'binance-us',
    symbol: 'BTCUSD',
    currency: 'USD',
    providerLabel: 'Binance.US',
    descriptionLabel: 'OHLCV'
  })
];
