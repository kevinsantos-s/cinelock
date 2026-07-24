import type { Reservation } from '@prisma/client';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { isValidSeat, seatLockKey } from '../seatMap.js';

export const RESERVATION_TTL_SECONDS = 300;

export type ReserveSeatResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: 'invalid-seat' | 'session-not-found' | 'seat-taken' };

export async function reserveSeat(
  sessionId: string,
  seat: string,
  clientId: string,
): Promise<ReserveSeatResult> {
  if (!isValidSeat(seat)) {
    return { ok: false, reason: 'invalid-seat' };
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return { ok: false, reason: 'session-not-found' };
  }

  const confirmedReservation = await prisma.reservation.findUnique({
    where: { sessionId_seat_status: { sessionId, seat, status: 'CONFIRMED' } },
  });
  if (confirmedReservation) {
    return { ok: false, reason: 'seat-taken' };
  }

  // Coração da concorrência: só grava se a chave não existir, com TTL de 5 minutos.
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
