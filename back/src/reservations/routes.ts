import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  confirmReservationSchema,
  confirmResponseSchema,
  createReservationSchema,
  errorSchema,
  reservationResponseSchema,
} from './schema.js';
import { confirmReservations, reserveSeat } from './service.js';

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
        summary: 'Reserva um assento com lock atômico no Redis (SET NX EX)',
        body: createReservationSchema,
        response: {
          201: reservationResponseSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { sessionId, seat, clientId } = request.body;
      const result = await reserveSeat(sessionId, seat, clientId);

      if (result.ok) {
        return reply.status(201).send(result.reservation);
      }

      if (result.reason === 'invalid-seat') {
        return reply.status(400).send({ message: `Assento ${seat} não existe nesta sala` });
      }
      if (result.reason === 'session-not-found') {
        return reply.status(404).send({ message: 'Sessão não encontrada' });
      }
      return reply.status(409).send({ message: `Assento ${seat} indisponível` });
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
