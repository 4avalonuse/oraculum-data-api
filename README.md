# Oraculum Data API

Backend de dados do Oraculum.

## Arquitetura inicial

Cloudflare Worker -> D1 -> JSON API -> OChart

O Worker é a camada HTTP e de integração com providers. D1 é o armazenamento estruturado dos datasets.

## Endpoints iniciais

- GET /api/health — verifica Worker e D1.
- GET /api/datasets — lista datasets cadastrados.
- GET /api/datasets/:id — retorna metadados e observações do dataset.

## Próximo passo

Implementar o provider Yahoo e o pipeline de ingestão/normalização. O ID do D1 será configurado no wrangler.toml depois da criação do banco.

## Regra arquitetural

Providers externos não são a API pública. O OChart conversa com a Data API, e a Data API conversa com Yahoo, Binance, FRED etc.
