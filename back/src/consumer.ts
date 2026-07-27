import { randomUUID } from 'node:crypto';
import { prisma } from './db.js';
import { createConsumer, publish } from './kafka.js';
import { emitSeatReleased, emitSeatReserved } from './realtimeEmitter.js';
import { redis } from './redis.js';
import { parseSeatLockKey, seatLockKey } from './seatMap.js';
import { RESERVATION_TOPIC, reservationEventSchema, type ReservationEvent } from './reservations/events.js';

const RECONCILE_INTERVAL_MS = 30000;

async function handleEvent(event: ReservationEvent): Promise<void> {
  if (event.type === 'created') {
    // Idempotente: reprocessar o mesmo evento não duplica graças ao skipDuplicates
    // + @@unique(sessionId, seat, status). Kafka entrega "pelo menos uma vez".
    await prisma.reservation.createMany({
      data: event.seats.map((seat) => ({
        sessionId: event.sessionId,
        seat,
        clientId: event.clientId,
        status: 'PENDING' as const,
        expiresAt: new Date(event.expiresAt),
      })),
      skipDuplicates: true,
    });
    emitSeatReserved(event.sessionId, event.seats);
    return;
  }

  if (event.type === 'confirmed') {
    // PENDING → CONFIRMED. Idempotente: se já confirmou, nada a atualizar.
    await prisma.reservation.updateMany({
      where: {
        sessionId: event.sessionId,
        seat: { in: event.seats },
        clientId: event.clientId,
        status: 'PENDING',
      },
      data: { status: 'CONFIRMED' },
    });
    return;
  }

  if (event.type === 'cancelled') {
    // Cliente desistiu antes de confirmar: solta os locks e apaga os PENDING dele,
    // liberando os assentos na hora pras outras telas. Apagar (em vez de marcar
    // EXPIRED) evita colidir com a @@unique(sessionId, seat, status).
    await Promise.all(event.seats.map((seat) => redis.del(seatLockKey(event.sessionId, seat))));
    await prisma.reservation.deleteMany({
      where: {
        sessionId: event.sessionId,
        seat: { in: event.seats },
        clientId: event.clientId,
        status: 'PENDING',
      },
    });
    emitSeatReleased(event.sessionId, event.seats);
    return;
  }

  // expired: libera só o que ainda era PENDING e venceu — um assento já CONFIRMED
  // (vendido) nunca é solto, mesmo quando o lock dele expira no Redis.
  const stale = await prisma.reservation.findMany({
    where: {
      sessionId: event.sessionId,
      seat: { in: event.seats },
      status: 'PENDING',
      expiresAt: { lte: new Date() },
    },
    select: { seat: true },
  });
  if (stale.length === 0) return;

  const releasedSeats = stale.map((reservation) => reservation.seat);
  await prisma.reservation.deleteMany({
    where: { sessionId: event.sessionId, seat: { in: releasedSeats }, status: 'PENDING' },
  });
  emitSeatReleased(event.sessionId, releasedSeats);
}

async function publishExpired(sessionId: string, seats: string[]): Promise<void> {
  const event: ReservationEvent = { type: 'expired', eventId: randomUUID(), sessionId, seats };
  await publish(RESERVATION_TOPIC, sessionId, event);
}

// Caminho rápido: o Redis avisa quando um lock expira (keyspace notification).
// Entregue "uma vez só", sem confirmação — por isso existe a reconciliação abaixo.
async function startExpirationListener(): Promise<void> {
  await redis.config('SET', 'notify-keyspace-events', 'Ex');
  const subscriber = redis.duplicate();
  await subscriber.subscribe('__keyevent@0__:expired');
  subscriber.on('message', (_channel, expiredKey) => {
    const parsed = parseSeatLockKey(expiredKey);
    if (!parsed) return;
    publishExpired(parsed.sessionId, [parsed.seat]).catch((error: unknown) => console.error(error));
  });
}

// Rede de segurança: varre o Postgres atrás de PENDING vencidos que a notificação
// do Redis possa ter perdido, garantindo que nenhum assento fique preso pra sempre.
async function reconcileExpired(): Promise<void> {
  const stale = await prisma.reservation.findMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    select: { sessionId: true, seat: true },
  });
  if (stale.length === 0) return;

  const seatsBySession = new Map<string, string[]>();
  for (const reservation of stale) {
    const seats = seatsBySession.get(reservation.sessionId) ?? [];
    seats.push(reservation.seat);
    seatsBySession.set(reservation.sessionId, seats);
  }
  for (const [sessionId, seats] of seatsBySession) {
    await publishExpired(sessionId, seats);
  }
}

async function main(): Promise<void> {
  const consumer = createConsumer('reservation-persister');
  await consumer.connect();
  await consumer.subscribe({ topic: RESERVATION_TOPIC, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const parsed = reservationEventSchema.safeParse(JSON.parse(message.value.toString()));
      if (!parsed.success) return;
      try {
        await handleEvent(parsed.data);
      } catch (error) {
        // Loga e segue: uma mensagem problemática não pode travar o consumer inteiro
        // (senão o offset nunca avança e o pipeline inteiro para — "poison message").
        console.error('Falha ao processar evento, pulando:', error);
      }
    },
  });

  await startExpirationListener();
  setInterval(() => {
    reconcileExpired().catch((error: unknown) => console.error(error));
  }, RECONCILE_INTERVAL_MS);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
