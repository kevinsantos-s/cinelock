import { z } from 'zod';

// Endpoints da demo não recebem sessionId — operam sempre na sessão dedicada,
// pra ninguém conseguir rodar a corrida ou o reset numa sessão real.
export const raceRequestSchema = z.object({
  seat: z.string().regex(/^[A-Z]\d+$/),
  attempts: z.number().int().min(2).max(50).default(30),
});

export const raceResponseSchema = z.object({
  seat: z.string(),
  attempts: z.number(),
  winners: z.number(),
  durationMs: z.number(),
  results: z.array(
    z.object({
      attempt: z.number(),
      won: z.boolean(),
    }),
  ),
});

export const demoSessionResponseSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string(),
  startsAt: z.date(),
  movie: z.object({
    id: z.string().uuid(),
    title: z.string(),
    duration: z.number(),
  }),
});

export const resetResponseSchema = z.object({ ok: z.boolean() });

export const demoErrorSchema = z.object({ message: z.string() });
