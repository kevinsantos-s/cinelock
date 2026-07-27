import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient, ReservationStatus } from '@prisma/client';
import { ALL_SEATS } from '../src/seatMap.js';
import type { TmdbMovie } from './tmdb.js';

const prisma = new PrismaClient();

const SESSION_HOURS = [14, 17, 20];
const DAYS_AHEAD = 3;

function pickRandomSeats(count: number): string[] {
  const shuffled = [...ALL_SEATS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Catálogo congelado (prisma/movies.json) — o site não depende do TMDB pra existir.
// Pra atualizar os dados: npm run refresh-movies (precisa do token).
async function loadMovies(): Promise<TmdbMovie[]> {
  const raw = await readFile(new URL('./movies.json', import.meta.url), 'utf-8');
  return JSON.parse(raw) as TmdbMovie[];
}

async function main(): Promise<void> {
  const movies = await loadMovies();

  await prisma.reservation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.movie.deleteMany();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const [movieIndex, movieData] of movies.entries()) {
    const movie = await prisma.movie.create({ data: movieData });

    for (let day = 0; day < DAYS_AHEAD; day++) {
      for (const hour of SESSION_HOURS) {
        const startsAt = new Date(today);
        startsAt.setDate(startsAt.getDate() + day);
        startsAt.setHours(hour, 0, 0, 0);

        const session = await prisma.session.create({
          data: {
            movieId: movie.id,
            roomId: `sala-${(movieIndex % 6) + 1}`,
            startsAt,
          },
        });

        // 20–30% dos assentos já vendidos, pra planta parecer um cinema real
        const occupiedRatio = 0.2 + Math.random() * 0.1;
        const occupiedCount = Math.round(ALL_SEATS.length * occupiedRatio);
        const occupiedSeats = pickRandomSeats(occupiedCount);

        await prisma.reservation.createMany({
          data: occupiedSeats.map((seat) => ({
            sessionId: session.id,
            seat,
            clientId: randomUUID(),
            status: ReservationStatus.CONFIRMED,
            expiresAt: startsAt,
          })),
        });
      }
    }
  }

  const totals = {
    movies: await prisma.movie.count(),
    sessions: await prisma.session.count(),
    reservations: await prisma.reservation.count(),
  };
  console.log('Seed concluído:', totals);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
