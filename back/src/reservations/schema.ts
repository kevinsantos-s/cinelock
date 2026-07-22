import { z } from 'zod';

export const createReservationSchema = z.object({
  sessionId: z.string().uuid(),
  seat: z.string().regex(/^[A-Z]\d+$/),
  clientId: z.string().uuid(),
});

export const reservationResponseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  seat: z.string(),
  clientId: z.string().uuid(),
  status: z.enum(['PENDING', 'CONFIRMED', 'EXPIRED']),
  expiresAt: z.date(),
});

export const errorSchema = z.object({ message: z.string() });
