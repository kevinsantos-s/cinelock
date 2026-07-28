# Cinelock

Sistema de reserva de assentos de cinema construído pra responder uma pergunta difícil de sistemas distribuídos: **como garantir que duas pessoas nunca comprem o mesmo assento, mesmo com dezenas de requisições chegando no mesmo milissegundo?**

## O problema que ele resolve

Em qualquer sistema de venda com estoque disputado (ingressos, passagens, e-commerce em promoção), o cenário crítico é a **corrida**: dois usuários veem o mesmo assento livre e clicam em "reservar" ao mesmo tempo. Sem proteção, os dois recebem "sucesso" — e alguém vai assistir o filme em pé.

O Cinelock resolve: o primeiro request grava a chave e leva o assento; o segundo falha na hora. Não há janela de corrida porque o Redis processa um comando por vez. O resto da arquitetura (Kafka, consumer, Socket.io) existe pra tornar isso escalável e visível em tempo real, sem atrasos.

Dá pra **ver funcionando** na página `/demo/concurrency`: um clique simula 30 pessoas disputando o mesmo assento — exatamente 1 leva, e a resolução acontece em poucos milissegundos.

## Como funciona

```
reservar:   API ─ lock no Redis (SET NX EX) ─ publica no Kafka ─ responde na hora
                                                    │
atrás:                                    consumer lê o evento
                                          ├─ persiste no Postgres (PENDING)
                                          └─ emite seat:reserved via Socket.io
                                             → o assento fica vermelho em todas as telas
```

- **Redis é a autoridade**: quem tem o lock, tem o assento. A API responde sem esperar o banco.
- **Kafka desacopla**: a persistência e o aviso em tempo real acontecem num processo separado (o consumer). A API aguenta pico porque só empilha eventos.
- **Socket.io** mantém todas as telas da mesma sessão sincronizadas: reservou → vermelho na hora; cancelou ou expirou → volta a livre.
- **Expiração automática**: quem reserva tem 5 minutos pra confirmar. O TTL do Redis + keyspace notifications + um job de reconciliação garantem que nenhum assento fica preso.
- **Retomar compra**: caiu a luz no meio do checkout? Voltando dentro do prazo, o site oferece continuar de onde parou, com o tempo restante correto.

## Stack

| Camada | Tecnologia |
|---|---|
| API | Node.js + TypeScript + Fastify + Zod |
| Mensageria | Kafka (KRaft) + kafkajs |
| Tempo real | Socket.io (com Redis adapter entre processos) |
| Lock / cache | Redis (`SET NX EX`) |
| Banco | PostgreSQL + Prisma |
| Front | React + Vite |
| Docs da API | Swagger em `/docs` |

```
cinelock/
├── back/     API + consumer (Fastify, Prisma, Kafka, Socket.io)
├── front/    React + Vite
├── docker-compose.yml        infra: Postgres + Redis + Kafka
└── docker-compose.full.yml   override que sobe também API + consumer + front
```

## Rodando localmente

Pré-requisitos: Docker e Node 22+. **Não precisa de nenhuma chave de API** — o catálogo de filmes vem congelado no repositório.

```bash
git clone <repo> && cd cinelock
docker compose up -d              # Postgres + Redis + Kafka
npm --prefix back install
npm --prefix front install
cp back/.env.example back/.env
npm run db:migrate                # cria as tabelas
npm run db:seed                   # filmes, sessões e assentos pré-ocupados
npm run dev                       # API (3000) + consumer + front (5173) juntos
```

| O quê | Onde |
|---|---|
| Site | http://localhost:5173 |
| Demo de concorrência | http://localhost:5173/demo/concurrency |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/docs |

Os comandos na raiz (`dev`, `db:migrate`, `db:seed`, `lint`, `stress-test`) delegam pro `back/`.

### Alternativa: tudo containerizado

Sobe a aplicação inteira (infra + API + consumer + front) sem instalar nada além do Docker:

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.full.yml --profile seed run --rm seed
```

Site em http://localhost:8080. As migrations rodam sozinhas; o seed popula o catálogo.

## Testando a concorrência na prática

**Pelo navegador:** abra a mesma sessão em duas abas, reserve um assento numa — ele fica vermelho na outra instantaneamente. Ou use a página `/demo/concurrency`, que dispara 30 tentativas simultâneas no mesmo assento e mostra quem venceu.

**Pelo terminal:** o stress test dispara 30 `POST /reservations` paralelos pro mesmo assento e confere que **exatamente 1** consegue:

```bash
RATE_LIMIT_ENABLED=false npm --prefix back run dev
```

```bash
npm run stress-test
```

## Regras de negócio

- Máximo de **6 ingressos por compra** (validado no backend).
- Reserva segura o assento por **5 minutos**; sem confirmação, libera sozinho.
- Cancelar no checkout libera os assentos **na hora** pra outros compradores.
- Rate limiting por IP (Redis como store, compartilhado entre instâncias).

## Créditos

Dados e pôsteres dos filmes via [TMDB](https://www.themoviedb.org/) (snapshot local — o site não depende da API deles pra funcionar).
