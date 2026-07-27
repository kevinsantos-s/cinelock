import { z } from 'zod';

const seatCode = z.string().regex(/^[A-Z]\d+$/);

// Regra de negócio: no máximo 6 ingressos por compra (anti-cambista, padrão de mercado).
// Fonte da verdade — o front reflete isso, mas quem impede de verdade é o backend.
export const MAX_SEATS_PER_RESERVATION = 6;

export const createReservationSchema = z.object({
  sessionId: z.string().uuid(),
  seats: z.array(seatCode).min(1).max(MAX_SEATS_PER_RESERVATION),
  clientId: z.string().uuid(),
});

// Resposta do lote: os assentos que seguramos e os que falharam (com o motivo).
// Só os códigos dos assentos — a reserva no Postgres é gravada async pelo consumer.
export const batchReservationResponseSchema = z.object({
  held: z.array(z.string()),
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
  seats: z.array(z.string()),
});

// Cancelar reusa o mesmo formato de entrada/saída do confirmar.
export const cancelReservationSchema = confirmReservationSchema;
export const cancelResponseSchema = z.object({
  released: z.array(z.string()),
});

export const pendingQuerySchema = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().uuid(),
});
export const pendingResponseSchema = z.object({
  seats: z.array(z.string()),
  expiresAt: z.date().nullable(),
});

export const errorSchema = z.object({ message: z.string() });
