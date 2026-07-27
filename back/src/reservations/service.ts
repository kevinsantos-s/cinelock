import { randomUUID } from 'node:crypto';
import { prisma } from '../db.js';
import { publish } from '../kafka.js';
import { redis } from '../redis.js';
import { isValidSeat, seatLockKey } from '../seatMap.js';
import { RESERVATION_TOPIC, type ReservationEvent } from './events.js';

export const RESERVATION_TTL_SECONDS = 300;

// Reservas ainda seguradas (PENDING, não vencidas) do cliente numa sessão — usado
// pra "retomar compra" quando ele volta (ex.: fechou a aba, caiu a luz). Só assentos
// não confirmados; os já comprados (CONFIRMED) não entram.
export async function getPendingReservation(
  sessionId: string,
  clientId: string,
): Promise<{ seats: string[]; expiresAt: Date | null }> {
  const pending = await prisma.reservation.findMany({
    where: { sessionId, clientId, status: 'PENDING', expiresAt: { gt: new Date() } },
    select: { seat: true, expiresAt: true },
    orderBy: { expiresAt: 'asc' },
  });
  const first = pending[0];
  if (!first) {
    return { seats: [], expiresAt: null };
  }
  return { seats: pending.map((reservation) => reservation.seat), expiresAt: first.expiresAt };
}

export type SeatFailure = { seat: string; reason: 'invalid-seat' | 'seat-taken' };

export type ReserveSeatsResult =
  | { ok: false; reason: 'session-not-found' }
  | { ok: true; held: string[]; failed: SeatFailure[] };

// Reserva um lote de assentos. Pega o lock no Redis (autoridade instantânea) e
// publica o evento no Kafka — a gravação durável no Postgres e o aviso em tempo
// real ficam a cargo do consumer. A rota responde sem esperar o banco.
export async function reserveSeats(
  sessionId: string,
  seats: string[],
  clientId: string,
): Promise<ReserveSeatsResult> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return { ok: false, reason: 'session-not-found' };
  }

  const held: string[] = [];
  const failed: SeatFailure[] = [];

  // Sem duplicatas: se o cliente mandar o mesmo assento duas vezes, conta uma.
  for (const seat of new Set(seats)) {
    const result = await holdSeat(sessionId, seat, clientId);
    if (result.ok) held.push(seat);
    else failed.push({ seat, reason: result.reason });
  }

  if (held.length > 0) {
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000).toISOString();
    const event: ReservationEvent = {
      type: 'created',
      eventId: randomUUID(),
      sessionId,
      clientId,
      seats: held,
      expiresAt,
    };
    try {
      await publish(RESERVATION_TOPIC, sessionId, event);
    } catch (error) {
      // Sem evento registrado, liberamos os locks pra não prender assento por 5 min.
      await Promise.all(held.map((seat) => redis.del(seatLockKey(sessionId, seat))));
      throw error;
    }
  }

  return { ok: true, held, failed };
}

type HoldSeatResult = { ok: true } | { ok: false; reason: 'invalid-seat' | 'seat-taken' };

// Segura um único assento no Redis (assume a sessão já validada). O coração da
// concorrência: só grava se a chave não existir, com TTL de 5 minutos. Dois
// requests simultâneos → o Redis processa um por vez, o segundo falha no NX.
async function holdSeat(
  sessionId: string,
  seat: string,
  clientId: string,
): Promise<HoldSeatResult> {
  if (!isValidSeat(seat)) {
    return { ok: false, reason: 'invalid-seat' };
  }

  const alreadySold = await prisma.reservation.findUnique({
    where: { sessionId_seat_status: { sessionId, seat, status: 'CONFIRMED' } },
  });
  if (alreadySold) {
    return { ok: false, reason: 'seat-taken' };
  }

  const lockAcquired = await redis.set(
    seatLockKey(sessionId, seat),
    clientId,
    'EX',
    RESERVATION_TTL_SECONDS,
    'NX',
  );
  if (lockAcquired !== 'OK') {
    return { ok: false, reason: 'seat-taken' };
  }

  return { ok: true };
}

export type ConfirmResult =
  | { ok: true; seats: string[] }
  | { ok: false; reason: 'session-not-found' | 'nothing-pending' };

// Segundo passo do fluxo: confirmar os assentos segurados. A autoridade é o lock
// no Redis — só confirma assentos cujo lock ainda pertence a este cliente, sem
// depender do PENDING no Postgres (que é gravado de forma assíncrona pelo consumer).
// Publica o evento; o consumer faz a transição PENDING → CONFIRMED.
export async function confirmReservations(
  sessionId: string,
  seats: string[],
  clientId: string,
): Promise<ConfirmResult> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return { ok: false, reason: 'session-not-found' };
  }

  const owned: string[] = [];
  for (const seat of new Set(seats)) {
    const lockOwner = await redis.get(seatLockKey(sessionId, seat));
    if (lockOwner === clientId) owned.push(seat);
  }
  if (owned.length === 0) {
    return { ok: false, reason: 'nothing-pending' };
  }

  const event: ReservationEvent = {
    type: 'confirmed',
    eventId: randomUUID(),
    sessionId,
    clientId,
    seats: owned,
  };
  await publish(RESERVATION_TOPIC, sessionId, event);

  return { ok: true, seats: owned };
}

// Cancelamento explícito (o cliente desistiu antes de confirmar). Valida a posse
// pelo lock no Redis e publica o evento; o consumer solta os locks, marca como
// EXPIRED e avisa as telas em tempo real.
export async function cancelReservations(
  sessionId: string,
  seats: string[],
  clientId: string,
): Promise<string[]> {
  const owned: string[] = [];
  for (const seat of new Set(seats)) {
    const lockOwner = await redis.get(seatLockKey(sessionId, seat));
    if (lockOwner === clientId) owned.push(seat);
  }
  if (owned.length === 0) return [];

  const event: ReservationEvent = {
    type: 'cancelled',
    eventId: randomUUID(),
    sessionId,
    clientId,
    seats: owned,
  };
  await publish(RESERVATION_TOPIC, sessionId, event);

  return owned;
}
