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
