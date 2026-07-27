import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { publish } from '../kafka.js';
import { emitSeatReleased } from '../realtimeEmitter.js';
import { redis } from '../redis.js';
import { RESERVATION_TOPIC, type ReservationEvent } from '../reservations/events.js';
import { RESERVATION_TTL_SECONDS } from '../reservations/service.js';
import { ALL_SEATS, isValidSeat, seatLockKey } from '../seatMap.js';

const DEMO_ROOM = 'Sala Demo';

export type DemoSession = {
  id: string;
  roomId: string;
  startsAt: Date;
  movie: { id: string; title: string; duration: number };
};

export type RaceAttempt = { attempt: number; won: boolean };

export type RaceResult = {
  seat: string;
  attempts: number;
  winners: number;
  durationMs: number;
  results: RaceAttempt[];
};

const sessionSelect = {
  id: true,
  roomId: true,
  startsAt: true,
  movie: { select: { id: true, title: true, duration: true } },
} as const;

let cachedDemoSessionId: string | null = null;

// Sessão isolada só pra demo (fica no passado, então não aparece no catálogo).
// Como é dedicada, dá pra "resetar tudo" sem tocar em reservas de verdade.
export async function getDemoSession(): Promise<DemoSession> {
  if (cachedDemoSessionId) {
    const cached = await prisma.session.findUnique({
      where: { id: cachedDemoSessionId },
      select: sessionSelect,
    });
    if (cached) return cached;
    cachedDemoSessionId = null;
  }

  const existing = await prisma.session.findFirst({
    where: { roomId: DEMO_ROOM },
    select: sessionSelect,
  });
  if (existing) {
    cachedDemoSessionId = existing.id;
    return existing;
  }

  const movie = await prisma.movie.findFirst({ select: { id: true } });
  if (!movie) {
    throw new Error('Sem filmes no banco para criar a sessão de demo (rode o seed).');
  }
  const created = await prisma.session.create({
    data: { movieId: movie.id, roomId: DEMO_ROOM, startsAt: new Date('2000-01-01T00:00:00Z') },
    select: sessionSelect,
  });
  cachedDemoSessionId = created.id;
  return created;
}

// Zera a sala da demo por completo: solta todos os locks e apaga todas as reservas
// (inclusive confirmadas — é uma sessão dedicada), avisando as telas.
async function clearDemoSession(sessionId: string): Promise<void> {
  await Promise.all(ALL_SEATS.map((seat) => redis.del(seatLockKey(sessionId, seat))));
  await prisma.reservation.deleteMany({ where: { sessionId } });
  emitSeatReleased(sessionId, ALL_SEATS);
}

export async function resetDemoSeats(): Promise<void> {
  const session = await getDemoSession();
  await clearDemoSession(session.id);
}

// Simula N pessoas disputando o mesmo assento ao mesmo tempo. Cada tentativa usa
// uma CONEXÃO INDEPENDENTE — elas chegam de verdade em paralelo e quem vence varia.
// O SET NX atômico garante que exatamente uma leva o assento.
export async function runReservationRace(seat: string, attempts: number): Promise<RaceResult> {
  if (!isValidSeat(seat)) {
    throw new Error(`Assento ${seat} inválido`);
  }
  const session = await getDemoSession();

  const lockKey = seatLockKey(session.id, seat);
  // Libera só o assento alvo (os outros continuam reservados — a sala vai "enchendo"
  // conforme você testa cadeiras diferentes). O reset limpa tudo quando quiser.
  await redis.del(lockKey);
  await prisma.reservation.deleteMany({ where: { sessionId: session.id, seat } });
  const clients = Array.from(
    { length: attempts },
    () => new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }),
  );

  try {
    // Conecta todos antes de largar, pra a corrida medir o SET, não o handshake.
    await Promise.all(clients.map((client) => client.connect()));

    const startedAt = performance.now();
    const results = await Promise.all(
      clients.map(async (client, index) => {
        const clientId = randomUUID();
        const acquired = await client.set(lockKey, clientId, 'EX', RESERVATION_TTL_SECONDS, 'NX');
        return { attempt: index + 1, won: acquired === 'OK', clientId };
      }),
    );
    const durationMs = performance.now() - startedAt;

    const winner = results.find((result) => result.won);
    if (winner) {
      const event: ReservationEvent = {
        type: 'created',
        eventId: randomUUID(),
        sessionId: session.id,
        clientId: winner.clientId,
        seats: [seat],
        expiresAt: new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000).toISOString(),
      };
      await publish(RESERVATION_TOPIC, session.id, event);
    }

    return {
      seat,
      attempts,
      winners: results.filter((result) => result.won).length,
      durationMs,
      results: results.map(({ attempt, won }) => ({ attempt, won })),
    };
  } finally {
    await Promise.all(clients.map((client) => client.quit().catch(() => undefined)));
  }
}
