import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  errorSchema,
  seatsQuerySchema,
  seatsResponseSchema,
  sessionListResponseSchema,
  sessionParamsSchema,
} from './schema.js';
import { getSeatStatuses, listUpcomingSessions } from './service.js';

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/sessions',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Lista as sessões disponíveis (a partir de hoje)',
        response: { 200: sessionListResponseSchema },
      },
    },
    async () => listUpcomingSessions(),
  );

  typedApp.get(
    '/sessions/:id/seats',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Estado atual de todos os assentos da sessão (Redis + Postgres)',
        params: sessionParamsSchema,
        querystring: seatsQuerySchema,
        response: {
          200: seatsResponseSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: sessionId } = request.params;
      const { clientId } = request.query;

      const seats = await getSeatStatuses(sessionId, clientId);
      if (!seats) {
        return reply.status(404).send({ message: 'Sessão não encontrada' });
      }

      return reply.send({ seats });
    },
  );
}
