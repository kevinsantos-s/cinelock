import { z } from 'zod';

export const RESERVATION_TOPIC = 'reservation.events';

const seatList = z.array(z.string());

// Contrato dos eventos que trafegam no Kafka. O consumer valida toda mensagem
// recebida contra este schema — mensagem malformada é descartada, não confiada.
export const reservationEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('created'),
    eventId: z.string().uuid(),
    sessionId: z.string().uuid(),
    clientId: z.string().uuid(),
    seats: seatList,
    expiresAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('confirmed'),
    eventId: z.string().uuid(),
    sessionId: z.string().uuid(),
    clientId: z.string().uuid(),
    seats: seatList,
  }),
  z.object({
    type: z.literal('expired'),
    eventId: z.string().uuid(),
    sessionId: z.string().uuid(),
    seats: seatList,
  }),
  z.object({
    type: z.literal('cancelled'),
    eventId: z.string().uuid(),
    sessionId: z.string().uuid(),
    clientId: z.string().uuid(),
    seats: seatList,
  }),
]);

export type ReservationEvent = z.infer<typeof reservationEventSchema>;
