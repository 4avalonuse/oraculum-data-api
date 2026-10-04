const INTERVALS = ['1m', '1h', '1d', '1w', '1M'];

function buildOhlcvDatasets({ assetId, assetName, provider, symbol, currency, providerLabel }) {
  return INTERVALS.map((interval) => ({
    id: `${assetId}-${provider}-${interval}`,
    name: `${assetName} · ${providerLabel} · ${interval}`,
    provider, symbol, interval, currency, kind: 'ohlcv',
    description: `${assetName} OHLCV from ${providerLabel}`
  }));
}

function buildSeriesDataset({ id, name, provider = 'yahoo', symbol, interval = '1d', currency = 'USD', description }) {
  return { id, name, provider, symbol, interval, currency, kind: 'series', description };
}

export const DATASETS = [
  ...buildOhlcvDatasets({ assetId: 'btc-usd', assetName: 'Bitcoin / USD', provider: 'yahoo', symbol: 'BTC-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'btc-usd', assetName: 'Bitcoin / USD', provider: 'binance-us', symbol: 'BTCUSD', currency: 'USD', providerLabel: 'Binance.US' }),
  ...buildOhlcvDatasets({ assetId: 'sol-usd', assetName: 'Solana / USD', provider: 'yahoo', symbol: 'SOL-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'render-usd', assetName: 'Render / USD', provider: 'yahoo', symbol: 'RENDER-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'jup-usd', assetName: 'Jupiter / USD', provider: 'yahoo', symbol: 'JUP-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'ondo-usd', assetName: 'Ondo / USD', provider: 'yahoo', symbol: 'ONDO-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  buildSeriesDataset({ id: 'cpi-us', name: 'Inflação · CPI EUA', provider: 'fred', symbol: 'CPIAUCSL', interval: '1M', currency: 'USD', description: 'Consumer Price Index for All Urban Consumers, All Items, via BLS/FRED. Índice usado como deflator.' }),
  buildSeriesDataset({ id: 'gold-usd', name: 'Ouro · USD/oz', symbol: 'GC=F', description: 'Gold futures from Yahoo Finance' }),
  buildSeriesDataset({ id: 'oil-wti-usd', name: 'Petróleo WTI · USD/bbl', symbol: 'CL=F', description: 'WTI crude oil futures from Yahoo Finance' }),
  buildSeriesDataset({ id: 'sp500-usd', name: 'S&P 500', symbol: '^GSPC', description: 'S&P 500 index from Yahoo Finance' }),
  buildSeriesDataset({ id: 'dxy-usd', name: 'Dólar · DXY', symbol: 'DX-Y.NYB', description: 'US Dollar Index from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-13w', name: 'US Treasury 13W', symbol: '^IRX', description: 'US Treasury 13-week yield from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-5y', name: 'US Treasury 5Y', symbol: '^FVX', description: 'US Treasury 5-year yield from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-10y', name: 'US Treasury 10Y', symbol: '^TNX', description: 'US Treasury 10-year yield from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-30y', name: 'US Treasury 30Y', symbol: '^TYX', description: 'US Treasury 30-year yield from Yahoo Finance' })
];