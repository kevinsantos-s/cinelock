# Cinelock

Sistema de reserva de assentos de cinema focado em **concorrência distribuída**: dois usuários nunca reservam o mesmo assento, mesmo com dezenas de requisições simultâneas. O lock é um único comando atômico no Redis (`SET NX EX`).

## Estrutura

```
cinelock/
├── back/     API Fastify + Prisma + Redis + Kafka (API + consumer)
├── front/    React + Vite (frontend)
├── docker-compose.yml        infra: Postgres + Redis + Kafka
└── docker-compose.full.yml   override que sobe também API + consumer + front
```

## Stack

- **API:** Node.js + TypeScript + Fastify + Zod (`back/`)
- **Banco:** PostgreSQL (Prisma)
- **Lock/Cache:** Redis (`SET NX EX 300`)
- **Docs:** Swagger em `/docs`
- **Front:** React + Vite (`front/`)

## Rodando local

```bash
docker compose up -d          # Postgres + Redis
npm --prefix back install
npm --prefix front install
npm run db:migrate            # cria as tabelas
npm run db:seed               # filmes, sessões e assentos pré-ocupados
npm run dev                   # sobe API (3000) + front (5173) juntos
```

- Front: http://localhost:5173
- API: http://localhost:3000
- Swagger: http://localhost:3000/docs

Os comandos na raiz (`dev`, `db:migrate`, `db:seed`, `lint`, `stress-test`) delegam pro `back/`.

## Rodar tudo com Docker (API + consumer + front + infra)

Sobe a aplicação inteira containerizada — infra (Postgres, Redis, Kafka) **mais** API, consumer e front num comando só:

```bash
cp back/.env.example back/.env     # preencha o TMDB_READ_TOKEN
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.full.yml --profile seed run --rm seed
```

- Front: http://localhost:8080
- API: http://localhost:3000

As migrations rodam sozinhas (serviço `migrate`); o `seed` popula o catálogo (precisa do token do TMDB). No dia a dia de desenvolvimento continua valendo o modo acima (`docker compose up -d` só da infra + `npm run dev`).

## Testando a concorrência

O `POST /reservations` tem rate limit apertado (10/min). Pro stress test de 30 requests não tomar `429`, suba a API com o limite desligado:

```bash
RATE_LIMIT_ENABLED=false npm --prefix back run dev
```

Em outro terminal:

```bash
npm run stress-test
```

Dispara 30 `POST /reservations` simultâneos pro mesmo assento. Resultado esperado: **1 sucesso, 29 conflitos (409)** — o `SET NX` do Redis garante que só o primeiro request cria o lock.

## Como funciona a reserva

1. Selecionar assento é só feedback visual — não trava nada.
2. Clicar em **Reservar** executa `SET seat:{sessionId}:{seat} {clientId} NX EX 300` no Redis.
3. Se a chave já existe, a API responde `409` na hora.
4. Se o lock foi criado, a reserva é persistida como `PENDING` com expiração em 5 minutos.
5. Sem confirmação no prazo, o TTL do Redis libera o assento automaticamente.

A constraint `@@unique([sessionId, seat, status])` no Postgres é a última linha de defesa caso algo escape do Redis.

## Roadmap

- [x] Fase 1 — MVP: lock no Redis, rate limiting, Swagger, stress test, front básico
- [x] Fase 2 — Kafka (KRaft) + Socket.io em tempo real + expiração via keyspace notifications
- [x] Fase 3 — Docker Compose completo (API, consumer, front)
- [ ] Fase 4 — Deploy em VPS com Nginx + HTTPS
