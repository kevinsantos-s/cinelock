import type { Reservation } from '@prisma/client';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { isValidSeat, seatLockKey } from '../seatMap.js';

export const RESERVATION_TTL_SECONDS = 300;

export type SeatFailure = { seat: string; reason: 'invalid-seat' | 'seat-taken' };

export type ReserveSeatsResult =
  | { ok: false; reason: 'session-not-found' }
  | { ok: true; held: Reservation[]; failed: SeatFailure[] };

export async function reserveSeats(
  sessionId: string,
  seats: string[],
  clientId: string,
): Promise<ReserveSeatsResult> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return { ok: false, reason: 'session-not-found' };
  }

  const held: Reservation[] = [];
  const failed: SeatFailure[] = [];

  for (const seat of new Set(seats)) {
    const result = await holdSeat(sessionId, seat, clientId);
    if (result.ok) held.push(result.reservation);
    else failed.push({ seat, reason: result.reason });
  }

  return { ok: true, held, failed };
}

type HoldSeatResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: 'invalid-seat' | 'seat-taken' };

async function holdSeat(
  sessionId: string,
  seat: string,
  clientId: string,
): Promise<HoldSeatResult> {
  if (!isValidSeat(seat)) {
    return { ok: false, reason: 'invalid-seat' };
  }

  const confirmedReservation = await prisma.reservation.findUnique({
    where: { sessionId_seat_status: { sessionId, seat, status: 'CONFIRMED' } },
  });
  if (confirmedReservation) {
    return { ok: false, reason: 'seat-taken' };
  }

  // Só grava se a chave não existir, com TTL de 5 minutos.
  // Dois requests simultâneos → o Redis processa um por vez, o segundo falha no NX.
  const lockKey = seatLockKey(sessionId, seat);
  const lockAcquired = await redis.set(lockKey, clientId, 'EX', RESERVATION_TTL_SECONDS, 'NX');
  if (lockAcquired !== 'OK') {
    return { ok: false, reason: 'seat-taken' };
  }

  const expiresAt = new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000);
  try {
    const reservation = await prisma.reservation.create({
      data: { sessionId, seat, clientId, status: 'PENDING', expiresAt },
    });
    return { ok: true, reservation };
  } catch (error) {
    // Se o banco recusar (ex.: @@unique), libera o lock pra não prender o assento
    await redis.del(lockKey);
    throw error;
  }
}

export type ConfirmResult =
  | { ok: true; reservations: Reservation[] }
  | { ok: false; reason: 'session-not-found' | 'nothing-pending' };

// Segundo passo do fluxo: o cliente tem 5 minutos pra confirmar os assentos que
// segurou (PENDING). Confirmar troca pra CONFIRMED — aí o assento fica vendido de
// vez, e não depende mais do TTL do lock no Redis.
export async function confirmReservations(
  sessionId: string,
  seats: string[],
  clientId: string,
): Promise<ConfirmResult> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return { ok: false, reason: 'session-not-found' };
  }

  const pending = await prisma.reservation.findMany({
    where: { sessionId, seat: { in: seats }, clientId, status: 'PENDING' },
  });
  if (pending.length === 0) {
    return { ok: false, reason: 'nothing-pending' };
  }

  const reservations: Reservation[] = [];
  for (const held of pending) {
    const confirmed = await prisma.reservation.update({
      where: { id: held.id },
      data: { status: 'CONFIRMED' },
    });
    // O lock cumpriu seu papel; o CONFIRMED no Postgres passa a ser a fonte da verdade.
    // Deixamos o TTL no Redis expirar sozinho — não há corrida a proteger mais.
    reservations.push(confirmed);
  }

  return { ok: true, reservations };
}
