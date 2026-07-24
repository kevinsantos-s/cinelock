import { PrismaClient, ReservationStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ALL_SEATS } from '../src/seatMap.js';
import { fetchMovies } from './tmdb.js';

const prisma = new PrismaClient();

// 15 filmes reconhecíveis pra vitrine parecer um cinema de verdade.
// Os dados (pôster, sinopse, duração, gênero, classificação) vêm do TMDB.
const MOVIE_TITLES = [
  'Duna: Parte Dois',
  'Oppenheimer',
  'Interestelar',
  'A Origem',
  'Parasita',
  'O Poderoso Chefão',
  'Cidade de Deus',
  'Coringa',
  'Vingadores: Ultimato',
  'Homem-Aranha: Através do Aranhaverso',
  'Pulp Fiction: Tempo de Violência',
  'Clube da Luta',
  'Matrix',
  'O Senhor dos Anéis: A Sociedade do Anel',
  'Divertida Mente 2',
] as const;

const SESSION_HOURS = [14, 17, 20];
const DAYS_AHEAD = 3;

function pickRandomSeats(count: number): string[] {
  const shuffled = [...ALL_SEATS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function main(): Promise<void> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    throw new Error('TMDB_READ_TOKEN ausente no .env — necessário pra popular o catálogo.');
  }

  console.log('Buscando filmes no TMDB...');
  const movies = await fetchMovies(MOVIE_TITLES, token);

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
