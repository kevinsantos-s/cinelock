import { prisma } from '../db.js';

const cardFields = {
  id: true,
  title: true,
  duration: true,
  tagline: true,
  posterUrl: true,
  backdropUrl: true,
  genre: true,
  rating: true,
  year: true,
  voteAverage: true,
} as const;

// Vitrine: só filmes que têm pelo menos uma sessão a partir de hoje.
export async function listMovies() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.movie.findMany({
    where: { sessions: { some: { startsAt: { gte: today } } } },
    orderBy: { voteAverage: 'desc' },
    select: cardFields,
  });
}

// Detalhe do filme + suas sessões futuras (o front agrupa por dia).
// Retorna null quando o filme não existe, pra rota traduzir em 404.
export async function getMovieWithSessions(movieId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: {
      ...cardFields,
      synopsis: true,
      sessions: {
        where: { startsAt: { gte: today } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, roomId: true, startsAt: true },
      },
    },
  });

  return movie;
}
