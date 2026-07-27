import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  demoErrorSchema,
  demoSessionResponseSchema,
  raceRequestSchema,
  raceResponseSchema,
  resetResponseSchema,
} from './schema.js';
import { getDemoSession, resetDemoSeats, runReservationRace } from './service.js';

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/demo/session',
    {
      schema: {
        tags: ['demo'],
        summary: 'Sessão isolada usada pela demo de concorrência',
        response: { 200: demoSessionResponseSchema },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send(await getDemoSession());
    },
  );

  typedApp.post(
    '/demo/reserve-race',
    {
      // A demo gera carga concorrente de propósito, mas um limite moderado por IP
      // impede que alguém martele o endpoint (cada corrida abre 30 conexões).
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['demo'],
        summary: 'Dispara N tentativas concorrentes no mesmo assento (prova do lock)',
        body: raceRequestSchema,
        response: {
          200: raceResponseSchema,
          400: demoErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { seat, attempts } = request.body;
      try {
        return reply.status(200).send(await runReservationRace(seat, attempts));
      } catch {
        return reply.status(400).send({ message: `Assento ${seat} inválido` });
      }
    },
  );

  typedApp.post(
    '/demo/reset',
    {
      config: { rateLimit: { max: 40, timeWindow: '1 minute' } },
      schema: {
        tags: ['demo'],
        summary: 'Reseta a sala da demo por completo',
        response: { 200: resetResponseSchema },
      },
    },
    async (_request, reply) => {
      await resetDemoSeats();
      return reply.status(200).send({ ok: true });
    },
  );
}
