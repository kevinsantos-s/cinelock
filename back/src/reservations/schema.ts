import { z } from 'zod';

const seatCode = z.string().regex(/^[A-Z]\d+$/);

// Regra de negócio: no máximo 5 ingressos por compra (anti-cambista, padrão de mercado).
// Fonte da verdade — o front reflete isso, mas quem impede de verdade é o backend.
export const MAX_SEATS_PER_RESERVATION = 5;

export const createReservationSchema = z.object({
  sessionId: z.string().uuid(),
  seats: z.array(seatCode).min(1).max(MAX_SEATS_PER_RESERVATION),
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

// Resposta do lote: o que conseguimos segurar e o que falhou (com o motivo por assento).
export const batchReservationResponseSchema = z.object({
  held: z.array(reservationResponseSchema),
  failed: z.array(
    z.object({
      seat: z.string(),
      reason: z.enum(['invalid-seat', 'seat-taken']),
    }),
  ),
});

export const confirmReservationSchema = z.object({
  sessionId: z.string().uuid(),
  seats: z.array(seatCode).min(1),
  clientId: z.string().uuid(),
});

export const confirmResponseSchema = z.object({
  reservations: z.array(reservationResponseSchema),
});

export const errorSchema = z.object({ message: z.string() });
