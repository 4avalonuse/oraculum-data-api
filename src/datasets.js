const INTERVALS = ['1m', '1h', '1d', '1w', '1M'];

function buildOhlcvDatasets({
  assetId,
  assetName,
  provider,
  symbol,
  currency,
  providerLabel
}) {
  return INTERVALS.map((interval) => ({
    id: `${assetId}-${provider}-${interval}`,
    name: `${assetName} · ${providerLabel} · ${interval}`,
    provider,
    symbol,
    interval,
    currency,
    description: `${assetName} OHLCV from ${providerLabel}`
  }));
}

export const DATASETS = [
  ...buildOhlcvDatasets({
    assetId: 'btc-usd',
    assetName: 'Bitcoin / USD',
    provider: 'yahoo',
    symbol: 'BTC-USD',
    currency: 'USD',
    providerLabel: 'Yahoo Finance'
  }),
  ...buildOhlcvDatasets({
    assetId: 'btc-usd',
    assetName: 'Bitcoin / USD',
    provider: 'binance-us',
    symbol: 'BTCUSD',
    currency: 'USD',
    providerLabel: 'Binance.US'
  }),
  ...buildOhlcvDatasets({
    assetId: 'sol-usd',
    assetName: 'Solana / USD',
    provider: 'yahoo',
    symbol: 'SOL-USD',
    currency: 'USD',
    providerLabel: 'Yahoo Finance'
  })
];
