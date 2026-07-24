import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  errorSchema,
  movieDetailResponseSchema,
  movieListResponseSchema,
  movieParamsSchema,
} from './schema.js';
import { getMovieWithSessions, listMovies } from './service.js';

export async function movieRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/movies',
    {
      schema: {
        tags: ['movies'],
        summary: 'Vitrine: filmes em cartaz (com sessões a partir de hoje)',
        response: { 200: movieListResponseSchema },
      },
    },
    async () => listMovies(),
  );

  typedApp.get(
    '/movies/:id',
    {
      schema: {
        tags: ['movies'],
        summary: 'Detalhe do filme + sessões futuras',
        params: movieParamsSchema,
        response: {
          200: movieDetailResponseSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const movie = await getMovieWithSessions(request.params.id);
      if (!movie) {
        return reply.status(404).send({ message: 'Filme não encontrado' });
      }
      return reply.send(movie);
    },
  );
}
