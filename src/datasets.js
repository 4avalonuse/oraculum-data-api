const INTERVALS = ['1m', '1h', '1d', '1w', '1M'];

function buildOhlcvDatasets({ assetId, assetName, provider, symbol, currency, providerLabel }) {
  return INTERVALS.map((interval) => ({
    id: `${assetId}-${provider}-${interval}`,
    name: `${assetName} · ${providerLabel} · ${interval}`,
    provider, symbol, interval, currency, kind: 'ohlcv',
    description: `${assetName} OHLCV from ${providerLabel}`
  }));
}


function buildSyntheticDatasets() {
  return ['A', 'B', 'C'].flatMap((id) => buildOhlcvDatasets({
    assetId: `test-${id.toLowerCase()}`,
    assetName: `TEST-${id} · Dados controlados`,
    provider: 'synthetic',
    symbol: `TEST-${id}`,
    currency: 'USD',
    providerLabel: 'Oraculum Synthetic Lab'
  }));
}

function buildSeriesDataset({ id, name, provider = 'yahoo', symbol, interval = '1d', currency = 'USD', description }) {
  return { id, name, provider, symbol, interval, currency, kind: 'series', description };
}

export const DATASETS = [
  ...buildSyntheticDatasets(),
  ...buildOhlcvDatasets({ assetId: 'btc-usd', assetName: 'Bitcoin / USD', provider: 'yahoo', symbol: 'BTC-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'btc-usd', assetName: 'Bitcoin / USD', provider: 'binance-us', symbol: 'BTCUSD', currency: 'USD', providerLabel: 'Binance.US' }),
  ...buildOhlcvDatasets({ assetId: 'sol-usd', assetName: 'Solana / USD', provider: 'yahoo', symbol: 'SOL-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'render-usd', assetName: 'Render / USD', provider: 'yahoo', symbol: 'RENDER-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'jup-usd', assetName: 'Jupiter / USD', provider: 'yahoo', symbol: 'JUP29210-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'ondo-usd', assetName: 'Ondo / USD', provider: 'yahoo', symbol: 'ONDO-USD', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'mstr-usd', assetName: 'Strategy / USD', provider: 'yahoo', symbol: 'MSTR', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'coin-usd', assetName: 'Coinbase / USD', provider: 'yahoo', symbol: 'COIN', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'nvda-usd', assetName: 'NVIDIA / USD', provider: 'yahoo', symbol: 'NVDA', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'aapl-usd', assetName: 'Apple / USD', provider: 'yahoo', symbol: 'AAPL', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'msft-usd', assetName: 'Microsoft / USD', provider: 'yahoo', symbol: 'MSFT', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'ibit-usd', assetName: 'iShares Bitcoin Trust / USD', provider: 'yahoo', symbol: 'IBIT', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  buildSeriesDataset({ id: 'cpi-us', name: 'Inflação · CPI EUA', provider: 'fred', symbol: 'CPIAUCSL', interval: '1M', currency: 'USD', description: 'Consumer Price Index for All Urban Consumers, All Items, via BLS/FRED. Índice usado como deflator.' }),
  ...buildOhlcvDatasets({ assetId: 'gold-usd', assetName: 'Ouro · USD/oz', provider: 'yahoo', symbol: 'GC=F', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'oil-wti-usd', assetName: 'Petróleo WTI · USD/bbl', provider: 'yahoo', symbol: 'CL=F', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'sp500-usd', assetName: 'S&P 500', provider: 'yahoo', symbol: '^GSPC', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  ...buildOhlcvDatasets({ assetId: 'dxy-usd', assetName: 'Dólar · DXY', provider: 'yahoo', symbol: 'DX-Y.NYB', currency: 'USD', providerLabel: 'Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-13w', name: 'US Treasury 13W', symbol: '^IRX', description: 'US Treasury 13-week yield from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-5y', name: 'US Treasury 5Y', symbol: '^FVX', description: 'US Treasury 5-year yield from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-10y', name: 'US Treasury 10Y', symbol: '^TNX', description: 'US Treasury 10-year yield from Yahoo Finance' }),
  buildSeriesDataset({ id: 'us-treasury-30y', name: 'US Treasury 30Y', symbol: '^TYX', description: 'US Treasury 30-year yield from Yahoo Finance' })
];