import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { ALL_SEATS, seatLockKey } from '../seatMap.js';

export async function listUpcomingSessions() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.session.findMany({
    where: { startsAt: { gte: today } },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      roomId: true,
      startsAt: true,
      movie: { select: { id: true, title: true, duration: true } },
    },
  });
}

export type SeatStatus = {
  seat: string;
  status: 'available' | 'reserved';
  mine: boolean;
};

// Retorna null quando a sessão não existe, pra rota traduzir em 404.
export async function getSeatStatuses(
  sessionId: string,
  clientId: string | undefined,
): Promise<SeatStatus[] | null> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return null;
  }

  const confirmedReservations = await prisma.reservation.findMany({
    where: { sessionId, status: 'CONFIRMED' },
    select: { seat: true, clientId: true },
  });
  const confirmedBySeat = new Map(
    confirmedReservations.map((reservation) => [reservation.seat, reservation.clientId]),
  );

  // Locks ativos no Redis (reservas pendentes dentro dos 5 minutos)
  const lockValues = await redis.mget(ALL_SEATS.map((seat) => seatLockKey(sessionId, seat)));

  return ALL_SEATS.map((seat, index) => {
    const confirmedClientId = confirmedBySeat.get(seat);
    const lockClientId = lockValues[index];
    const ownerClientId = confirmedClientId ?? lockClientId ?? null;

    return {
      seat,
      status: ownerClientId ? ('reserved' as const) : ('available' as const),
      mine: clientId !== undefined && ownerClientId === clientId,
    };
  });
}
