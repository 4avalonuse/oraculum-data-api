# Oraculum Data API

Backend único de dados do Oraculum.

## Arquitetura

```
Yahoo ──┐
        ├──> Cloudflare Worker ──> D1
Binance ┘             │
                      ├── RAW
                      └── NORMALIZED
                              │
                              ▼
                            OChart
```

O Worker é o único backend. Providers externos são adaptadores internos; o OChart nunca conversa diretamente com Yahoo ou Binance.

### RAW

Cada ingestão preserva o payload bruto do provider em `raw_ingestions`, junto com horário da coleta, provider, símbolo e contadores de normalização.

### NORMALIZED

As observações válidas são convertidas para o formato canônico do Oraculum e armazenadas em `candles`. Duplicatas são consolidadas por `dataset_id + timestamp`; registros inválidos são descartados da camada normalizada, mas o payload bruto continua preservado.

## Providers

- Yahoo Finance Chart: OHLCV via `/v8/finance/chart/{symbol}`.
- Binance Spot market data: klines via `/api/v3/klines`.

Os adapters ficam em `src/providers/`, mas continuam fazendo parte do mesmo backend.

## API pública

- `GET /api/health` — verifica Worker e D1.
- `GET /api/datasets` — lista datasets.
- `GET /api/datasets/:id` — retorna dados normalizados para o OChart.
- `GET /api/datasets/:id/raw` — retorna histórico de ingestões sem expor o payload bruto.
- `POST /api/ingest/:id` — dispara uma ingestão manual. Requer `Authorization: Bearer <INGEST_TOKEN>`.

## Ingestão automática

O Worker possui um Cron Trigger horário. Em cada execução, ele busca datasets configurados para Yahoo/Binance, preserva o RAW e atualiza a série NORMALIZED.

Cron Triggers são executados em UTC pelo Cloudflare Workers.

## D1

`schema.sql` representa o estado completo esperado do banco. A migration `migrations/0002_raw_ingestion.sql` registra a evolução da tabela RAW.

Durante o deploy, o Worker também cria a tabela `raw_ingestions` de forma idempotente para que a primeira implantação não quebre enquanto a migration ainda não tiver sido aplicada manualmente.

## Regra arquitetural

Providers externos não são a API pública. O OChart conversa com a Data API, e a Data API conversa com Yahoo, Binance, FRED etc.


## Estrutura

```
src/
├── index.js          # entrada do Worker / lifecycle
├── api.js            # rotas HTTP
├── db.js             # bootstrap do D1 e datasets base
├── ingest.js         # orquestração RAW → NORMALIZED
├── normalize.js      # contrato canônico OHLCV
└── providers/
    ├── yahoo.js
    └── binance.js
```

A regra é manter o backend pequeno: `index.js` coordena o ciclo de vida, `api.js` expõe HTTP, `db.js` cuida apenas do bootstrap do banco, e providers nunca vazam para o OChart.
