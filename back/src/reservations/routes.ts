import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  batchReservationResponseSchema,
  confirmReservationSchema,
  confirmResponseSchema,
  createReservationSchema,
  errorSchema,
} from './schema.js';
import { confirmReservations, reserveSeats } from './service.js';

export async function reservationRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/reservations',
    {
      config: {
      
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['reservations'],
        summary: 'Reserva um lote de assentos com lock atômico no Redis (SET NX EX)',
        body: createReservationSchema,
        response: {
          200: batchReservationResponseSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { sessionId, seats, clientId } = request.body;
      const result = await reserveSeats(sessionId, seats, clientId);

      if (!result.ok) {
        return reply.status(404).send({ message: 'Sessão não encontrada' });
      }

      // 200 mesmo com falhas parciais: o corpo detalha o que foi segurado e o que não.
      return reply.status(200).send({ held: result.held, failed: result.failed });
    },
  );

  typedApp.post(
    '/reservations/confirm',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['reservations'],
        summary: 'Confirma os assentos segurados (PENDING → CONFIRMED)',
        body: confirmReservationSchema,
        response: {
          200: confirmResponseSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { sessionId, seats, clientId } = request.body;
      const result = await confirmReservations(sessionId, seats, clientId);

      if (result.ok) {
        return reply.status(200).send({ reservations: result.reservations });
      }

      if (result.reason === 'session-not-found') {
        return reply.status(404).send({ message: 'Sessão não encontrada' });
      }
      return reply.status(409).send({
        message: 'Nenhuma reserva pendente encontrada — o tempo pode ter expirado.',
      });
    },
  );
}
