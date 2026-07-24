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

export const confirmReservationSchema = z.object({
  sessionId: z.string().uuid(),
  seats: z.array(z.string().regex(/^[A-Z]\d+$/)).min(1),
  clientId: z.string().uuid(),
});

export const confirmResponseSchema = z.object({
  reservations: z.array(reservationResponseSchema),
});

export const errorSchema = z.object({ message: z.string() });
