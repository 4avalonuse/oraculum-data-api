const INTERVALS = ['1m', '1h', '1d', '1w', '1M'];

function buildOhlcvDatasets({ assetId, assetName, provider, symbol, currency, providerLabel }) {
  return INTERVALS.map((interval) => ({
    id: `${assetId}-${provider}-${interval}`,
    name: `${assetName} · ${providerLabel} · ${interval}`,
    provider, symbol, interval, currency, kind: 'ohlcv',
    description: `${assetName} OHLCV from ${providerLabel}`
  }));
}

function buildSeriesDataset({ id, name, symbol, description }) {
  return { id, name, provider: 'yahoo', symbol, interval: '1d', currency: 'USD', kind: 'series', description };
}

export const DATASETS = [
  ...buildOhlcvDatasets({ assetId: 'btc-usd', assetName: 'Bitcoin / USD', provider: 'yahoo', symbol: 'BTC-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'btc-usd', assetName: 'Bitcoin / USD', provider: 'binance-us', symbol: 'BTCUSD', currency: 'USD', providerLabel: 'Binance.US' }),
  ...buildOhlcvDatasets({ assetId: 'sol-usd', assetName: 'Solana / USD', provider: 'yahoo', symbol: 'SOL-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-13w', name: 'US Treasury 13W', symbol: '^IRX', description: 'US Treasury 13-week yield from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-5y', name: 'US Treasury 5Y', symbol: '^FVX', description: 'US Treasury 5-year yield from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-10y', name: 'US Treasury 10Y', symbol: '^TNX', description: 'US Treasury 10-year yield from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-30y', name: 'US Treasury 30Y', symbol: '^TYX', description: 'US Treasury 30-year yield from Yahoo Finance' })
];